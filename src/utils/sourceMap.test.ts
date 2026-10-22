import { describe, expect, it } from "vitest";
import { createUtf8Mapper, decodeSourceMap, disassemble, instructionsInRange, pathsByFileIndex } from "./sourceMap";

describe("decodeSourceMap", () => {
  it("repeats empty fields from the entry before", () => {
    expect(decodeSourceMap("1:2:0:-:0;;3:4;:5:1:i;-1:-1:-1:o")).toEqual([
      { start: 1, length: 2, fileIndex: 0, jump: "-", modifierDepth: 0 },
      { start: 1, length: 2, fileIndex: 0, jump: "-", modifierDepth: 0 },
      { start: 3, length: 4, fileIndex: 0, jump: "-", modifierDepth: 0 },
      { start: 3, length: 5, fileIndex: 1, jump: "i", modifierDepth: 0 },
      { start: -1, length: -1, fileIndex: -1, jump: "o", modifierDepth: 0 },
    ]);
  });

  it("returns no entries for an empty map", () => {
    expect(decodeSourceMap("")).toEqual([]);
  });
});

describe("disassemble", () => {
  it("reads opcodes and push data, with byte offsets", () => {
    expect(disassemble("0x6080604052348015600f57600080fd5b5f")).toEqual([
      { offset: 0, opcode: "PUSH1", pushData: "0x80" },
      { offset: 2, opcode: "PUSH1", pushData: "0x40" },
      { offset: 4, opcode: "MSTORE" },
      { offset: 5, opcode: "CALLVALUE" },
      { offset: 6, opcode: "DUP1" },
      { offset: 7, opcode: "ISZERO" },
      { offset: 8, opcode: "PUSH1", pushData: "0x0f" },
      { offset: 10, opcode: "JUMPI" },
      { offset: 11, opcode: "PUSH1", pushData: "0x00" },
      { offset: 13, opcode: "DUP1" },
      { offset: 14, opcode: "REVERT" },
      { offset: 15, opcode: "JUMPDEST" },
      { offset: 16, opcode: "PUSH0" },
    ]);
  });

  it("treats library placeholders as zero bytes and names unknown opcodes", () => {
    const placeholder = "__$1234567890abcdef1234567890abcdef12$__";
    const instructions = disassemble(`0x73${placeholder}0c`);
    expect(instructions[0]).toEqual({ offset: 0, opcode: "PUSH20", pushData: "0x" + "0".repeat(40) });
    expect(instructions[1]).toEqual({ offset: 21, opcode: "UNKNOWN_0x0c" });
  });
});

describe("createUtf8Mapper", () => {
  it("is the identity for ASCII text", () => {
    const mapper = createUtf8Mapper("abc");
    expect(mapper.byteToIndex(2)).toBe(2);
    expect(mapper.indexToByte(2)).toBe(2);
  });

  it("maps multi-byte characters both ways", () => {
    // "é" is 2 bytes, "😀" is 4 bytes and 2 UTF-16 units
    const text = "aé😀b";
    const mapper = createUtf8Mapper(text);
    expect(mapper.byteToIndex(0)).toBe(0); // a
    expect(mapper.byteToIndex(1)).toBe(1); // é
    expect(mapper.byteToIndex(3)).toBe(2); // 😀
    expect(mapper.byteToIndex(7)).toBe(4); // b
    expect(mapper.byteToIndex(8)).toBe(5); // end
    expect(mapper.indexToByte(4)).toBe(7);
    expect(text[mapper.byteToIndex(7)]).toBe("b");
  });
});

describe("pathsByFileIndex and instructionsInRange", () => {
  it("maps file ids to paths", () => {
    expect(pathsByFileIndex({ "a.sol": { id: 0 }, "b.sol": { id: 3 } }).get(3)).toBe("b.sol");
  });

  it("finds only instructions whose range lies inside the given bytes of one file", () => {
    const entries = decodeSourceMap("0:100:0;10:5:0;12:2:0;30:5:0;10:5:1;-1:-1:-1");
    expect(instructionsInRange(entries, 0, 10, 20)).toEqual([1, 2]);
    expect(instructionsInRange(entries, 1, 0, 100)).toEqual([4]);
  });
});
