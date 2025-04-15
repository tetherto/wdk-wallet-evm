import { HDNodeWallet } from "ethers";

export interface WalletDetails {
  address: string;
  publicKey: string;
  privateKey: string;
  derivationPath: string;
}

export class WDKWalletManagementEVM {
  createWallet(): Promise<HDNodeWallet>;
  restoreWalletFromPhrase(mnemonicPhrase: string): Promise<HDNodeWallet>;
  derivePrivateKeysFromPhrase(mnemonicPhrase: string, derivationPath: string): Promise<string>;
  createWalletByIndex(mnemonicPhrase: string, index?: number): Promise<WalletDetails | null>;
} 