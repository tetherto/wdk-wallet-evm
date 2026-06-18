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
/** @typedef {import("@tetherto/wdk-wallet").SignerError} SignerError */

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
   * Returns the wallet account at a specific index.
   *
   * @overload
   * @param {number} [index] - The index of the account to get (default: 0).
   * @param {Object} [options] - Account options.
   * @param {string} [options.signerName] - The signer name. Omit to use the default signer.
   * @returns {Promise<WalletAccountEvm>} The account.
   * @throws {Error} If a signer name is given but no signer exists with that name.
   * @throws {SignerError} If the signer doesn't support account derivation.
   */

  /**
   * Returns the wallet account associated with a registered signer. Non-derivable
   * signers (e.g. private-key signers) , returns the signer's single account, deriable signers derive an account at the path "0'/0/0"
   *
   * @overload
   * @param {string} signerName - The signer name registered via {@link addSigner}.
   * @returns {Promise<WalletAccountEvm>} The account.
   * @throws {Error} If no signer exists with the given name.
   */

  async getAccount (indexOrSignerName = 0, options = {}) {
    if (typeof indexOrSignerName === 'string') {
      const key = `${indexOrSignerName}#self`
      if (this._accounts[key]) {
        return this._accounts[key]
      }
      const signer = this.getSigner(indexOrSignerName)
      // Never wrap a root signer directly
      const accountSigner = signer.isPrivateKey ? signer : signer.derive("0'/0/0")
      const account = new WalletAccountEvm(accountSigner, this._config)
      this._accounts[key] = account
      return account
    }

    const { signerName } = options
    return await this.getAccountByPath(`0'/0/${indexOrSignerName}`, { signerName })
  }

  /**
   * Returns the wallet account at a specific derivation path.
   *
   * @param {string} path - The derivation path (e.g. "0'/0/0").
   * @param {Object} [options] - Account options.
   * @param {string} [options.signerName] - The signer name. Omit to use the default signer.
   * @returns {Promise<WalletAccountEvm>} The account.
   * @throws {Error} If a signer name is given but no signer exists with that name.
   * @throws {SignerError} If the signer doesn't support account derivation.
   */
  async getAccountByPath (path, options = {}) {
    const { signerName } = options
    const key = `${signerName ?? ''}:${path}`
    if (this._accounts[key]) {
      return this._accounts[key]
    }
    const signer = this.getSigner(signerName)
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
