# @tetherto/wdk-wallet-evm

[![npm version](https://img.shields.io/npm/v/%40tetherto%2Fwdk-wallet-evm?style=flat-square)](https://www.npmjs.com/package/@tetherto/wdk-wallet-evm)
[![npm downloads](https://img.shields.io/npm/dw/%40tetherto%2Fwdk-wallet-evm?style=flat-square)](https://www.npmjs.com/package/@tetherto/wdk-wallet-evm)
[![license](https://img.shields.io/npm/l/%40tetherto%2Fwdk-wallet-evm?style=flat-square)](https://github.com/tetherto/wdk-wallet-evm/blob/main/LICENSE)
[![docs](https://img.shields.io/badge/docs-docs.wdk.tether.io-0A66C2?style=flat-square)](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm)

**Note**: This package is currently in beta. Please test thoroughly in development environments before using in production.

A simple and secure package to manage BIP-44 wallets for EVM-compatible blockchains. This package provides a clean API for creating, managing, and interacting with Ethereum-compatible wallets using BIP-39 seed phrases and EVM-specific derivation paths.

## About WDK

This module is part of the [**WDK (Wallet Development Kit)**](https://docs.wdk.tether.io/) project, which empowers developers to build secure, non-custodial wallets with unified blockchain access, stateless architecture, and complete user control.

For detailed documentation about the complete WDK ecosystem, visit [docs.wdk.tether.io](https://docs.wdk.tether.io).

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
} from '@tetherto/wdk-wallet-evm'

// Signers are exported under the /signers subpath
import {
  SeedSignerEvm,
  PrivateKeySignerEvm,
} from '@tetherto/wdk-wallet-evm/signers'

// Ledger signer has a separate export (optional peer dependencies)
import { LedgerSignerEvm } from '@tetherto/wdk-wallet-evm/signers/ledger'
```

### Create a Wallet Manager (seed-based)

```javascript
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import { SeedSignerEvm } from '@tetherto/wdk-wallet-evm/signers'

// Use a BIP-39 seed phrase (replace with your own secure phrase)
const seedPhrase =
  'test only example nut use this real life secret phrase must random'

// Create a root signer from the seed phrase
const root = new SeedSignerEvm(seedPhrase)

// Create wallet manager with provider config (provider is required for chain ops)
const wallet = new WalletManagerEvm(root, {
  // Option 1: Using RPC URL
  provider: 'https://sepolia.drpc.org', // any EVM RPC
  transferMaxFee: 100000000000000n, // Optional: max fee in wei (BigInt)
})

// OR

// Option 2: Using EIP-1193 provider (e.g., from browser wallet)
const wallet2 = new WalletManagerEvm(root, {
  provider: window.ethereum, // EIP-1193 provider
  transferMaxFee: 100000000000000n, // Optional
})

// Get a full access account
const account0 = await wallet.getAccount(0)

// Convert to a read-only account
const readOnlyAccount = await account0.toReadOnlyAccount()
```

### Single Account (no manager): Private key or Ledger

```javascript
import { WalletAccountEvm } from '@tetherto/wdk-wallet-evm'
import { PrivateKeySignerEvm } from '@tetherto/wdk-wallet-evm/signers'
import { LedgerSignerEvm } from '@tetherto/wdk-wallet-evm/signers/ledger'

// From a raw private key (hex string or bytes)
const pkSigner = new PrivateKeySignerEvm('0x0123...abcd')
const pkAccount = new WalletAccountEvm(pkSigner, {
  provider: 'https://eth-mainnet.g.alchemy.com/v2/your-api-key',
})

// From a Ledger hardware wallet (browser environment, WebHID)
// Requires optional peer dependencies:
//   npm install @ledgerhq/device-management-kit @ledgerhq/device-signer-kit-ethereum @ledgerhq/device-transport-kit-web-hid rxjs
const ledgerSigner = new LedgerSignerEvm('0\'/0/0')
const ledgerAccount = new WalletAccountEvm(ledgerSigner, {
  provider: window.ethereum,
})
await ledgerAccount.getAddress() // ensure connection and address resolution
```

### Managing Multiple Accounts (seed-based manager)

```javascript
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import { SeedSignerEvm } from '@tetherto/wdk-wallet-evm/signers'

const root = new SeedSignerEvm(mnemonic)
const wallet = new WalletManagerEvm(root, {
  provider: 'https://eth-mainnet.g.alchemy.com/v2/your-api-key',
})

// Get the first account (index 0)
const account = await wallet.getAccount(0) // m/44'/60'/0'/0/0
const address = await account.getAddress() // 0x...
console.log('Account 0 address:', address)

// Get the second account (index 1)
const account1 = await wallet.getAccount(1) // m/44'/60'/0'/0/1
const address1 = await account1.getAddress() // 0x...
console.log('Account 1 address:', address1)

// Get account by custom derivation path
// Full path will be m/44'/60'/0'/0/5
const customAccount = await wallet.getAccountByPath('0\'/0/5')
const customAddress = await customAccount.getAddress()
console.log('Custom account address:', customAddress)

// Note: All addresses are checksummed Ethereum addresses (0x...)
// All accounts inherit the provider configuration from the wallet manager
```

### Checking Balances

#### Owned Account

For accounts where you have the seed phrase and full access:

```javascript
// Assume wallet and account are already created
// Get native token balance (in wei)
const balance = await account.getBalance()
console.log('Native balance:', balance, 'wei') // 1 ETH = 1000000000000000000 wei

// Get ERC20 token balance
const tokenContract = '0x...' // ERC20 contract address
const tokenBalance = await account.getTokenBalance(tokenContract)
console.log('Token balance:', tokenBalance)

// Note: Provider is required for balance checks
// Make sure wallet was created with a provider configuration
```

#### Read-Only Account

For addresses where you don't have the seed phrase:

```javascript
import { WalletAccountReadOnlyEvm } from '@tetherto/wdk-wallet-evm'

// Create a read-only account
const readOnlyAccount = new WalletAccountReadOnlyEvm('0x...', {
  // Ethereum address
  provider: 'https://sepolia.drpc.org', // Required for balance checks
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

Send native tokens and estimate fees using `WalletAccountEvm`. Supports EIP-1559 and auto-populates gas/fee fields where possible.

```javascript
// Send native tokens
// Modern EIP-1559 style transaction (recommended)
const result = await account.sendTransaction({
  to: '0x...', // Recipient address
  value: 1000000000000000000n, // 1 ETH in wei
  maxFeePerGas: 30000000000n, // Optional: max fee per gas (in wei)
  maxPriorityFeePerGas: 2000000000n, // Optional: max priority fee per gas (in wei)
})
console.log('Transaction hash:', result.hash)
console.log('Transaction fee:', result.fee, 'wei')

// OR Legacy style transaction
const legacyResult = await account.sendTransaction({
  to: '0x...',
  value: 1000000000000000000n,
  gasPrice: 20000000000n, // Optional: legacy gas price (in wei)
  gasLimit: 21000, // Optional: gas limit
})

// Get transaction fee estimate
const quote = await account.quoteSendTransaction({
  to: '0x...',
  value: 1000000000000000000n,
})
console.log('Estimated fee:', quote.fee, 'wei')
```

### Token Transfers

Transfer ERC20 tokens and estimate fees using `WalletAccountEvm`. Uses standard ERC20 `transfer` function.

```javascript
// Transfer ERC20 tokens
const transferResult = await account.transfer({
  token: '0x...', // ERC20 contract address
  recipient: '0x...', // Recipient's address
  amount: 1000000n, // Amount in token's base units (use BigInt for large numbers)
})
console.log('Transfer hash:', transferResult.hash)
console.log('Transfer fee:', transferResult.fee, 'wei')

// Quote token transfer fee
const transferQuote = await account.quoteTransfer({
  token: '0x...', // ERC20 contract address
  recipient: '0x...', // Recipient's address
  amount: 1000000n, // Amount in token's base units
})
console.log('Transfer fee estimate:', transferQuote.fee, 'wei')
```

### Token Approvals

Approve a spender for a specific amount (uses ERC20 `approve`):

```javascript
const approval = await account.approve({
  token: '0x...', // ERC20 contract
  spender: '0x...', // Spender address
  amount: 1000000n, // Allowance amount in base units
})
console.log('Approval tx hash:', approval.hash)
```

### Message Signing and Verification

Sign messages using `WalletAccountEvm` and verify signatures using `WalletAccountReadOnlyEvm`.

```javascript
// Sign a message
const message = 'Hello, Ethereum!'
const signature = await account.sign(message)
console.log('Signature:', signature)

// Verify a signature (can use read-only account)
const isValid = await readOnlyAccount.verify(message, signature)
console.log('Signature valid:', isValid)
```

### Fee Management

Retrieve current fee rates using `WalletManagerEvm`. Supports EIP-1559 fee model.

```javascript
// Get current fee rates
const feeRates = await wallet.getFeeRates()
console.log('Normal fee rate:', feeRates.normal, 'wei') // 1.1x base fee
console.log('Fast fee rate:', feeRates.fast, 'wei') // 2.0x base fee
```

### Memory Management

Clear sensitive data from memory using `dispose` methods in `WalletAccountEvm` and `WalletManagerEvm`.

```javascript
// Dispose wallet accounts to clear private keys from memory
account.dispose()

// Dispose entire wallet manager
wallet.dispose()
```

## 🔐 Signers

Signers provide the cryptographic primitives for accounts. There are three signer implementations:

- **SeedSignerEvm (root + child)**: Derives accounts from a BIP-39 seed using the BIP-44 Ethereum path. Can act as a root (for `WalletManagerEvm`) and derive children (for `WalletAccountEvm`).
- **PrivateKeySignerEvm (child only)**: Wraps a raw private key in a memory-safe buffer. Cannot derive. Use directly with `WalletAccountEvm`. Not supported by `WalletManagerEvm`.
- **LedgerSignerEvm (child only)**: Hardware-backed signer using Ledger DMK + WebHID. Construct it at a specific relative path (e.g., `"0'/0/0"`) and use with `WalletAccountEvm`.

Examples:

```javascript
// Root + manager (seed)
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import { SeedSignerEvm } from '@tetherto/wdk-wallet-evm/signers'
const root = new SeedSignerEvm(mnemonic)
const wallet = new WalletManagerEvm(root, { provider: 'https://...' })
const account0 = await wallet.getAccount(0)

// Single account from a private key
import { WalletAccountEvm } from '@tetherto/wdk-wallet-evm'
import { PrivateKeySignerEvm } from '@tetherto/wdk-wallet-evm/signers'
const signer = new PrivateKeySignerEvm('0x0123...')
const account = new WalletAccountEvm(signer, { provider: 'https://...' })

// Single account from a Ledger device (browser)
import { LedgerSignerEvm } from '@tetherto/wdk-wallet-evm/signers/ledger'
const ledgerSigner = new LedgerSignerEvm('0\'/0/0')
const ledgerAccount = new WalletAccountEvm(ledgerSigner, {
  provider: window.ethereum,
})
```

## Key Capabilities

- **BIP-39 Seed Phrase Support**: Generate and validate mnemonic seed phrases
- **BIP-44 Derivation Paths**: Standard Ethereum derivation (m/44'/60')
- **Multi-Account Management**: Derive multiple accounts from a single seed phrase
- **EIP-1559 Transaction Support**: Modern fee estimation and transaction sending
- **ERC-20 Token Support**: Query balances and transfer tokens
- **Message Signing**: Sign and verify messages (EIP-191 and EIP-712)
- **Fee Estimation**: Real-time network fee rates with normal/fast tiers
- **Secure Memory Disposal**: Clear private keys from memory when done
- **Signer Submodule**: Create your own signer from ISignerEvm, support for Seed and Ledger signers
- **EIP-7702 Delegation**: Delegate EOAs to smart contracts, sign authorizations, and send type 4 transactions

## Compatibility

- **Ethereum Mainnet** and testnets (Sepolia)
- **Layer 2 Networks**: Arbitrum, Optimism, Base
- **Other EVM Chains**: Polygon, Avalanche C-Chain, and any EVM-compatible chain

## Documentation

| Topic         | Description                               | Link                                                                                               |
| ------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Overview      | Module overview and feature summary       | [Wallet EVM Overview](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm)                    |
| Usage         | End-to-end integration walkthrough        | [Wallet EVM Usage](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm/usage)                 |
| Configuration | Provider, fees, and network configuration | [Wallet EVM Configuration](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm/configuration) |
| API Reference | Complete class and type reference         | [Wallet EVM API Reference](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm/api-reference) |

## Examples

| Example                                                                                                       | Description                                                          |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [Create Wallet](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm/create-wallet.ts)               | Initialize a wallet manager and derive accounts from a seed phrase   |
| [Manage Accounts](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm/manage-accounts.ts)           | Work with multiple accounts and custom derivation paths              |
| [Check Balances](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm/check-balances.ts)             | Query native token and ERC-20 balances for owned accounts            |
| [Read-Only Account](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm/read-only-account.ts)       | Monitor balances for any address without a private key               |
| [Send Transaction](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm/send-transaction.ts)         | Estimate fees and send native token transactions (EIP-1559 + legacy) |
| [Token Transfer](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm/token-transfer.ts)             | Transfer ERC-20 tokens and estimate transfer fees                    |
| [Sign & Verify Message](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm/sign-verify-message.ts) | Sign messages and verify signatures                                  |
| [Fee Management](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm/fee-management.ts)             | Retrieve current network fee rates                                   |
| [Memory Management](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm/memory-management.ts)       | Securely dispose wallets and clear private keys from memory          |

> For detailed walkthroughs, see the [Usage Guide](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm/usage).
> See all runnable examples in the [wdk-examples](https://github.com/tetherto/wdk-examples) repository.

## Community

Join the [WDK Discord](https://discord.gg/arYXDhHB2w) to connect with other developers.

## Support

For support, please [open an issue](https://github.com/tetherto/wdk-wallet-evm/issues) on GitHub or reach out via [email](mailto:wallet-info@tether.io).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
