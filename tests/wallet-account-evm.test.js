import hre from 'hardhat'
import { createHmac } from 'crypto'
import { isAddress, HDNodeWallet, JsonRpcProvider, ContractFactory, parseUnits, BrowserProvider } from 'ethers';
import * as secp256k1 from '@noble/secp256k1'

import WalletAccountEvm from '../src/wallet-account-evm.js'
import WalletManagerEvm from '../src/wallet-manager-evm.js'

import MyToken from './abis/MyToken.json' with { type: "json" }
import { afterEach } from '@jest/globals';

const SEED_PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe('WalletAccountEvm', () => {
  let account
  let myTokenAddress

  beforeAll(async () => {
    secp256k1.etc.hmacSha256Sync = (key, ...messages) => {
      const hmac = createHmac('sha256', key)
      messages.forEach(msg => hmac.update(msg))
      return hmac.digest()
    }

    const hdNode = HDNodeWallet.fromPhrase(SEED_PHRASE);
    const provider = new BrowserProvider(hre.network.provider)

    const wallet = hdNode.connect(provider)

    const factory = new ContractFactory(MyToken.abi, MyToken.bytecode, wallet);

    const initialSupply = parseUnits("1000000", 18);

    const contract = await factory.deploy();
    await contract.deploymentTransaction().wait();

    console.log("ERC20 Token deployed at:", contract.target);
    myTokenAddress = contract.target;
  })

  beforeEach(async () => {
    account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0", { provider: hre.network.provider })
  })

  afterEach(() => {
    account.dispose()
  })

  test('shouwld throw if seed phrase is invalid', () => {
    expect(() => {
      new WalletAccountEvm('invalid seed phrase', "0'/0/0")
    }).toThrow()
  })

  describe('index getter', () => {
    test('returns the correct index', () => {
      expect(account.index).toBe(0)
    })
  })

  describe('path getter', () => {
    test('returns the correct path', () => {
      expect(account.path).toBe("m/44'/60'/0'/0/0")
    })
  })

  describe('keyPair getter', () => {
    test('returns the correct key pair', () => {
      expect(account.keyPair).toEqual({
        privateKey: expect.any(Uint8Array),
        publicKey: expect.any(Uint8Array)
      })
    })
  })

  describe('getAddress method', () => {
    test('returns the address', async () => {
      const address = await account.getAddress()

      expect(isAddress(address)).toBe(true)
      expect(typeof address).toBe('string')
    })
  })


  describe('sign method', () => {
    test('produces a unique signature for different messages', async () => {
      const msg1 = 'First message'
      const msg2 = 'Second message'

      const sig1 = await account.sign(msg1)
      const sig2 = await account.sign(msg2)

      expect(sig1).not.toBe(sig2)
      expect(sig1).toMatch(/^0x[a-fA-F0-9]+$/)
      expect(sig2).toMatch(/^0x[a-fA-F0-9]+$/)
    })

    test('produces the same signature for the same message and same key', async () => {
      const message = 'Message to sign'
      const sig1 = await account.sign(message)
      const sig2 = await account.sign(message)

      expect(sig1).toBe(sig2)
    })
  })

  describe('verify method', () => {
    test('returns false for tampered message', async () => {
      const original = 'Original message'
      const altered = 'Original message with change'

      const signature = await account.sign(original)

      const isValid = await account.verify(altered, signature)

      expect(isValid).toBe(false)
    })

    test('returns false for invalid signature', async () => {
      const message = 'Message to check'
      const fakeSig = '0xc8a0eac95516c7396935e903fb35bcf234c8e1df13f7126ad60fdaf0b5d3c6210a4199d49d10271aed578db911a5c2c40ff4329604f71bcd62b39324e8cc62df1b'

      const isValid = await account.verify(message, fakeSig)

      expect(isValid).toBe(false)
    })

    test('throws on malformed signature input', async () => {
      const message = 'Test message'
      const malformedSignature = 'bad-signature'

      await expect(account.verify(message, malformedSignature)).rejects.toThrow()
    })
  })

  describe('sendTransaction method', () => {
    test('sends a transaction and returns the hash', async () => {
      const tx = {
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        value: 1_000
      }

      const hash = await account.sendTransaction(tx)

      expect(hash.match(/^0x[0-9a-fA-F]{64}$/)).toBeTruthy();
    })

    test('throws if provider is missing', async () => {
      const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")
      const tx = {
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        value: 100
      }

      await expect(account.sendTransaction(tx)).rejects.toThrow()
    })
  })

  describe('quoteTransaction method', () => {
    test('returns estimated transaction fee', async () => {
      const tx = {
        to: await account.getAddress(),
        value: 0
      }

      const fee = await account.quoteTransaction(tx)

      expect(typeof fee).toBe('number')

      expect(fee).toBeGreaterThan(0)
    })

    test('throws if provider is missing', async () => {
      const accountWithoutProvider = new WalletAccountEvm(SEED_PHRASE, "0'/0/1")

      const tx = {
        to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        value: 0
      }

      await expect(accountWithoutProvider.quoteTransaction(tx)).rejects.toThrow('The wallet must be connected to a provider to quote transactions.')
    })
  })

  describe('getBalance method', () => {
    test('returns native balance as number', async () => {
      const balance = await account.getBalance()

      expect(typeof balance).toBe('number')
      expect(balance).toBeGreaterThan(0)
    })

    test('throws if provider is missing', async () => {
      const accountWithoutProvider = new WalletAccountEvm(SEED_PHRASE, "0'/0/2")

      await expect(accountWithoutProvider.getBalance()).rejects.toThrow('The wallet must be connected to a provider to retrieve balances.')
    })
  })

  describe('getTokenBalance method', () => {
    test('returns token balance', async () => {
      const balance = await account.getTokenBalance(myTokenAddress);

      expect(balance).toBe(1000000000000000000);
    })

    test('throws if provider is missing', async () => {
      const accountWithoutProvider = new WalletAccountEvm(SEED_PHRASE, "0'/0/3")

      await expect(accountWithoutProvider.getTokenBalance(myTokenAddress)).rejects.toThrow('The wallet must be connected to a provider to retrieve token balances.')
    })
  })
})
