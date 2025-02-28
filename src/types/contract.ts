export interface ContractData {
  matchId: string;
  creationMatch: string;
  runtimeMatch: string;
  verifiedAt: string;
  creationBytecode: BytecodeData;
  runtimeBytecode: BytecodeData;
  deployment?: DeploymentData;
  sources: Record<string, SourceData>;
  compilation: CompilationData;
  abi: AbiItem[];
  metadata: Record<string, unknown>;
  storageLayout: Record<string, unknown> | null;
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
  cborAuxdata?: Record<string, unknown>;
  immutableReferences?: Record<string, unknown>;
  transformations?: Array<Record<string, unknown>>;
  transformationValues?: Record<string, unknown>;
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
