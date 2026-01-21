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

import * as bip39 from 'bip39'

import MemorySafeHDNodeWallet from '../memory-safe/hd-node-wallet.js'
import { NotImplementedError } from '@tetherto/wdk-wallet'

const BIP_44_ETH_DERIVATION_PATH_PREFIX = "m/44'/60'"

/** @typedef {import('../utils/tx-populator-evm.js').UnsignedEvmTransaction} UnsignedEvmTransaction */
/** @typedef {import('@tetherto/wdk-wallet/src/isigner.js').ISigner} ISigner */
/** @typedef {import('../wallet-account-read-only-evm.js').EvmWalletConfig} EvmWalletConfig */

/**
 * Interface for EVM signers.
 * Follows the base `ISigner` from `@tetherto/wdk-wallet`. For interface compatibility,
 * the second argument to `derive` is accepted but ignored by EVM signers.
 * @implements {ISigner}
 * @interface
 */
export class ISignerEvm {
  /**
   * True if the signer is currently active and usable.
   * @type {boolean}
   */
  get isActive () {
    throw new NotImplementedError('isActive')
  }

  /**
   * The last component index for the derivation path of this signer, when applicable.
   * @type {number|undefined}
   */
  get index () {
    throw new NotImplementedError('index')
  }

  /**
   * The full derivation path if this is a child signer.
   * @type {string|undefined}
   */
  get path () {
    throw new NotImplementedError('path')
  }

  /** @returns {string|undefined} */
  get address () {
    throw new NotImplementedError('address')
  }

  /**
   * Derive a child signer from this signer using a relative path (e.g. "0'/0/0").
   * @param {string} relPath
   * @param {EvmWalletConfig} [_cfg] - Ignored for EVM signers; present for base compatibility.
   * @returns {ISignerEvm}
   */
  derive (relPath, _cfg) {
    throw new NotImplementedError('derive(relPath, cfg?)')
  }

  /** @returns {Promise<string>} */
  async getAddress () {
    throw new NotImplementedError('getAddress(message)')
  }

  /**
   * Sign a plain message.
   * @param {string} message
   * @returns {Promise<string>}
   */
  async sign (message) {
    throw new NotImplementedError('sign(message)')
  }

  /**
   * Sign a transaction-like object compatible with ethers Transaction.from.
   * @param {Record<string, any>} unsignedTx
   * @returns {Promise<string>} The serialized signed transaction hex.
   */
  async signTransaction (unsignedTx) {
    throw new NotImplementedError('signTransaction(unsignedTx)')
  }

  /**
   * EIP-712 typed data signing.
   * @param {Record<string, any>} domain
   * @param {Record<string, any>} types
   * @param {Record<string, any>} message
   * @returns {Promise<string>}
   */
  async signTypedData (domain, types, message) {
    throw new NotImplementedError('signTypedData(domain, types, message)')
  }

  /** Clear any secret material from memory. */
  dispose () {
    throw new NotImplementedError('dispose()')
  }
}

/**
 * @implements {ISignerEvm}
 * Signer implementation that derives keys from a BIP-39 seed using the BIP-44 Ethereum path.
 * Can represent either a root (no address, only derivation) or a child (derived account with address).
 */
export default class SeedSignerEvm {
  /**
   * Create a SeedSignerEvm.
   * Provide either a mnemonic/seed or an existing root via opts.root.
   *
   * @param {string|Uint8Array|null} seed - BIP-39 mnemonic or seed bytes. Omit when providing `opts.root`.
   * @param {{root?: import('../memory-safe/hd-node-wallet.js').default, path?: string}} [opts]
   */
  constructor (seed, opts = {}) {
    // If a root is provided, do not expect a seed
    if (opts.root && seed) {
      throw new Error('Provide either a seed or a root, not both.')
    }

    if (!opts.root && !seed) {
      throw new Error('Seed or root is required.')
    }

    if (typeof seed === 'string') {
      if (!bip39.validateMnemonic(seed)) {
        throw new Error('The seed phrase is invalid.')
      }
      seed = bip39.mnemonicToSeedSync(seed)
    }

    this._isRoot = true
    this._root =
      opts.root || (seed ? MemorySafeHDNodeWallet.fromSeed(seed) : undefined)
    this._account = undefined
    this._address = undefined
    this._path = undefined
    this._isActive = true

    if (opts.path) {
      const fullPath = `${BIP_44_ETH_DERIVATION_PATH_PREFIX}/${opts.path}`
      const account = this._root.derivePath(fullPath)
      this._account = account
      this._address = account.address
      this._path = fullPath
      this._isRoot = false
    }
  }

  get isActive () {
    return this._isActive
  }

  get isRoot () {
    return this._isRoot
  }

  get isPrivateKey () {
    return false
  }

  get index () {
    if (!this._path) return undefined
    return +this._path.split('/').pop()
  }

  get path () {
    return this._path
  }

  get address () {
    return this._address
  }

  get keyPair () {
    return {
      privateKey: this._account ? this._account.privateKeyBuffer : null,
      publicKey: this._account ? this._account.publicKeyBuffer : null
    }
  }

  /**
   * Derive a child signer using the provided relative path (e.g. "0'/0/0").
   * @param {string} relPath
   * @param {EvmWalletConfig} [_cfg] - Ignored for EVM signers; present for base compatibility.
   * @returns {SeedSignerEvm}
   */
  derive (relPath, _cfg) {
    return new SeedSignerEvm(null, { root: this._root, path: relPath })
  }

  /**
   * Sign a plain message string.
   * @param {string} message
   * @returns {Promise<string>}
   */
  async sign (message) {
    if (!this._account) {
      throw new Error('Cannot sign from a root signer. Derive a child first.')
    }
    return this._account.signMessage(message)
  }

  /**
   * Sign a transaction object and return its serialized form.
   * @param {UnsignedEvmTransaction} unsignedTx
   * @returns {Promise<string>}
   */
  async signTransaction (unsignedTx) {
    if (!this._account) {
      throw new Error(
        'Cannot sign transactions from a root signer. Derive a child first.'
      )
    }
    return this._account.signTransaction(unsignedTx)
  }

  /**
   * EIP-712 typed data signing.
   * @param {Record<string, any>} domain
   * @param {Record<string, any>} types
   * @param {Record<string, any>} message
   * @returns {Promise<string>}
   */
  async signTypedData (domain, types, message) {
    if (!this._account) {
      throw new Error(
        'Cannot sign typed data from a root signer. Derive a child first.'
      )
    }
    return this._account.signTypedData(domain, types, message)
  }

  /** Dispose secrets from memory. */
  dispose () {
    if (this._account) this._account.dispose()
    if (this._root) this._root.dispose()
    this._root = undefined
    this._isActive = false
  }
}
