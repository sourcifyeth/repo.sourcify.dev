export interface ChainData {
  name: string;
  title?: string;
  chainId: number;
  rpc: string[];
  traceSupportedRPCs?: {
    type: string;
    index: number;
  }[];
  supported: boolean;
  etherscanAPI?: string;
}

export interface ChainsResponse {
  [key: string]: ChainData;
}
