/**
 * The clear signing SDK in the browser: input models for the functions of a contract (the "reverse" direction),
 * and the text that a wallet shows for a transaction (the forward direction, for the round-trip check).
 *
 * The descriptors come from the ERC-7730 registry on GitHub, directly from the browser. Nothing here is needed
 * to read or write: every failure and every timeout means "no models", and the page keeps its ABI forms.
 */
import {
  type Descriptor,
  type DescriptorResolver,
  type DisplayModel,
  type ExternalDataProvider,
  type RegistryIndex,
  fetchPrebuiltRegistryIndex,
  format,
} from "@ethereum-sourcify/clear-signing";
import { type InputModel, buildCalldata, getCalldataInputModels } from "@ethereum-sourcify/clear-signing/builder";
import type { TokenStandard } from "./tokenStandard";

const REGISTRY_FILES = "https://raw.githubusercontent.com/ethereum/clear-signing-erc7730-registry/master/";
/** The registry's own text about what inclusion means, and about attestations */
export const REGISTRY_DISCLAIMER_URL = "https://github.com/ethereum/clear-signing-erc7730-registry#disclaimer";
const TIMEOUT_MS = 8000;

/** Where the models of a contract come from: its descriptor in the registry, or a generic token template of the SDK. */
export type ModelSource = "registry" | TokenStandard;

export interface LoadedModels {
  models: InputModel[];
  source: ModelSource;
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No answer in ${ms} ms`)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

// One download of the index (two small files) for the page, shared by every lookup
let indexLoad: Promise<RegistryIndex | null> | undefined;

/** The index of the registry (chain and address → descriptor file), or null if it could not be loaded. */
export function registryIndex(): Promise<RegistryIndex | null> {
  indexLoad ??= withTimeout(fetchPrebuiltRegistryIndex(), TIMEOUT_MS).catch((error) => {
    console.warn("Clear signing: the registry index could not be loaded.", error);
    // The next lookup tries again
    indexLoad = undefined;
    return null;
  });
  return indexLoad;
}

// Each descriptor file is fetched once for the page: the round-trip check runs on every change of the form
const files = new Map<string, Promise<Descriptor>>();

function fetchDescriptor(path: string): Promise<Descriptor> {
  // Paths come from the index and from "includes" of descriptors: only files inside the registry
  if (!/^[\w.@/-]+\.json$/.test(path) || path.split("/").includes(".."))
    return Promise.reject(new Error(`Not a descriptor path: ${path}`));
  let load = files.get(path);
  if (!load) {
    load = fetch(REGISTRY_FILES + path, { signal: AbortSignal.timeout(TIMEOUT_MS) }).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
      return response.json() as Promise<Descriptor>;
    });
    files.set(path, load);
    load.catch(() => files.delete(path));
  }
  return load;
}

const caip10 = (chainId: number, address: string) => `eip155:${chainId}:${address.toLowerCase()}`;

/**
 * The descriptor source for one contract. A contract with a descriptor in the registry uses it. Any other
 * contract that the page found to be an ERC-20 or ERC-721 token (from its verified ABI) gets the generic
 * template of the SDK, through a one-entry list of trusted tokens.
 */
function resolverOptions(index: RegistryIndex, chainId: number, address: string, standard: TokenStandard | null) {
  const resolver: DescriptorResolver = { index, fetchDescriptor };
  const inRegistry = caip10(chainId, address) in index.calldataIndex;
  return {
    inRegistry,
    options: {
      type: "custom" as const,
      resolver,
      ...(!inRegistry && standard ? { trustedTokens: { [chainId]: { [address.toLowerCase()]: standard } } } : {}),
    },
  };
}

/** The input models of the contract's functions, or null if there are none (or on any failure). */
export async function loadInputModels(
  chainId: number,
  address: string,
  standard: TokenStandard | null
): Promise<LoadedModels | null> {
  try {
    const index = await registryIndex();
    if (!index) return null;
    const { inRegistry, options } = resolverOptions(index, chainId, address, standard);
    if (!inRegistry && !standard) return null;
    const { models } = await withTimeout(
      getCalldataInputModels(chainId, address, { descriptorResolverOptions: options }),
      TIMEOUT_MS
    );
    if (!models || models.length === 0) return null;
    return { models, source: inRegistry ? "registry" : standard! };
  } catch (error) {
    console.warn("Clear signing: no input models.", error);
    return null;
  }
}

export interface PreviewTransaction {
  chainId: number;
  to: string;
  data: string;
  value?: bigint;
  from?: string;
}

/**
 * What a wallet with clear signing shows for the transaction: the forward direction of the same descriptor.
 * Null if the SDK cannot format it fully (a warning, or a fallback to raw calldata), and on any failure.
 */
export async function walletPreview(
  tx: PreviewTransaction,
  standard: TokenStandard | null,
  externalDataProvider: ExternalDataProvider
): Promise<DisplayModel | null> {
  try {
    const index = await registryIndex();
    if (!index) return null;
    const { options } = resolverOptions(index, tx.chainId, tx.to, standard);
    const display = await withTimeout(
      format(tx, { descriptorResolverOptions: options, externalDataProvider }),
      TIMEOUT_MS
    );
    if (display.rawCalldataFallback || (display.warnings?.length ?? 0) > 0) {
      if (process.env.NODE_ENV !== "production") console.debug("Clear signing: no wallet preview.", display.warnings);
      return null;
    }
    return display;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.debug("Clear signing: no wallet preview.", error);
    return null;
  }
}

/** The SDK's own encoder, for the comparison with viem (see crossCheck.ts). */
export const sdkBuildCalldata = buildCalldata;
