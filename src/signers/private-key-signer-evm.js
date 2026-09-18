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

import { UnsupportedOperationError } from '@tetherto/wdk-wallet'

import MemorySafeSigningKey from '../memory-safe/signing-key.js'

/** @typedef {import('./signer-evm.js').ISignerEvm} ISignerEvm */
/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */
/** @typedef {import('@tetherto/wdk-wallet').ValueError} ValueError */
/** @typedef {import('ethers').TransactionLike} TransactionLike */
/** @typedef {import('ethers').AuthorizationRequest} AuthorizationRequest */
/** @typedef {import('ethers').Authorization} Authorization */
/** @typedef {import('../wallet-account-read-only-evm.js').TypedData} TypedData */

/**
 * Signer that wraps a raw private key in a memory-safe buffer, exposing a minimal
 * interface for signing messages, transactions and typed data. This signer does
 * not support derivation and always represents a single account.
 *
 * @implements {ISignerEvm}
 */
export default class PrivateKeySignerEvm {
  /**
   * Create a signer from a raw private key.
   *
   * @param {string | Uint8Array} privateKey - The private key's hex string or byte sequence.
   */
  constructor (privateKey) {
    if (typeof privateKey === 'string') {
      const hex = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey

      privateKey = Buffer.from(hex, 'hex')
    }

    /** @private */
    this._signingKey = new MemorySafeSigningKey(privateKey)

    /** @private */
    this._wallet = new BaseWallet(this._signingKey)

    /** @private */
    this._address = this._wallet.address
  }

  /**
   * Whether this signer can derive child signers.
   *
   * @type {false}
   */
  get isDerivable () {
    return false
  }

  /**
   * The BIP 0044 derivation path.
   *
   * @type {string | null}
   */
  get path () { return null }

  /**
   * The account's address.
   *
   * @deprecated Use {@link getAddress} instead. This property will be removed in an upcoming
   * release: not all signers (e.g. hardware signers) can expose the address synchronously.
   * @type {string}
   */
  get address () { return this._address }

  /**
   * The account's key pair (private and public key buffers).
   *
   * @type {KeyPair}
   */
  get keyPair () {
    return {
      privateKey: this._signingKey.privateKeyBuffer ?? null,
      publicKey: this._signingKey.publicKeyBuffer
    }
  }

  /**
   * Derive a child signer using a relative path (e.g., "0'/0/0").
   *
   * @param {string} path - The relative derivation path.
   * @returns {Promise<never>} The derived signer.
   * @throws {UnsupportedOperationError} If the signer does not support account derivation.
   * @throws {ValueError} If the path is not valid.
   */
  async derive (path) {
    throw new UnsupportedOperationError('derive(path)')
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
   * Signs a message.
   *
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The message's signature.
   */
  async sign (message) {
    return this._wallet.signMessage(message)
  }

  /**
   * Signs a transaction.
   *
   * @param {TransactionLike} tx - The transaction to sign.
   * @returns {Promise<string>} The signed transaction as a hex string.
   */
  async signTransaction (tx) {
    return this._wallet.signTransaction(tx)
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
   * Signs an ERC-7702 authorization tuple.
   *
   * @param {AuthorizationRequest} auth - The authorization request.
   * @returns {Promise<Authorization>} The signed authorization.
   */
  async signAuthorization (auth) {
    return this._wallet.authorizeSync(auth)
  }

  /**
   * Disposes the signer, erasing its secrets from memory.
   */
  dispose () {
    this._signingKey.dispose()
  }
}
