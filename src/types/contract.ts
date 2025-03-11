export interface ContractData {
  matchId: string;
  creationMatch: string;
  runtimeMatch: string;
  verifiedAt: string;
  creationBytecode: BytecodeData;
  runtimeBytecode: BytecodeData;
  deployment: DeploymentData;
  sources: Record<string, SourceData>;
  compilation: CompilationData;
  abi: AbiItem[];
  metadata: Record<string, unknown>;
  storageLayout: StorageLayoutData;
  userdoc: Record<string, unknown>;
  devdoc: Record<string, unknown>;
  stdJsonInput: Record<string, unknown>;
  stdJsonOutput: Record<string, unknown>;
  proxyResolution?: ProxyResolutionData;
  match: string;
  chainId: string;
  address: string;
}

export interface BytecodeData {
  onchainBytecode: string;
  recompiledBytecode: string;
  sourceMap: string;
  linkReferences: Record<string, unknown>;
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
  LibraryTransformation | ConstructorArgumentTransformation | ImmutableTransformation | CallProtectionTransformation
>;

export interface TransformationValues {
  libraries?: Record<string, string>;
  constructorArguments?: string;
  immutables?: Record<string, string>;
  callProtection?: string;
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
