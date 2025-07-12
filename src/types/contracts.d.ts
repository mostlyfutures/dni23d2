export interface ContractABI {
  _format: string;
  contractName: string;
  sourceName: string;
  abi: any[];
  bytecode: string;
  deployedBytecode: string;
  linkReferences: any;
  deployedLinkReferences: any;
}

export interface DarkPoolDEXABI extends ContractABI {
  contractName: 'DarkPoolDEX';
}

export interface AtomicSwapABI extends ContractABI {
  contractName: 'AtomicSwap';
} 