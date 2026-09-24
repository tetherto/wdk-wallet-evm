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
import { ISigner, InvalidSignerError, NotImplementedError, ValueError } from '@tetherto/wdk-wallet'

const BIP_44_ETH_DERIVATION_PATH_PREFIX = "m/44'/60'"

// Relative path of the account derived when none is provided.
const DEFAULT_ACCOUNT_PATH = "0'/0/0"

/** @typedef {import('../utils/tx-populator-evm.js').UnsignedEvmTransaction} UnsignedEvmTransaction */
/** @typedef {import('@tetherto/wdk-wallet').ISigner} ISigner */
/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */
/** @typedef {import('ethers').AuthorizationRequest} AuthorizationRequest */
/** @typedef {import('ethers').Authorization} Authorization */
/** @typedef {import('../wallet-account-read-only-evm.js').TypedData} TypedData */
/** @typedef {import('../memory-safe/hd-node-wallet.js').default} MemorySafeHDNodeWallet */

/**
 * @typedef {Object} SeedSignerEvmOpts
 * @property {MemorySafeHDNodeWallet} [root] - An existing HD node wallet root to derive from.
 * @property {string} [path] - Relative BIP-44 path segment (e.g. "0'/0/0"). Defaults to the account at index 0.
 * @property {boolean} [isChild] - When true, the signer is a derived child and does not retain the root.
 */

/**
 * Interface for EVM signers, extending the base `ISigner` from `@tetherto/wdk-wallet`.
 *
 * @extends {ISigner}
 * @interface
 */
export class ISignerEvm extends ISigner {
  /**
   * Whether this signer can derive child signers (i.e. it holds an HD root). Non-derivable
   * signers (e.g. private-key signers) are bound directly to an account; derivable signers
   * derive child accounts and keep the root for management only.
   * @type {boolean}
   */
  get isDerivable () {
    throw new NotImplementedError('isDerivable')
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

  /**
   * The account's address, if available.
   * @type {string|undefined}
   */
  get address () {
    throw new NotImplementedError('address')
  }

  /**
   * The account's key pair.
   * @type {KeyPair}
   */
  get keyPair () {
    throw new NotImplementedError('keyPair')
  }

  /**
   * Derive a child signer from this signer using a relative path (e.g. "0'/0/0").
   *
   * @param {string} relPath - The relative BIP-44 path segment.
   * @returns {Promise<ISignerEvm>} The derived child signer.
   * @throws {InvalidSignerError} If the signer does not support derivation (e.g. private-key signers).
   */
  async derive (relPath) {
    throw new NotImplementedError('derive(relPath)')
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
 * @extends {ISignerEvm}
 * Signer implementation that derives keys from a BIP-39 seed using the BIP-44 Ethereum path.
 * Always holds a derived account (index 0 by default). A root signer also retains the HD root
 * and can derive child signers; a derived child holds only its own account.
 */
export default class SeedSignerEvm extends ISignerEvm {
  /**
   * Create a SeedSignerEvm.
   * Provide either a mnemonic/seed or an existing root via opts.root (for children root is not stored internally)
   *
   * @param {string|Uint8Array|null} seed - A BIP-39 mnemonic seed phrase, or a raw BIP-32 master seed (16-64 bytes). Omit when providing `opts.root`.
   * @param {SeedSignerEvmOpts} [opts] - Construction options for root reuse, direct child derivation or path definition (default is index 0).
   * @throws {ValueError} If neither a seed nor a root is provided, or if both are provided.
   * @throws {ValueError} If a seed is provided but is not a valid BIP-39 mnemonic.
   */
  constructor (seed, opts = {}) {
    super()

    // If a root is provided, do not expect a seed
    if (opts.root && seed) {
      throw new ValueError('Provide either a seed or a root, not both.')
    }

    if (!opts.root && !seed) {
      throw new ValueError('Seed or root is required.')
    }

    if (typeof seed === 'string') {
      if (!bip39.validateMnemonic(seed)) {
        throw new ValueError('The seed phrase is invalid.')
      }
      seed = bip39.mnemonicToSeedSync(seed)
    }

    const root = opts.root || (seed ? MemorySafeHDNodeWallet.fromSeed(seed) : undefined)

    const fullPath = `${BIP_44_ETH_DERIVATION_PATH_PREFIX}/${opts.path || DEFAULT_ACCOUNT_PATH}`
    const account = root.derivePath(fullPath)

    if (opts.isChild && !opts.root) root.dispose()

    /** @private */
    this._account = account
    /** @private */
    this._address = account.address
    /** @private */
    this._path = fullPath
    /** @private */
    this._root = opts.isChild ? undefined : root
  }

  /**
   * Whether this signer can derive child signers. True for a root signer (which holds the
   * HD root); false for a derived child, which does not retain the root.
   * @type {boolean}
   */
  get isDerivable () {
    return Boolean(this._root)
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
   * The full derivation path of this signer's account.
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
   * @returns {Promise<SeedSignerEvm>}
   * @throws {InvalidSignerError} If called on a derived child signer, which does not retain the root.
   */
  async derive (relPath) {
    if (!this._root) {
      throw new InvalidSignerError('Cannot derive: this signer has no root (it is a derived child or has been disposed).')
    }
    return new SeedSignerEvm(null, { root: this._root, path: relPath, isChild: true })
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
    return this._account.signMessage(message)
  }

  /**
   * Sign a transaction object and return its serialized form.
   * @param {UnsignedEvmTransaction} unsignedTx
   * @returns {Promise<string>}
   */
  async signTransaction (unsignedTx) {
    return this._account.signTransaction(unsignedTx)
  }

  /**
   * Signs typed data according to EIP-712.
   *
   * @param {TypedData} typedData - The typed data to sign.
   * @returns {Promise<string>} The typed data signature.
   */
  async signTypedData ({ domain, types, message }) {
    return this._account.signTypedData(domain, types, message)
  }

  /**
   * Sign an ERC-7702 authorization tuple.
   * @param {AuthorizationRequest} auth
   * @returns {Promise<Authorization>}
   */
  async signAuthorization (auth) {
    return this._account.authorizeSync(auth)
  }

  /** Disposes secrets from memory. */
  dispose () {
    if (this._account) this._account.dispose()
    this._account = undefined
    if (this._root) this._root.dispose()
    this._root = undefined
  }
}
