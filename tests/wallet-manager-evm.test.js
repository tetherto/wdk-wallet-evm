import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

import { InvalidSignerError, NoSuchElementError, ProviderRequiredError, UnsupportedOperationError } from '@tetherto/wdk-wallet'

import WalletManagerEvm, { WalletAccountEvm } from '../index.js'
import SeedSignerEvm from '../src/signers/seed-signer-evm.js'
import PrivateKeySignerEvm from '../src/signers/private-key-signer-evm.js'

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

// Derived independently of the wallet's seed; registered as a named signer in tests.
const PRIVATE_KEY = '260905feebf1ec684f36f1599128b85f3a26c2b817f2065a2fc278398449c41f'
const PRIVATE_KEY_ADDRESS = '0x405005C7c4422390F4B334F64Cf20E0b767131d0'

const DUMMY_BLOCK = {
  number: '0x1',
  hash: '0x' + '11'.repeat(32),
  parentHash: '0x' + '00'.repeat(32),
  timestamp: '0x64',
  nonce: '0x0000000000000000',
  difficulty: '0x0',
  gasLimit: '0x1c9c380',
  gasUsed: '0x0',
  miner: '0x0000000000000000000000000000000000000000',
  extraData: '0x',
  baseFeePerGas: '0x3b9aca00',
  transactions: []
}

function createProvider () {
  const handlers = {
    eth_chainId: () => '0x1',
    net_version: () => '1',
    eth_gasPrice: () => '0x3b9aca00',
    eth_maxPriorityFeePerGas: () => '0x3b9aca00',
    eth_getBlockByNumber: () => DUMMY_BLOCK,
    eth_estimateGas: () => '0x5208',
    eth_getTransactionCount: () => '0x0'
  }

  return {
    request: jest.fn(async ({ method, params }) => {
      const handler = handlers[method]
      if (!handler) throw new Error(`Unexpected rpc method: ${method}`)
      return handler(params)
    })
  }
}

describe('WalletManagerEvm', () => {
  let wallet

  beforeEach(async () => {
    const root = new SeedSignerEvm(SEED_PHRASE, "m/44'/60'")
    wallet = new WalletManagerEvm(root, { provider: createProvider() })
  })

  afterEach(() => {
    wallet.dispose()
  })

  describe('constructor', () => {
    test('should throw if the default signer is not derivable', () => {
      expect(() => new WalletManagerEvm(new PrivateKeySignerEvm(PRIVATE_KEY))) // eslint-disable-line no-new
        .toThrow(InvalidSignerError)
      expect(() => new WalletManagerEvm(new PrivateKeySignerEvm(PRIVATE_KEY))) // eslint-disable-line no-new
        .toThrow('The default signer must be derivable.')
    })

    test('should throw if the default signer is a bare ISigner without isDerivable', () => {
      const bareSigner = { derive: async () => {}, signTransaction: async () => {}, getAddress: async () => '0x0', dispose: () => {} }

      expect(() => new WalletManagerEvm(bareSigner)) // eslint-disable-line no-new
        .toThrow(InvalidSignerError)
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
      wallet.addSigner('secondary', new SeedSignerEvm(SEED_PHRASE, "m/44'/60'"))

      const account = await wallet.getAccount(2, { signerName: 'secondary' })

      expect(account).toBeInstanceOf(WalletAccountEvm)
      expect(account.path).toBe("m/44'/60'/0'/0/2")
    })

    test('should throw if the named signer does not exist', async () => {
      const promise = wallet.getAccount(0, { signerName: 'missing' })

      await expect(promise).rejects.toThrow(NoSuchElementError)
      await expect(promise).rejects.toThrow('No signer found with name "missing".')
    })

    test('should return the account of a named private key signer (string overload)', async () => {
      wallet.addSigner('hot', new PrivateKeySignerEvm(PRIVATE_KEY))

      const account = await wallet.getAccount('hot')

      expect(account).toBeInstanceOf(WalletAccountEvm)
      expect(await account.getAddress()).toBe(PRIVATE_KEY_ADDRESS)
    })

    test('should throw if the named signer does not exist (string overload)', async () => {
      const promise = wallet.getAccount('missing')

      await expect(promise).rejects.toThrow(NoSuchElementError)
      await expect(promise).rejects.toThrow('No signer found with name "missing".')
    })

    test('should use the named signer as given without taking ownership of it', async () => {
      const named = new SeedSignerEvm(SEED_PHRASE)
      wallet.addSigner('seed', named)

      const account = await wallet.getAccount('seed')

      expect(account).toBeInstanceOf(WalletAccountEvm)
      expect(account.path).toBe("m/44'/60'/0'/0/0")

      // The registered signer is wrapped as-is but stays consumer-owned, so disposing
      // the returned account must leave the signer fully usable.
      account.dispose()
      await expect(named.derive("0'/0/1")).resolves.toBeInstanceOf(SeedSignerEvm)

      named.dispose()
    })

    test('should mirror the registered signer\'s own (non-default) path', async () => {
      wallet.addSigner('atFive', new SeedSignerEvm(SEED_PHRASE, "m/44'/60'/0'/0/5"))

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
      wallet.addSigner('secondary', new SeedSignerEvm(SEED_PHRASE, "m/44'/60'"))

      const account = await wallet.getAccountByPath("0'/0/0", { signerName: 'secondary' })

      expect(account.path).toBe("m/44'/60'/0'/0/0")
    })

    test('should throw if the path is invalid', async () => {
      await expect(wallet.getAccountByPath("a'/b/c"))
        .rejects.toThrow('invalid path component')
    })

    test('should throw when deriving from a named private key signer', async () => {
      wallet.addSigner('hot', new PrivateKeySignerEvm(PRIVATE_KEY))

      const promise = wallet.getAccountByPath("0'/0/0", { signerName: 'hot' })

      await expect(promise).rejects.toThrow(UnsupportedOperationError)
      await expect(promise).rejects.toThrow("Method 'derive(path)' is not supported.")
    })
  })

  describe('dispose', () => {
    test('should dispose the wallet and erase the private keys of the accounts', async () => {
      const account0 = await wallet.getAccount(0)

      const account1 = await wallet.getAccount(1)

      wallet.dispose()

      const MESSAGE = 'Hello, world!'

      const TRANSACTION = {
        to: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        value: 1_000
      }

      const TRANSFER = {
        token: '0x4CC1D60C268B68a7019034E6dE7Fb05d82d827E0',
        recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        amount: 100
      }

      for (const account of [account0, account1]) {
        expect(account.keyPair.privateKey).toBe(null)

        // Once disposed, the signer keeps its (neutered) HD node, so any signing
        // operation fails inside the crypto layer when it reads the wiped private key.
        await expect(account.sign(MESSAGE))
          .rejects.toThrow(/Uint8Array expected/)
        await expect(account.sendTransaction(TRANSACTION))
          .rejects.toThrow(/Uint8Array expected/)
        await expect(account.transfer(TRANSFER))
          .rejects.toThrow(/Uint8Array expected/)
      }
    })

    test('should dispose the internally created default signer when constructed from a seed', () => {
      const wallet = new WalletManagerEvm(SEED_PHRASE)
      const defaultSigner = wallet.getSigner()

      wallet.dispose()

      expect(defaultSigner.keyPair.privateKey).toBe(null)
    })

    test('should not dispose a default signer supplied at construction', async () => {
      const root = new SeedSignerEvm(SEED_PHRASE, "m/44'/60'")
      const wallet = new WalletManagerEvm(root)

      wallet.dispose()

      // The consumer still owns the signer, so it must remain fully usable.
      await expect(root.derive("0'/0/0")).resolves.toBeInstanceOf(SeedSignerEvm)

      root.dispose()
    })

    test('should not dispose signers registered via addSigner', () => {
      const named = new SeedSignerEvm(SEED_PHRASE)
      wallet.addSigner('seed', named)

      wallet.dispose()

      expect(named.keyPair.privateKey).not.toBe(null)

      named.dispose()
    })

    test('should be safe to call dispose more than once', () => {
      const wallet = new WalletManagerEvm(SEED_PHRASE)

      wallet.dispose()

      expect(() => wallet.dispose()).not.toThrow()
    })
  })

  describe('getFeeRates', () => {
    test('should return the correct fee rates', async () => {
      // maxFeePerGas = 2 * baseFee (1 gwei) + priorityFee (1 gwei) = 3 gwei;
      // normal is 110% and fast 200% of that.
      const feeRates = await wallet.getFeeRates()

      expect(feeRates.normal).toBe(3_300_000_000n)

      expect(feeRates.fast).toBe(6_000_000_000n)
    })

    test('should throw if the wallet is not connected to a provider', async () => {
      const wallet = new WalletManagerEvm(SEED_PHRASE)

      const promise = wallet.getFeeRates()

      await expect(promise).rejects.toThrow(ProviderRequiredError)
      await expect(promise).rejects.toThrow('The wallet must be connected to a provider to get fee rates.')
    })

    test('should throw if the provider does not return any fee data', async () => {
      // A pre-EIP-1559 block (no baseFeePerGas) makes maxFeePerGas resolve to null, and the
      // missing eth_gasPrice handler makes gasPrice resolve to null.
      const legacyBlock = { ...DUMMY_BLOCK }
      delete legacyBlock.baseFeePerGas

      const handlers = {
        eth_chainId: () => '0x1',
        net_version: () => '1',
        eth_getBlockByNumber: () => legacyBlock
      }

      const provider = {
        request: jest.fn(async ({ method }) => {
          const handler = handlers[method]
          if (!handler) throw new Error(`Unexpected rpc method: ${method}`)
          return handler()
        })
      }

      const wallet = new WalletManagerEvm(new SeedSignerEvm(SEED_PHRASE), { provider })

      await expect(wallet.getFeeRates())
        .rejects.toThrow()
    })
  })
})
