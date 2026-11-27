/**
 * For tests only: the real descriptors of the ERC-7730 registry that the tests use, copied on 2026-11-26
 * (registry commit 4754709c), and one made-up descriptor (`calldata-formats.json`) for the formats that
 * these four do not have. The tests use no network.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DescriptorResolver, ExternalDataProvider, RegistryIndex } from "@ethereum-sourcify/clear-signing";
import { type AbiEntry, type Fn, buildFunctions } from "../../abi";

const here = dirname(fileURLToPath(import.meta.url));

export const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
export const SWAP_ROUTER = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
export const AAVE_GATEWAY = "0xd01607c3C5eCABa394D8be377a08590149325722";
export const SEPOLIA_WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
export const FORMATS = "0x00000000000000000000000000000000000f0f0f";
export const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
export const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

export const index: RegistryIndex = {
  calldataIndex: {
    [`eip155:1:${USDT.toLowerCase()}`]: "registry/tether/calldata-usdt.json",
    [`eip155:1:${SWAP_ROUTER.toLowerCase()}`]: "registry/uniswap/calldata-UniswapV3Router02.json",
    [`eip155:1:${AAVE_GATEWAY.toLowerCase()}`]: "registry/aave/calldata-WrappedTokenGatewayV3.json",
    [`eip155:11155111:${SEPOLIA_WETH.toLowerCase()}`]: "registry/weth/calldata-weth.json",
    [`eip155:1:${FORMATS}`]: "registry/tests/calldata-formats.json",
  },
  typedDataIndex: {},
};

export const resolver: DescriptorResolver = {
  index,
  fetchDescriptor: async (path) => JSON.parse(readFileSync(join(here, path.split("/").pop()!), "utf8")),
};

export const resolverOptions = { type: "custom" as const, resolver };

const TOKENS: Record<string, { name: string; symbol: string; decimals: number }> = {
  [USDT.toLowerCase()]: { name: "Tether USD", symbol: "USDT", decimals: 6 },
  [USDC.toLowerCase()]: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  [WETH.toLowerCase()]: { name: "Wrapped Ether", symbol: "WETH", decimals: 18 },
  [SEPOLIA_WETH.toLowerCase()]: { name: "Wrapped Ether", symbol: "WETH", decimals: 18 },
};

/** What a wallet would know: three tokens and the chain's currency. */
export const externalData: ExternalDataProvider = {
  resolveToken: async (_chainId, address) => TOKENS[address.toLowerCase()] ?? null,
  resolveChainInfo: async () => ({
    name: "Ethereum Mainnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  }),
};

const input = (type: string, name: string, components?: AbiEntry["inputs"]) => ({ type, name, components });
const fn = (name: string, inputs: AbiEntry["inputs"], stateMutability = "nonpayable"): AbiEntry => ({
  type: "function",
  name,
  inputs,
  outputs: [],
  stateMutability,
});

/**
 * Verified ABIs as Sourcify has them. The argument names are on purpose not the names of the descriptors
 * (`to` and `amount`, not `_to` and `_value`): the link must work by position.
 */
export const ABIS = {
  token: [
    fn("totalSupply", [], "view"),
    fn("balanceOf", [input("address", "account")], "view"),
    fn("transfer", [input("address", "to"), input("uint256", "amount")]),
    fn("transferFrom", [input("address", "from"), input("address", "to"), input("uint256", "amount")]),
    fn("approve", [input("address", "spender"), input("uint256", "amount")]),
    fn("allowance", [input("address", "owner"), input("address", "spender")], "view"),
    fn("decimals", [], "view"),
  ],
  router: [
    fn(
      "exactInputSingle",
      [
        input("tuple", "params", [
          input("address", "tokenIn"),
          input("address", "tokenOut"),
          input("uint24", "fee"),
          input("address", "recipient"),
          input("uint256", "amountIn"),
          input("uint256", "amountOutMinimum"),
          input("uint160", "sqrtPriceLimitX96"),
        ]),
      ],
      "payable"
    ),
    fn(
      "swapExactTokensForTokens",
      [
        input("uint256", "amountIn"),
        input("uint256", "amountOutMin"),
        input("address[]", "path"),
        input("address", "to"),
      ],
      "payable"
    ),
  ],
  gateway: [
    fn(
      "depositETH",
      [input("address", ""), input("address", "onBehalfOf"), input("uint16", "referralCode")],
      "payable"
    ),
    fn("repayETH", [input("address", ""), input("uint256", "amount"), input("address", "onBehalfOf")], "payable"),
  ],
  weth: [fn("deposit", [], "payable"), fn("withdraw", [input("uint256", "wad")])],
  formats: [
    fn("schedule", [
      input("uint256", "start"),
      input("uint32", "lock"),
      input("uint24", "rate"),
      input("uint8", "mode"),
      input("uint256", "height"),
      input("tuple[]", "orders", [input("address", "token"), input("uint256", "amount")]),
    ]),
  ],
} satisfies Record<string, AbiEntry[]>;

export const functionsOf = (abi: AbiEntry[]): Fn[] => buildFunctions(abi, {}, "own");
export const functionOf = (abi: AbiEntry[], name: string): Fn => functionsOf(abi).find((item) => item.name === name)!;
