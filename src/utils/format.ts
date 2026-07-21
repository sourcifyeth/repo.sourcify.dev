import { decode, getAuxdataStyle } from "@ethereum-sourcify/bytecode-utils";

export function formatCborAuxdata(rawCborAuxdata: string, language: string, compilerVersion: string) {
  try {
    // getAuxdataStyle selects the correct decoder style from the language and
    // compiler version. This matters for Vyper, whose auxdata layout changed
    // across versions (e.g. < 0.3.10 stores a CBOR map, >= 0.3.10 a CBOR array).
    const auxdataStyle = getAuxdataStyle(language, compilerVersion);
    const decoded = decode(rawCborAuxdata, auxdataStyle);
    return decoded;
  } catch (error) {
    console.error("Error decoding CBOR auxdata:", error);
    return "Could not decode CBOR auxdata";
  }
}
