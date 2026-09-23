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

import { ValueError } from '@tetherto/wdk-wallet'

import MemorySafeHDNodeWallet from '../memory-safe/hd-node-wallet.js'

/** @typedef {import('./signer-evm.js').ISignerEvm} ISignerEvm */
/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */
/** @typedef {import('ethers').TransactionLike} TransactionLike */
/** @typedef {import('ethers').AuthorizationRequest} AuthorizationRequest */
/** @typedef {import('ethers').Authorization} Authorization */
/** @typedef {import('../wallet-account-read-only-evm.js').TypedData} TypedData */
/** @typedef {import('../memory-safe/hd-node-wallet.js').default} MemorySafeHDNodeWallet */

/**
 * Absolute BIP-44 prefix for Ethereum (m/purpose'/coin_type'). Exported so callers that want
 * "the standard Ethereum path" (WalletAccountEvm's seed overload, WalletManagerEvm's own
 * internal default signer) can compose an absolute path without hardcoding it themselves.
 *
 * @internal
 */
export const BIP_44_ETH_DERIVATION_PATH_PREFIX = "m/44'/60'"

/**
 * Signer implementation that derives keys from a BIP-39 seed using an HD path. Every signer
 * holds exactly one HD node (the Ethereum BIP-44 coin node "m/44'/60'" by default, ready to
 * derive accounts below it) and can derive child signers below its own path. Each signer owns
 * an independent copy of its key, so disposing one never affects its parent, children or
 * siblings.
 *
 * @implements {ISignerEvm}
 */
export default class SeedSignerEvm {
  /**
   * Create a SeedSignerEvm from a BIP-39 seed.
   *
   * @param {string|Uint8Array} seed - BIP-39 mnemonic or seed bytes.
   * @param {string} [path] - A BIP-32 path (default: "m/44'/60'").
   * @throws {ValueError} If the given seed phrase is invalid.
   */
  constructor (seed, path = BIP_44_ETH_DERIVATION_PATH_PREFIX) {
    if (typeof seed === 'string') {
      if (!bip39.validateMnemonic(seed)) {
        throw new ValueError('The seed phrase is invalid.')
      }

      seed = bip39.mnemonicToSeedSync(seed)
    }

    const root = MemorySafeHDNodeWallet.fromSeed(seed)
    const account = root.derivePath(path)
    if (account !== root) root.dispose()

    /** @private */
    this._account = account
  }

  /**
   * Whether this signer can derive child signers. Always true: every seed signer holds an
   * HD node with a private key and can derive below its own path.
   *
   * @type {true}
   */
  get isDerivable () {
    return true
  }

  /**
   * The signer's absolute derivation path.
   *
   * @type {string}
   */
  get path () {
    return this._account.path
  }

  /**
   * The account's derived address.
   *
   * @deprecated Use {@link getAddress} instead. This property will be removed in an upcoming
   * release: not all signers (e.g. hardware signers) can expose the address synchronously.
   * @type {string}
   */
  get address () {
    return this._account.address
  }

  /**
   * The account's key pair (private and public key buffers).
   *
   * @type {KeyPair}
   */
  get keyPair () {
    return {
      privateKey: this._account.privateKeyBuffer ?? null,
      publicKey: this._account.publicKeyBuffer
    }
  }

  /**
   * Derive a child signer relative to this signer's own path (e.g. calling derive("0'/0/1") on
   * a signer at "m/44'/60'" yields a child at "m/44'/60'/0'/0/1"). Purely self-relative: no
   * coin-specific prefix is ever assumed or injected. The child owns an independent copy of
   * its key and can itself derive further.
   *
   * @param {string} relPath - The path segment to derive, relative to this signer's own path.
   * @returns {Promise<SeedSignerEvm>} The derived child signer.
   */
  async derive (relPath) {
    const signer = Object.create(SeedSignerEvm.prototype)
    signer._account = this._account.derivePath(relPath)
    return signer
  }

  /**
   * Returns the account's derived address.
   *
   * @returns {Promise<string>} The account's address.
   */
  async getAddress () {
    return this._account.address
  }

  /**
   * Signs a message.
   *
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The message's signature.
   */
  async sign (message) {
    return this._account.signMessage(message)
  }

  /**
   * Signs a transaction.
   *
   * @param {TransactionLike} tx - The transaction to sign.
   * @returns {Promise<string>} The signed transaction as a hex string.
   */
  async signTransaction (tx) {
    return this._account.signTransaction(tx)
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
   * Signs an ERC-7702 authorization tuple.
   *
   * @param {AuthorizationRequest} auth - The authorization request.
   * @returns {Promise<Authorization>} The signed authorization.
   */
  async signAuthorization (auth) {
    return this._account.authorizeSync(auth)
  }

  /**
   * Disposes the signer, erasing its secrets from memory.
   */
  dispose () {
    this._account.dispose()
  }
}
