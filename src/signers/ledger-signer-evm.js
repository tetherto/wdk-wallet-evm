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

/** @typedef {import('../utils/tx-populator-evm.js').UnsignedEvmTransaction} UnsignedEvmTransaction */
/** @typedef {import('../wallet-account-read-only-evm.js').EvmWalletConfig} EvmWalletConfig */

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
   * @param {string} path - Relative BIP-44 path segment (e.g. "0'/0/0"). Prefixed internally.
   * @param {{dmk?: DeviceManagementKit}} [opts]
   */
  constructor (path, opts = {}) {
    if (!path) {
      throw new Error('Path is required.')
    }

    this._account = undefined
    this._address = undefined
    this._sessionId = ''
    this._path = `${BIP_44_ETH_DERIVATION_PATH_PREFIX}/${path}`
    this._isActive = false

    /**
     * @type {DeviceManagementKit}
     */
    this._dmk =
      opts.dmk ||
      new DeviceManagementKitBuilder()
        .addTransport(webHidTransportFactory)
        .build()
  }

  get isActive () {
    return this._isActive
  }

  get index () {
    if (!this._path) return undefined
    return +this._path.split('/').pop()
  }

  get path () {
    return this._path
  }

  get address () {
    if (!this._account) return undefined
    return this._address
  }

  /**
   * Ledger-backed signers do not expose private keys; key pairs are not available.
   *
   * @throws {Error} Always throws to indicate unavailability on Ledger.
   */
  get keyPair () {
    throw new Error('Key pair is not available for Ledger signer.')
  }

  /**
   * Disconnect current session if any.
   *
   * @private
   */
  async _disconnect () {
    try {
      if (this._account && this._dmk && this._sessionId) {
        await this._dmk.disconnect({ sessionId: this._sessionId })
      }
    } catch (_) {
      // ignore best-effort disconnect
    } finally {
      this._account = undefined
      this._sessionId = ''
      this._isActive = false
    }
  }

  /**
   * Reconnect device and refresh signer/address
   *
   * @private
   */
  async _reconnect () {
    if (!this._dmk || !this._sessionId) {
      await this._connect()
      return
    }
    try {
      const device = this._dmk.getConnectedDevice({ sessionId: this._sessionId })
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
   * @param {string} context
   * @private
   */
  async _ensureDeviceReady (context) {
    if (!this._dmk || !this._sessionId) return
    let state
    try {
      state = await firstValueFrom(this._dmk.getDeviceSessionState({ sessionId: this._sessionId }))
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
   * @param {import('rxjs').Observable<any>} observable
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

  /**
   * Discover and connect the device
   *
   * @private
   */
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

    // Get the address
    try {
      const { observable } = this._account.getAddress(this._path)
      const { address } = await this._consumeDeviceAction(observable)

      // Active
      this._address = address
      this._isActive = true
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
    const mergedOpts = {
      ...this.opts,
      dmk: this._dmk
    }

    return new LedgerSignerEvm(`${relPath}`, mergedOpts)
  }

  /** @returns {Promise<string>} */
  async getAddress () {
    if (!this._account) await this._connect()
    await this._ensureDeviceReady('get address')
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
    await this._ensureDeviceReady('message signing')

    const attempt = async () => {
      const { observable } = this._account.signMessage(this._path, message)
      return await this._consumeDeviceAction(observable)
    }

    const formatSignatureHex = ({ r, s, v }) => {
      const rHex = String(r).replace(/^0x/i, '')
      const sHex = String(s).replace(/^0x/i, '')
      let vNum = Number(BigInt(v))
      if (vNum === 0 || vNum === 1) vNum += 27
      let vHex = vNum.toString(16)
      if (vHex.length % 2 !== 0) vHex = '0' + vHex
      const rPadded = rHex.padStart(64, '0')
      const sPadded = sHex.padStart(64, '0')
      return '0x' + rPadded + sPadded + vHex
    }

    const { r, s, v } = await attempt()
    return formatSignatureHex({ r, s, v })
  }

  /** @param {UnsignedEvmTransaction} unsignedTx @returns {Promise<string>} */
  async signTransaction (unsignedTx) {
    if (!this._account) await this._connect()
    await this._ensureDeviceReady('transaction signing')

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
   * EIP-712 typed data signing.
   * @param {Record<string, any>} domain
   * @param {Record<string, any>} types
   * @param {Record<string, any>} message
   * @returns {Promise<string>}
   */
  async signTypedData (domain, types, message) {
    if (!this._account) await this._connect()
    await this._ensureDeviceReady('typed data signing')

    const [[primaryType]] = Object.entries(types)

    const attempt = async () => {
      const { observable } = this._account.signTypedData(this._path, {
        domain,
        types,
        message,
        primaryType
      })
      return await this._consumeDeviceAction(observable)
    }

    const { r, s, v } = await attempt()
    return (
      '0x' +
      String(r).replace(/^0x/i, '').padStart(64, '0') +
      String(s).replace(/^0x/i, '').padStart(64, '0') +
      (() => {
        let vNum = Number(BigInt(v))
        if (vNum === 0 || vNum === 1) vNum += 27
        const hex = vNum.toString(16)
        return hex.length % 2 ? '0' + hex : hex
      })()
    )
  }

  /** Clear device handles and local state. */
  dispose () {
    this._account = undefined
    this._dmk = undefined
    this._sessionId = ''
    this._isActive = false
  }
}
