import hre from 'hardhat'

import { ContractFactory, Contract, Signature } from 'ethers'

import * as bip39 from 'bip39'

import { afterEach, beforeEach, describe, expect, test, jest } from '@jest/globals'

import { WalletAccountEvm, WalletAccountReadOnlyEvm } from '../index.js'

import TestToken from './artifacts/TestToken.json' with { type: 'json' }

import SimpleDelegateContract from './artifacts/SimpleDelegateContract.json' with { type: 'json' }

const USDT_MAINNET_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const DELEGATE_CONTRACT_ADDRESS = '0xbe08d4d81ebea77f6aa54b2067ea5f56005f98de'

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

const INVALID_SEED_PHRASE = 'invalid seed phrase'

const SEED = bip39.mnemonicToSeedSync(SEED_PHRASE)

const ACCOUNT = {
  index: 0,
  path: "m/44'/60'/0'/0/0",
  address: '0x405005C7c4422390F4B334F64Cf20E0b767131d0',
  keyPair: {
    privateKey: '260905feebf1ec684f36f1599128b85f3a26c2b817f2065a2fc278398449c41f',
    publicKey: '036c082582225926b9356d95b91a4acffa3511b7cc2a14ef5338c090ea2cc3d0aa'
  }
}

const INITIAL_BALANCE = 1_000_000_000_000_000_000n
const INITIAL_TOKEN_BALANCE = 1_000_000n

async function deploySimpleDelegateContract () {
  const [signer] = await hre.ethers.getSigners()

  const factory = new ContractFactory(SimpleDelegateContract.abi, SimpleDelegateContract.bytecode, signer)
  const contract = await factory.deploy()
  const transaction = await contract.deploymentTransaction()

  await transaction.wait()

  return contract
}

async function deployTestToken () {
  const [signer] = await hre.ethers.getSigners()

  const factory = new ContractFactory(TestToken.abi, TestToken.bytecode, signer)
  const contract = await factory.deploy()
  const transaction = await contract.deploymentTransaction()

  await transaction.wait()

  return contract
}

describe('WalletAccountEvm', () => {
  let testToken,
    delegateContract,
    account

  async function sendEthersTo (to, value) {
    const [signer] = await hre.ethers.getSigners()
    const transaction = await signer.sendTransaction({ to, value })
    await transaction.wait()
  }

  async function sendTestTokensTo (to, value) {
    const transaction = await testToken.transfer(to, value)
    await transaction.wait()
  }

  beforeEach(async () => {
    testToken = await deployTestToken()
    delegateContract = await deploySimpleDelegateContract()

    await sendEthersTo(ACCOUNT.address, INITIAL_BALANCE)

    await sendTestTokensTo(ACCOUNT.address, INITIAL_TOKEN_BALANCE)

    account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0", {
      provider: hre.network.provider
    })
  })

  afterEach(async () => {
    account.dispose()

    await hre.network.provider.send('hardhat_reset')
  })

  describe('constructor', () => {
    test('should successfully initialize an account for the given seed phrase and path', async () => {
      const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")

      expect(account.index).toBe(ACCOUNT.index)

      expect(account.path).toBe(ACCOUNT.path)

      expect(account.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT.keyPair.publicKey, 'hex'))
      })
    })

    test('should successfully initialize an account for the given seed and path', async () => {
      const account = new WalletAccountEvm(SEED, "0'/0/0")

      expect(account.index).toBe(ACCOUNT.index)

      expect(account.path).toBe(ACCOUNT.path)

      expect(account.keyPair).toEqual({
        privateKey: new Uint8Array(Buffer.from(ACCOUNT.keyPair.privateKey, 'hex')),
        publicKey: new Uint8Array(Buffer.from(ACCOUNT.keyPair.publicKey, 'hex'))
      })
    })

    test('should throw if the seed phrase is invalid', () => {
      // eslint-disable-next-line no-new
      expect(() => { new WalletAccountEvm(INVALID_SEED_PHRASE, "0'/0/0") })
        .toThrow('The seed phrase is invalid.')
    })

    test('should throw if the path is invalid', () => {
      // eslint-disable-next-line no-new
      expect(() => { new WalletAccountEvm(SEED_PHRASE, "a'/b/c") })
        .toThrow('invalid path component')
    })
  })

  describe('sign', () => {
    const MESSAGE = 'Dummy message to sign.'

    const EXPECTED_SIGNATURE = '0xd130f94c52bf393206267278ac0b6009e14f11712578e5c1f7afe4a12685c5b96a77a0832692d96fc51f4bd403839572c55042ecbcc92d215879c5c8bb5778c51c'

    test('should return the correct signature', async () => {
      const signature = await account.sign(MESSAGE)

      expect(signature).toBe(EXPECTED_SIGNATURE)
    })
  })

  describe('signTypedData', () => {
    const DOMAIN = {
      name: 'TestApp',
      version: '1',
      chainId: 1,
      verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
    }

    const TYPES = {
      Person: [
        { name: 'name', type: 'string' },
        { name: 'wallet', type: 'address' }
      ],
      Mail: [
        { name: 'from', type: 'Person' },
        { name: 'to', type: 'Person' },
        { name: 'contents', type: 'string' }
      ]
    }

    const MESSAGE = {
      from: {
        name: 'Alice',
        wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826'
      },
      to: {
        name: 'Bob',
        wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'
      },
      contents: 'Hello, Bob!'
    }

    const EXPECTED_SIGNATURE = '0xd5d54d9a7fe501ab5dc1532a443a4f70bc8b6ad1c3f09caac9b891efa8701cac5ad1d4830c7bc7ed2688965ed6b04d25e8f55906a843689fdf79100aee3a5dc71c'

    test('should return the correct signature', async () => {
      const signature = await account.signTypedData({
        domain: DOMAIN,
        types: TYPES,
        primaryType: 'Mail',
        message: MESSAGE
      })

      expect(signature).toBe(EXPECTED_SIGNATURE)
    })
  })

  describe('sendTransaction', () => {
    test('should successfully send a transaction', async () => {
      const TRANSACTION = {
        to: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        value: 1_000
      }

      const EXPECTED_FEE = 46_114_898_254_972n

      const { hash, fee } = await account.sendTransaction(TRANSACTION)

      const transaction = await hre.ethers.provider.getTransaction(hash)

      expect(transaction.to).toBe(TRANSACTION.to)
      expect(transaction.value).toBe(BigInt(TRANSACTION.value))

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should successfully send a transaction with arbitrary data', async () => {
      const TRANSACTION_WITH_DATA = {
        to: testToken.target,
        value: 0,
        data: testToken.interface.encodeFunctionData('balanceOf', ['0x636e9c21f27d9401ac180666bf8DC0D3FcEb0D24'])
      }

      const EXPECTED_FEE = 53_350_200_847_712n

      const { hash, fee } = await account.sendTransaction(TRANSACTION_WITH_DATA)

      const transaction = await hre.ethers.provider.getTransaction(hash)

      expect(transaction.to).toBe(TRANSACTION_WITH_DATA.to)
      expect(transaction.value).toBe(BigInt(TRANSACTION_WITH_DATA.value))
      expect(transaction.data).toBe(TRANSACTION_WITH_DATA.data)

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should successfully send a transaction with an authorization list', async () => {
      const auth = await account.signAuthorization({
        address: DELEGATE_CONTRACT_ADDRESS
      })

      const TRANSACTION_WITH_AUTHORIZATION_LIST = {
        type: 4,
        to: account.address,
        value: 0,
        gasLimit: 100_000,
        authorizationList: [auth]
      }

      const EXPECTED_FEE = 101_010_972_554_972n

      const { hash, fee } = await account.sendTransaction(TRANSACTION_WITH_AUTHORIZATION_LIST)

      const transaction = await hre.ethers.provider.getTransaction(hash)

      expect(transaction.to).toBe(account.address)
      expect(transaction.value).toBe(0n)
      expect(transaction.type).toBe(4)

      expect(transaction.authorizationList).toEqual([{
        address: DELEGATE_CONTRACT_ADDRESS,
        nonce: 0n,
        chainId: 31_337n,
        signature: expect.objectContaining({
          r: '0x6d9dbf302601c472e1ab44401e56abc1b4cbce9b6806a7267f853d0ff4b4a324',
          s: '0x52e3b093cdc0e2fc2fc878352ce80c57d25ab3ea28ac2c065f72ff4b29a65783',
          v: 27
        })
      }])

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")

      await expect(account.sendTransaction({ }))
        .rejects.toThrow('The wallet must be connected to a provider to send transactions.')
    })
  })

  describe('transfer', () => {
    test('should successfully transfer tokens', async () => {
      const TRANSFER = {
        token: testToken.target,
        recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        amount: 100
      }

      const EXPECTED_FEE = 114_464_902_444_416n

      const { hash, fee } = await account.transfer(TRANSFER)
      const transaction = await hre.ethers.provider.getTransaction(hash)
      const data = testToken.interface.encodeFunctionData('transfer', [TRANSFER.recipient, TRANSFER.amount])

      expect(transaction.to).toBe(TRANSFER.token)
      expect(transaction.value).toBe(0n)
      expect(transaction.data).toBe(data)

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should successfully transfer tokens with an authorization list', async () => {
      const auth = await account.signAuthorization({
        address: DELEGATE_CONTRACT_ADDRESS
      })

      const TRANSFER = {
        token: testToken.target,
        recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        amount: 100,
        authorizationList: [auth]
      }

      const EXPECTED_FEE = 169_360_976_744_416n

      const { hash, fee } = await account.transfer(TRANSFER)
      const transaction = await hre.ethers.provider.getTransaction(hash)
      const data = testToken.interface.encodeFunctionData('transfer', [TRANSFER.recipient, TRANSFER.amount])

      expect(transaction.to).toBe(TRANSFER.token)
      expect(transaction.value).toBe(0n)
      expect(transaction.data).toBe(data)
      expect(transaction.type).toBe(4)

      expect(transaction.authorizationList).toEqual([{
        address: DELEGATE_CONTRACT_ADDRESS,
        nonce: 0n,
        chainId: 31_337n,
        signature: expect.objectContaining({
          r: '0x6d9dbf302601c472e1ab44401e56abc1b4cbce9b6806a7267f853d0ff4b4a324',
          s: '0x52e3b093cdc0e2fc2fc878352ce80c57d25ab3ea28ac2c065f72ff4b29a65783',
          v: 27
        })
      }])

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should throw if transfer fee exceeds the transfer max fee configuration', async () => {
      const TRANSFER = {
        token: testToken.target,
        recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        amount: 100
      }

      const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0", {
        provider: hre.network.provider,
        transferMaxFee: 0
      })

      await expect(account.transfer(TRANSFER))
        .rejects.toThrow('Exceeded maximum fee cost for transfer operation.')
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")

      await expect(account.transfer({ }))
        .rejects.toThrow('The wallet must be connected to a provider to transfer tokens.')
    })
  })

  describe('approve', () => {
    const SPENDER = '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd'
    const AMOUNT = 100n

    test('should successfully approve tokens for a spender', async () => {
      const APPROVE_OPTIONS = {
        token: testToken.target,
        spender: SPENDER,
        amount: AMOUNT
      }

      const { hash, fee } = await account.approve(APPROVE_OPTIONS)
      const transaction = await hre.ethers.provider.getTransaction(hash)
      const data = testToken.interface.encodeFunctionData('approve', [SPENDER, AMOUNT])

      expect(transaction.hash).toBe(hash)
      expect(transaction.to).toBe(APPROVE_OPTIONS.token)
      expect(transaction.data).toBe(data)
      expect(typeof fee).toBe('bigint')
      expect(fee).toBeGreaterThan(0n)

      const allowance = await testToken.allowance(ACCOUNT.address, SPENDER)
      expect(allowance).toBe(AMOUNT)
    })

    test('should throw if approving non-zero USDT on mainnet when allowance is non-zero', async () => {
      jest.spyOn(account, 'getAllowance').mockResolvedValue(1n)
      jest.spyOn(account._provider, 'getNetwork').mockResolvedValue({ chainId: 1n })

      const approveOptions = {
        token: USDT_MAINNET_ADDRESS,
        spender: SPENDER,
        amount: AMOUNT
      }

      await expect(account.approve(approveOptions))
        .rejects.toThrow('USDT requires the current allowance to be reset to 0 before setting a new non-zero value.')
    })

    test('should successfully approve a non-zero amount for USDT on mainnet when allowance is zero', async () => {
      jest.spyOn(account, 'getAllowance').mockResolvedValue(0n)
      jest.spyOn(account._provider, 'getNetwork').mockResolvedValue({ chainId: 1n })
      const sendTxSpy = jest.spyOn(account, 'sendTransaction').mockResolvedValue({ hash: '0xhash', fee: 0n })

      const approveOptions = {
        token: USDT_MAINNET_ADDRESS,
        spender: SPENDER,
        amount: AMOUNT
      }

      const abi = ['function approve(address spender, uint256 amount) returns (bool)']
      const contract = new Contract(USDT_MAINNET_ADDRESS, abi, hre.ethers.provider)
      const expectedData = contract.interface.encodeFunctionData('approve', [SPENDER, AMOUNT])

      const { hash, fee } = await account.approve(approveOptions)

      expect(hash).toBe('0xhash')
      expect(fee).toBe(0n)
      expect(sendTxSpy).toHaveBeenCalledWith({
        to: USDT_MAINNET_ADDRESS,
        value: 0,
        data: expectedData
      })
    })

    test('should successfully approve a zero amount for USDT on mainnet when allowance is non-zero', async () => {
      jest.spyOn(account, 'getAllowance').mockResolvedValue(1n)
      jest.spyOn(account._provider, 'getNetwork').mockResolvedValue({ chainId: 1n })
      const sendTxSpy = jest.spyOn(account, 'sendTransaction').mockResolvedValue({ hash: '0xhash', fee: 0n })

      const approveOptions = {
        token: USDT_MAINNET_ADDRESS,
        spender: SPENDER,
        amount: 0
      }

      const abi = ['function approve(address spender, uint256 amount) returns (bool)']
      const contract = new Contract(USDT_MAINNET_ADDRESS, abi, hre.ethers.provider)
      const expectedData = contract.interface.encodeFunctionData('approve', [SPENDER, 0])

      const { hash, fee } = await account.approve(approveOptions)

      expect(hash).toBe('0xhash')
      expect(fee).toBe(0n)
      expect(sendTxSpy).toHaveBeenCalledWith({
        to: USDT_MAINNET_ADDRESS,
        value: 0,
        data: expectedData
      })
    })

    test('should throw if the account is not connected to a provider', async () => {
      const accountWithoutProvider = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")
      const approveOptions = {
        token: testToken.target,
        spender: SPENDER,
        amount: AMOUNT
      }

      await expect(accountWithoutProvider.approve(approveOptions))
        .rejects.toThrow('The wallet must be connected to a provider to approve funds.')
    })
  })

  describe('toReadOnlyAccount', () => {
    test('should return a read-only copy of the account', async () => {
      const readOnlyAccount = await account.toReadOnlyAccount()

      expect(readOnlyAccount).toBeInstanceOf(WalletAccountReadOnlyEvm)

      expect(await readOnlyAccount.getAddress()).toBe(ACCOUNT.address)
    })
  })

  describe('signAuthorization', () => {
    test('should succesfully sign an authorization', async () => {
      const auth = await account.signAuthorization({
        address: delegateContract.target
      })

      expect(auth).toEqual({
        address: delegateContract.target,
        nonce: 0n,
        chainId: 31_337n,
        signature: expect.objectContaining({
          r: '0x6d9dbf302601c472e1ab44401e56abc1b4cbce9b6806a7267f853d0ff4b4a324',
          s: '0x52e3b093cdc0e2fc2fc878352ce80c57d25ab3ea28ac2c065f72ff4b29a65783',
          v: 27
        })
      })
    })
  })

  describe('delegate', () => {
    test('should succesfully set delegation to a contract', async () => {
      const EXPECTED_FEE = 101_404_028_446_960n

      const { hash, fee } = await account.delegate(DELEGATE_CONTRACT_ADDRESS)

      const transaction = await hre.ethers.provider.getTransaction(hash)

      expect(transaction.to).toBe(account.address)
      expect(transaction.value).toBe(0n)
      expect(transaction.type).toBe(4)

      expect(transaction.authorizationList).toEqual([{
        address: DELEGATE_CONTRACT_ADDRESS,
        nonce: 1n,
        chainId: 31_337n,
        signature: expect.objectContaining({
          r: '0x7dc08507592858aced1689ea3d58a4e3b482dd3ace313b33a5cd53c90d895a6e',
          s: '0x4e3b748e3d9d4d55231f64b389bd1890b598150328f4e15a24baa35e39ed7e00',
          v: 28
        })
      }])

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")

      await expect(account.delegate(delegateContract.target))
        .rejects.toThrow('The wallet must be connected to a provider to delegate.')
    })
  })

  describe('revokeDelegation', () => {
    test('should successfully set a delegation to the zero address', async () => {
      const EXPECTED_FEE = 101_010_972_554_972n

      const { hash, fee } = await account.revokeDelegation()

      const transaction = await hre.ethers.provider.getTransaction(hash)

      expect(transaction.to).toBe(account.address)
      expect(transaction.value).toBe(0n)
      expect(transaction.type).toBe(4)

      expect(transaction.authorizationList).toEqual([{
        address: '0x0000000000000000000000000000000000000000',
        nonce: 1n,
        chainId: 31_337n,
        signature: expect.objectContaining({
          r: '0x6ec7aaa669f7ffe72dccf910d7f6d8282649660747f3ce8a1218de8ab5710899',
          s: '0x4bf4e7983a6f1e1db3d275f02e18bfc4408732e49ac3465dc8cd3150e9ac9240',
          v: 28
        })
      }])

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0")

      await expect(account.revokeDelegation())
        .rejects.toThrow('The wallet must be connected to a provider to delegate.')
    })
  })

})
