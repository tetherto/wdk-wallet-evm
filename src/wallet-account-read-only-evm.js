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

import { verifyMessage } from 'ethers'

import WalletAccountEvm from './wallet-account-evm.js'

/**
 * A buffer filled with zeros used as a placeholder for read-only accounts
 * that don't need actual seed data.
 *
 * @type {Buffer}
 */
const FAKE_SEED = Buffer.alloc(32).fill(0)

/**
 * A read-only implementation of the EVM wallet account.
 * This account can only verify signatures and check balances,
 * but cannot sign messages or send transactions.
 *
 * @extends {WalletAccountEvm}
 */
export default class WalletAccountReadOnlyEvm extends WalletAccountEvm {
  /**
     * Creates a new read-only EVM wallet account.
     *
     * @param {string} address - The wallet's address.
     * @param {import('./wallet-account-evm.js').EvmWalletConfig} [config] - The configuration object.
     */
  constructor (address, config) {
    super(FAKE_SEED, "0'/0/0", {
      ...config,
      readOnly: true
    })

    this._address = address
  }

  /**
     * Returns the account's address.
     *
     * @returns {Promise<string>} The account's address.
     */
  async getAddress () {
    return this._address
  }

  /**
     * This method is not supported in read-only accounts.
     *
     * @param {string} message - The message that would be signed.
     * @throws {Error} Always throws an error since signing is not supported.
     */
  async sign (message) {
    throw new Error('Signing is not supported for read-only accounts')
  }

  /**
     * Verifies a message's signature.
     *
     * @param {string} message - The original message.
     * @param {string} signature - The signature to verify.
     * @returns {Promise<boolean>} True if the signature is valid and matches this account's address.
     */
  async verify (message, signature) {
    const address = await verifyMessage(message, signature)

    return address.toLowerCase() === this._address.toLowerCase()
  }

  /**
     * This method is not supported in read-only accounts.
     *
     * @param {import('./wallet-account-evm.js').EvmTransaction} tx - The transaction that would be sent.
     * @throws {Error} Always throws an error since sending transactions is not supported.
     */
  async sendTransaction (tx) {
    throw new Error('Sending transactions is not supported for read-only accounts')
  }

  /**
     * This method is not supported in read-only accounts.
     *
     * @param {import('./wallet-account-evm.js').TransferOptions} options - The transfer's options.
     * @throws {Error} Always throws an error since transferring tokens is not supported.
     */
  async transfer (options) {
    throw new Error('Transferring tokens is not supported for read-only accounts')
  }
}
