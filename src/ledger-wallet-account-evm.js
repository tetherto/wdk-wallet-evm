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

import { verifyMessage } from 'ethers'

import { LedgerSigner } from '@ethers-ext/signer-ledger'

import WalletAccountReadOnlyEvm from './wallet-account-read-only-evm.js'

/** @typedef {import('@ethers-ext/signer-ledger').LedgerSigner} LedgerSigner */

/** @typedef {import('@wdk/wallet').IWalletAccount} IWalletAccount */

/** @typedef {import('@wdk/wallet').TransactionResult} TransactionResult */
/** @typedef {import('@wdk/wallet').TransferOptions} TransferOptions */
/** @typedef {import('@wdk/wallet').TransferResult} TransferResult */

/** @typedef {import('./wallet-account-read-only-evm.js').EvmTransaction} EvmTransaction */
/** @typedef {import('./wallet-account-read-only-evm.js').EvmWalletConfig} EvmWalletConfig */

/** @implements {IWalletAccount} */
export default class LedgerWalletAccountEvm extends WalletAccountReadOnlyEvm {
  /**
   * Creates a new ledger wallet account.
   *
   * @param {LedgerSigner} signer - The [ledger signer](https://github.com/ethers-io/ext-signer-ledger).
   * @param {string} [address] - The wallet address.
   * @param {EvmWalletConfig} [config] - The configuration object.
   */
  constructor (signer, address = '', config = {}) {
    if (!address) {
      throw new Error(
        'Please using `await LedgerWalletAccountEvm.new(signer, config)` instead.'
      )
    }

    super(address, config)

    /**
     * The wallet account configuration.
     *
     * @protected
     * @type {EvmWalletConfig}
     */
    this._config = config

    /**
     * The signer.
     *
     * @protected
     * @type {LedgerSigner}
     */
    this._signer = signer

    if (this._provider) {
      this._signer = this._signer.connect(this._provider)
    }
  }

  /**
   * Asynchronously creates a new evm wallet account.
   *
   * @param {LedgerSigner} signer - The [ledger signer](https://github.com/ethers-io/ext-signer-ledger).
   * @param {EvmWalletConfig} [config] - The configuration object.
   */
  static async new (signer, config = {}) {
    const address = await signer.getAddress()
    return new LedgerWalletAccountEvm(signer, address, config)
  }

  /**
   * The Ledger wallet returns account #0 as default.
   *
   * @type {number}
   */
  get index () {
    return 0
  }

  /**
   * The default HD path m/44'/60'/0'/0/0 is returned.
   *
   * @type {string}
   */
  get path () {
    return LedgerSigner.getPath()
  }

  /**
   * Signs a message.
   *
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The message's signature.
   */
  async sign (message) {
    return await this._signer.signMessage(message)
  }

  /**
   * Verifies a message's signature.
   *
   * @param {string} message - The original message.
   * @param {string} signature - The signature to verify.
   * @returns {Promise<boolean>} True if the signature is valid.
   */
  async verify (message, signature) {
    const address = verifyMessage(message, signature)

    return address.toLowerCase() === this._address.toLowerCase()
  }

  /**
   * Sends a transaction.
   *
   * @param {EvmTransaction} tx - The transaction.
   * @returns {Promise<TransactionResult>} The transaction's result.
   */
  async sendTransaction (tx) {
    if (!this._provider) {
      throw new Error('The wallet must be connected to a provider to send transactions.')
    }

    const { fee } = await this.quoteSendTransaction(tx)

    const { hash } = await this._signer.sendTransaction({
      from: await this.getAddress(),
      ...tx
    })

    return { hash, fee }
  }

  /**
   * Transfers a token to another address.
   *
   * @param {TransferOptions} options - The transfer's options.
   * @returns {Promise<TransferResult>} The transfer's result.
   */
  async transfer (options) {
    if (!this._provider) {
      throw new Error(
        'The wallet must be connected to a provider to transfer tokens.'
      )
    }

    const tx = await LedgerWalletAccountEvm._getTransferTransaction(options)

    const { fee } = await this.quoteSendTransaction(tx)

    if (
      this._config.transferMaxFee !== undefined &&
      fee >= this._config.transferMaxFee
    ) {
      throw new Error('Exceeded maximum fee cost for transfer operation.')
    }

    const { hash } = await this._signer.sendTransaction(tx)

    return { hash, fee }
  }

  /**
   * Returns a read-only copy of the account.
   *
   * @returns {Promise<WalletAccountReadOnlyEvm>} The read-only account.
   */
  async toReadOnlyAccount () {
    const readOnlyAccount = new WalletAccountReadOnlyEvm(
      this._address,
      this._config
    )

    return readOnlyAccount
  }
}
