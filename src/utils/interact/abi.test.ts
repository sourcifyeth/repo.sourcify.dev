import { Interface, defaultAbiCoder } from "@ethersproject/abi";
import { describe, expect, it } from "vitest";
import { type AbiEntry, buildFunctions, checkForm, encodeCall, fromJson, leafError, toJson } from "./abi";

// A second, independent ABI coder (ethers v5) is the reference for the encoding with viem
const reference = (entry: AbiEntry, args: unknown[]) =>
  new Interface([entry as never]).encodeFunctionData(entry.name!, args);

const fnOf = (entry: AbiEntry) => buildFunctions([entry], {}, "own")[0];

describe("buildFunctions", () => {
  it("gives signature, selector, mutability, overloads and NatSpec", () => {
    const fns = buildFunctions(
      [
        {
          type: "function",
          name: "transfer",
          inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
          stateMutability: "nonpayable",
        },
        { type: "function", name: "f", inputs: [{ name: "a", type: "uint8" }], constant: true },
        { type: "function", name: "f", inputs: [{ name: "a", type: "string" }], payable: true },
        { type: "receive", stateMutability: "payable" },
        { type: "event", name: "Transfer" },
      ],
      {
        userdoc: { methods: { "transfer(address,uint256)": { notice: "Moves tokens" } } },
        devdoc: { methods: { "transfer(address,uint256)": { details: "Emits Transfer", params: { to: "Receiver" } } } },
      },
      "own"
    );
    expect(fns.map((fn) => [fn.signature, fn.selector, fn.mutability, fn.overloaded])).toEqual([
      ["transfer(address,uint256)", "0xa9059cbb", "nonpayable", false],
      ["f(uint8)", expect.stringMatching(/^0x[0-9a-f]{8}$/), "view", true],
      ["f(string)", expect.stringMatching(/^0x[0-9a-f]{8}$/), "payable", true],
      ["receive()", "", "payable", false],
    ]);
    expect(fns[0]).toMatchObject({ notice: "Moves tokens", dev: "Emits Transfer", paramDocs: { to: "Receiver" } });
  });
});

describe("encodeCall (viem) against ethers", () => {
  it("encodes simple types", () => {
    const entry: AbiEntry = {
      type: "function",
      name: "mix",
      inputs: [
        { name: "a", type: "address" },
        { name: "b", type: "uint256" },
        { name: "c", type: "int24" },
        { name: "d", type: "bool" },
        { name: "e", type: "bytes32" },
        { name: "f", type: "bytes" },
        { name: "g", type: "string" },
      ],
      stateMutability: "nonpayable",
    };
    const address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const bytes32 = "0x" + "ab".repeat(32);
    const values = [
      address,
      "115792089237316195423570985008687907853269984665640564039457584007913129639935",
      "-8388608",
      true,
      bytes32,
      "0x1234",
      "héllo",
    ];
    expect(encodeCall(fnOf(entry), values)).toBe(
      reference(entry, [address, values[1], -8388608, true, bytes32, "0x1234", "héllo"])
    );
  });

  it("accepts an address in lower case or upper case", () => {
    const entry: AbiEntry = {
      type: "function",
      name: "f",
      inputs: [{ name: "a", type: "address" }],
      stateMutability: "view",
    };
    const lower = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
    expect(encodeCall(fnOf(entry), [lower])).toBe(reference(entry, [lower]));
    expect(encodeCall(fnOf(entry), ["0x" + lower.slice(2).toUpperCase()])).toBe(reference(entry, [lower]));
  });

  it("encodes structs, nested structs, fixed and dynamic arrays, arrays of structs", () => {
    const item = {
      name: "item",
      type: "tuple",
      components: [
        { name: "kind", type: "uint8" },
        { name: "token", type: "address" },
        { name: "ids", type: "uint256[]" },
      ],
    };
    const entry: AbiEntry = {
      type: "function",
      name: "deep",
      inputs: [
        {
          name: "order",
          type: "tuple",
          components: [
            { name: "offerer", type: "address" },
            { ...item, name: "first" },
            { ...item, name: "items", type: "tuple[]" },
          ],
        },
        { name: "pair", type: "uint16[2]" },
        { name: "matrix", type: "bytes4[][]" },
      ],
      stateMutability: "payable",
    };
    const zero = "0x0000000000000000000000000000000000000001";
    const order = [
      zero,
      ["1", zero, ["5", "6"]],
      [
        ["2", zero, []],
        ["3", zero, ["7"]],
      ],
    ];
    const values = [order, ["1", "65535"], [["0x01020304"], [], ["0xffffffff", "0x00000000"]]];
    expect(encodeCall(fnOf(entry), values)).toBe(
      reference(entry, [
        [
          zero,
          [1, zero, [5, 6]],
          [
            [2, zero, []],
            [3, zero, [7]],
          ],
        ],
        [1, 65535],
        [["0x01020304"], [], ["0xffffffff", "0x00000000"]],
      ])
    );
  });

  it("picks the right overload by signature", () => {
    const fns = buildFunctions(
      [
        { type: "function", name: "f", inputs: [{ name: "a", type: "uint8" }], stateMutability: "view" },
        { type: "function", name: "f", inputs: [{ name: "a", type: "string" }], stateMutability: "view" },
      ],
      {},
      "own"
    );
    expect(encodeCall(fns[0], ["7"])?.slice(0, 10)).toBe(fns[0].selector);
    expect(encodeCall(fns[1], ["7"])?.slice(0, 10)).toBe(fns[1].selector);
    expect(encodeCall(fns[1], ["7"])).toBe(fns[1].selector + defaultAbiCoder.encode(["string"], ["7"]).slice(2));
  });

  it("gives null for an incomplete form, and raw data for fallback and receive", () => {
    const entry: AbiEntry = {
      type: "function",
      name: "f",
      inputs: [{ name: "a", type: "uint256" }],
      stateMutability: "view",
    };
    expect(encodeCall(fnOf(entry), ["1.5"])).toBeNull();
    const [fallback, receive] = buildFunctions(
      [{ type: "fallback" }, { type: "receive", stateMutability: "payable" }],
      {},
      "own"
    );
    expect(encodeCall(fallback, ["0xdeadbeef"])).toBe("0xdeadbeef");
    expect(encodeCall(receive, [])).toBe("0x");
  });
});

describe("input checks", () => {
  it("checks integers, addresses and bytes", () => {
    expect(leafError("uint8", "256")).toContain("Too large");
    expect(leafError("int8", "-129")).toContain("Too small");
    expect(leafError("uint256", "-1")).toContain("negative");
    expect(leafError("uint256", "1,000")).toContain("whole number");
    expect(leafError("address", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB49")).toContain("checksum");
    expect(leafError("address", "0x1234")).toContain("40 hex characters");
    expect(leafError("bytes4", "0x123456")).toContain("exactly 4 bytes");
    expect(leafError("bytes", "0x123")).toContain("even number");
    expect(leafError("uint256", "")).toBeNull();
  });

  it("counts missing and wrong values through structs and lists", () => {
    const params = [
      {
        name: "s",
        type: "tuple",
        components: [
          { name: "a", type: "address" },
          { name: "n", type: "uint8" },
        ],
      },
      { name: "list", type: "uint8[]" },
    ];
    expect(
      checkForm(params, [
        ["", "300"],
        ["1", ""],
      ])
    ).toEqual({ missing: 2, invalid: 1 });
  });

  it("goes from form values to JSON and back", () => {
    const param = {
      name: "s",
      type: "tuple",
      components: [
        { name: "a", type: "uint256" },
        { name: "b", type: "bool[]" },
      ],
    };
    const value = ["12345678901234567890123", [true, false]];
    expect(toJson(param, value)).toEqual({ a: "12345678901234567890123", b: [true, false] });
    expect(fromJson(param, toJson(param, value))).toEqual(value);
    expect(() => fromJson(param, { a: "1" })).toThrow('has no field "b"');
  });
});

describe("parseJsonExact", () => {
  it("keeps large integers exact, and leaves numbers inside strings alone", async () => {
    const { parseJsonExact } = await import("./abi");
    expect(parseJsonExact('{"amount":12345678901234567891,"n":-5,"f":1.5e3,"s":"12345678901234567891 x"}')).toEqual({
      amount: "12345678901234567891",
      n: "-5",
      f: "1.5e3",
      s: "12345678901234567891 x",
    });
    expect(parseJsonExact('[1, "a\\"2", [3]]')).toEqual(["1", 'a"2', ["3"]]);
    expect(() => parseJsonExact("{bad")).toThrow(SyntaxError);
  });

  it("gives the exact number to the form", async () => {
    const { parseJsonExact } = await import("./abi");
    const param = { name: "s", type: "tuple", components: [{ name: "amount", type: "uint256" }] };
    expect(fromJson(param, parseJsonExact('{"amount":12345678901234567891}'))).toEqual(["12345678901234567891"]);
  });
});
