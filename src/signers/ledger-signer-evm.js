'use strict'

import {
  DeviceActionStatus,
  DeviceManagementKitBuilder
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
    const { observable } = this._account.getAddress(this._path)
    const address = await firstValueFrom(
      observable.pipe(
        filter((evt) => evt.status === DeviceActionStatus.Completed),
        map((evt) => evt.output.address)
      )
    )

    // Active
    this._address = address
    this._isActive = true
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
    return this._address
  }

  async sign (message) {
    if (!this._account) await this._connect()

    const { observable } = this._account.signMessage(this._path, message)
    const { r, s, v } = await firstValueFrom(
      observable.pipe(
        filter((evt) => evt.status === DeviceActionStatus.Completed),
        map((evt) => evt.output)
      )
    )

    return r.replace(/^0x/, '') + s.replace(/^0x/, '') + BigInt(v).toString(16)
  }

  async verify (message, signature) {
    if (!this._address) return false
    const addr = verifyMessage(message, signature)
    return addr.toLowerCase() === this._address.toLowerCase()
  }

  async signTransaction (unsignedTx) {
    if (!this._account) await this._connect()

    const tx = Transaction.from(unsignedTx)

    const { observable: signTransaction } = this._account.signTransaction(
      this._path,
      getBytes(tx.unsignedSerialized)
    )

    const { r, s, v } = await firstValueFrom(
      signTransaction.pipe(
        filter((evt) => evt.status === DeviceActionStatus.Completed),
        map((evt) => evt.output)
      )
    )

    tx.signature = Signature.from({ r, s, v })

    return tx.serialized
  }

  async signTypedData (domain, types, message) {
    if (!this._account) await this._connect()

    const [[primaryType]] = Object.entries(types)

    const { observable } = this._account.signTypedData(this._path, {
      domain,
      types,
      message,
      primaryType
    })
    const { r, s, v } = await firstValueFrom(
      observable.pipe(
        filter((evt) => evt.status === DeviceActionStatus.Completed),
        map((evt) => evt.output)
      )
    )

    return r.replace(/^0x/, '') + s.replace(/^0x/, '') + BigInt(v).toString(16)
  }

  dispose () {
    if (this._account) this._dmk.disconnect({ sessionId: this._sessionId })

    this._account = undefined
    this._dmk = undefined
    this._sessionId = ''
    this._isActive = false
  }
}
