import hre from 'hardhat'

import * as bip39 from 'bip39'

import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'

import WalletManagerEvm, { WalletAccountEvm } from '../index.js'

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

const INVALID_SEED_PHRASE = 'invalid seed phrase'

const SEED = bip39.mnemonicToSeedSync(SEED_PHRASE)

describe('WalletManagerEvm', () => {
  let wallet

  beforeEach(async () => {
    wallet = new WalletManagerEvm(SEED_PHRASE, {
      provider: hre.network.provider
    })

    await hre.network.provider.send('hardhat_reset')
  })

  afterEach(() => {
    wallet.dispose()
  })

  describe('constructor', () => {
    test('should successfully initialize a wallet manager for the given seed phrase', () => {
      const wallet = new WalletManagerEvm(SEED_PHRASE)

      expect(wallet.seed).toEqual(SEED)
    })

    test('should successfully initialize a wallet manager for the given seed', () => {
      const wallet = new WalletManagerEvm(SEED)

      expect(wallet.seed).toEqual(SEED)
    })

    test('should throw if the seed phrase is invalid', () => {
      // eslint-disable-next-line no-new
      expect(() => { new WalletManagerEvm(INVALID_SEED_PHRASE) })
        .toThrow('The seed phrase is invalid.')
    })
  })

  describe('static getRandomSeedPhrase', () => {
    test('should generate a valid 12-word seed phrase', () => {
      const seedPhrase = WalletManagerEvm.getRandomSeedPhrase()

      const words = seedPhrase.trim()
        .split(/\s+/)

      expect(words).toHaveLength(12)

      words.forEach(word => {
        expect(bip39.wordlists.EN.includes(word))
          .not.toBe(-1)
      })
    })
  })

  describe('static isValidSeedPhrase', () => {
    test('should return true for a valid seed phrase', () => {
      expect(WalletManagerEvm.isValidSeedPhrase(SEED_PHRASE))
        .toBe(true)
    })

    test('should return false for an invalid seed phrase', () => {
      expect(WalletManagerEvm.isValidSeedPhrase(INVALID_SEED_PHRASE))
        .toBe(false)
    })

    test('should return false for an empty string', () => {
      expect(WalletManagerEvm.isValidSeedPhrase(''))
        .toBe(false)
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
  })

  describe('getFeeRates', () => {
    test('should return the correct fee rates', async () => {
      const feeRates = await wallet.getFeeRates()

      expect(feeRates.normal).toBe(3_300_000_000)

      expect(feeRates.fast).toBe(6_000_000_000)
    })

    test('should throw if the wallet is not connected to a provider', async () => {
      const wallet = new WalletManagerEvm(SEED_PHRASE)

      await expect(wallet.getFeeRates())
        .rejects.toThrow('The wallet must be connected to a provider to get fee rates.')
    })
  })
})
