'use strict'

import { verifyMessage, BaseWallet } from 'ethers'

import MemorySafeSigningKey from '../memory-safe/signing-key.js'

export default class PrivateKeySignerEvm {
  constructor (privateKey, config = {}) {
    // Expect a Uint8Array buffer; accept hex string as convenience
    let privateKeyBuffer = privateKey
    if (typeof privateKey === 'string') {
      const hex = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey
      privateKeyBuffer = new Uint8Array(Buffer.from(hex, 'hex'))
    }

    this._config = config
    this._signingKey = new MemorySafeSigningKey(privateKeyBuffer)
    this._wallet = new BaseWallet(this._signingKey, null)
    this._address = this._wallet.address
    this._isRoot = false
    this._path = undefined
  }

  get isRoot () { return this._isRoot }
  get isPrivateKey () { return true }
  get index () { return 0 }
  get path () { return this._path }
  get config () { return this._config }
  get address () { return this._address }
  get keyPair () {
    return {
      privateKey: this._signingKey.privateKeyBuffer,
      publicKey: this._signingKey.publicKeyBuffer
    }
  }

  derive () {
    throw new Error('PrivateKeySignerEvm does not support derivation.')
  }

  async sign (message) {
    return this._wallet.signMessage(message)
  }

  async verify (message, signature) {
    const addr = await verifyMessage(message, signature)
    return addr.toLowerCase() === this._address.toLowerCase()
  }

  async signTransaction (unsignedTx) {
    return this._wallet.signTransaction(unsignedTx)
  }

  async signTypedData (domain, types, message) {
    return this._wallet.signTypedData(domain, types, message)
  }

  dispose () {
    this._signingKey.dispose()
    this._wallet = undefined
  }
}
