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

import {
  DeviceActionStatus,
  DeviceManagementKitBuilder,
  DeviceStatus
} from '@ledgerhq/device-management-kit'
import { webHidTransportFactory } from '@ledgerhq/device-transport-kit-web-hid'
import { SignerEthBuilder } from '@ledgerhq/device-signer-kit-ethereum'
import { filter, firstValueFrom, map } from 'rxjs'
import { Signature, Transaction, getBytes } from 'ethers'

/** @typedef {import('@tetherto/wdk-wallet').KeyPair} KeyPair */
/** @typedef {import('../utils/tx-populator-evm.js').UnsignedEvmTransaction} UnsignedEvmTransaction */
/** @typedef {import('../wallet-account-read-only-evm.js').EvmWalletConfig} EvmWalletConfig */
/** @typedef {import('ethers').AuthorizationRequest} AuthorizationRequest */
/** @typedef {import('ethers').Authorization} Authorization */
/** @typedef {import('../wallet-account-read-only-evm.js').TypedData} TypedData */
/** @typedef {import('rxjs').Observable} Observable */

const BIP_44_ETH_DERIVATION_PATH_PREFIX = "44'/60'"

/**
 * @typedef {import("@ledgerhq/device-management-kit").DeviceManagementKit} DeviceManagementKit
 * @typedef {import("./seed-signer-evm.js").ISignerEvm} ISignerEvm
 */

/**
 * @implements {ISignerEvm}
 * Hardware-backed signer using Ledger DMK + Ethereum app.
 * Handles device connection, reconnection and provides signing primitives compatible with the
 * rest of the EVM wallet stack.
 */
export default class LedgerSignerEvm {
  /**
   * Create a hardware-backed Ledger signer for the given derivation path.
   *
   * @param {string} path - Relative BIP-44 path segment (e.g. "0'/0/0"). Prefixed internally.
   * @param {DeviceManagementKit} [dmk] - Optional DMK instance. Auto-created if omitted.
   */
  constructor (path, dmk) {
    /** @private */
    this._account = undefined
    /** @private */
    this._address = undefined
    /** @private */
    this._publicKey = undefined
    /** @private */
    this._sessionId = ''
    /** @private */
    this._path = `${BIP_44_ETH_DERIVATION_PATH_PREFIX}/${path}`

    /** @private */
    this._dmk =
      dmk ||
      new DeviceManagementKitBuilder()
        .addTransport(webHidTransportFactory)
        .build()
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
   * The full BIP-44 derivation path.
   * @type {string}
   */
  get path () {
    return this._path
  }

  /**
   * The account's address, resolved after the first device connection.
   * @type {string|undefined}
   */
  get address () {
    if (!this._account) return undefined
    return this._address
  }

  /**
   * The account's key pair. Private key is always null for Ledger signers.
   *
   * @type {KeyPair}
   * @throws {Error} If the device has not been connected yet.
   */
  get keyPair () {
    if (!this._publicKey) {
      throw new Error('Connect the device first.')
    }
    return { privateKey: null, publicKey: this._publicKey }
  }

  /** @private */
  async _disconnect () {
    try {
      if (this._account && this._dmk && this._sessionId) {
        await this._dmk.disconnect({ sessionId: this._sessionId })
      }
    } catch (_) {
      // ignore best-effort disconnect
    } finally {
      this._account = undefined
      this._publicKey = undefined
      this._sessionId = ''
    }
  }

  /** @private */
  async _reconnect () {
    if (!this._dmk || !this._sessionId) {
      await this._connect()
      return
    }
    try {
      const device = this._dmk.getConnectedDevice({
        sessionId: this._sessionId
      })
      this._sessionId = await this._dmk.reconnect({
        device,
        sessionRefresherOptions: { isRefresherDisabled: true }
      })
      // Rebuild signer to ensure refreshed handles
      this._account = new SignerEthBuilder({
        dmk: this._dmk,
        sessionId: this._sessionId
      }).build()
    } catch (_) {
      // Fallback to full reconnect if soft reconnect fails
      await this._disconnect()
      await this._connect()
    }
  }

  /**
   * Ensure the device is in a usable state before sending actions.
   * - If locked or busy: fail fast with a friendly error.
   * - If not connected: attempt reconnect.
   *
   * @private
   */
  async _ensureDeviceReady () {
    if (!this._dmk || !this._sessionId) return
    let state
    try {
      state = await firstValueFrom(
        this._dmk.getDeviceSessionState({ sessionId: this._sessionId })
      )
    } catch (_) {
      // If state cannot be retrieved, try to reconnect; let subsequent action fail if still unavailable
      await this._reconnect()
      return
    }
    const status = state.deviceStatus
    if (status === DeviceStatus.LOCKED) {
      throw new Error('Device is locked')
    }
    if (status === DeviceStatus.BUSY) {
      throw new Error('Device is busy')
    }
    if (status === DeviceStatus.NOT_CONNECTED) {
      await this._reconnect()
    }
  }

  /**
   * Consume a DeviceAction observable and resolve on Completed; reject early on Error/Stopped.
   *
   * @template T
   * @param {Observable<any>} observable
   * @returns {Promise<T>}
   * @private
   */
  async _consumeDeviceAction (observable) {
    return await firstValueFrom(
      observable.pipe(
        filter(
          (evt) =>
            evt.status === DeviceActionStatus.Completed ||
            evt.status === DeviceActionStatus.Error ||
            evt.status === DeviceActionStatus.Stopped
        ),
        map((evt) => {
          if (evt.status === DeviceActionStatus.Completed) return evt.output
          if (evt.status === DeviceActionStatus.Error) {
            const err = evt.error || new Error('Unknown Ledger error')
            throw err
          }
          // Stopped → user canceled or device blocked
          throw new Error('Action stopped')
        })
      )
    )
  }

  /** @private */
  async _connect () {
    // Discover & Connect the device
    const device = await firstValueFrom(this._dmk.startDiscovering({}))
    this._sessionId = await this._dmk.connect({
      device,
      sessionRefresherOptions: { isRefresherDisabled: true }
    })

    // Create a hardware signer
    this._account = new SignerEthBuilder({
      dmk: this._dmk,
      sessionId: this._sessionId
    }).build()

    try {
      const { observable } = this._account.getAddress(this._path)
      const { address, publicKey } = await this._consumeDeviceAction(observable)

      this._address = address
      const pubHex = publicKey.startsWith('0x') ? publicKey : `0x${publicKey}`
      this._publicKey = getBytes(pubHex)
    } catch (err) {
      await this._disconnect()
      throw err
    }
  }

  /**
   * Derive a new signer at the given relative path, reusing the current device session.
   *
   * @param {string} relPath - Relative BIP-44 path (e.g. "0'/0/1").
   * @param {EvmWalletConfig} [_cfg] - Ignored for EVM signers; present for base compatibility.
   * @returns {LedgerSignerEvm} A new hardware-backed signer bound to the derived path.
   */
  derive (relPath, _cfg) {
    return new LedgerSignerEvm(relPath, this._dmk)
  }

  /**
   * @returns {Promise<string>} The account's address.
   */
  async getAddress () {
    if (!this._account) await this._connect()
    await this._ensureDeviceReady()
    return this._address
  }

  /**
   * Signs a message.
   *
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The message's signature.
   */
  async sign (message) {
    if (!this._account) await this._connect()
    await this._ensureDeviceReady()

    const { observable } = this._account.signMessage(this._path, message)
    const { r, s, v } = await this._consumeDeviceAction(observable)
    return Signature.from({ r, s, v }).serialized
  }

  /**
   * Signs a transaction and returns the serialized signed transaction hex.
   *
   * @param {UnsignedEvmTransaction} unsignedTx - The unsigned transaction object.
   * @returns {Promise<string>} The serialized signed transaction hex.
   */
  async signTransaction (unsignedTx) {
    if (!this._account) await this._connect()
    await this._ensureDeviceReady()

    delete unsignedTx.from // Ledger does not support signing transactions with the from field
    const tx = Transaction.from(unsignedTx)

    const attempt = async () => {
      const { observable: signTransaction } = this._account.signTransaction(
        this._path,
        getBytes(tx.unsignedSerialized)
      )
      return await this._consumeDeviceAction(signTransaction)
    }

    const { r, s, v } = await attempt()
    tx.signature = Signature.from({ r, s, v })

    return tx.serialized
  }

  /**
   * Signs typed data according to EIP-712.
   *
   * @param {TypedData} typedData - The typed data to sign.
   * @returns {Promise<string>} The typed data signature.
   */
  async signTypedData ({ domain, types, message }) {
    if (!this._account) await this._connect()
    await this._ensureDeviceReady()

    const [[primaryType]] = Object.entries(types)

    const { observable } = this._account.signTypedData(this._path, {
      domain,
      types,
      message,
      primaryType
    })
    const { r, s, v } = await this._consumeDeviceAction(observable)
    return Signature.from({ r, s, v }).serialized
  }

  /**
   * Sign an ERC-7702 authorization tuple.
   *
   * Standalone authorization signing is not supported on Ledger devices because it
   * requires raw hash signing which the Ledger Ethereum app does not expose for
   * security reasons. Use `signTransaction` with a type 4 transaction containing
   * an `authorizationList` instead.
   *
   * @param {AuthorizationRequest} _auth
   * @returns {Promise<Authorization>}
   * @throws {Error} Always throws — not supported on Ledger hardware.
   */
  async signAuthorization (_auth) {
    throw new Error(
      'Standalone EIP-7702 authorization signing is not supported on Ledger devices. ' +
      'The Ledger Ethereum app does not expose raw hash signing. ' +
      'Use signTransaction with a type 4 transaction containing an authorizationList instead.'
    )
  }

  /** Clear device handles and local state.
   * @returns {void} */
  dispose () {
    this._disconnect()
    this._dmk = undefined
  }
}
