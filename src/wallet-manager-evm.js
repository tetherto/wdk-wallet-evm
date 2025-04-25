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

import { HDNodeWallet, Mnemonic, JsonRpcProvider } from 'ethers'

import WalletAccountEvm from './wallet-account-evm.js'

const BIP_44_ETH_DERIVATION_PATH_BASE = 'm/44\'/60\'/0\'/0'

export default class WalletManagerEvm {
  #wallet
  #provider

  /**
   * Creates an instance of WalletManagerEvm
   * @param {string} seedPhrase - The wallet’s BIP-39 seed phrase.
   * @param {Object} [config] - The configuration object
   * @param {string} [config.rpcUrl] - The url of the rpc provider
   */
  constructor (seedPhrase, config = {}) {
    const { rpcUrl } = config

    if (!WalletManagerEvm.isValidSeedPhrase(seedPhrase)) {
      throw new Error('Seed phrase is invalid!')
    }

    this.#wallet = HDNodeWallet.fromPhrase(seedPhrase, undefined, BIP_44_ETH_DERIVATION_PATH_BASE)

    if (rpcUrl) {
      this.#provider = new JsonRpcProvider(rpcUrl)

      this.#wallet = this.#wallet.connect(this.#provider)
    }
  }

  /**
   * Generates a random BIP-39 seed phrase
   * @returns {string} Returns a random BIP-39 seed phrase
  */
   static getRandomSeedPhrase () {
    const wallet = HDNodeWallet.createRandom()
    return wallet.mnemonic.phrase
  }

  /**
   * Checks if a BIP-39 seed phrase is valid
   * @param {string} seedPhrase - The wallet’s BIP-39 seed phrase.
   * @returns {boolean} Returns `true` if the seed phrase is valid
  */
  static isValidSeedPhrase (seedPhrase) {
    return Mnemonic.isValidMnemonic(seedPhrase)
  }

  /**
  * Get the seed phrase.
  * @returns {string}
  */
  get seedPhrase () {
    return this.#wallet.mnemonic.phrase
  }

  /**
   * Returns the wallet account at a specific index
   * @param {number} [index] - The index of the account to get
   * @returns {WalletAccountEvm} The account
  */
  getAccount (index = 0) {
    const account = this.#wallet.derivePath(index.toString())

    return new WalletAccountEvm(account)
  }
}
