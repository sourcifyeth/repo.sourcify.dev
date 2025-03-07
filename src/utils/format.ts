import { decode, AuxdataStyle } from "@ethereum-sourcify/bytecode-utils";

export function formatCborAuxdata(rawCborAuxdata: string, language: string) {
  try {
    const auxdataStyle = language === "vyper" ? AuxdataStyle.VYPER : AuxdataStyle.SOLIDITY;
    const decoded = decode(rawCborAuxdata, auxdataStyle);
    return decoded;
  } catch (error) {
    console.error("Error decoding CBOR auxdata:", error);
    return "Could not decode CBOR auxdata";
  }
}
