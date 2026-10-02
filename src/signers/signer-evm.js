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

import { ISigner, NotImplementedError } from '@tetherto/wdk-wallet'

/** @typedef {import('ethers').TransactionLike} TransactionLike */
/** @typedef {import('ethers').AuthorizationRequest} AuthorizationRequest */
/** @typedef {import('ethers').Authorization} Authorization */
/** @typedef {import('../wallet-account-read-only-evm.js').TypedData} TypedData */

/**
 * Interface for EVM signers, extending the base `ISigner` from `@tetherto/wdk-wallet`.
 *
 * @interface
 */
export class ISignerEvm extends ISigner {
  /**
   * The account's address, if available.
   *
   * @deprecated Use {@link getAddress} instead. This property will be removed in an upcoming
   * release: not all signers (e.g. hardware signers) can expose the address synchronously.
   * @type {string | undefined}
   */
  get address () {
    throw new NotImplementedError('address')
  }

  /**
   * Signs a transaction.
   *
   * @param {TransactionLike} tx - The transaction to sign.
   * @returns {Promise<string>} The signed transaction as a hex string.
   */
  async signTransaction (tx) {
    throw new NotImplementedError('signTransaction(tx)')
  }

  /**
   * Signs typed data according to EIP-712.
   *
   * @param {TypedData} typedData - The typed data to sign.
   * @returns {Promise<string>} The typed data signature.
   */
  async signTypedData (typedData) {
    throw new NotImplementedError('signTypedData(typedData)')
  }

  /**
   * Signs an ERC-7702 authorization tuple.
   *
   * @param {AuthorizationRequest} auth - The authorization request.
   * @returns {Promise<Authorization>} The signed authorization.
   */
  async signAuthorization (auth) {
    throw new NotImplementedError('signAuthorization(auth)')
  }
}
