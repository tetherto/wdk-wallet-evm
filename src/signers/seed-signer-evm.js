'use strict'

import { verifyMessage } from 'ethers'
import * as bip39 from 'bip39'

import MemorySafeHDNodeWallet from '../memory-safe/hd-node-wallet.js'
import { NotImplementedError } from '@tetherto/wdk-wallet'

const BIP_44_ETH_DERIVATION_PATH_PREFIX = "m/44'/60'"

/** @implements {ISigner} */
export class ISignerEvm {
  get isActive () {
    throw new NotImplementedError('isActive')
  }

  get index () {
    throw new NotImplementedError('index')
  }

  get path () {
    throw new NotImplementedError('path')
  }

  get config () {
    throw new NotImplementedError('config')
  }

  get address () {
    throw new NotImplementedError('address')
  }

  derive (relPath, cfg = {}) {
    throw new NotImplementedError('derive(relPath, cfg = {})')
  }

  sign (message) {
    throw new NotImplementedError('sign(message)')
  }

  verify (message, signature) {
    throw new NotImplementedError('verify(message, signature)')
  }

  signTransaction (unsignedTx) {
    throw new NotImplementedError('signTransaction(unsignedTx)')
  }

  signTypedData (domain, types, message) {
    throw new NotImplementedError('signTypedData(domain, types, message)')
  }

  dispose () {
    throw new NotImplementedError('dispose()')
  }
}

export default class SeedSignerEvm {
  constructor (seed, config = {}, opts = {}) {
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

    this._config = config
    this._isRoot = true
    this._root = opts.root || (seed ? MemorySafeHDNodeWallet.fromSeed(seed) : undefined)
    this._account = undefined
    this._address = undefined
    this._path = undefined
    this._isActive = true

    if (opts.path) {
      const fullPath = `${BIP_44_ETH_DERIVATION_PATH_PREFIX}/${opts.path}`
      const account = this._root.derivePath(fullPath)
      this._account = account
      this._address = account.address
      this._path = fullPath
      this._isRoot = false
    }
  }

  get isActive () { return this._isActive }

  get isRoot () { return this._isRoot }
  get isPrivateKey () { return false }
  get index () {
    if (!this._path) return undefined
    return +this._path.split('/').pop()
  }

  get path () { return this._path }

  get config () { return this._config }
  get address () { return this._address }
  get keyPair () {
    return {
      privateKey: this._account ? this._account.privateKeyBuffer : null,
      publicKey: this._account ? this._account.publicKeyBuffer : null
    }
  }

  derive (relPath, cfg = {}) {
    const merged = {
      ...this._config,
      ...Object.fromEntries(Object.entries(cfg || {}).filter(([, v]) => v !== undefined))
    }
    return new SeedSignerEvm(null, merged, { root: this._root, path: relPath })
  }

  async sign (message) {
    if (!this._account) {
      throw new Error('Cannot sign from a root signer. Derive a child first.')
    }
    return this._account.signMessage(message)
  }

  async verify (message, signature) {
    if (!this._address) return false
    const addr = await verifyMessage(message, signature)
    return addr.toLowerCase() === this._address.toLowerCase()
  }

  async signTransaction (unsignedTx) {
    if (!this._account) {
      throw new Error('Cannot sign transactions from a root signer. Derive a child first.')
    }
    return this._account.signTransaction(unsignedTx)
  }

  async signTypedData (domain, types, message) {
    if (!this._account) {
      throw new Error('Cannot sign typed data from a root signer. Derive a child first.')
    }
    return this._account.signTypedData(domain, types, message)
  }

  dispose () {
    if (this._account) this._account.dispose()
    if (this._root) this._root.dispose()
    this._root = undefined
    this._isActive = false
  }
}
