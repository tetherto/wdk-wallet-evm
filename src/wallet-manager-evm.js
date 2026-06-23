// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'

import WalletManager, { SignerError } from '@tetherto/wdk-wallet'

import { BrowserProvider, JsonRpcProvider } from 'ethers'

import FailoverProvider from '@tetherto/wdk-failover-provider'

import WalletAccountEvm from './wallet-account-evm.js'

/** @typedef {import('ethers').Provider} Provider */

/** @typedef {import("@tetherto/wdk-wallet").FeeRates} FeeRates */

/** @typedef {import("@tetherto/wdk-wallet").ISigner} ISigner */

/** @typedef {import('./wallet-account-evm.js').EvmWalletConfig} EvmWalletConfig */

export default class WalletManagerEvm extends WalletManager {
  /**
   * Multiplier for normal fee rate calculations (in %).
   *
   * @protected
   * @type {bigint}
   */
  static _FEE_RATE_NORMAL_MULTIPLIER = 110n

  /**
   * Multiplier for fast fee rate calculations (in %).
   *
   * @protected
   * @type {bigint}
   */
  static _FEE_RATE_FAST_MULTIPLIER = 200n

  /**
   * Creates a new wallet manager for evm blockchains.
   *
   * Signer-based construction is not yet supported by the EVM module: passing
   * an `ISigner` is accepted at the type level for parity with the abstract
   * `WalletManager` constructor overloads but throws a `SignerError` at
   * runtime.
   *
   * @overload
   * @param {string | Uint8Array} seed - The wallet's [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) seed phrase or raw seed bytes.
   * @param {EvmWalletConfig} [config] - The configuration object.
   */
  /**
   * @overload
   * @param {ISigner} signer - The default signer. Not yet supported by the EVM module.
   * @param {EvmWalletConfig} [config] - The configuration object.
   */
  constructor (seedOrSigner, config = {}) {
    if (
      seedOrSigner !== null &&
      typeof seedOrSigner === 'object' &&
      !(seedOrSigner instanceof Uint8Array)
    ) {
      throw new SignerError(
        'Signer-based construction is not yet supported by WalletManagerEvm.'
      )
    }

    super(seedOrSigner, config)

    /**
     * The evm wallet configuration.
     *
     * @protected
     * @type {EvmWalletConfig}
     */
    this._config = config

    /**
     * An ethers provider to interact with a node of the blockchain.
     *
     * @protected
     * @type {Provider | undefined}
     */
    this._provider = undefined

    const { provider, retries = 3 } = config

    if (Array.isArray(provider)) {
      if (provider.length > 0) {
        const failoverProvider = new FailoverProvider({ retries })

        for (const entry of provider) {
          const option = typeof entry === 'string'
            ? new JsonRpcProvider(entry)
            : new BrowserProvider(entry)
          failoverProvider.addProvider(option)
        }

        this._provider = failoverProvider.initialize()
      }
    } else if (provider) {
      this._provider =
        typeof provider === 'string'
          ? new JsonRpcProvider(provider)
          : new BrowserProvider(provider)
    }
  }

  /**
   * Returns the wallet account at a specific index (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)).
   *
   * Signer-derived accounts are not yet supported by the EVM module: passing a
   * `signerName` (positionally or via `options`) is accepted at the type level
   * for parity with the abstract `WalletManager.getAccount` overloads but
   * throws a `SignerError` at runtime.
   *
   * @example
   * // Returns the account with derivation path m/44'/60'/0'/0/1
   * const account = await wallet.getAccount(1);
   * @overload
   * @param {number} [index] - The index of the account to get (default: 0).
   * @param {Object} [options] - Account options.
   * @param {string} [options.signerName] - The signer name. Omit to use the default signer. Not yet supported by the EVM module.
   * @returns {Promise<WalletAccountEvm>} The account.
   * @throws {SignerError} If a signer name is given (signer-derived accounts are not yet supported by the EVM module).
   */
  /**
   * @overload
   * @param {string} signerName - The signer name registered via `addSigner`. Not yet supported by the EVM module.
   * @returns {Promise<WalletAccountEvm>} The account.
   * @throws {SignerError} Always — signer-derived accounts are not yet supported by the EVM module.
   */
  async getAccount (indexOrSignerName = 0, options = {}) {
    if (typeof indexOrSignerName === 'string') {
      throw new SignerError(
        'Signer-derived accounts are not yet supported by WalletManagerEvm.'
      )
    }

    return await this.getAccountByPath(`0'/0/${indexOrSignerName}`, options)
  }

  /**
   * Returns the wallet account at a specific BIP-44 derivation path.
   *
   * Signer-derived accounts are not yet supported by the EVM module: passing
   * `options.signerName` is accepted at the type level for parity with the
   * abstract `WalletManager.getAccountByPath` signature but throws a
   * `SignerError` at runtime.
   *
   * @example
   * // Returns the account with derivation path m/44'/60'/0'/0/1
   * const account = await wallet.getAccountByPath("0'/0/1");
   * @param {string} path - The derivation path (e.g. "0'/0/0").
   * @param {Object} [options] - Account options.
   * @param {string} [options.signerName] - The signer name. Omit to use the default signer. Not yet supported by the EVM module.
   * @returns {Promise<WalletAccountEvm>} The account.
   * @throws {SignerError} If a signer name is given (signer-derived accounts are not yet supported by the EVM module).
   */
  async getAccountByPath (path, options = {}) {
    if (options.signerName !== undefined) {
      throw new SignerError(
        'Signer-derived accounts are not yet supported by WalletManagerEvm.'
      )
    }

    if (!this._accounts[path]) {
      const account = new WalletAccountEvm(this.seed, path, this._config)

      this._accounts[path] = account
    }

    return this._accounts[path]
  }

  /**
   * Returns the current fee rates.
   *
   * @returns {Promise<FeeRates>} The fee rates (in weis).
   */
  async getFeeRates () {
    if (!this._provider) {
      throw new Error('The wallet must be connected to a provider to get fee rates.')
    }

    const data = await this._provider.getFeeData()

    const feeRate = data.maxFeePerGas || data.gasPrice

    return {
      normal: feeRate * WalletManagerEvm._FEE_RATE_NORMAL_MULTIPLIER / 100n,
      fast: feeRate * WalletManagerEvm._FEE_RATE_FAST_MULTIPLIER / 100n
    }
  }
}
