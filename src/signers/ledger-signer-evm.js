'use strict'

import { ISignerEvm } from './seed-signer-evm.js'

import {
  DeviceActionStatus,
  DeviceManagementKitBuilder
} from '@ledgerhq/device-management-kit'
import { webHidTransportFactory } from '@ledgerhq/device-transport-kit-web-hid'
import { SignerEthBuilder } from '@ledgerhq/device-signer-kit-ethereum'
import { filter, firstValueFrom, map } from 'rxjs'
import { verifyMessage, Signature, Transaction, getBytes } from 'ethers'

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
     * Discover & connect a device
     */

    this._dmk =
      opts.dmk ||
      new DeviceManagementKitBuilder()
        .addTransport(webHidTransportFactory)
        .build()

    this._dmk.startDiscovering({}).subscribe({
      next: async (device) => {
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
      },
      error: (e) => {
        throw new Error(e)
      }
    })
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
    return this._address
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

    return new LedgerSignerEvm(`${path}/${relPath}`, mergedCfg, mergedOpts)
  }

  async sign (message) {
    if (!this._account) throw new Error('Ledger is not connected yet.')

    const { observable } = signer.signMessage(this._path, message)
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
    if (!this._account) throw new Error('Ledger is not connected yet.')

    const tx = Transaction.from(unsignedTx)

    const { observable: signTransaction } = signer.signTransaction(
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
    if (!this._account) throw new Error('Ledger is not connected yet.')

    const [[primaryType]] = Object.entries(types)

    const { observable } = signer.signTypedData(this._path, {
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
    this._dmk.disconnect({ sessionId: this._sessionId })

    this._account = undefined
    this._dmk = undefined
    this._sessionId = ''
    this._isActive = false
  }
}
