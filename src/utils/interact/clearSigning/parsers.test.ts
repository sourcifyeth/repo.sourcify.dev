import { describe, expect, it } from "vitest";
import {
  amountToRaw,
  dateToRaw,
  durationToRaw,
  enumIndex,
  enumOptions,
  invalidRaw,
  invalidText,
  maxOfType,
  rawToAmount,
  rawToDate,
  rawToDuration,
  reachesThreshold,
} from "./parsers";

describe("amounts", () => {
  it("turns decimal text into the raw integer, exactly", () => {
    expect(amountToRaw("1.5", 6)).toBe("1500000");
    expect(amountToRaw("0.000001", 6)).toBe("1");
    expect(amountToRaw("123456789012345678901234567890.123456789012345678", 18)).toBe(
      "123456789012345678901234567890123456789012345678"
    );
    expect(amountToRaw("7", 0)).toBe("7");
  });

  it("refuses text that does not fit the decimals, and text that is not a number", () => {
    expect(amountToRaw("0.0000001", 6)).toBeNull();
    expect(amountToRaw("1.5", 0)).toBeNull();
    for (const text of ["", ".", "abc", "1,5", "1e6", "0x10", "1.2.3"]) expect(amountToRaw(text, 6), text).toBeNull();
  });

  it("turns the raw integer back into the same text", () => {
    expect(rawToAmount("1500000", 6)).toBe("1.5");
    expect(rawToAmount("1", 6)).toBe("0.000001");
    expect(rawToAmount("1000000", 6)).toBe("1");
    expect(rawToAmount("0", 18)).toBe("0");
    expect(rawToAmount("42", 0)).toBe("42");
    for (const text of ["1.5", "0.000001", "250000", "0.1", "99999999999999999999.999999"])
      expect(rawToAmount(amountToRaw(text, 6)!, 6)).toBe(text);
  });

  it("knows the largest value of a type and when a threshold is reached", () => {
    expect(maxOfType("uint8")).toBe("255");
    expect(maxOfType("int8")).toBe("127");
    expect(maxOfType("uint256")).toBe((BigInt(2) ** BigInt(256) - BigInt(1)).toString());
    expect(maxOfType("address")).toBeNull();
    const threshold = "0x8000000000000000000000000000000000000000000000000000000000000000";
    expect(reachesThreshold(maxOfType("uint256")!, threshold)).toBe(true);
    expect(reachesThreshold("1500000", threshold)).toBe(false);
    expect(reachesThreshold("1500000", undefined)).toBe(false);
    expect(reachesThreshold("abc", threshold)).toBe(false);
  });

  it("marks text that cannot be a value, so that it is never sent", () => {
    const raw = invalidRaw("0.0000001");
    expect(/^-?\d+$/.test(raw)).toBe(false);
    expect(invalidText(raw)).toBe("0.0000001");
    expect(invalidText("1500000")).toBeNull();
  });
});

describe("durations", () => {
  it("turns a number of units into seconds", () => {
    expect(durationToRaw("90", 60)).toBe("5400");
    expect(durationToRaw("1.5", 3600)).toBe("5400");
    expect(durationToRaw("2", 86400)).toBe("172800");
    expect(durationToRaw("0", 1)).toBe("0");
  });

  it("refuses parts of a second, and text that is not a number", () => {
    expect(durationToRaw("1.5", 1)).toBeNull();
    expect(durationToRaw("0.001", 60)).toBeNull();
    for (const text of ["", "-1", "abc", "1:30"]) expect(durationToRaw(text, 60), text).toBeNull();
  });

  it("shows seconds in the largest unit that fits", () => {
    expect(rawToDuration("5400")).toEqual({ text: "90", unitSeconds: 60 });
    expect(rawToDuration("172800")).toEqual({ text: "2", unitSeconds: 86400 });
    expect(rawToDuration("7200")).toEqual({ text: "2", unitSeconds: 3600 });
    expect(rawToDuration("61")).toEqual({ text: "61", unitSeconds: 1 });
    expect(rawToDuration("0")).toEqual({ text: "0", unitSeconds: 1 });
  });
});

describe("dates", () => {
  it("reads a UTC date as a Unix timestamp", () => {
    expect(dateToRaw("2026-11-26T10:00")).toBe("1795687200");
    expect(dateToRaw("2026-11-26T10:00:30")).toBe("1795687230");
    expect(dateToRaw("1970-01-01T00:00")).toBe("0");
  });

  it("refuses text that is not a date", () => {
    for (const text of ["", "2026-11-26", "2026-02-31T10:00", "2026-13-01T10:00", "2026-11-26T25:00", "tomorrow"])
      expect(dateToRaw(text), text).toBeNull();
  });

  it("turns a timestamp back into the same date", () => {
    expect(rawToDate("1795687200")).toBe("2026-11-26T10:00:00");
    expect(dateToRaw(rawToDate("1795687230")!)).toBe("1795687230");
    expect(rawToDate("-1")).toBeNull();
    expect(rawToDate((BigInt(2) ** BigInt(255)).toString())).toBeNull();
  });
});

describe("enums", () => {
  it("gives the options of a number enum and finds the stored value", () => {
    const options = enumOptions({ "0": "Stable", "1": "Variable" }, "uint8");
    expect(options).toEqual([
      { value: "0", label: "Stable" },
      { value: "1", label: "Variable" },
    ]);
    expect(enumIndex(options, "1")).toBe(1);
    expect(enumIndex(options, "0x1")).toBe(1);
    expect(enumIndex(options, "")).toBe(-1);
    expect(enumIndex(options, "7")).toBe(-1);
  });

  it("gives the options of a bool enum (ERC-721 setApprovalForAll)", () => {
    const options = enumOptions({ True: "Grant all", False: "Deny all" }, "bool");
    expect(options).toEqual([
      { value: true, label: "Grant all" },
      { value: false, label: "Deny all" },
    ]);
    expect(enumIndex(options, false)).toBe(1);
  });
});
