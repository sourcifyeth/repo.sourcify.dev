import { describe, expect, it } from "vitest";
import { canonicalSignature, hasUniqueNames, parseSignature, resolvePath, stepsKey } from "./signature";

const SWAP =
  "exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params)";

describe("parseSignature", () => {
  it("reads names and types", () => {
    const parsed = parseSignature("transfer(address _to, uint256 _value)")!;
    expect(parsed.name).toBe("transfer");
    expect(parsed.inputs.map((input) => [input.name, input.base])).toEqual([
      ["_to", "address"],
      ["_value", "uint256"],
    ]);
    expect(canonicalSignature(parsed)).toBe("transfer(address,uint256)");
  });

  it("reads nested tuples and arrays", () => {
    const parsed = parseSignature(SWAP)!;
    expect(canonicalSignature(parsed)).toBe(
      "exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))"
    );
    expect(parsed.inputs[0].components!.map((component) => component.name)).toEqual([
      "tokenIn",
      "tokenOut",
      "fee",
      "recipient",
      "amountIn",
      "amountOutMinimum",
      "sqrtPriceLimitX96",
    ]);
    const lists = parseSignature("f((address token, uint256[2][] amounts)[] orders, bytes32[4] proof)")!;
    expect(canonicalSignature(lists)).toBe("f((address,uint256[2][])[],bytes32[4])");
    expect(lists.inputs[0].components![1].dims).toEqual([2, null]);
  });

  it("takes functions without arguments, data locations, and `uint`", () => {
    expect(canonicalSignature(parseSignature("deposit()")!)).toBe("deposit()");
    const parsed = parseSignature("f(bytes calldata data, address payable to, uint amount, tuple(int a) s)")!;
    expect(parsed.inputs.map((input) => input.name)).toEqual(["data", "to", "amount", "s"]);
    expect(canonicalSignature(parsed)).toBe("f(bytes,address,uint256,(int256))");
  });

  it("names an argument without a name param<i>, as the SDK does", () => {
    expect(parseSignature("f(uint256, address to)")!.inputs.map((input) => input.name)).toEqual(["param0", "to"]);
  });

  it("refuses text that is not a signature", () => {
    for (const text of ["", "transfer", "(address)", "f(address", "f(address,)", "f(address) x", "f(a b c, )"])
      expect(parseSignature(text), text).toBeNull();
  });

  it("finds repeated names", () => {
    expect(hasUniqueNames(parseSignature("f(address a, uint256 b)")!.inputs)).toBe(true);
    expect(hasUniqueNames(parseSignature("f(address a, uint256 a)")!.inputs)).toBe(false);
    expect(hasUniqueNames(parseSignature("f((address a, uint256 a) s)")!.inputs)).toBe(false);
  });
});

describe("resolvePath", () => {
  const swap = parseSignature(SWAP)!.inputs;
  const lists = parseSignature("f((address token, uint256 amount)[] orders, address[] path, address to)")!.inputs;

  it("gives the position of an argument and of a struct field", () => {
    expect(resolvePath(parseSignature("transfer(address _to, uint256 _value)")!.inputs, "#._value")).toEqual([1]);
    expect(resolvePath(swap, "params.amountIn")).toEqual([0, 4]);
    expect(resolvePath(swap, "params")).toEqual([0]);
  });

  it("follows lists", () => {
    expect(resolvePath(lists, "orders.[].amount")).toEqual([0, "[]", 1]);
    expect(resolvePath(lists, "path.[]")).toEqual([1, "[]"]);
    expect(resolvePath(lists, "path.[0]")).toEqual([1, { index: 0 }]);
    expect(resolvePath(lists, "path.[-1]")).toEqual([1, { index: -1 }]);
    expect(stepsKey(resolvePath(lists, "orders.[].amount")!)).toBe("0.[].1");
  });

  it("gives null for paths that name no value", () => {
    for (const path of ["nope", "params.nope", "params.[]", "to.x", "orders.amount", "@.value", "data.[:4]", ""])
      expect(resolvePath(path.startsWith("params") ? swap : lists, path), path).toBeNull();
  });
});
