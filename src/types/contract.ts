export interface ContractData {
  matchId: string;
  creationMatch: string | null;
  runtimeMatch: string | null;
  verifiedAt: string;
  creationBytecode: BytecodeData;
  runtimeBytecode: BytecodeData;
  deployment: DeploymentData;
  sources: Record<string, SourceData>;
  // The files of the compilation, with the id that source maps use. Files in
  // `sources` but not here are not used by the compiled contract.
  sourceIds?: Record<string, { id: number }>;
  compilation: CompilationData;
  abi: AbiItem[] | null;
  metadata: Record<string, unknown> | null;
  storageLayout: StorageLayoutData | VyperStorageLayout | null;
  transientStorageLayout?: StorageLayoutData | null;
  additionalInput?: {
    storage_layout_overrides?: Record<string, VyperStorageLayout>;
  } | null;
  userdoc: Record<string, unknown>;
  devdoc: Record<string, unknown>;
  stdJsonInput: Record<string, unknown>;
  stdJsonOutput: Record<string, unknown>;
  proxyResolution?: ProxyResolutionData;
  match: string;
  chainId: string;
  address: string;
  signatures?: SignatureData;
}

/**
 * The large fields that the contract page does not request. The browser
 * loads each one when its section comes into view (see LazyJsonSection).
 */
export const LAZY_CONTRACT_FIELDS = ["metadata", "stdJsonInput", "stdJsonOutput"] as const;
export type LazyContractField = (typeof LAZY_CONTRACT_FIELDS)[number];

/** The contract as the page requests it: all fields except the lazy ones. */
export type ContractPageData = Omit<ContractData, LazyContractField>;

/**
 * The fields that the source view reads. The page gives it only these: each
 * prop of a client component goes into the page, and React writes a long
 * string (a bytecode, a source map) again for every component that gets it.
 * The source view reads the source maps from the bytecode sections in the
 * browser (registeredSourceMap in sourceRegistry.ts).
 */
export type SourceViewData = Pick<ContractPageData, "sources" | "sourceIds" | "signatures" | "userdoc" | "devdoc"> & {
  compilation: Pick<CompilationData, "fullyQualifiedName" | "compilerSettings">;
};

export interface LibraryReferenceObject {
  start: number;
  length: number;
}
export interface LinkReferences {
  [fileName: string]: {
    [libraryName: string]: LibraryReferenceObject[];
  };
}

export interface BytecodeData {
  onchainBytecode: string;
  recompiledBytecode: string;
  sourceMap: string;
  linkReferences: LinkReferences;
  cborAuxdata?: Record<
    string,
    {
      value: string;
      offset: number;
    }
  >;
  immutableReferences?: Record<string, unknown>;
  transformations?: Transformations;
  transformationValues?: TransformationValues;
}

export type Transformations = Array<
  | LibraryTransformation
  | ConstructorArgumentTransformation
  | ImmutableTransformation
  | CallProtectionTransformation
  | CBORAuxdataTransformation
>;

export interface TransformationValues {
  libraries?: Record<string, string>;
  constructorArguments?: string;
  immutables?: Record<string, string>;
  callProtection?: string;
  cborAuxdata?: Record<string, string>;
}

interface Transformation {
  reason: string;
  type: "insert" | "replace";
  offset: number;
}

interface CallProtectionTransformation extends Transformation {
  type: "replace";
  reason: "callProtection";
}

interface LibraryTransformation extends Transformation {
  type: "replace";
  reason: "library";
  id: string;
}

interface ImmutableTransformation extends Transformation {
  type: "replace";
  reason: "immutable";
  id: string;
}

interface CBORAuxdataTransformation extends Transformation {
  type: "replace";
  reason: "cborAuxdata";
  id: string;
}

export interface ConstructorArgumentTransformation extends Transformation {
  type: "insert";
  reason: "constructorArguments";
}

export interface DeploymentData {
  transactionHash: string;
  blockNumber: string;
  transactionIndex: string;
  deployer: string;
}

export interface SourceData {
  content: string;
}

export interface CompilationData {
  language: string;
  compiler: string;
  compilerVersion: string;
  compilerSettings: Record<string, unknown>;
  name: string;
  fullyQualifiedName: string;
}

export interface AbiItem {
  name?: string;
  type: string;
  inputs?: AbiInput[];
  outputs?: AbiOutput[];
  payable?: boolean;
  constant?: boolean;
  stateMutability?: string;
  anonymous?: boolean;
}

export interface AbiInput {
  name: string;
  type: string;
  indexed?: boolean;
}

export interface AbiOutput {
  name: string;
  type: string;
}

export interface ProxyResolutionData {
  isProxy: boolean;
  proxyType: string;
  implementations: ProxyImplementation[];
}

export interface ProxyImplementation {
  address: string;
  name: string;
}

export interface StorageLayoutType {
  label: string;
  encoding: string;
  numberOfBytes: string;
  key?: string;
  value?: string;
  members?: Array<{
    slot: string;
    type: string;
    label: string;
    offset: number;
    contract: string;
  }>;
}

export interface StorageLayoutData {
  types: Record<string, StorageLayoutType> | null;
  storage: Array<{
    slot: string;
    type: string;
    label: string;
    offset: number;
    contract: string;
  }>;
}

export interface VyperStorageLayoutEntry {
  type: string;
  slot: number;
  n_slots: number;
}

export type VyperStorageLayout = Record<string, VyperStorageLayoutEntry>;

export function isSolidityStorageLayout(
  layout: StorageLayoutData | VyperStorageLayout
): layout is StorageLayoutData {
  return "storage" in layout && Array.isArray((layout as StorageLayoutData).storage);
}

export interface SignatureData {
  function: SignatureItem[];
  event: SignatureItem[];
  error: SignatureItem[];
}

export interface SignatureItem {
  signature: string;
  signatureHash32: string;
  signatureHash4: string;
}

// One verified deployment, as returned by /v2/contract/all-chains/{address}
export interface VerifiedContractMinimal {
  match: "match" | "exact_match" | null;
  creationMatch: "match" | "exact_match" | null;
  runtimeMatch: "match" | "exact_match" | null;
  matchId: string;
  chainId: string;
  address: string;
  verifiedAt: string;
}
