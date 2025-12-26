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

import WalletAccountEvm from './wallet-account-evm.js'

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
   * Creates a new wallet manager for evm blockchains using a root signer.
   *
   * @param {object} signer - The root signer (must not be a private key signer).
   * @param {EvmWalletConfig} [config] - The configuration object.
   */
  constructor (signer, config = {}) {
    if (signer?.isPrivateKey) {
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

    const { provider } = config

    if (provider) {
      /**
       * An ethers provider to interact with a node of the blockchain.
       *
       * @protected
       * @type {Provider | undefined}
       */
      this._provider = typeof provider === 'string'
        ? new JsonRpcProvider(provider)
        : new BrowserProvider(provider)
    }
  }

  /**
   * Registers an additional root signer under a name.
   *
   * @param {string} signerName - The signer name.
   * @param {object} signer - The root signer to register.
   */
  createSigner (signerName, signer) {
    if (!signerName) {
      throw new Error('Signer name is required.')
    }
    if (signer?.isPrivateKey) {
      throw new Error('Private key signers are not supported for wallet managers.')
    }
    this._signers.set(signerName, signer)
  }

  /**
   * Returns the wallet account at a specific index (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)).
   *
   * @example
   * // Returns the account with derivation path m/44'/60'/0'/0/1
   * const account = await wallet.getAccount(1);
   * @param {number} [index] - The index of the account to get (default: 0).
   * @param {string} [signerName='default'] - The root signer name.
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
   * @param {string} [signerName='default'] - The root signer name.
   * @returns {Promise<WalletAccountEvm>} The account.
   */
  async getAccountByPath (path, signerName = 'default') {
    const key = `${signerName}:${path}`
    if (this._accounts[key]) {
      return this._accounts[key]
    }
    const signer = this._signers.get(signerName)
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

    const { maxFeePerGas } = await this._provider.getFeeData()

    return {
      normal: maxFeePerGas * WalletManagerEvm._FEE_RATE_NORMAL_MULTIPLIER / 100n,
      fast: maxFeePerGas * WalletManagerEvm._FEE_RATE_FAST_MULTIPLIER / 100n
    }
  }
}
