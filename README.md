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

## Installation

```bash
npm install @tetherto/wdk-wallet-evm
```

## Quick Start

```javascript
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'

const seedPhrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const wallet = new WalletManagerEvm(seedPhrase, {
  provider: 'https://sepolia.drpc.org',
})

const account = await wallet.getAccount(0)
const address = await account.getAddress()
console.log('Address:', address)

wallet.dispose()
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

## Compatibility

- **Ethereum Mainnet** and testnets (Sepolia)
- **Layer 2 Networks**: Arbitrum, Optimism, Base
- **Other EVM Chains**: Polygon, Avalanche C-Chain, and any EVM-compatible chain

## Documentation

| Topic | Description | Link |
|-------|-------------|------|
| Overview | Module overview and feature summary | [Wallet EVM Overview](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm) |
| Usage | End-to-end integration walkthrough | [Wallet EVM Usage](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm/usage) |
| Configuration | Provider, fees, and network configuration | [Wallet EVM Configuration](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm/configuration) |
| API Reference | Complete class and type reference | [Wallet EVM API Reference](https://docs.wdk.tether.io/sdk/wallet-modules/wallet-evm/api-reference) |

## Examples

| Example | Description |
|---------|-------------|
| [Create Wallet](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm/create-wallet.ts) | Initialize a wallet manager and derive accounts from a seed phrase |
| [Manage Accounts](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm/manage-accounts.ts) | Work with multiple accounts and custom derivation paths |
| [Check Balances](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm/check-balances.ts) | Query native token and ERC-20 balances for owned accounts |
| [Read-Only Account](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm/read-only-account.ts) | Monitor balances for any address without a private key |
| [Send Transaction](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm/send-transaction.ts) | Estimate fees and send native token transactions (EIP-1559 + legacy) |
| [Token Transfer](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm/token-transfer.ts) | Transfer ERC-20 tokens and estimate transfer fees |
| [Sign & Verify Message](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm/sign-verify-message.ts) | Sign messages and verify signatures |
| [Fee Management](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm/fee-management.ts) | Retrieve current network fee rates |
| [Memory Management](https://github.com/tetherto/wdk-examples/blob/main/wallet-evm/memory-management.ts) | Securely dispose wallets and clear private keys from memory |

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
