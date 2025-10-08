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

## ⬇️ Installation

To install the `@tetherto/wdk-wallet-evm` package, follow these instructions:

You can install it using npm:

```bash
npm install @tetherto/wdk-wallet-evm
```

## 🚀 Quick Start

### Importing from `@tetherto/wdk-wallet-evm`

### Creating a New Wallet

```javascript
import WalletManagerEvm, { WalletAccountEvm, WalletAccountReadOnlyEvm } from '@tetherto/wdk-wallet-evm'

// Use a BIP-39 seed phrase (replace with your own secure phrase)
const seedPhrase = 'test only example nut use this real life secret phrase must random'

// Create wallet manager with provider config
const wallet = new WalletManagerEvm(seedPhrase, {
  // Option 1: Using RPC URL
  provider: 'https://eth-mainnet.g.alchemy.com/v2/your-api-key', // or any EVM RPC endpoint
  transferMaxFee: 100000000000000 // Optional: Maximum fee in wei
})

// OR

// Option 2: Using EIP-1193 provider (e.g., from browser wallet)
const wallet2 = new WalletManagerEvm(seedPhrase, {
  provider: window.ethereum, // EIP-1193 provider
  transferMaxFee: 100000000000000 // Optional: Maximum fee in wei
})

// Get a full access account
const account = await wallet.getAccount(0)

// Convert to a read-only account
const readOnlyAccount = await account.toReadOnlyAccount()
```

### Managing Multiple Accounts

```javascript
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

// Assume wallet is already created
// Get the first account (index 0)
const account = await wallet.getAccount(0)
const address = await account.getAddress()
console.log('Account 0 address:', address)

// Get the second account (index 1)
const account1 = await wallet.getAccount(1)
const address1 = await account1.getAddress()
console.log('Account 1 address:', address1)

// Get account by custom derivation path
// Full path will be m/44'/60'/0'/0/5
const customAccount = await wallet.getAccountByPath("0'/0/5")
const customAddress = await customAccount.getAddress()
console.log('Custom account address:', customAddress)

// Note: All addresses are checksummed Ethereum addresses (0x...)
// All accounts inherit the provider configuration from the wallet manager
```

### Checking Balances

#### Owned Account

For accounts where you have the seed phrase and full access:

```javascript
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

// Assume wallet and account are already created
// Get native token balance (in wei)
const balance = await account.getBalance()
console.log('Native balance:', balance, 'wei') // 1 ETH = 1000000000000000000 wei

// Get ERC20 token balance
const tokenContract = '0x...'; // ERC20 contract address
const tokenBalance = await account.getTokenBalance(tokenContract);
console.log('Token balance:', tokenBalance);

// Note: Provider is required for balance checks
// Make sure wallet was created with a provider configuration
```

#### Read-Only Account

For addresses where you don't have the seed phrase:

```javascript
import { WalletAccountReadOnlyEvm } from '@tetherto/wdk-wallet-evm'

// Create a read-only account
const readOnlyAccount = new WalletAccountReadOnlyEvm('0x...', { // Ethereum address
  provider: 'https://eth-mainnet.g.alchemy.com/v2/your-api-key' // Required for balance checks
})

// Check native token balance
const balance = await readOnlyAccount.getBalance()
console.log('Native balance:', balance, 'wei')

// Check ERC20 token balance using contract
const tokenBalance = await readOnlyAccount.getTokenBalance('0x...') // ERC20 contract address
console.log('Token balance:', tokenBalance)

// Note: ERC20 balance checks use the standard balanceOf(address) function
// Make sure the contract address is correct and implements the ERC20 standard
```

### Sending Transactions

Send native tokens and estimate fees using `WalletAccountEvm`. Supports EIP-1559 fee model.

```javascript
// Send native tokens
// Modern EIP-1559 style transaction (recommended)
const result = await account.sendTransaction({
  to: '0x...', // Recipient address
  value: 1000000000000000000n, // 1 ETH in wei
  maxFeePerGas: 30000000000, // Optional: max fee per gas (in wei)
  maxPriorityFeePerGas: 2000000000 // Optional: max priority fee per gas (in wei)
})
console.log('Transaction hash:', result.hash)
console.log('Transaction fee:', result.fee, 'wei')

// OR Legacy style transaction
const legacyResult = await account.sendTransaction({
  to: '0x...',
  value: 1000000000000000000n,
  gasPrice: 20000000000n, // Optional: legacy gas price (in wei)
  gasLimit: 21000 // Optional: gas limit
})

// Get transaction fee estimate
const quote = await account.quoteSendTransaction({
  to: '0x...',
  value: 1000000000000000000n
});
console.log('Estimated fee:', quote.fee, 'wei');
```

### Token Transfers

Transfer ERC20 tokens and estimate fees using `WalletAccountEvm`. Uses standard ERC20 `transfer` function.

```javascript
// Transfer ERC20 tokens
const transferResult = await account.transfer({
  token: '0x...',      // ERC20 contract address
  recipient: '0x...',  // Recipient's address
  amount: 1000000n     // Amount in token's base units (use BigInt for large numbers)
});
console.log('Transfer hash:', transferResult.hash);
console.log('Transfer fee:', transferResult.fee, 'wei');

// Quote token transfer fee
const transferQuote = await account.quoteTransfer({
  token: '0x...',      // ERC20 contract address
  recipient: '0x...',  // Recipient's address
  amount: 1000000n     // Amount in token's base units
})
console.log('Transfer fee estimate:', transferQuote.fee, 'wei')
```

### Message Signing and Verification

Sign and verify messages using `WalletAccountEvm`.

```javascript
// Sign a message
const message = 'Hello, Ethereum!'
const signature = await account.sign(message)
console.log('Signature:', signature)

// Verify a signature
const isValid = await account.verify(message, signature)
console.log('Signature valid:', isValid)
```

### Fee Management

Retrieve current fee rates using `WalletManagerEvm`. Supports EIP-1559 fee model.

```javascript
// Get current fee rates
const feeRates = await wallet.getFeeRates();
console.log('Normal fee rate:', feeRates.normal, 'wei'); // 1.1x base fee
console.log('Fast fee rate:', feeRates.fast, 'wei');     // 2.0x base fee
```

### Memory Management

Clear sensitive data from memory using `dispose` methods in `WalletAccountEvm` and `WalletManagerEvm`.

```javascript
// Dispose wallet accounts to clear private keys from memory
account.dispose()

// Dispose entire wallet manager
wallet.dispose()
```

## 📚 API Reference

### Table of Contents

### Table of Contents

| Class | Description | Methods |
|-------|-------------|---------|
| [WalletManagerEvm](#walletmanagerevm) | Main class for managing EVM wallets. Extends `WalletManager` from `@tetherto/wdk-wallet`. | [Constructor](#constructor), [Methods](#methods) |
| [WalletAccountEvm](#walletaccountevm) | Individual EVM wallet account implementation. Extends `WalletAccountReadOnlyEvm` and implements `IWalletAccount` from `@tetherto/wdk-wallet`. | [Constructor](#constructor-1), [Methods](#methods-1), [Properties](#properties) |
| [WalletAccountReadOnlyEvm](#walletaccountreadonlyevm) | Read-only EVM wallet account. Extends `WalletAccountReadOnly` from `@tetherto/wdk-wallet`. | [Constructor](#constructor-2), [Methods](#methods-2) |

### WalletManagerEvm

The main class for managing EVM wallets.  
Extends `WalletManager` from `@tetherto/wdk-wallet`.

#### Constructor

```javascript
new WalletManagerEvm(seed, config)
```

**Parameters:**
- `seed` (string | Uint8Array): BIP-39 mnemonic seed phrase or seed bytes
- `config` (object, optional): Configuration object
  - `provider` (string | Eip1193Provider): RPC endpoint URL or EIP-1193 provider instance
  - `transferMaxFee` (number | bigint, optional): Maximum fee amount for transfer operations (in wei)

**Example:**
```javascript
const wallet = new WalletManagerEvm(seedPhrase, {
  provider: 'https://eth-mainnet.g.alchemy.com/v2/your-api-key',
  transferMaxFee: '100000000000000' // Maximum fee in wei
})
```

#### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `getAccount(index)` | Returns a wallet account at the specified index | `Promise<WalletAccountEvm>` |
| `getAccountByPath(path)` | Returns a wallet account at the specified BIP-44 derivation path | `Promise<WalletAccountEvm>` |
| `getFeeRates()` | Returns current fee rates for transactions | `Promise<{normal: bigint, fast: bigint}>` |
| `dispose()` | Disposes all wallet accounts, clearing private keys from memory | `void` |

### WalletAccountEvm

Represents an individual wallet account. Implements `IWalletAccount` from `@tetherto/wdk-wallet`.

#### Constructor

```javascript
new WalletAccountEvm(seed, path, config)
```

**Parameters:**
- `seed` (string | Uint8Array): BIP-39 mnemonic seed phrase or seed bytes
- `path` (string): BIP-44 derivation path (e.g., "0'/0/0")
- `config` (object, optional): Configuration object
  - `provider` (string | Eip1193Provider): RPC endpoint URL or EIP-1193 provider instance
  - `transferMaxFee` (number | bigint, optional): Maximum fee amount for transfer operations (in wei)

#### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `getAddress()` | Returns the account's address | `Promise<string>` |
| `sign(message)` | Signs a message using the account's private key | `Promise<string>` |
| `verify(message, signature)` | Verifies a message signature | `Promise<boolean>` |
| `sendTransaction(tx)` | Sends an EVM transaction | `Promise<{hash: string, fee: bigint}>` |
| `quoteSendTransaction(tx)` | Estimates the fee for an EVM transaction | `Promise<{fee: bigint}>` |
| `transfer(options)` | Transfers ERC20 tokens to another address | `Promise<{hash: string, fee: bigint}>` |
| `quoteTransfer(options)` | Estimates the fee for an ERC20 transfer | `Promise<{fee: bigint}>` |
| `getBalance()` | Returns the native token balance (in wei) | `Promise<bigint>` |
| `getTokenBalance(tokenAddress)` | Returns the balance of a specific ERC20 token | `Promise<bigint>` |
| `dispose()` | Disposes the wallet account, clearing private keys from memory | `void` |

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

| Property | Type | Description |
|----------|------|-------------|
| `index` | `number` | The derivation path's index of this account |
| `path` | `string` | The full derivation path of this account |
| `keyPair` | `object` | The account's key pair (⚠️ Contains sensitive data) |

⚠️ **Security Note**: The `keyPair` property contains sensitive cryptographic material. Never log, display, or expose the private key.

### WalletAccountReadOnlyEvm

Represents a read-only wallet account.

#### Constructor

```javascript
new WalletAccountReadOnlyEvm(address, config)
```

**Parameters:**
- `address` (string): The account's address
- `config` (object, optional): Configuration object
  - `provider` (string | Eip1193Provider): RPC endpoint URL or EIP-1193 provider instance

#### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `getBalance()` | Returns the native token balance (in wei) | `Promise<bigint>` |
| `getTokenBalance(tokenAddress)` | Returns the balance of a specific ERC20 token | `Promise<bigint>` |
| `quoteSendTransaction(tx)` | Estimates the fee for an EVM transaction | `Promise<{fee: bigint}>` |
| `quoteTransfer(options)` | Estimates the fee for an ERC20 transfer | `Promise<{fee: bigint}>` |

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
