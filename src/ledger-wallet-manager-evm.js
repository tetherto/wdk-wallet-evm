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

import { BrowserProvider, JsonRpcProvider } from 'ethers'

import LedgerWalletAccountEvm from './ledger-wallet-account-evm.js'

import { LedgerSigner } from '@ethers-ext/signer-ledger'

/** @typedef {import('ethers').Provider} Provider */

/** @typedef {import("./ledger-wallet-account-evm.js")} LedgerWalletAccountEvm */

/** @typedef {import("@wdk/wallet").FeeRates} FeeRates */

/** @typedef {import('./wallet-account-evm.js').EvmWalletConfig} EvmWalletConfig */

const FEE_RATE_NORMAL_MULTIPLIER = 1.1

const FEE_RATE_FAST_MULTIPLIER = 2.0

export default class LedgerWalletManagerEvm {
  /**
   * Creates a new wallet manager for evm blockchains.
   *
   * @param {EvmWalletConfig & {transport: any}} [config] - The configuration object. For `config.transport`, take a reference at [ext-signer-ledger repo](https://github.com/ethers-io/ext-signer-ledger?tab=readme-ov-file#installing).
   *
   */
  constructor (config = {}) {
    /**
     * The evm wallet configuration.
     *
     * @protected
     * @type {EvmWalletConfig}
     */
    this._config = config

    /**
     * A map between derivation paths and wallet accounts. It contains all the wallet accounts that have been accessed through the {@link getAccount} and {@link getAccountByPath} methods.
     *
     * In case of Ledger wallet, we only have the ('0/0/0) account.
     *
     * @protected
     * @type {{ [path: string]: LedgerWalletAccountEvm }}
     */
    this._accounts = {}

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
   * Returns the wallet account at a specific index (see [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)).
   *
   * @example
   * // Returns the account with derivation path m/44'/60'/0'/0/1
   * const account = await wallet.getAccount(1);
   * @param {number} [index] - The index of the account to get (default: 0).
   * @returns {Promise<LedgerWalletAccountEvm>} The account.
   */
  async getAccount (index = 0) {
    return await this.getAccountByPath(`0'/0/${index}`)
  }

  /**
   * Returns the wallet account at a specific BIP-44 derivation path.
   *
   * @example
   * // Returns the account with derivation path m/44'/60'/0'/0/1
   * const account = await wallet.getAccountByPath("0'/0/1");
   * @param {string} path - The derivation path (e.g. "0'/0/0").
   * @returns {Promise<LedgerWalletAccountEvm>} The account.
   */
  async getAccountByPath (path) {
    if (path !== "0'/0/0") {
      throw new Error('Unsupported HD path on Ledger wallet.')
    }

    if (!this._accounts[path]) {
      const signer = new LedgerSigner(this._config.transport)

      const account = await LedgerWalletAccountEvm.new(signer, this._config)

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

    const feeData = await this._provider.getFeeData()

    const maxFeePerGas = Number(feeData.maxFeePerGas)

    return {
      normal: Math.round(maxFeePerGas * FEE_RATE_NORMAL_MULTIPLIER),
      fast: maxFeePerGas * FEE_RATE_FAST_MULTIPLIER
    }
  }
}
