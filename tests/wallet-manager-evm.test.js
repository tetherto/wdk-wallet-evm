import hre from 'hardhat'

import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'

import { SignerError } from '@tetherto/wdk-wallet'

import WalletManagerEvm, { WalletAccountEvm } from '../index.js'

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

describe('WalletManagerEvm', () => {
  let wallet

  beforeEach(async () => {
    wallet = new WalletManagerEvm(SEED_PHRASE, {
      provider: hre.network.provider
    })
  })

  afterEach(() => {
    wallet.dispose()
  })

  describe('constructor', () => {
    test('should throw SignerError if an ISigner is passed instead of a seed', () => {
      const fakeSigner = { derive: async () => {}, signTransaction: async () => {} }

      expect(() => new WalletManagerEvm(fakeSigner))
        .toThrow(SignerError)
    })
  })

  describe('getAccount', () => {
    test('should return the account at index 0 by default', async () => {
      const account = await wallet.getAccount()

      expect(account).toBeInstanceOf(WalletAccountEvm)

      expect(account.path).toBe("m/44'/60'/0'/0/0")
    })

    test('should return the account at the given index', async () => {
      const account = await wallet.getAccount(3)

      expect(account).toBeInstanceOf(WalletAccountEvm)

      expect(account.path).toBe("m/44'/60'/0'/0/3")
    })

    test('should throw if the index is a negative number', async () => {
      await expect(wallet.getAccount(-1))
        .rejects.toThrow('invalid path component')
    })

    test('should throw SignerError if a signer name is given positionally', async () => {
      await expect(wallet.getAccount('mySigner'))
        .rejects.toThrow(SignerError)
    })

    test('should throw SignerError if options.signerName is given', async () => {
      await expect(wallet.getAccount(0, { signerName: 'mySigner' }))
        .rejects.toThrow(SignerError)
    })
  })

  describe('getAccountByPath', () => {
    test('should return the account with the given path', async () => {
      const account = await wallet.getAccountByPath("1'/2/3")

      expect(account).toBeInstanceOf(WalletAccountEvm)

      expect(account.path).toBe("m/44'/60'/1'/2/3")
    })

    test('should throw if the path is invalid', async () => {
      await expect(wallet.getAccountByPath("a'/b/c"))
        .rejects.toThrow('invalid path component')
    })

    test('should throw SignerError if options.signerName is given', async () => {
      await expect(wallet.getAccountByPath("0'/0/0", { signerName: 'mySigner' }))
        .rejects.toThrow(SignerError)
    })
  })

  describe('getFeeRates', () => {
    test('should return the correct fee rates', async () => {
      const feeRates = await wallet.getFeeRates()

      expect(feeRates.normal).toBe(3_300_000_000n)

      expect(feeRates.fast).toBe(6_000_000_000n)
    })

    test('should throw if the wallet is not connected to a provider', async () => {
      const wallet = new WalletManagerEvm(SEED_PHRASE)

      await expect(wallet.getFeeRates())
        .rejects.toThrow('The wallet must be connected to a provider to get fee rates.')
    })
  })
})
