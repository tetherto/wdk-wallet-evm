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
/** @typedef {import('./seed-signer-evm.js').ISignerEvm} ISignerEvm */
/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */
/** @typedef {import('ethers').AuthorizationRequest} AuthorizationRequest */
/** @typedef {import('ethers').Authorization} Authorization */
/** @typedef {import('../wallet-account-read-only-evm.js').TypedData} TypedData */

/**
 * @implements {ISignerEvm}
 * Signer that wraps a raw private key in a memory-safe buffer, exposing a minimal
 * interface for signing messages, transactions and typed data. This signer does
 * not support derivation and always represents a single account.
 */
export default class PrivateKeySignerEvm {
  /**
   * Create a signer from a raw private key.
   *
   * @param {string|Uint8Array} privateKey - Hex string (with/without 0x) or raw key bytes.
   */
  constructor (privateKey) {
    // Expect a Uint8Array buffer; accept hex string as convenience
    let privateKeyBuffer = privateKey
    if (typeof privateKey === 'string') {
      const hex = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey
      privateKeyBuffer = new Uint8Array(Buffer.from(hex, 'hex'))
    }

    /** @private */
    this._signingKey = new MemorySafeSigningKey(privateKeyBuffer)
    /** @private */
    this._wallet = new BaseWallet(this._signingKey, null)
    /** @private */
    this._address = this._wallet.address
    /** @private */
    this._isRoot = false
    /** @private */
    this._path = undefined
  }

  /**
   * Whether this signer is a root (master) signer. Always false for private key signers.
   * @type {boolean}
   */
  get isRoot () { return this._isRoot }

  /**
   * Whether this signer was created from a standalone private key.
   * @type {boolean}
   */
  get isPrivateKey () { return true }

  /**
   * The account index. Always 0 for private key signers.
   * @type {number}
   */
  get index () { return 0 }

  /**
   * The derivation path. Always undefined for private key signers.
   * @type {string|undefined}
   */
  get path () { return this._path }

  /**
   * The account's address.
   * @type {string}
   */
  get address () { return this._address }
  /**
   * The account's key pair (private and public key buffers).
   * @type {KeyPair}
   */
  get keyPair () {
    return {
      privateKey: this._signingKey ? this._signingKey.privateKeyBuffer : null,
      publicKey: this._signingKey ? this._signingKey.publicKeyBuffer : null
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

  /**
   * Signs a transaction and returns the serialized signed transaction hex.
   *
   * @param {UnsignedEvmTransaction} unsignedTx - The unsigned transaction object.
   * @returns {Promise<string>}
   */
  async signTransaction (unsignedTx) {
    return this._wallet.signTransaction(unsignedTx)
  }

  /**
   * Signs typed data according to EIP-712.
   *
   * @param {TypedData} typedData - The typed data to sign.
   * @returns {Promise<string>} The typed data signature.
   */
  async signTypedData ({ domain, types, message }) {
    return this._wallet.signTypedData(domain, types, message)
  }

  /**
   * Sign an ERC-7702 authorization tuple.
   * @param {AuthorizationRequest} auth
   * @returns {Promise<Authorization>}
   */
  async signAuthorization (auth) {
    return this._wallet.authorizeSync(auth)
  }

  /** Dispose secrets from memory. */
  dispose () {
    this._signingKey.dispose()
    this._signingKey = undefined
    this._wallet = undefined
  }
}
