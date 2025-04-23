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

export default class WalletAccountEvm {
  #account

  /**
   * Creates an instance of WalletAccountEvm
   * @param {number} index - The wallet’s BIP-39 seed phrase.
   */
  constructor (account) {
    this.#account = account
  }

  get index () {
    return this.#account.index
  }

  get path () {
    return this.#account.path
  }

  get address () {
    return this.#account.address
  }

  get keyPair () {
    return {
      privateKey: this.#account.privateKey,
      publicKey: this.#account.publicKey
    }
  }

  /**
   * Signs a message.
   * @param {string} message - The message to sign.
   * @returns Promise with the signature string.
   */
  async sign (message) {
    return await this.#account.signMessage(message)
  }

  /**
   * Verifies a message signature.
   * @param {string} message - The original message.
   * @param {string} signature - The signature to verify.
   * @returns Promise that resolves to true if valid, otherwise false.
   */
  async verify (message, signature) {
    const address = await verifyMessage(message, signature)
    return address.toLowerCase() === this.#account.address.toLowerCase()
  }

  /**
   * Sends a transaction using the connected wallet.
   * Requires wallet to be connected to a provider.
   * @param tx - The transaction object.
   * @returns {Promise<string>} Promise with the transaction hash.
   */
  async sendTransaction (tx) {
    if (!this.#account.provider) {
      throw new Error('Wallet is not connected to a provider')
    }

    const sentTx = await this.#account.sendTransaction(tx)
    return sentTx.hash
  }
}
