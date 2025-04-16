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

/**
 * @fileoverview Wallet service for EVM chains using HDNode
 */

import { HDNodeWallet, Mnemonic } from 'ethers'

/**
 * Service class for managing Ethereum wallets
 */
export class WDKWalletManagementEVM {
  /**
   * Creates a new random HD wallet
   * @returns {Promise<HDNodeWallet>} A new HD wallet instance
   * @throws {Error} If wallet creation fails
   */
  async createWallet () {
    return new Promise((resolve, reject) => {
      try {
        const wallet = HDNodeWallet.createRandom()
        resolve(wallet)
      } catch (error) {
        reject(new Error('Failed to create wallet: ' + error.message))
      }
    })
  }

  /**
   * Restores a wallet from a mnemonic phrase
   * @param {string} mnemonicPhrase - The mnemonic phrase to restore from
   * @returns {Promise<HDNodeWallet>} The restored HD wallet instance
   * @throws {Error} If mnemonic phrase is empty or invalid
   */
  async restoreWalletFromPhrase (mnemonicPhrase) {
    if (!mnemonicPhrase) {
      throw new Error('Mnemonic phrase cannot be empty.')
    }

    try {
      const mnemonic = Mnemonic.fromPhrase(mnemonicPhrase)
      return HDNodeWallet.fromMnemonic(mnemonic)
    } catch (error) {
      throw new Error(
        'Failed to restore wallet from mnemonic: ' + error.message
      )
    }
  }

  /**
   * Derives private keys from a mnemonic phrase using a specific derivation path
   * @param {string} mnemonicPhrase - The mnemonic phrase to derive from
   * @param {string} derivationPath - The derivation path to use
   * @returns {Promise<string>} The derived private key
   * @throws {Error} If mnemonic phrase is empty or derivation fails
   */
  async derivePrivateKeysFromPhrase (mnemonicPhrase, derivationPath) {
    if (!mnemonicPhrase) {
      throw new Error('Empty mnemonic phrase')
    }

    try {
      const mnemonic = Mnemonic.fromPhrase(mnemonicPhrase)
      const ethWallet = HDNodeWallet.fromMnemonic(mnemonic, derivationPath)
      return ethWallet.privateKey
    } catch (error) {
      throw new Error(
        'Failed to derive wallet from mnemonic: ' + error.message
      )
    }
  }

  /**
   * Creates a wallet using a specific index from a mnemonic phrase
   * @param {string} mnemonicPhrase - The mnemonic phrase
   * @param {number} [index=0] - The index to derive the wallet from
   * @returns {Promise<Object|null>} Wallet details including address, public key, and private key
   */
  async createWalletByIndex (mnemonicPhrase, index = 0) {
    try {
      console.log('mnemonicPhrase', mnemonicPhrase)
      console.log('index', index)
      if (!mnemonicPhrase) {
        return null
      }

      const mnemonic = Mnemonic.fromPhrase(mnemonicPhrase)
      const path = `m/44'/60'/0'/0/${index}`
      const wallet = HDNodeWallet.fromMnemonic(mnemonic, path)

      return {
        address: wallet.address,
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey,
        derivationPath: path
      }
    } catch (error) {
      console.error('Error creating wallet by index:', error)
      return null
    }
  }
}
