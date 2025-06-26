# @wdk/wallet-evm

A simple and secure package to manage BIP-32 wallets for EVM (Ethereum Virtual Machine) blockchains. This package provides a clean API for creating, managing, and interacting with Ethereum-compatible wallets using BIP-39 seed phrases and BIP-44 derivation paths.

## About WDK

This module is part of the **WDK (Wallet Development Kit)** project, which empowers developers to build secure, non-custodial wallets with unified blockchain access, stateless architecture, and complete user control. 

For detailed documentation about the complete WDK ecosystem, visit [docs.wallet.tether.io](https://docs.wallet.tether.io).

## Features

- **BIP-39 Seed Phrase Support**: Generate and validate BIP-39 mnemonic seed phrases
- **BIP-44 Derivation Paths**: Support for standard BIP-44 derivation paths for EVM chains
- **Multi-Account Management**: Create and manage multiple accounts from a single seed phrase
- **EVM Chain Support**: Works with any EVM-compatible blockchain (Ethereum, Polygon, BSC, etc.)
- **Message Signing**: Sign and verify messages using EIP-191 standard
- **Transaction Management**: Send transactions and get fee estimates
- **Token Support**: Query native token and ERC-20 token balances
- **EIP-1559 Support**: Full support for EIP-1559 fee mechanism
- **TypeScript Support**: Full TypeScript definitions included
- **Memory Safety**: Secure private key management with automatic memory cleanup
- **Provider Flexibility**: Support for both RPC URLs and EIP-1193 providers

## Installation

```bash
npm install @wdk/wallet-evm
```

## Quick Start

### Creating a New Wallet

```javascript
import WalletManagerEvm from '@wdk/wallet-evm'

// Use a BIP-39 seed phrase (replace with your own secure phrase)
const seedPhrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

// Create wallet manager with RPC provider
const wallet = new WalletManagerEvm(seedPhrase, {
  provider: 'https://rpc.mevblocker.io/fast' // or any other RPC provider
})
```

### Managing Multiple Accounts

```javascript
// Get the first account (index 0)
const account = await wallet.getAccount(0)
const address = await account.getAddress()
console.log('Account 0 address:', address)

// Get the second account (index 1)
const account1 = await wallet.getAccount(1)
const address1 = await account1.getAddress()
console.log('Account 1 address:', address1)

// Get account by custom derivation path
const customAccount = await wallet.getAccountByPath("0'/0/5")
const customAddress = await customAccount.getAddress()
console.log('Custom account address:', customAddress)
```

### Checking Balances

```javascript
// Get native token balance (ETH, MATIC, BNB, etc.)
const balance = await account.getBalance()
console.log('Native balance:', balance, 'wei')

// Get ERC-20 token balance
const tokenAddress = '0x...'
const tokenBalance = await account.getTokenBalance(tokenAddress)
console.log('Token balance:', tokenBalance)
```

### Sending Transactions

```javascript
// Send native tokens
const result = await account.sendTransaction({
  to: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
  value: 1000000000000000000n, // 1 ETH in wei
  gasLimit: 21000
})
console.log('Transaction hash:', result.hash)
console.log('Transaction fee:', result.fee, 'wei')

// Get transaction fee estimate
const quote = await account.quoteSendTransaction({
  to: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
  value: 1000000000000000000n
})
console.log('Estimated fee:', quote.fee, 'wei')
```

### Token Transfers

```javascript
// Transfer ERC-20 tokens
const transferResult = await account.transfer({
  token: '0x...',
  recipient: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
  amount: 1000000000000000000n // 1 token in base units
})
console.log('Transfer hash:', transferResult.hash)
console.log('Transfer fee:', transferResult.fee, 'wei')

// Quote token transfer
const transferQuote = await account.quoteTransfer({
  token: '0x...',
  recipient: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
  amount: 1000000000000000000n
})
console.log('Transfer fee estimate:', transferQuote.fee, 'wei')
```

### Message Signing and Verification

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

```javascript
// Get current fee rates
const feeRates = await wallet.getFeeRates()
console.log('Normal fee rate:', feeRates.normal, 'wei')
console.log('Fast fee rate:', feeRates.fast, 'wei')

// Send transaction with custom gas settings
const txWithCustomGas = await account.sendTransaction({
  to: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
  value: 1000000000000000000n,
  maxFeePerGas: feeRates.fast,
  maxPriorityFeePerGas: 2000000000n // 2 gwei
})
```

### Memory Management

```javascript
// Dispose wallet accounts to clear private keys from memory
account.dispose()

// Dispose entire wallet manager
wallet.dispose()
```

## API Reference

### Table of Contents

| Class | Description | Methods |
|-------|-------------|---------|
| [WalletManagerEvm](#walletmanagerevm) | Main class for managing EVM wallets | [Constructor](#constructor), [Methods](#methods), [Properties](#properties) |
| [WalletAccountEvm](#walletaccountevm) | Individual wallet account implementation | [Constructor](#constructor-1), [Methods](#methods), [Properties](#properties-1) |

### WalletManagerEvm

The main class for managing EVM wallets. Extends `AbstractWalletManager` from `@wdk/wallet`.

#### Constructor

```javascript
new WalletManagerEvm(seed, config)
```

**Parameters:**
- `seed` (string | Uint8Array): BIP-39 mnemonic seed phrase or seed bytes
- `config` (object, optional): Configuration object
  - `provider` (string | Eip1193Provider, optional): RPC endpoint URL or EIP-1193 provider instance
  - `transferMaxFee` (number, optional): Maximum fee amount for transfer operations

**Example:**
```javascript
const wallet = new WalletManagerEvm(seedPhrase, {
  provider: 'https://rpc.mevblocker.io/fast',
  transferMaxFee: 5000000
})
```

#### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `getAccount(index)` | Returns a wallet account at the specified index | `Promise<WalletAccountEvm>` |
| `getAccountByPath(path)` | Returns a wallet account at the specified BIP-44 derivation path | `Promise<WalletAccountEvm>` |
| `getFeeRates()` | Returns current fee rates for normal and fast transactions | `Promise<{normal: number, fast: number}>` |
| `dispose()` | Disposes all wallet accounts, clearing private keys from memory | `void` |

##### `getAccount(index)`
Returns a wallet account at the specified index.

**Parameters:**
- `index` (number, optional): The index of the account to get (default: 0)

**Returns:** `Promise<WalletAccountEvm>` - The wallet account

**Example:**
```javascript
const account = await wallet.getAccount(0)
```

##### `getAccountByPath(path)`
Returns a wallet account at the specified BIP-44 derivation path.

**Parameters:**
- `path` (string): The derivation path (e.g., "0'/0/0")

**Returns:** `Promise<WalletAccountEvm>` - The wallet account

**Example:**
```javascript
const account = await wallet.getAccountByPath("0'/0/1")
```

##### `getFeeRates()`
Returns current fee rates for normal and fast transactions.

**Returns:** `Promise<FeeRates>` - Object containing normal and fast fee rates

**Example:**
```javascript
const feeRates = await wallet.getFeeRates()
console.log('Normal fee rate:', feeRates.normal, 'wei')
console.log('Fast fee rate:', feeRates.fast, 'wei')
```

##### `dispose()`
Disposes all wallet accounts, clearing private keys from memory.

**Example:**
```javascript
wallet.dispose()
```

#### Properties

##### `seed`
The wallet's seed phrase.

**Type:** `string | Uint8Array`

**Example:**
```javascript
console.log('Seed phrase:', wallet.seed)
```

### WalletAccountEvm

Represents an individual wallet account. Implements `IWalletAccount` from `@wdk/wallet`.

#### Constructor

```javascript
new WalletAccountEvm(seed, path, config)
```

**Parameters:**
- `seed` (string | Uint8Array): BIP-39 mnemonic seed phrase or seed bytes
- `path` (string): BIP-44 derivation path
- `config` (object, optional): Configuration object
  - `provider` (string | Eip1193Provider, optional): RPC endpoint URL or EIP-1193 provider instance
  - `transferMaxFee` (number, optional): Maximum fee amount for transfer operations

**Example:**
```javascript
const account = new WalletAccountEvm(seedPhrase, "0'/0/0", {
  provider: 'https://rpc.mevblocker.io/fast',
  transferMaxFee: 5000000
})
```

#### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| [`getAddress()`](#getaddress) | Returns the account's address | `Promise<string>` |
| [`sign(message)`](#signmessage) | Signs a message using the account's private key | `Promise<string>` |
| [`verify(message, signature)`](#verifymessage-signature) | Verifies a message signature | `Promise<boolean>` |
| [`sendTransaction(tx)`](#sendtransactiontx) | Sends a transaction and returns the result with hash and fee | `Promise<{hash: string, fee: number}>` |
| [`quoteSendTransaction(tx)`](#quotesendtransactiontx) | Estimates the fee for a transaction | `Promise<{fee: number}>` |
| [`transfer(options)`](#transferoptions) | Transfers ERC-20 tokens to another address | `Promise<{hash: string, fee: number}>` |
| [`quoteTransfer(options)`](#quotetransferoptions) | Estimates the fee for a token transfer | `Promise<{fee: number}>` |
| [`getBalance()`](#getbalance) | Returns the native token balance | `Promise<bigint>` |
| [`getTokenBalance(tokenAddress)`](#gettokenbalancetokenaddress) | Returns the balance of a specific ERC-20 token | `Promise<bigint>` |
| [`dispose()`](#dispose-1) | Disposes the wallet account, clearing private keys from memory | `void` |

##### `getAddress()`
Returns the account's address.

**Returns:** `Promise<string>` - The account's Ethereum address

**Example:**
```javascript
const address = await account.getAddress()
console.log('Account address:', address)
```

##### `sign(message)`
Signs a message using the account's private key.

**Parameters:**
- `message` (string): The message to sign

**Returns:** `Promise<string>` - The message signature

**Example:**
```javascript
const signature = await account.sign('Hello, World!')
console.log('Signature:', signature)
```

##### `verify(message, signature)`
Verifies a message signature.

**Parameters:**
- `message` (string): The original message
- `signature` (string): The signature to verify

**Returns:** `Promise<boolean>` - True if the signature is valid

**Example:**
```javascript
const isValid = await account.verify('Hello, World!', signature)
console.log('Signature valid:', isValid)
```

##### `sendTransaction(tx)`
Sends a transaction and returns the result with hash and fee.

**Parameters:**
- `tx` (EvmTransaction): The transaction object
  - `to` (string): Recipient address
  - `value` (number | bigint): Amount in wei
  - `data` (string, optional): Transaction data
  - `gasLimit` (number, optional): Gas limit
  - `gasPrice` (number, optional): Gas price (legacy)
  - `maxFeePerGas` (number, optional): Max fee per gas (EIP-1559)
  - `maxPriorityFeePerGas` (number, optional): Max priority fee per gas (EIP-1559)

**Returns:** `Promise<TransactionResult>` - Object containing hash and fee

**Example:**
```javascript
const result = await account.sendTransaction({
  to: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
  value: 1000000000000000000n, // 1 ETH
  gasLimit: 21000
})
console.log('Transaction hash:', result.hash)
console.log('Transaction fee:', result.fee, 'wei')
```

##### `quoteSendTransaction(tx)`
Estimates the fee for a transaction.

**Parameters:**
- `tx` (EvmTransaction): The transaction object (same as sendTransaction)

**Returns:** `Promise<Omit<TransactionResult, "hash">>` - Object containing fee estimate

**Example:**
```javascript
const quote = await account.quoteSendTransaction({
  to: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
  value: 1000000000000000000n
})
console.log('Estimated fee:', quote.fee, 'wei')
```

##### `transfer(options)`
Transfers ERC-20 tokens to another address.

**Parameters:**
- `options` (TransferOptions): Transfer options
  - `token` (string): Token contract address
  - `recipient` (string): Recipient address
  - `amount` (number | bigint): Amount in base units

**Returns:** `Promise<TransferResult>` - Object containing hash and fee

**Example:**
```javascript
const result = await account.transfer({
  token: '0x...',
  recipient: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
  amount: 1000000000000000000n // 1 token
})
console.log('Transfer hash:', result.hash)
console.log('Transfer fee:', result.fee, 'wei')
```

##### `quoteTransfer(options)`
Estimates the fee for a token transfer.

**Parameters:**
- `options` (TransferOptions): Transfer options (same as transfer)

**Returns:** `Promise<Omit<TransferResult, "hash">>` - Object containing fee estimate

**Example:**
```javascript
const quote = await account.quoteTransfer({
  token: '0x...',
  recipient: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
  amount: 1000000000000000000n
})
console.log('Transfer fee estimate:', quote.fee, 'wei')
```

##### `getBalance()`
Returns the native token balance.

**Returns:** `Promise<bigint>` - Balance in wei

**Example:**
```javascript
const balance = await account.getBalance()
console.log('Balance:', balance, 'wei')
```

##### `getTokenBalance(tokenAddress)`
Returns the balance of a specific ERC-20 token.

**Parameters:**
- `tokenAddress` (string): The token contract address

**Returns:** `Promise<bigint>` - Token balance in base units

**Example:**
```javascript
const tokenBalance = await account.getTokenBalance('0x...')
console.log('Token balance:', tokenBalance)
```

##### `dispose()`
Disposes the wallet account, clearing private keys from memory.

**Example:**
```javascript
account.dispose()
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `index` | `number` | The derivation path's index of this account |
| `path` | `string` | The full derivation path of this account |
| `keyPair` | `{publicKey: Buffer, privateKey: Buffer}` | The account's public and private key pair as buffers |

**Example:**
```javascript
const { publicKey, privateKey } = account.keyPair
console.log('Public key length:', publicKey.length)
console.log('Private key length:', privateKey.length)
```

## Supported Networks

This package works with any EVM-compatible blockchain, including:

- Ethereum (Mainnet, Goerli, Sepolia)
- Polygon (Mainnet, Mumbai)
- Binance Smart Chain (BSC)
- Arbitrum
- Optimism
- Avalanche C-Chain
- And many more...

## Security Considerations

- **Seed Phrase Security**: Always store your seed phrase securely and never share it
- **Private Key Management**: The package handles private keys internally with memory safety features
- **Provider Security**: Use trusted RPC endpoints and consider using your own node for production applications
- **Transaction Validation**: Always validate transaction details before signing
- **Memory Cleanup**: Use the `dispose()` method to clear private keys from memory when done
- **Fee Limits**: Set `transferMaxFee` in config to prevent excessive transaction fees

## Examples

### Complete Wallet Setup

```javascript
import WalletManagerEvm from '@wdk/wallet-evm'

async function setupWallet() {
  // Use a BIP-39 seed phrase (replace with your own secure phrase)
  const seedPhrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  
  // Create wallet manager
  const wallet = new WalletManagerEvm(seedPhrase, {
    provider: 'https://rpc.mevblocker.io/fast' 
  })
  
  // Get first account
  const account = await wallet.getAccount(0)
  const address = await account.getAddress()
  console.log('Wallet address:', address)
  
  // Check balance
  const balance = await account.getBalance()
  console.log('Balance:', balance, 'wei')
  
  return { wallet, account, address, balance }
}
```

### Multi-Account Management

```javascript
async function manageMultipleAccounts(wallet) {
  const accounts = []
  
  // Create 5 accounts
  for (let i = 0; i < 5; i++) {
    const account = await wallet.getAccount(i)
    const address = await account.getAddress()
    const balance = await account.getBalance()
    
    accounts.push({
      index: i,
      address,
      balance
    })
  }
  
  return accounts
}
```

## Development

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

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For support, please open an issue on the GitHub repository.

---

**Note**: This package is currently in beta. Please test thoroughly in development environments before using in production.
