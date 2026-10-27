/**
 * Bytecode ↔ source: the compiler's source map, a disassembler, and the
 * conversion between UTF-8 byte offsets (source maps) and string indexes
 * (the editor).
 *
 * A source map has one entry per instruction: `s:l:f:j:m`, where `s` is the
 * start byte in the source file, `l` the length in bytes, `f` the file index
 * (the ids of `sourceIds`; -1 for code that the compiler generates), `j` the
 * jump type ("i" into a function, "o" out of it, "-" a plain jump), and `m`
 * the modifier depth. An empty field repeats the value of the entry before.
 * See https://docs.soliditylang.org/en/latest/internals/source_mappings.html
 */

export interface SourceMapEntry {
  start: number;
  length: number;
  fileIndex: number;
  jump: string;
  modifierDepth: number;
}

export function decodeSourceMap(sourceMap: string): SourceMapEntry[] {
  if (!sourceMap) return [];
  const entries: SourceMapEntry[] = [];
  let previous: SourceMapEntry = { start: -1, length: -1, fileIndex: -1, jump: "-", modifierDepth: 0 };
  for (const item of sourceMap.split(";")) {
    const [s, l, f, j, m] = item.split(":");
    const entry: SourceMapEntry = {
      start: s !== undefined && s !== "" ? Number(s) : previous.start,
      length: l !== undefined && l !== "" ? Number(l) : previous.length,
      fileIndex: f !== undefined && f !== "" ? Number(f) : previous.fileIndex,
      jump: j !== undefined && j !== "" ? j : previous.jump,
      modifierDepth: m !== undefined && m !== "" ? Number(m) : previous.modifierDepth,
    };
    entries.push(entry);
    previous = entry;
  }
  return entries;
}

const OPCODES: Record<number, string> = {
  0x00: "STOP",
  0x01: "ADD",
  0x02: "MUL",
  0x03: "SUB",
  0x04: "DIV",
  0x05: "SDIV",
  0x06: "MOD",
  0x07: "SMOD",
  0x08: "ADDMOD",
  0x09: "MULMOD",
  0x0a: "EXP",
  0x0b: "SIGNEXTEND",
  0x10: "LT",
  0x11: "GT",
  0x12: "SLT",
  0x13: "SGT",
  0x14: "EQ",
  0x15: "ISZERO",
  0x16: "AND",
  0x17: "OR",
  0x18: "XOR",
  0x19: "NOT",
  0x1a: "BYTE",
  0x1b: "SHL",
  0x1c: "SHR",
  0x1d: "SAR",
  0x1e: "CLZ",
  0x20: "KECCAK256",
  0x30: "ADDRESS",
  0x31: "BALANCE",
  0x32: "ORIGIN",
  0x33: "CALLER",
  0x34: "CALLVALUE",
  0x35: "CALLDATALOAD",
  0x36: "CALLDATASIZE",
  0x37: "CALLDATACOPY",
  0x38: "CODESIZE",
  0x39: "CODECOPY",
  0x3a: "GASPRICE",
  0x3b: "EXTCODESIZE",
  0x3c: "EXTCODECOPY",
  0x3d: "RETURNDATASIZE",
  0x3e: "RETURNDATACOPY",
  0x3f: "EXTCODEHASH",
  0x40: "BLOCKHASH",
  0x41: "COINBASE",
  0x42: "TIMESTAMP",
  0x43: "NUMBER",
  0x44: "PREVRANDAO",
  0x45: "GASLIMIT",
  0x46: "CHAINID",
  0x47: "SELFBALANCE",
  0x48: "BASEFEE",
  0x49: "BLOBHASH",
  0x4a: "BLOBBASEFEE",
  0x50: "POP",
  0x51: "MLOAD",
  0x52: "MSTORE",
  0x53: "MSTORE8",
  0x54: "SLOAD",
  0x55: "SSTORE",
  0x56: "JUMP",
  0x57: "JUMPI",
  0x58: "PC",
  0x59: "MSIZE",
  0x5a: "GAS",
  0x5b: "JUMPDEST",
  0x5c: "TLOAD",
  0x5d: "TSTORE",
  0x5e: "MCOPY",
  0x5f: "PUSH0",
  0xa0: "LOG0",
  0xa1: "LOG1",
  0xa2: "LOG2",
  0xa3: "LOG3",
  0xa4: "LOG4",
  0xf0: "CREATE",
  0xf1: "CALL",
  0xf2: "CALLCODE",
  0xf3: "RETURN",
  0xf4: "DELEGATECALL",
  0xf5: "CREATE2",
  0xfa: "STATICCALL",
  0xfd: "REVERT",
  0xfe: "INVALID",
  0xff: "SELFDESTRUCT",
};
for (let i = 1; i <= 32; i++) OPCODES[0x5f + i] = `PUSH${i}`;
for (let i = 1; i <= 16; i++) {
  OPCODES[0x7f + i] = `DUP${i}`;
  OPCODES[0x8f + i] = `SWAP${i}`;
}

export interface Instruction {
  // Byte offset in the bytecode
  offset: number;
  opcode: string;
  // Hex of the pushed value (PUSH1 to PUSH32), with 0x
  pushData?: string;
}

/**
 * Splits bytecode into instructions. Non-hex characters (for example library
 * placeholders `__$…$__`) count as zero bytes, so the layout stays right.
 */
export function disassemble(bytecode: string): Instruction[] {
  const hex = (bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode)
    // A library placeholder (__$<34 hex>$__) stands for a 20-byte address: show it as zeros
    .replace(/__\$[0-9a-fA-F]{34}\$__/g, "0".repeat(40))
    .replace(/[^0-9a-fA-F]/g, "0");
  const instructions: Instruction[] = [];
  const byteCount = Math.floor(hex.length / 2);
  let offset = 0;
  while (offset < byteCount) {
    const byte = parseInt(hex.slice(offset * 2, offset * 2 + 2), 16);
    const opcode = OPCODES[byte] ?? `UNKNOWN_0x${byte.toString(16).padStart(2, "0")}`;
    const instruction: Instruction = { offset, opcode };
    if (byte >= 0x60 && byte <= 0x7f) {
      const size = byte - 0x5f;
      instruction.pushData = "0x" + hex.slice((offset + 1) * 2, (offset + 1 + size) * 2);
      offset += size;
    }
    instructions.push(instruction);
    offset += 1;
  }
  return instructions;
}

/**
 * Maps UTF-8 byte offsets (source maps) to string indexes (UTF-16 code units,
 * as in the editor) and back. ASCII-only text needs no table.
 */
export function createUtf8Mapper(content: string) {
  if (/^[\x00-\x7f]*$/.test(content)) {
    return { byteToIndex: (byte: number) => byte, indexToByte: (index: number) => index };
  }
  const encoder = new TextEncoder();
  const byteToIndexTable: number[] = [];
  const indexToByteTable: number[] = [];
  let bytes = 0;
  for (let index = 0; index < content.length;) {
    const codePoint = content.codePointAt(index)!;
    const units = codePoint > 0xffff ? 2 : 1;
    const size = encoder.encode(String.fromCodePoint(codePoint)).length;
    for (let b = 0; b < size; b++) byteToIndexTable[bytes + b] = index;
    for (let u = 0; u < units; u++) indexToByteTable[index + u] = bytes;
    bytes += size;
    index += units;
  }
  byteToIndexTable[bytes] = content.length;
  indexToByteTable[content.length] = bytes;
  return {
    byteToIndex: (byte: number) => byteToIndexTable[Math.min(Math.max(byte, 0), bytes)],
    indexToByte: (index: number) => indexToByteTable[Math.min(Math.max(index, 0), content.length)],
  };
}

/** File index → path, from `sourceIds` ({ path: { id } }). */
export function pathsByFileIndex(sourceIds: Record<string, { id: number }> | undefined): Map<number, string> {
  return new Map(Object.entries(sourceIds ?? {}).map(([path, { id }]) => [id, path]));
}

/**
 * The instructions whose source range lies inside [startByte, endByte) of one
 * file. Entries that cover more (a whole function or contract) are left out,
 * so that a few lines do not match thousands of instructions.
 */
export function instructionsInRange(
  entries: SourceMapEntry[],
  fileIndex: number,
  startByte: number,
  endByte: number
): number[] {
  const found: number[] = [];
  entries.forEach((entry, index) => {
    if (entry.fileIndex !== fileIndex || entry.start < 0) return;
    if (entry.start >= startByte && entry.start + entry.length <= endByte) found.push(index);
  });
  return found;
}
