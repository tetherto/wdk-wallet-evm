# WDK Wallet Management EVM

A TypeScript/JavaScript package for managing Ethereum wallets using HD (Hierarchical Deterministic) wallets. This package provides utilities for creating, restoring, and managing EVM-compatible wallets using the ethers.js library.

## Features

- Create new random HD wallets
- Restore wallets from mnemonic phrases
- Derive private keys from mnemonic phrases using custom derivation paths
- Create multiple wallets from a single mnemonic phrase using different indices
- Full TypeScript support

## Installation

```bash
npm install https://github.com/tetherto/wdk-wallet-evm
# or
yarn add https://github.com/tetherto/wdk-wallet-evm
```

## Dependencies

- ethers.js (^6.0.0)

## Usage

```typescript
import { WDKWalletManagementEVM } from '@wdk/wallet-evm';

const walletManager = new WDKWalletManagementEVM();

// Create a new random wallet
const newWallet = await walletManager.createWallet();
console.log('New wallet address:', newWallet.address);

// Restore a wallet from mnemonic phrase
const mnemonic = "your twelve word mnemonic phrase here";
const restoredWallet = await walletManager.restoreWalletFromPhrase(mnemonic);

// Derive private keys using a custom derivation path
const derivationPath = "m/44'/60'/0'/0/0";
const privateKey = await walletManager.derivePrivateKeysFromPhrase(mnemonic, derivationPath);

// Create a wallet using a specific index
const walletDetails = await walletManager.createWalletByIndex(mnemonic, 0);
console.log('Wallet details:', walletDetails);
```

## API Reference

### `createWallet()`

Creates a new random HD wallet.

```typescript
async createWallet(): Promise<HDNodeWallet>
```

### `restoreWalletFromPhrase(mnemonicPhrase: string)`

Restores a wallet from a mnemonic phrase.

```typescript
async restoreWalletFromPhrase(mnemonicPhrase: string): Promise<HDNodeWallet>
```

### `derivePrivateKeysFromPhrase(mnemonicPhrase: string, derivationPath: string)`

Derives private keys from a mnemonic phrase using a specific derivation path.

```typescript
async derivePrivateKeysFromPhrase(mnemonicPhrase: string, derivationPath: string): Promise<string>
```

### `createWalletByIndex(mnemonicPhrase: string, index?: number)`

Creates a wallet using a specific index from a mnemonic phrase.

```typescript
async createWalletByIndex(mnemonicPhrase: string, index?: number): Promise<{
  address: string;
  publicKey: string;
  privateKey: string;
  derivationPath: string;
} | null>
```

## Error Handling

The package includes comprehensive error handling for common scenarios:

- Invalid mnemonic phrases
- Empty mnemonic phrases
- Failed wallet creation
- Failed wallet restoration
- Failed key derivation

