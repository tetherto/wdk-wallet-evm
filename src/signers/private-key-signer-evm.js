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

import { BaseWallet } from 'ethers'

import MemorySafeSigningKey from '../memory-safe/signing-key.js'

/** @typedef {import('../utils/tx-populator-evm.js').UnsignedEvmTransaction} UnsignedEvmTransaction */

/**
 * * @implements {ISignerEvm}
 * Signer that wraps a raw private key in a memory-safe buffer, exposing a minimal
 * interface for signing messages, transactions and typed data. This signer does
 * not support derivation and always represents a single account.
 */
export default class PrivateKeySignerEvm {
  /**
   * @param {string|Uint8Array} privateKey - Hex string (with/without 0x) or raw key bytes.
   */
  constructor (privateKey) {
    // Expect a Uint8Array buffer; accept hex string as convenience
    let privateKeyBuffer = privateKey
    if (typeof privateKey === 'string') {
      const hex = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey
      privateKeyBuffer = new Uint8Array(Buffer.from(hex, 'hex'))
    }

    this._signingKey = new MemorySafeSigningKey(privateKeyBuffer)
    this._wallet = new BaseWallet(this._signingKey, null)
    this._address = this._wallet.address
    this._isRoot = false
    this._path = undefined
    this._isActive = true
  }

  get isRoot () { return this._isRoot }
  get isPrivateKey () { return true }
  get index () { return 0 }
  get path () { return this._path }
  get address () { return this._address }
  get isActive () { return this._isActive }
  get keyPair () {
    return {
      privateKey: this._signingKey.privateKeyBuffer,
      publicKey: this._signingKey.publicKeyBuffer
    }
  }

  /**
   * PrivateKeySignerEvm is not a hierarchical signer and cannot derive.
   * @throws {Error}
   */
  derive () {
    throw new Error('PrivateKeySignerEvm does not support derivation.')
  }

  /** @returns {Promise<string>} */
  async getAddress () {
    return this._address
  }

  /**
   * Signs a message.
   *
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The message's signature.
   */
  async sign (message) {
    return this._wallet.signMessage(message)
  }

  /** @param {UnsignedEvmTransaction} unsignedTx @returns {Promise<string>} */
  async signTransaction (unsignedTx) {
    return this._wallet.signTransaction(unsignedTx)
  }

  /**
   * EIP-712 typed data signing.
   * @param {Record<string, any>} domain
   * @param {Record<string, any>} types
   * @param {Record<string, any>} message
   * @returns {Promise<string>}
   */
  async signTypedData (domain, types, message) {
    return this._wallet.signTypedData(domain, types, message)
  }

  /** Dispose secrets from memory. */
  dispose () {
    this._signingKey.dispose()
    this._wallet = undefined
    this._isActive = false
  }
}
