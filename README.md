# @tetherto/wdk-wallet-evm

**Note**: This package is currently in beta. Please test thoroughly in development environments before using in production.

A simple and secure package to manage BIP-44 wallets for EVM-compatible blockchains. This package provides a clean API for creating, managing, and interacting with Ethereum-compatible wallets using BIP-39 seed phrases and EVM-specific derivation paths.

## 🔍 About WDK

This module is part of the [**WDK (Wallet Development Kit)**](https://wallet.tether.io/) project, which empowers developers to build secure, non-custodial wallets with unified blockchain access, stateless architecture, and complete user control.

For detailed documentation about the complete WDK ecosystem, visit [docs.wallet.tether.io](https://docs.wallet.tether.io).

## 🌟 Features

- **BIP-39 Seed Phrase Support**: Generate and validate BIP-39 mnemonic seed phrases
- **EVM Derivation Paths**: Support for BIP-44 standard derivation paths for Ethereum (m/44'/60')
- **Multi-Account Management**: Create and manage multiple accounts from a single seed phrase
- **Transaction Management**: Send transactions and get fee estimates with EIP-1559 support
- **ERC20 Support**: Query native token and ERC20 token balances using smart contract interactions
- **Signer Submodule**: Create your own signer from ISignerEvm, support for Seed and Ledger signers

## ⬇️ Installation

To install the `@tetherto/wdk-wallet-evm` package, follow these instructions:

You can install it using npm:

```bash
npm install @tetherto/wdk-wallet-evm
```

## 🚀 Quick Start

### Importing from `@tetherto/wdk-wallet-evm`

```javascript
import WalletManagerEvm, {
  WalletAccountEvm,
  WalletAccountReadOnlyEvm,
} from "@tetherto/wdk-wallet-evm";

// Signers are exported under the /signers subpath
import {
  SeedSignerEvm,
  PrivateKeySignerEvm,
  LedgerSignerEvm,
} from "@tetherto/wdk-wallet-evm/signers";
```

### Create a Wallet Manager (seed-based)

```javascript
import WalletManagerEvm from "@tetherto/wdk-wallet-evm";
import { SeedSignerEvm } from "@tetherto/wdk-wallet-evm/signers";

// Use a BIP-39 seed phrase (replace with your own secure phrase)
const seedPhrase =
  "test only example nut use this real life secret phrase must random";

// Create a root signer from the seed phrase
const root = new SeedSignerEvm(mnemonic);

// Create wallet manager with provider config (provider is required for chain ops)
const wallet = new WalletManagerEvm(root, {
  // Option 1: Using RPC URL
  provider: "https://eth-mainnet.g.alchemy.com/v2/your-api-key", // any EVM RPC
  transferMaxFee: 100000000000000n, // Optional: max fee in wei (BigInt)
});

// OR

// Option 2: Using EIP-1193 provider (e.g., from browser wallet)
const wallet2 = new WalletManagerEvm(root, {
  provider: window.ethereum, // EIP-1193 provider
  transferMaxFee: 100000000000000n, // Optional
});

// Get a full access account
const account0 = await wallet.getAccount(0);

// Convert to a read-only account
const readOnlyAccount = await account0.toReadOnlyAccount();
```

### Single Account (no manager): Private key or Ledger

```javascript
import { WalletAccountEvm } from "@tetherto/wdk-wallet-evm";
import {
  PrivateKeySignerEvm,
  LedgerSignerEvm,
} from "@tetherto/wdk-wallet-evm/signers";

// From a raw private key (hex string or bytes)
const pkSigner = new PrivateKeySignerEvm("0x0123...abcd");
const pkAccount = new WalletAccountEvm(pkSigner, {
  provider: "https://eth-mainnet.g.alchemy.com/v2/your-api-key",
});

// From a Ledger hardware wallet (browser environment, WebHID)
// Note: You will be prompted to connect and open the Ethereum app on the device.
const ledgerSigner = new LedgerSignerEvm("0'/0/0");
const ledgerAccount = new WalletAccountEvm(ledgerSigner, {
  provider: window.ethereum,
});
await ledgerAccount.getAddress(); // ensure connection and address resolution
```

### Managing Multiple Accounts (seed-based manager)

```javascript
import WalletManagerEvm from "@tetherto/wdk-wallet-evm";
import { SeedSignerEvm } from "@tetherto/wdk-wallet-evm/signers";

const root = new SeedSignerEvm(mnemonic);
const wallet = new WalletManagerEvm(root, {
  provider: "https://eth-mainnet.g.alchemy.com/v2/your-api-key",
});

// Get the first account (index 0)
const account = await wallet.getAccount(0); // m/44'/60'/0'/0/0
const address = await account.getAddress(); // 0x...
console.log("Account 0 address:", address);

// Get the second account (index 1)
const account1 = await wallet.getAccount(1); // m/44'/60'/0'/0/1
const address1 = await account1.getAddress(); // 0x...
console.log("Account 1 address:", address1);

// Get account by custom derivation path
// Full path will be m/44'/60'/0'/0/5
const customAccount = await wallet.getAccountByPath("0'/0/5");
const customAddress = await customAccount.getAddress();
console.log("Custom account address:", customAddress);

// Note: All addresses are checksummed Ethereum addresses (0x...)
// All accounts inherit the provider configuration from the wallet manager
```

### Checking Balances

#### Owned Account

For accounts where you have the seed phrase and full access:

```javascript
// Assume wallet and account are already created
// Get native token balance (in wei)
const balance = await account.getBalance();
console.log("Native balance:", balance, "wei"); // 1 ETH = 1000000000000000000 wei

// Get ERC20 token balance
const tokenContract = "0x..."; // ERC20 contract address
const tokenBalance = await account.getTokenBalance(tokenContract);
console.log("Token balance:", tokenBalance);

// Note: Provider is required for balance checks
// Make sure wallet was created with a provider configuration
```

#### Read-Only Account

For addresses where you don't have the seed phrase:

```javascript
import { WalletAccountReadOnlyEvm } from "@tetherto/wdk-wallet-evm";

// Create a read-only account
const readOnlyAccount = new WalletAccountReadOnlyEvm("0x...", {
  // Ethereum address
  provider: "https://eth-mainnet.g.alchemy.com/v2/your-api-key", // Required for balance checks
});

// Check native token balance
const balance = await readOnlyAccount.getBalance();
console.log("Native balance:", balance, "wei");

// Check ERC20 token balance using contract
const tokenBalance = await readOnlyAccount.getTokenBalance("0x..."); // ERC20 contract address
console.log("Token balance:", tokenBalance);

// Note: ERC20 balance checks use the standard balanceOf(address) function
// Make sure the contract address is correct and implements the ERC20 standard
```

### Sending Transactions

Send native tokens and estimate fees using `WalletAccountEvm`. Supports EIP-1559 and auto-populates gas/fee fields where possible.

```javascript
// Send native tokens
// Modern EIP-1559 style transaction (recommended)
const result = await account.sendTransaction({
  to: "0x...", // Recipient address
  value: 1000000000000000000n, // 1 ETH in wei
  maxFeePerGas: 30000000000n, // Optional: max fee per gas (in wei)
  maxPriorityFeePerGas: 2000000000n, // Optional: max priority fee per gas (in wei)
});
console.log("Transaction hash:", result.hash);
console.log("Transaction fee:", result.fee, "wei");

// OR Legacy style transaction
const legacyResult = await account.sendTransaction({
  to: "0x...",
  value: 1000000000000000000n,
  gasPrice: 20000000000n, // Optional: legacy gas price (in wei)
  gasLimit: 21000, // Optional: gas limit
});

// Get transaction fee estimate
const quote = await account.quoteSendTransaction({
  to: "0x...",
  value: 1000000000000000000n,
});
console.log("Estimated fee:", quote.fee, "wei");
```

### Token Transfers

Transfer ERC20 tokens and estimate fees using `WalletAccountEvm`. Uses standard ERC20 `transfer` function.

```javascript
// Transfer ERC20 tokens
const transferResult = await account.transfer({
  token: "0x...", // ERC20 contract address
  recipient: "0x...", // Recipient's address
  amount: 1000000n, // Amount in token's base units (use BigInt for large numbers)
});
console.log("Transfer hash:", transferResult.hash);
console.log("Transfer fee:", transferResult.fee, "wei");

// Quote token transfer fee
const transferQuote = await account.quoteTransfer({
  token: "0x...", // ERC20 contract address
  recipient: "0x...", // Recipient's address
  amount: 1000000n, // Amount in token's base units
});
console.log("Transfer fee estimate:", transferQuote.fee, "wei");
```

### Token Approvals

Approve a spender for a specific amount (uses ERC20 `approve`):

```javascript
const approval = await account.approve({
  token: "0x...", // ERC20 contract
  spender: "0x...", // Spender address
  amount: 1000000n, // Allowance amount in base units
});
console.log("Approval tx hash:", approval.hash);
```

### Message Signing and Verification

Sign and verify messages using `WalletAccountEvm`.

```javascript
// Sign a message
const message = "Hello, Ethereum!";
const signature = await account.sign(message);
console.log("Signature:", signature);

// Verify a signature
const isValid = await account.verify(message, signature);
console.log("Signature valid:", isValid);
```

### Fee Management

Retrieve current fee rates using `WalletManagerEvm`. Supports EIP-1559 fee model.

```javascript
// Get current fee rates
const feeRates = await wallet.getFeeRates();
console.log("Normal fee rate:", feeRates.normal, "wei"); // 1.1x base fee
console.log("Fast fee rate:", feeRates.fast, "wei"); // 2.0x base fee
```

### Memory Management

Clear sensitive data from memory using `dispose` methods in `WalletAccountEvm` and `WalletManagerEvm`.

```javascript
// Dispose wallet accounts to clear private keys from memory
account.dispose();

// Dispose entire wallet manager
wallet.dispose();
```

## 🔐 Signers

Signers provide the cryptographic primitives for accounts. There are three signer implementations:

- **SeedSignerEvm (root + child)**: Derives accounts from a BIP-39 seed using the BIP-44 Ethereum path. Can act as a root (for `WalletManagerEvm`) and derive children (for `WalletAccountEvm`).
- **PrivateKeySignerEvm (child only)**: Wraps a raw private key in a memory-safe buffer. Cannot derive. Use directly with `WalletAccountEvm`. Not supported by `WalletManagerEvm`.
- **LedgerSignerEvm (child only)**: Hardware-backed signer using Ledger DMK + WebHID. Construct it at a specific relative path (e.g., `"0'/0/0"`) and use with `WalletAccountEvm`.

Examples:

```javascript
// Root + manager (seed)
import WalletManagerEvm from "@tetherto/wdk-wallet-evm";
import { SeedSignerEvm } from "@tetherto/wdk-wallet-evm/signers";
const root = new SeedSignerEvm(mnemonic);
const wallet = new WalletManagerEvm(root, { provider: "https://..." });
const account0 = await wallet.getAccount(0);

// Single account from a private key
import { WalletAccountEvm } from "@tetherto/wdk-wallet-evm";
import { PrivateKeySignerEvm } from "@tetherto/wdk-wallet-evm/signers";
const signer = new PrivateKeySignerEvm("0x0123...");
const account = new WalletAccountEvm(signer, { provider: "https://..." });

// Single account from a Ledger device (browser)
import { LedgerSignerEvm } from "@tetherto/wdk-wallet-evm/signers";
const ledgerSigner = new LedgerSignerEvm("0'/0/0");
const ledgerAccount = new WalletAccountEvm(ledgerSigner, {
  provider: window.ethereum,
});
```

## 📚 API Reference

### Table of Contents

| Class                                                 | Description                                                                                             | Methods                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [WalletManagerEvm](#walletmanagerevm)                 | Manage seed-based EVM wallets and derive accounts. Extends `WalletManager` from `@tetherto/wdk-wallet`. | [Constructor](#constructor), [Methods](#methods)                                |
| [WalletAccountEvm](#walletaccountevm)                 | Individual EVM wallet account. Extends `WalletAccountReadOnlyEvm` and implements `IWalletAccount`.      | [Constructor](#constructor-1), [Methods](#methods-1), [Properties](#properties) |
| [WalletAccountReadOnlyEvm](#walletaccountreadonlyevm) | Read-only EVM wallet account. Extends `WalletAccountReadOnly`.                                          | [Constructor](#constructor-2), [Methods](#methods-2)                            |

### WalletManagerEvm

The main class for managing EVM wallets.  
Extends `WalletManager` from `@tetherto/wdk-wallet`.

#### Constructor

```javascript
new WalletManagerEvm(signer, config);
```

**Parameters:**

- `signer` (object): Root signer (e.g., `SeedSignerEvm`). Must support `derive`. Private key signers are not supported for managers.
- `config` (object, optional): Configuration object
  - `provider` (string | Eip1193Provider): RPC endpoint URL or EIP-1193 provider instance
  - `transferMaxFee` (number | bigint, optional): Maximum fee amount for transfer operations (in wei)

**Example:**

```javascript
import { SeedSignerEvm } from "@tetherto/wdk-wallet-evm/signers";
const root = new SeedSignerEvm(mnemonic);
const wallet = new WalletManagerEvm(root, {
  provider: "https://eth-mainnet.g.alchemy.com/v2/your-api-key",
  transferMaxFee: 100000000000000n, // Maximum fee in wei
});
```

#### Methods

| Method                   | Description                                                      | Returns                                   |
| ------------------------ | ---------------------------------------------------------------- | ----------------------------------------- |
| `getAccount(index)`      | Returns a wallet account at the specified index                  | `Promise<WalletAccountEvm>`               |
| `getAccountByPath(path)` | Returns a wallet account at the specified BIP-44 derivation path | `Promise<WalletAccountEvm>`               |
| `getFeeRates()`          | Returns current fee rates for transactions                       | `Promise<{normal: bigint, fast: bigint}>` |
| `dispose()`              | Disposes all wallet accounts, clearing private keys from memory  | `void`                                    |

### WalletAccountEvm

Represents an individual wallet account. Implements `IWalletAccount` from `@tetherto/wdk-wallet`.

#### Constructor

```javascript
new WalletAccountEvm(signer, config);
```

**Parameters:**

- `signer` (object): A child signer implementing the EVM signer interface (e.g., a derived `SeedSignerEvm`, `PrivateKeySignerEvm`, or `LedgerSignerEvm`).
- `config` (object, optional): Configuration object
  - `provider` (string | Eip1193Provider): RPC endpoint URL or EIP-1193 provider instance
  - `transferMaxFee` (number | bigint, optional): Maximum fee amount for transfer operations (in wei)

Legacy convenience:

```javascript
// Create a child account directly from seed + path (legacy helper)
const account = WalletAccountEvm.fromSeed(mnemonic, "0'/0/0", {
  provider: "https://...",
});
```

#### Methods

| Method                          | Description                                                    | Returns                                |
| ------------------------------- | -------------------------------------------------------------- | -------------------------------------- |
| `getAddress()`                  | Returns the account's address                                  | `Promise<string>`                      |
| `sign(message)`                 | Signs a message using the account's private key                | `Promise<string>`                      |
| `verify(message, signature)`    | Verifies a message signature                                   | `Promise<boolean>`                     |
| `sendTransaction(tx)`           | Sends an EVM transaction                                       | `Promise<{hash: string, fee: bigint}>` |
| `quoteSendTransaction(tx)`      | Estimates the fee for an EVM transaction                       | `Promise<{fee: bigint}>`               |
| `transfer(options)`             | Transfers ERC20 tokens to another address                      | `Promise<{hash: string, fee: bigint}>` |
| `quoteTransfer(options)`        | Estimates the fee for an ERC20 transfer                        | `Promise<{fee: bigint}>`               |
| `approve(options)`              | Approves ERC20 allowance for a spender                         | `Promise<{hash: string, fee: bigint}>` |
| `getBalance()`                  | Returns the native token balance (in wei)                      | `Promise<bigint>`                      |
| `getTokenBalance(tokenAddress)` | Returns the balance of a specific ERC20 token                  | `Promise<bigint>`                      |
| `dispose()`                     | Disposes the wallet account, clearing private keys from memory | `void`                                 |

##### `sendTransaction(tx)`

Sends an EVM transaction.

**Parameters:**

- `tx` (object): The transaction object
  - `to` (string): Recipient address
  - `value` (number | bigint): Amount in wei
  - `data` (string, optional): Transaction data in hex format
  - `gasLimit` (number | bigint, optional): Maximum gas units
  - `gasPrice` (number | bigint, optional): Legacy gas price in wei
  - `maxFeePerGas` (number | bigint, optional): EIP-1559 max fee per gas in wei
  - `maxPriorityFeePerGas` (number | bigint, optional): EIP-1559 max priority fee per gas in wei

**Returns:** `Promise<{hash: string, fee: bigint}>` - Object containing hash and fee (in wei)

#### Properties

| Property  | Type     | Description                                         |
| --------- | -------- | --------------------------------------------------- |
| `index`   | `number` | The derivation path's index of this account         |
| `path`    | `string` | The full derivation path of this account            |
| `keyPair` | `object` | The account's key pair (⚠️ Contains sensitive data) |

⚠️ **Security Note**: The `keyPair` property contains sensitive cryptographic material. Never log, display, or expose the private key.

### WalletAccountReadOnlyEvm

Represents a read-only wallet account.

#### Constructor

```javascript
new WalletAccountReadOnlyEvm(address, config);
```

**Parameters:**

- `address` (string): The account's address
- `config` (object, optional): Configuration object
  - `provider` (string | Eip1193Provider): RPC endpoint URL or EIP-1193 provider instance

#### Methods

| Method                          | Description                                   | Returns                  |
| ------------------------------- | --------------------------------------------- | ------------------------ |
| `getBalance()`                  | Returns the native token balance (in wei)     | `Promise<bigint>`        |
| `getTokenBalance(tokenAddress)` | Returns the balance of a specific ERC20 token | `Promise<bigint>`        |
| `quoteSendTransaction(tx)`      | Estimates the fee for an EVM transaction      | `Promise<{fee: bigint}>` |
| `quoteTransfer(options)`        | Estimates the fee for an ERC20 transfer       | `Promise<{fee: bigint}>` |

## 🌐 Supported Networks

This package works with any EVM-compatible blockchain, including:

- **Ethereum Mainnet**
- **Ethereum Testnets** (Sepolia, etc.)
- **Layer 2 Networks** (Arbitrum, Optimism, etc.)
- **Other EVM Chains** (Polygon, Avalanche C-Chain, etc.)

## 🔒 Security Considerations

- **Seed Phrase Security**: Always store your seed phrase securely and never share it
- **Private Key Management**: The package handles private keys internally with memory safety features
- **Provider Security**: Use trusted RPC endpoints and consider running your own node for production
- **Transaction Validation**: Always validate transaction details before signing
- **Memory Cleanup**: Use the `dispose()` method to clear private keys from memory when done
- **Fee Limits**: Set `transferMaxFee` in config to prevent excessive transaction fees
- **Gas Estimation**: Always estimate gas before sending transactions
- **EIP-1559**: Consider using EIP-1559 fee model for better gas price estimation
- **Contract Interactions**: Verify contract addresses and token decimals before transfers

## 🛠️ Development

### Building

```bash
# Install dependencies
npm install

# Build TypeScript definitions
npm run build:types

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 📜 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🆘 Support

For support, please open an issue on the GitHub repository.

---
