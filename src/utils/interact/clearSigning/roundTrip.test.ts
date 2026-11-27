/**
 * The round trip: text that a person types → raw value (the page's inverse parsers) → calldata (viem) →
 * the text that a wallet shows (`format()` of the SDK). The text at the end must say what was typed.
 */
import { describe, expect, it } from "vitest";
import { type DisplayModel, format } from "@ethereum-sourcify/clear-signing";
import { getCalldataInputModels } from "@ethereum-sourcify/clear-signing/builder";
import { type FormValue, encodeCall } from "../abi";
import {
  AAVE_GATEWAY,
  ABIS,
  FORMATS,
  SEPOLIA_WETH,
  SWAP_ROUTER,
  USDC,
  USDT,
  WETH,
  externalData,
  functionOf,
  resolverOptions,
} from "./fixtures";
import { amountToRaw, dateToRaw, durationToRaw, enumOptions, maxOfType } from "./parsers";

const SPENDER = "0x1234567890AbcdEF1234567890aBcdef12345678";

async function shown(
  chainId: number,
  to: string,
  data: string,
  value?: bigint,
  trustedTokens?: Record<number, Record<string, "erc20" | "erc721">>
): Promise<{ display: DisplayModel; fields: Record<string, string> }> {
  const display = await format(
    { chainId, to, data, ...(value !== undefined ? { value } : {}) },
    {
      descriptorResolverOptions: { ...resolverOptions, ...(trustedTokens ? { trustedTokens } : {}) },
      externalDataProvider: externalData,
    }
  );
  const flat = (display.fields ?? []).flatMap((field) => ("fields" in field ? field.fields : [field]));
  return { display, fields: Object.fromEntries(flat.map((field) => [field.label, field.value])) };
}

describe("round trip with format()", () => {
  it("tokenAmount: 1.5 USDT", async () => {
    const fn = functionOf(ABIS.token, "approve");
    const data = encodeCall(fn, [SPENDER, amountToRaw("1.5", 6)!])!;
    const { display, fields } = await shown(1, USDT, data);
    expect(display.intent).toBe("Approve");
    expect(display.rawCalldataFallback).toBeUndefined();
    expect(fields).toEqual({ Spender: SPENDER, Amount: "1.5 USDT" });
  });

  it("tokenAmount: the threshold button gives the wallet's message", async () => {
    const fn = functionOf(ABIS.token, "approve");
    const { fields } = await shown(1, USDT, encodeCall(fn, [SPENDER, maxOfType("uint256")!])!);
    expect(fields.Amount).toBe("Unlimited USDT");
  });

  it("tokenAmount with the token in another input, and unit with %", async () => {
    const fn = functionOf(ABIS.router, "exactInputSingle");
    const values: FormValue[] = [
      [WETH, USDC, amountToRaw("0.3", 4)!, SPENDER, amountToRaw("0.001", 18)!, amountToRaw("2.5", 6)!, "0"],
    ];
    const { fields } = await shown(1, SWAP_ROUTER, encodeCall(fn, values)!);
    expect(fields).toMatchObject({ Send: "0.001 WETH", "Minimum to Receive": "2.5 USDC", "Uniswap fee": "0.3%" });
  });

  it("amount: the native value of the transaction", async () => {
    const fn = functionOf(ABIS.gateway, "depositETH");
    const data = encodeCall(fn, ["0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", SPENDER, "0"])!;
    const { display, fields } = await shown(1, AAVE_GATEWAY, data, BigInt(amountToRaw("0.01", 18)!));
    expect(display.intent).toBe("Supply");
    expect(fields["Amount to supply"]).toBe("0.01 ETH");
  });

  it("tokenAmount with the native currency as the token, and its message", async () => {
    const fn = functionOf(ABIS.gateway, "repayETH");
    const pool = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
    expect(
      (await shown(1, AAVE_GATEWAY, encodeCall(fn, [pool, amountToRaw("0.25", 18)!, SPENDER])!)).fields
    ).toMatchObject({ "Amount to repay": "0.25 ETH" });
    const all = await shown(1, AAVE_GATEWAY, encodeCall(fn, [pool, maxOfType("uint256")!, SPENDER])!);
    expect(all.fields["Amount to repay"]).toBe("All ETH");
  });

  it("date, duration, unit and enum", async () => {
    const fn = functionOf(ABIS.formats, "schedule");
    const { models } = await getCalldataInputModels(1, FORMATS, { descriptorResolverOptions: resolverOptions });
    const mode = models![0].fields.flatMap((field) => ("options" in field && field.options ? [field.options] : []))[0];
    const variable = enumOptions(mode, "uint8").find((option) => option.label === "Variable")!;
    const values: FormValue[] = [
      dateToRaw("2026-11-26T10:00")!,
      durationToRaw("1.5", 3600)!,
      amountToRaw("2.5", 2)!,
      variable.value,
      "21000000",
      [[USDT, amountToRaw("1.5", 6)!]],
    ];
    const { fields } = await shown(1, FORMATS, encodeCall(fn, values)!);
    expect(fields).toMatchObject({
      "Start date": "2026-11-26 10:00:00Z",
      "Lock time": "01:30:00",
      Rate: "2.5%",
      "Interest mode": "Variable",
      "At block": "21000000",
      "Order amount": "1.5 USDT",
    });
  });

  it("a function without arguments", async () => {
    const { display, fields } = await shown(
      11155111,
      SEPOLIA_WETH,
      encodeCall(functionOf(ABIS.weth, "deposit"), [])!,
      BigInt(amountToRaw("0.01", 18)!)
    );
    expect(display.intent).toBe("Wrap");
    expect(fields.Amount).toBe("0.01 ETH");
  });

  it("the generic ERC-20 template", async () => {
    // A token with no descriptor in the registry: the SDK uses its template for a trusted token
    const token = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const fn = functionOf(ABIS.token, "transfer");
    const { display, fields } = await shown(1, token, encodeCall(fn, [SPENDER, amountToRaw("12.34", 6)!])!, undefined, {
      1: { [token]: "erc20" },
    });
    expect(display.intent).toBe("Send");
    expect(fields).toMatchObject({ Amount: "12.34 USDC", To: SPENDER });
  });
});
