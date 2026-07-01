import hre from 'hardhat'

import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'

import WalletManagerEvm, { WalletAccountEvm } from '../index.js'
import SeedSignerEvm from '../src/signers/seed-signer-evm.js'
import PrivateKeySignerEvm from '../src/signers/private-key-signer-evm.js'

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

// Derived independently of the wallet's seed; registered as a named signer in tests.
const PRIVATE_KEY = '260905feebf1ec684f36f1599128b85f3a26c2b817f2065a2fc278398449c41f'
const PRIVATE_KEY_ADDRESS = '0x405005C7c4422390F4B334F64Cf20E0b767131d0'

describe('WalletManagerEvm', () => {
  let wallet

  beforeEach(async () => {
    const root = new SeedSignerEvm(SEED_PHRASE)
    wallet = new WalletManagerEvm(root, { provider: hre.network.provider })
  })

  afterEach(() => {
    wallet.dispose()
  })

  describe('constructor', () => {
    test('should throw if the default signer is not derivable', () => {
      expect(() => new WalletManagerEvm(new PrivateKeySignerEvm(PRIVATE_KEY))) // eslint-disable-line no-new
        .toThrow('The default signer must be derivable.')
    })

    test('should throw if the default signer is a bare ISigner without isDerivable', () => {
      const bareSigner = { derive: async () => {}, signTransaction: async () => {}, getAddress: async () => '0x0', dispose: () => {} }

      expect(() => new WalletManagerEvm(bareSigner)) // eslint-disable-line no-new
        .toThrow('The default signer must be derivable.')
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

    test('should return the same cached account instance for the same index', async () => {
      const first = await wallet.getAccount(1)
      const second = await wallet.getAccount(1)

      expect(second).toBe(first)
    })

    test('should throw if the index is a negative number', async () => {
      await expect(wallet.getAccount(-1))
        .rejects.toThrow('invalid path component')
    })

    test('should derive from a named signer via options.signerName', async () => {
      wallet.addSigner('secondary', new SeedSignerEvm(SEED_PHRASE))

      const account = await wallet.getAccount(2, { signerName: 'secondary' })

      expect(account).toBeInstanceOf(WalletAccountEvm)
      expect(account.path).toBe("m/44'/60'/0'/0/2")
    })

    test('should throw if the named signer does not exist', async () => {
      await expect(wallet.getAccount(0, { signerName: 'missing' }))
        .rejects.toThrow('No signer registered with name "missing".')
    })

    test('should return the account of a named private key signer (string overload)', async () => {
      wallet.addSigner('hot', new PrivateKeySignerEvm(PRIVATE_KEY))

      const account = await wallet.getAccount('hot')

      expect(account).toBeInstanceOf(WalletAccountEvm)
      expect(await account.getAddress()).toBe(PRIVATE_KEY_ADDRESS)
    })

    test('should throw if the named signer does not exist (string overload)', async () => {
      await expect(wallet.getAccount('missing'))
        .rejects.toThrow('No signer registered with name "missing".')
    })

    test('should derive a detached account for a named derivable signer without handing out the root', async () => {
      const named = new SeedSignerEvm(SEED_PHRASE)
      wallet.addSigner('seed', named)

      const account = await wallet.getAccount('seed')

      expect(account).toBeInstanceOf(WalletAccountEvm)
      expect(account.path).toBe("m/44'/60'/0'/0/0")

      // Disposing the account must not neuter the registered root.
      account.dispose()
      await expect(named.derive("0'/0/1")).resolves.toBeInstanceOf(SeedSignerEvm)
    })

    test('should mirror the registered signer\'s own (non-default) path', async () => {
      wallet.addSigner('atFive', new SeedSignerEvm(SEED_PHRASE, { path: "0'/0/5" }))

      const account = await wallet.getAccount('atFive')

      expect(account.path).toBe("m/44'/60'/0'/0/5")
    })
  })

  describe('getAccountByPath', () => {
    test('should return the account with the given path', async () => {
      const account = await wallet.getAccountByPath("1'/2/3")

      expect(account).toBeInstanceOf(WalletAccountEvm)

      expect(account.path).toBe("m/44'/60'/1'/2/3")
    })

    test('should derive from a named signer via options.signerName', async () => {
      wallet.addSigner('secondary', new SeedSignerEvm(SEED_PHRASE))

      const account = await wallet.getAccountByPath("0'/0/0", { signerName: 'secondary' })

      expect(account.path).toBe("m/44'/60'/0'/0/0")
    })

    test('should throw if the path is invalid', async () => {
      await expect(wallet.getAccountByPath("a'/b/c"))
        .rejects.toThrow('invalid path component')
    })

    test('should throw when deriving from a named private key signer', async () => {
      wallet.addSigner('hot', new PrivateKeySignerEvm(PRIVATE_KEY))

      await expect(wallet.getAccountByPath("0'/0/0", { signerName: 'hot' }))
        .rejects.toThrow('PrivateKeySignerEvm does not support derivation.')
    })
  })

  describe('getFeeRates', () => {
    test('should return the correct fee rates', async () => {
      const feeRates = await wallet.getFeeRates()

      expect(feeRates.normal).toBe(3_300_000_000n)

      expect(feeRates.fast).toBe(6_000_000_000n)
    })

    test('should throw if the wallet is not connected to a provider', async () => {
      const wallet = new WalletManagerEvm(new SeedSignerEvm(SEED_PHRASE))

      await expect(wallet.getFeeRates())
        .rejects.toThrow('The wallet must be connected to a provider to get fee rates.')
    })
  })
})
