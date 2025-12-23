'use strict'

import {
  DeviceActionStatus,
  DeviceManagementKitBuilder,
  DeviceStatus
} from '@ledgerhq/device-management-kit'
import { webHidTransportFactory } from '@ledgerhq/device-transport-kit-web-hid'
import { SignerEthBuilder } from '@ledgerhq/device-signer-kit-ethereum'
import { filter, firstValueFrom, map } from 'rxjs'
import { verifyMessage, Signature, Transaction, getBytes } from 'ethers'

const BIP_44_ETH_DERIVATION_PATH_PREFIX = "44'/60'"

/**
 * @typedef {import("@ledgerhq/device-management-kit").DeviceManagementKit} DeviceManagementKit
 * @typedef {import("./seed-signer-evm.js").ISignerEvm} ISignerEvm
 */

/**
 * @implements {ISignerEvm}
 */
export default class LedgerSignerEvm {
  constructor (path, config = {}, opts = {}) {
    if (!path) {
      throw new Error('Path is required.')
    }

    this._config = config
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

  get config () {
    return this._config
  }

  get address () {
    if (!this._account) return undefined
    return this._address
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

    // Get the extended pubkey
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

  derive (relPath, cfg = {}) {
    const mergedCfg = {
      ...this._config,
      ...Object.fromEntries(
        Object.entries(cfg || {}).filter(([, v]) => v !== undefined)
      ),
      dmk: this._dmk
    }

    const mergedOpts = {
      ...this.opts,
      dmk: this._dmk
    }

    return new LedgerSignerEvm(`${this._path}/${relPath}`, mergedCfg, mergedOpts)
  }

  async getAddress () {
    if (!this._account) await this._connect()
    await this._ensureDeviceReady('get address')
    return this._address
  }

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

  async verify (message, signature) {
    if (!this._address) return false
    const addr = verifyMessage(message, signature)
    return addr.toLowerCase() === this._address.toLowerCase()
  }

  async signTransaction (unsignedTx) {
    if (!this._account) await this._connect()
    await this._ensureDeviceReady('transaction signing')

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

  dispose () {
    this._account = undefined
    this._dmk = undefined
    this._sessionId = ''
    this._isActive = false
  }
}
