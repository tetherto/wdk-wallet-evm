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
/** @typedef {import('@tetherto/wdk-wallet').ISigner} ISigner */
/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */
/** @typedef {import('../wallet-account-read-only-evm.js').EvmWalletConfig} EvmWalletConfig */
/** @typedef {import('ethers').AuthorizationRequest} AuthorizationRequest */
/** @typedef {import('ethers').Authorization} Authorization */
/** @typedef {import('../wallet-account-read-only-evm.js').TypedData} TypedData */
/** @typedef {import('../memory-safe/hd-node-wallet.js').default} MemorySafeHDNodeWallet */

/**
 * @typedef {Object} SeedSignerEvmOpts
 * @property {MemorySafeHDNodeWallet} [root] - An existing HD node wallet root to derive from.
 * @property {string} [path] - Relative BIP-44 path segment (e.g. "0'/0/0").
 */

/**
 * Interface for EVM signers.
 * Follows the base `ISigner` from `@tetherto/wdk-wallet`. For interface compatibility,
 * the second argument to `derive` is accepted but ignored by EVM signers.
 * @implements {ISigner}
 * @interface
 */
export class ISignerEvm {
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

  /**
   * The account's address, if available.
   * @type {string|undefined}
   */
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

  /**
   * Returns the account's address.
   * @returns {Promise<string>}
   */
  async getAddress () {
    throw new NotImplementedError('getAddress()')
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
   * @param {UnsignedEvmTransaction} unsignedTx
   * @returns {Promise<string>} The serialized signed transaction hex.
   */
  async signTransaction (unsignedTx) {
    throw new NotImplementedError('signTransaction(unsignedTx)')
  }

  /**
   * Signs typed data according to EIP-712.
   *
   * @param {TypedData} typedData - The typed data to sign.
   * @returns {Promise<string>} The typed data signature.
   */
  async signTypedData ({ domain, types, message }) {
    throw new NotImplementedError('signTypedData(typedData)')
  }

  /**
   * Sign an ERC-7702 authorization tuple.
   * @param {AuthorizationRequest} auth
   * @returns {Promise<Authorization>}
   */
  async signAuthorization (auth) {
    throw new NotImplementedError('signAuthorization(auth)')
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
   * @param {SeedSignerEvmOpts} [opts] - Construction options for root reuse or direct child derivation.
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

    /** @private */
    this._isRoot = true
    /** @private */
    this._root =
      opts.root || (seed ? MemorySafeHDNodeWallet.fromSeed(seed) : undefined)
    /** @private */
    this._account = undefined
    /** @private */
    this._address = undefined
    /** @private */
    this._path = undefined

    if (opts.path) {
      const fullPath = `${BIP_44_ETH_DERIVATION_PATH_PREFIX}/${opts.path}`
      const account = this._root.derivePath(fullPath)
      this._account = account
      this._address = account.address
      this._path = fullPath
      this._isRoot = false
    }
  }

  /**
   * Whether this signer is a root (master) signer that can only derive children.
   * @type {boolean}
   */
  get isRoot () {
    return this._isRoot
  }

  /**
   * Whether this signer was created from a standalone private key.
   * @type {boolean}
   */
  get isPrivateKey () {
    return false
  }

  /**
   * The last component index of the derivation path, if available.
   * @type {number|undefined}
   */
  get index () {
    if (!this._path) return undefined
    return +this._path.split('/').pop()
  }

  /**
   * The full derivation path if this is a child signer.
   * @type {string|undefined}
   */
  get path () {
    return this._path
  }

  /**
   * The account's derived address.
   * @type {string}
   */
  get address () {
    return this._address
  }

  /**
   * The account's key pair (private and public key buffers).
   * @type {KeyPair}
   */
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
   * Returns the account's derived address.
   * @returns {Promise<string>}
   */
  async getAddress () {
    return this._address
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
   * Signs typed data according to EIP-712.
   *
   * @param {TypedData} typedData - The typed data to sign.
   * @returns {Promise<string>} The typed data signature.
   */
  async signTypedData ({ domain, types, message }) {
    if (!this._account) {
      throw new Error(
        'Cannot sign typed data from a root signer. Derive a child first.'
      )
    }
    return this._account.signTypedData(domain, types, message)
  }

  /**
   * Sign an ERC-7702 authorization tuple.
   * @param {AuthorizationRequest} auth
   * @returns {Promise<Authorization>}
   */
  async signAuthorization (auth) {
    if (!this._account) {
      throw new Error(
        'Cannot sign authorizations from a root signer. Derive a child first.'
      )
    }
    return this._account.authorizeSync(auth)
  }

  /** Dispose secrets from memory. */
  dispose () {
    if (this._account) this._account.dispose()
    this._account = undefined
    if (this._root) this._root.dispose()
    this._root = undefined
  }
}
