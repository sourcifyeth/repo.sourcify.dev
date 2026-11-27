/**
 * ERC-20 and ERC-721 detection from a verified ABI, for the generic clear signing templates of the SDK.
 * Only the function selectors count: argument names, return types (USDT returns nothing) and events are not checked.
 */
export type TokenStandard = "erc20" | "erc721";

/** The six required functions of EIP-20. */
export const ERC20_SELECTORS = [
  "0x18160ddd", // totalSupply()
  "0x70a08231", // balanceOf(address)
  "0xa9059cbb", // transfer(address,uint256)
  "0x23b872dd", // transferFrom(address,address,uint256)
  "0x095ea7b3", // approve(address,uint256)
  "0xdd62ed3e", // allowance(address,address)
];

/** Functions of EIP-721. `balanceOf`, `approve` and `transferFrom` have the same selectors as in ERC-20; these do not. */
export const ERC721_SELECTORS = [
  "0x6352211e", // ownerOf(uint256)
  "0x70a08231", // balanceOf(address)
  "0x42842e0e", // safeTransferFrom(address,address,uint256)
  "0xa22cb465", // setApprovalForAll(address,bool)
  "0x081812fc", // getApproved(uint256)
  "0xe985e9c5", // isApprovedForAll(address,address)
];

const OWNER_OF = "0x6352211e";

/**
 * The token standard of an ABI with these function selectors, or null.
 * ERC-20: all six ERC-20 functions, and no `ownerOf(uint256)`. ERC-721: all six ERC-721 functions.
 * An ABI with both full sets gets no template.
 */
export function detectTokenStandard(selectors: Iterable<string>): TokenStandard | null {
  const have = new Set([...selectors].map((selector) => selector.toLowerCase()));
  const all = (wanted: string[]) => wanted.every((selector) => have.has(selector));
  const erc20 = all(ERC20_SELECTORS);
  const erc721 = all(ERC721_SELECTORS);
  if (erc20 && erc721) return null;
  if (erc721) return "erc721";
  if (erc20 && !have.has(OWNER_OF)) return "erc20";
  return null;
}
