import { describe, expect, it } from "vitest";
import { type InputModel, buildCalldata, getCalldataInputModels } from "@ethereum-sourcify/clear-signing/builder";
import { type AbiEntry, type Fn, type FormValue, emptyValue, encodeCall } from "../abi";
import { crossCheck, toSdkValues } from "./crossCheck";
import {
  AAVE_GATEWAY,
  ABIS,
  FORMATS,
  SEPOLIA_WETH,
  SWAP_ROUTER,
  USDC,
  USDT,
  WETH,
  functionOf,
  functionsOf,
  resolverOptions,
} from "./fixtures";
import { type LinkedItem, linkModel, linkModels, paramAt, tokenAddressOf, valueAt, withValueAt } from "./link";
import { parseSignature } from "./signature";

const modelsOf = async (chainId: number, address: string, standard?: "erc20" | "erc721") =>
  (
    await getCalldataInputModels(chainId, address, {
      descriptorResolverOptions: {
        ...resolverOptions,
        ...(standard ? { trustedTokens: { [chainId]: { [address]: standard } } } : {}),
      },
    })
  ).models ?? [];

const inputs = (items: LinkedItem[]) =>
  items.flatMap((item) => (item.kind === "input" ? [item] : item.kind === "group" ? inputsOfGroup(item.items) : []));
const inputsOfGroup = (items: LinkedItem[]): Array<Extract<LinkedItem, { kind: "input" }>> => inputs(items);
const SPENDER = "0x1234567890abcdef1234567890abcdef12345678";

describe("linkModels", () => {
  it("links the USDT descriptor to an ABI with other argument names, by position", async () => {
    const linked = linkModels(await modelsOf(1, USDT), functionsOf(ABIS.token));
    // The descriptor covers transfer and approve; the other functions keep the ABI form
    expect([...linked.keys()].sort()).toEqual(["own:approve(address,uint256)", "own:transfer(address,uint256)"]);
    const approve = linked.get("own:approve(address,uint256)")!;
    expect(approve.intent).toBe("Approve");
    expect(inputs(approve.items).map((item) => [item.presentation.label, item.steps, item.param.name])).toEqual([
      ["Spender", [0], "spender"],
      ["Amount", [1], "amount"],
    ]);
    const amount = inputs(approve.items)[1].presentation;
    expect(amount.format).toBe("tokenAmount");
    expect(amount.token).toEqual({ kind: "contract" });
    expect(amount.threshold).toBe("0x8000000000000000000000000000000000000000000000000000000000000000");
    // The order is the order of the descriptor: transfer shows the amount first
    const transfer = linked.get("own:transfer(address,uint256)")!;
    expect(inputs(transfer.items).map((item) => item.presentation.label)).toEqual(["Amount", "To"]);
  });

  it("links fields inside a struct, and a token that is another input", async () => {
    const fn = functionOf(ABIS.router, "exactInputSingle");
    const linked = linkModels(await modelsOf(1, SWAP_ROUTER), [fn]).get(fn.id)!;
    const items = inputs(linked.items);
    // The inputs that hold a token address come first: the amounts need them. The rest keeps the descriptor's order.
    expect(items.map((item) => [item.presentation.label, item.steps])).toEqual([
      ["tokenIn", [0, 0]],
      ["tokenOut", [0, 1]],
      ["Send", [0, 4]],
      ["Minimum to Receive", [0, 5]],
      ["Uniswap fee", [0, 2]],
      ["Beneficiary", [0, 3]],
      ["Price Limit", [0, 6]],
    ]);
    expect(items[2].presentation.token).toEqual({ kind: "input", steps: [0, 0] });
    expect(items[4].presentation).toMatchObject({ format: "unit", decimals: 4, base: "%" });
    // Inputs that the descriptor does not describe keep the name of the ABI
    expect(items[0].presentation.described).toBe(false);
    // The descriptor has no field for the value of this payable function
    expect(linked.hasValue).toBe(false);

    const values: FormValue[] = [[WETH, USDC, "3000", SPENDER, "1", "0", "0"]];
    expect(tokenAddressOf(items[2].presentation, values, SWAP_ROUTER)).toBe(WETH.toLowerCase());
    expect(tokenAddressOf(items[3].presentation, values, SWAP_ROUTER)).toBe(USDC.toLowerCase());
    expect(tokenAddressOf(items[2].presentation, [["", USDC, "", "", "", "", ""]], SWAP_ROUTER)).toBeNull();
  });

  it("finds a token that is the first or last element of a list", async () => {
    const fn = functionOf(ABIS.router, "swapExactTokensForTokens");
    const linked = linkModels(await modelsOf(1, SWAP_ROUTER), [fn]).get(fn.id)!;
    const items = inputs(linked.items);
    expect(items.map((item) => [item.presentation.label, item.steps, item.param.type])).toEqual([
      // The list that holds the token addresses comes first
      ["path", [2], "address[]"],
      ["Amount to Send", [0], "uint256"],
      ["Minimum to Receive", [1], "uint256"],
      ["Recipient", [3], "address"],
    ]);
    const values: FormValue[] = ["1", "0", [WETH, USDT, USDC], SPENDER];
    expect(tokenAddressOf(items[1].presentation, values, SWAP_ROUTER)).toBe(WETH.toLowerCase());
    expect(tokenAddressOf(items[2].presentation, values, SWAP_ROUTER)).toBe(USDC.toLowerCase());
    expect(tokenAddressOf(items[2].presentation, ["1", "0", [], SPENDER], SWAP_ROUTER)).toBeNull();
  });

  it("links the native value, hidden fields, and the native currency as a token", async () => {
    const models = await modelsOf(1, AAVE_GATEWAY);
    const deposit = functionOf(ABIS.gateway, "depositETH");
    const linked = linkModels(models, [deposit]).get(deposit.id)!;
    expect(linked.intent).toBe("Supply");
    expect(linked.hasValue).toBe(true);
    expect(linked.items[0]).toMatchObject({ kind: "value", presentation: { label: "Amount to supply" } });
    // Fields that a wallet hides are normal inputs here: the function needs their values
    expect(inputs(linked.items).map((item) => [item.presentation.label, item.steps])).toEqual([
      ["Collateral recipient", [1]],
      ["Referral Code", [2]],
      ["Pool", [0]],
    ]);
    const repay = functionOf(ABIS.gateway, "repayETH");
    const amount = inputs(linkModels(models, [repay]).get(repay.id)!.items)[0].presentation;
    expect(amount.message).toBe("All");
    expect(tokenAddressOf(amount, ["", "", ""], AAVE_GATEWAY)).toBe("native");
  });

  it("links a function without arguments", async () => {
    const linked = linkModels(await modelsOf(11155111, SEPOLIA_WETH), functionsOf(ABIS.weth));
    expect(linked.get("own:deposit()")).toMatchObject({ intent: "Wrap", hasValue: true });
    expect(linked.get("own:withdraw(uint256)")!.items).toHaveLength(1);
  });

  it("makes a list one input, with the descriptor's labels inside each element", async () => {
    const fn = functionOf(ABIS.formats, "schedule");
    const linked = linkModels(await modelsOf(1, FORMATS), [fn]).get(fn.id)!;
    const items = inputs(linked.items);
    expect(items.map((item) => [item.presentation.label, item.steps])).toEqual([
      ["Start date", [0]],
      ["Lock time", [1]],
      ["Rate", [2]],
      ["Interest mode", [3]],
      ["At block", [4]],
      ["orders", [5]],
    ]);
    expect(items[3].presentation.options).toEqual({ "0": "Stable", "1": "Variable" });
    expect(items[4].presentation.encoding).toBe("blockheight");
    const overlay = items[5].overlay!;
    expect([...overlay.keys()].sort()).toEqual(["[].0", "[].1"]);
    expect(overlay.get("[].1")).toMatchObject({ label: "Order amount", format: "tokenAmount", token: null });
    expect(overlay.get("[].0")).toMatchObject({ label: "Order token" });
  });

  it("uses the generic templates for a token without a descriptor", async () => {
    const token = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
    const linked = linkModels(await modelsOf(11155111, token, "erc20"), functionsOf(ABIS.token));
    expect([...linked.values()].map((link) => link.intent).sort()).toEqual(["Approve", "Send"]);
    expect(await modelsOf(11155111, token)).toEqual([]);
  });

  it("gives no link if the model does not fit the function", () => {
    const fn = functionOf(ABIS.token, "approve");
    const model = (signature: string, fields: InputModel["fields"]): InputModel => ({
      signature,
      selector: fn.selector,
      fields,
    });
    const spender = { label: "Spender", path: "_spender", type: "address" };
    const value = { label: "Amount", path: "_value", type: "uint256" };
    expect(linkModel(model("approve(address _spender, uint256 _value)", [spender, value]), fn)).not.toBeNull();
    // Other types (a selector collision or a wrong descriptor)
    expect(linkModel(model("approve(address _spender, uint128 _value)", [spender, value]), fn)).toBeNull();
    // An input that the model does not show: the form could not be filled
    expect(linkModel(model("approve(address _spender, uint256 _value)", [spender]), fn)).toBeNull();
    // The same input twice
    expect(linkModel(model("approve(address _spender, uint256 _value)", [spender, value, value]), fn)).toBeNull();
    // A path that names nothing, and names that are not unique
    expect(
      linkModel(model("approve(address _spender, uint256 _value)", [spender, { ...value, path: "nope" }]), fn)
    ).toBeNull();
    expect(linkModel(model("approve(address a, uint256 a)", [spender, value]), fn)).toBeNull();
    expect(linkModel(model("not a signature", [spender, value]), fn)).toBeNull();
  });
});

describe("value access", () => {
  const fn = functionOf(ABIS.router, "exactInputSingle");
  it("reads and replaces a value at its steps", () => {
    const values = fn.inputs.map(emptyValue);
    const next = withValueAt(values, [0, 4], "1000");
    expect(valueAt(next, [0, 4])).toBe("1000");
    expect(valueAt(values, [0, 4])).toBe("");
    expect(valueAt(next, [0, 0])).toBe("");
    expect(valueAt(["1", ["a", "b"]], [1, { index: -1 }])).toBe("b");
    expect(valueAt(["1", []], [1, { index: 0 }])).toBeUndefined();
    expect(paramAt(fn.inputs, [0, 4])!.name).toBe("amountIn");
    expect(paramAt(functionOf(ABIS.formats, "schedule").inputs, [5, "[]", 1])!.name).toBe("amount");
    expect(paramAt(fn.inputs, [3])).toBeNull();
  });
});

describe("the two encoders", () => {
  const cases: Array<{ name: string; chainId: number; address: string; fn: Fn; values: FormValue[] }> = [
    {
      name: "USDT approve",
      chainId: 1,
      address: USDT,
      fn: functionOf(ABIS.token, "approve"),
      values: [SPENDER, "1500000"],
    },
    {
      name: "exactInputSingle (a struct)",
      chainId: 1,
      address: SWAP_ROUTER,
      fn: functionOf(ABIS.router, "exactInputSingle"),
      values: [[WETH, USDC, "3000", SPENDER, "1000000000000000", "0", "0"]],
    },
    {
      name: "swapExactTokensForTokens (a list)",
      chainId: 1,
      address: SWAP_ROUTER,
      fn: functionOf(ABIS.router, "swapExactTokensForTokens"),
      values: ["1000000", "0x0", [WETH, USDT, USDC], SPENDER],
    },
    {
      name: "depositETH",
      chainId: 1,
      address: AAVE_GATEWAY,
      fn: functionOf(ABIS.gateway, "depositETH"),
      values: ["0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", SPENDER, "0"],
    },
    { name: "deposit()", chainId: 11155111, address: SEPOLIA_WETH, fn: functionOf(ABIS.weth, "deposit"), values: [] },
    {
      name: "schedule (a list of structs)",
      chainId: 1,
      address: FORMATS,
      fn: functionOf(ABIS.formats, "schedule"),
      values: [
        "1795687200",
        "5400",
        "250",
        "1",
        "21000000",
        [
          [USDT, "1500000"],
          [USDC, "7"],
        ],
      ],
    },
  ];

  for (const { name, chainId, address, fn, values } of cases) {
    it(`give the same calldata: ${name}`, async () => {
      const linked = linkModels(await modelsOf(chainId, address), [fn]).get(fn.id)!;
      const calldata = encodeCall(fn, values)!;
      expect(crossCheck(linked.model, linked.inputs, fn.inputs, values, calldata, buildCalldata)).toEqual({ ok: true });
    });
  }

  it("uses the descriptor's names for the SDK, also for arguments without a name", async () => {
    const fn = functionOf(ABIS.token, "approve");
    const linked = linkModels(await modelsOf(1, USDT), [fn]).get(fn.id)!;
    expect(toSdkValues(linked.inputs, fn.inputs, [SPENDER, "5"])).toEqual({ _spender: SPENDER, _value: "5" });
    // depositETH: the verified ABI has no name for the first argument; the descriptor calls it `pool`
    const deposit = functionOf(ABIS.gateway, "depositETH");
    const gateway = linkModels(await modelsOf(1, AAVE_GATEWAY), [deposit]).get(deposit.id)!;
    expect(Object.keys(toSdkValues(gateway.inputs, deposit.inputs, ["", "", ""]))).toEqual([
      "pool",
      "onBehalfOf",
      "referralCode",
    ]);
  });

  it("catches a descriptor that writes `uint` for `uint256`", () => {
    // SDK 0.4.0 takes the selector from the text of the signature as it is: for `f(uint amount)` it gives the
    // selector of "f(uint)", not of "f(uint256)". The model of such a descriptor then matches no function (no
    // clear signing form). If it ever did, the two encoders would disagree, and nothing would be sent.
    const abi = [{ type: "function", name: "f", inputs: [{ type: "uint256", name: "amount" }], outputs: [] }];
    const fn = functionsOf(abi)[0];
    const model: InputModel = { signature: "f(uint amount)", selector: fn.selector, fields: [] };
    const link = linkModel({ ...model, fields: [{ label: "amount", path: "amount", type: "uint256" }] }, fn)!;
    const calldata = encodeCall(fn, ["1"])!;
    expect(crossCheck(model, link.inputs, fn.inputs, ["1"], calldata, buildCalldata)).toEqual({
      ok: false,
      detail: "the calldata of the two encoders is different",
    });
    expect(
      crossCheck({ ...model, signature: "f(uint256 amount)" }, link.inputs, fn.inputs, ["1"], calldata, buildCalldata)
    ).toEqual({ ok: true });
  });

  it("gives the same calldata for nested lists, fixed lists, and arguments without a name", () => {
    const id = `0x${"ab".repeat(32)}`;
    const cases: Array<[string, AbiEntry["inputs"], FormValue[]]> = [
      [
        "f(uint256[2] pair, int256 delta, bool flag, string note, bytes4 sel, bytes data, address[] list)",
        [
          { type: "uint256[2]", name: "pair" },
          { type: "int256", name: "delta" },
          { type: "bool", name: "flag" },
          { type: "string", name: "note" },
          { type: "bytes4", name: "sel" },
          { type: "bytes", name: "data" },
          { type: "address[]", name: "list" },
        ],
        [["1", "2"], "-5", true, "héllo", "0x12345678", "", []],
      ],
      [
        "g((address, uint256 x) y, uint256)",
        [
          {
            type: "tuple",
            name: "y",
            components: [
              { type: "address", name: "" },
              { type: "uint256", name: "x" },
            ],
          },
          { type: "uint256", name: "" },
        ],
        [[SPENDER, "7"], "9"],
      ],
      [
        "h(uint256 amount, (uint8 kind, (bytes32 id, int24 tick)[] items)[2] groups)",
        [
          { type: "uint256", name: "amount" },
          {
            type: "tuple[2]",
            name: "groups",
            components: [
              { type: "uint8", name: "kind" },
              {
                type: "tuple[]",
                name: "items",
                components: [
                  { type: "bytes32", name: "id" },
                  { type: "int24", name: "tick" },
                ],
              },
            ],
          },
        ],
        [
          "0x10",
          [
            ["1", [[id, "-100"]]],
            ["2", []],
          ],
        ],
      ],
    ];
    for (const [signature, inputs, values] of cases) {
      const fn = functionsOf([{ type: "function", name: signature[0], inputs, outputs: [] }])[0];
      const parsed = parseSignature(signature)!;
      const check = crossCheck(
        { signature, selector: fn.selector, fields: [] },
        parsed.inputs,
        fn.inputs,
        values,
        encodeCall(fn, values)!,
        buildCalldata
      );
      expect(check, signature).toEqual({ ok: true });
    }
  });

  it("reports different calldata, and values that the SDK refuses", async () => {
    const fn = functionOf(ABIS.token, "approve");
    const linked = linkModels(await modelsOf(1, USDT), [fn]).get(fn.id)!;
    const values: FormValue[] = [SPENDER, "1500000"];
    const calldata = encodeCall(fn, values)!;
    const check = (build: Parameters<typeof crossCheck>[5], data = calldata) =>
      crossCheck(linked.model, linked.inputs, fn.inputs, values, data, build);
    expect(check(() => ({ data: calldata.slice(0, -1) + "1" }))).toEqual({
      ok: false,
      detail: "the calldata of the two encoders is different",
    });
    expect(check(buildCalldata, calldata.slice(0, -2) + "00")).toMatchObject({ ok: false });
    expect(check(() => ({ errors: [{ path: "_value", message: "Value does not fit uint256" }] }))).toEqual({
      ok: false,
      detail: "the SDK refused the values: _value Value does not fit uint256",
    });
    expect(
      check(() => {
        throw new Error("boom");
      })
    ).toEqual({ ok: false, detail: "boom" });
    // The case of the hex digits does not matter
    expect(check(() => ({ data: calldata.toUpperCase().replace("0X", "0x") }))).toEqual({ ok: true });
  });
});
