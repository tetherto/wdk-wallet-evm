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

import WalletManager from '@tetherto/wdk-wallet'

import { BrowserProvider, JsonRpcProvider } from 'ethers'

import FailoverProvider from '@tetherto/wdk-failover-provider'

import WalletAccountEvm from './wallet-account-evm.js'
import SeedSignerEvm from './signers/seed-signer-evm.js'

/** @typedef {import('./signers/seed-signer-evm.js').ISignerEvm} ISignerEvm */
/** @typedef {import('ethers').Provider} Provider */

/** @typedef {import("@tetherto/wdk-wallet").FeeRates} FeeRates */

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
   * Accepts either a BIP-39 seed (string/Uint8Array) for backwards compatibility, or a
   * pre-built root signer object. Private key signers are not supported.
   *
   * @param {string|Uint8Array|ISignerEvm} seedOrSigner - A BIP-39 seed phrase, seed bytes, or a root signer.
   * @param {EvmWalletConfig} [config] - The configuration object.
   */
  constructor (seedOrSigner, config = {}) {
    let signer = seedOrSigner
    if (typeof seedOrSigner === 'string' || seedOrSigner instanceof Uint8Array) {
      signer = new SeedSignerEvm(seedOrSigner)
    }
    if (signer.isPrivateKey) {
      throw new Error('Private key signers are not supported for wallet managers.')
    }
    super(signer, config)

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
   * Registers an additional root signer under a name.
   *
   * @param {string} signerName - The signer name.
   * @param {ISignerEvm} signer - The root signer to register.
   */
  createSigner (signerName, signer) {
    if (!signerName) {
      throw new Error('Signer name is required.')
    }
    if (signer?.isPrivateKey) {
      throw new Error('Private key signers are not supported for wallet managers.')
    }
    this._signers[signerName] = signer
  }

  /**
   * Returns the wallet account at a specific index (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)).
   *
   * @example
   * // Returns the account with derivation path m/44'/60'/0'/0/1
   * const account = await wallet.getAccount(1);
   * @param {number} [index] - The index of the account to get (default: 0).
   * @param {string} [signerName] - The root signer name (default: 'default').
   * @returns {Promise<WalletAccountEvm>} The account.
   */
  async getAccount (index = 0, signerName = 'default') {
    return await this.getAccountByPath(`0'/0/${index}`, signerName)
  }

  /**
   * Returns the wallet account at a specific BIP-44 derivation path.
   *
   * @example
   * // Returns the account with derivation path m/44'/60'/0'/0/1
   * const account = await wallet.getAccountByPath("0'/0/1");
   * @param {string} path - The derivation path (e.g. "0'/0/0").
   * @param {string} [signerName] - The root signer name (default: 'default').
   * @returns {Promise<WalletAccountEvm>} The account.
   */
  async getAccountByPath (path, signerName = 'default') {
    const key = `${signerName}:${path}`
    if (this._accounts[key]) {
      return this._accounts[key]
    }
    const signer = this._signers[signerName]
    if (!signer) {
      throw new Error(`Signer ${signerName} not found.`)
    }
    const childSigner = signer.derive(path, this._config)
    const account = new WalletAccountEvm(childSigner, this._config)
    this._accounts[key] = account
    return account
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
