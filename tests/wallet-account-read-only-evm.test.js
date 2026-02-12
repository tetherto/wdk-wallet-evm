import hre from 'hardhat'

import { ContractFactory } from 'ethers'

import { afterEach, beforeEach, describe, expect, test } from '@jest/globals'

import { WalletAccountReadOnlyEvm } from '../index.js'

import TestToken from './artifacts/TestToken.json' with { type: 'json' }

const ADDRESS = '0x405005C7c4422390F4B334F64Cf20E0b767131d0'

const INITIAL_BALANCE = 1_000_000_000_000_000_000n
const INITIAL_TOKEN_BALANCE = 1_000_000n

async function deployTestToken() {
  const [signer] = await hre.ethers.getSigners()

  const factory = new ContractFactory(TestToken.abi, TestToken.bytecode, signer)
  const contract = await factory.deploy()
  const transaction = await contract.deploymentTransaction()

  await transaction.wait()

  return contract
}

describe('WalletAccountReadOnlyEvm', () => {
  let testToken,
    account

  async function sendEthersTo(to, value) {
    const [signer] = await hre.ethers.getSigners()
    const transaction = await signer.sendTransaction({ to, value })
    await transaction.wait()
  }

  async function sendTestTokensTo(to, value) {
    const transaction = await testToken.transfer(to, value)
    await transaction.wait()
  }

  beforeEach(async () => {
    testToken = await deployTestToken()

    await sendEthersTo(ADDRESS, INITIAL_BALANCE)

    await sendTestTokensTo(ADDRESS, INITIAL_TOKEN_BALANCE)

    account = new WalletAccountReadOnlyEvm(ADDRESS, {
      provider: hre.network.provider
    })
  })

  afterEach(async () => {
    await hre.network.provider.send('hardhat_reset')
  })

  describe('address', () => {
    test('should return the correct address', () => {
      expect(account.address).toBe(ADDRESS)
    })
  })

  describe('getBalance', () => {
    test('should return the correct balance of the account', async () => {
      const balance = await account.getBalance()

      expect(balance).toBe(INITIAL_BALANCE)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountReadOnlyEvm(ADDRESS)

      await expect(account.getBalance())
        .rejects.toThrow('The wallet must be connected to a provider to retrieve balances.')
    })
  })

  describe('getTokenBalance', () => {
    test('should return the correct token balance of the account', async () => {
      const balance = await account.getTokenBalance(testToken.target)

      expect(balance).toBe(INITIAL_TOKEN_BALANCE)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountReadOnlyEvm(ADDRESS)

      await expect(account.getTokenBalance(testToken.target))
        .rejects.toThrow('The wallet must be connected to a provider to retrieve token balances.')
    })
  })

  describe('quoteSendTransaction', () => {
    test('should successfully quote a transaction', async () => {
      const TRANSACTION = {
        to: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        value: 1_000
      }

      const EXPECTED_FEE = 49_611_983_472_910n

      const { fee } = await account.quoteSendTransaction(TRANSACTION)

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should successfully quote a transaction with arbitrary data', async () => {
      const TRANSACTION_WITH_DATA = {
        to: testToken.target,
        value: 0,
        data: testToken.interface.encodeFunctionData('balanceOf', ['0x636e9c21f27d9401ac180666bf8DC0D3FcEb0D24'])
      }

      const EXPECTED_FEE = 57_395_969_261_360n

      const { fee } = await account.quoteSendTransaction(TRANSACTION_WITH_DATA)

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountReadOnlyEvm(ADDRESS)

      await expect(account.quoteSendTransaction({}))
        .rejects.toThrow('The wallet must be connected to a provider to quote send transaction operations.')
    })
  })

  describe('quoteTransfer', () => {
    test('should successfully quote a transfer operation', async () => {
      const TRANSFER = {
        token: testToken.target,
        recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        amount: 100
      }

      const EXPECTED_FEE = 123_145_253_772_480n

      const { fee } = await account.quoteTransfer(TRANSFER)

      expect(fee).toBe(EXPECTED_FEE)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const account = new WalletAccountReadOnlyEvm(ADDRESS)

      await expect(account.quoteTransfer({}))
        .rejects.toThrow('The wallet must be connected to a provider to quote transfer operations.')
    })
  })

  describe('getTransactionReceipt', () => {
    test('should return the correct transaction receipt', async () => {
      const [sender] = await hre.ethers.getSigners()

      const TRANSACTION = {
        to: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        value: 0
      }

      const { hash } = await sender.sendTransaction(TRANSACTION)

      const receipt = await account.getTransactionReceipt(hash)

      expect(receipt.hash).toBe(hash)
      expect(receipt.to).toBe(TRANSACTION.to)
      expect(receipt.status).toBe(1)
    })

    test('should return null if the transaction has not been included in a block yet', async () => {
      const HASH = '0xe60970cd7685466037bac1ff337e08265ac9f48af70a12529bdca5caf5a2b14b'

      const receipt = await account.getTransactionReceipt(HASH)

      expect(receipt).toBe(null)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const HASH = '0xe60970cd7685466037bac1ff337e08265ac9f48af70a12529bdca5caf5a2b14b'

      const account = new WalletAccountReadOnlyEvm(ADDRESS)

      await expect(account.getTransactionReceipt(HASH))
        .rejects.toThrow('The wallet must be connected to a provider to fetch transaction receipts.')
    })
  })

  describe('getAllowance', () => {
    const SPENDER_ADDRESS = '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd'

    test('should return 0n when no allowance has been set', async () => {
      const allowance = await account.getAllowance(testToken.target, SPENDER_ADDRESS)

      expect(allowance).toEqual(0n)
    })

    test('should return the correct allowance after it has been set', async () => {
      const allowanceAmount = 500_000n

      await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [ADDRESS]
      })
      const ownerSigner = await hre.ethers.getSigner(ADDRESS)

      const approveTx = await testToken.connect(ownerSigner).approve(SPENDER_ADDRESS, allowanceAmount)
      await approveTx.wait()

      const allowance = await account.getAllowance(testToken.target, SPENDER_ADDRESS)

      expect(allowance).toBe(allowanceAmount)
    })

    test('should throw if the account is not connected to a provider', async () => {
      const accountWithoutProvider = new WalletAccountReadOnlyEvm(ADDRESS)

      await expect(accountWithoutProvider.getAllowance(testToken.target, SPENDER_ADDRESS))
        .rejects.toThrow('The wallet must be connected to a provider to retrieve allowances.')
    })
  })

  describe('verify', () => {
    const MESSAGE = 'Dummy message to sign.'

    const SIGNATURE = '0xd130f94c52bf393206267278ac0b6009e14f11712578e5c1f7afe4a12685c5b96a77a0832692d96fc51f4bd403839572c55042ecbcc92d215879c5c8bb5778c51c'

    test('should return true for a valid signature', async () => {
      const result = await account.verify(MESSAGE, SIGNATURE)

      expect(result).toBe(true)
    })

    test('should return false for an invalid signature', async () => {
      const result = await account.verify('Another message.', SIGNATURE)

      expect(result).toBe(false)
    })

    test('should throw on a malformed signature', async () => {
      await expect(account.verify(MESSAGE, 'A bad signature'))
        .rejects.toThrow('invalid BytesLike value')
    })
  })

  describe('verifyTypedData', () => {
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

    const SIGNATURE = '0xd5d54d9a7fe501ab5dc1532a443a4f70bc8b6ad1c3f09caac9b891efa8701cac5ad1d4830c7bc7ed2688965ed6b04d25e8f55906a843689fdf79100aee3a5dc71c'

    test('should return true for a valid signature', async () => {
      const result = await account.verifyTypedData({
        domain: DOMAIN,
        types: TYPES,
        primaryType: 'Mail',
        message: MESSAGE
      }, SIGNATURE)

      expect(result).toBe(true)
    })

    test('should return false for an invalid signature', async () => {
      const result = await account.verifyTypedData({
        domain: DOMAIN,
        types: TYPES,
        primaryType: 'Mail',
        message: { ...MESSAGE, contents: 'Hello, Alice!' }
      }, SIGNATURE)

      expect(result).toBe(false)
    })

    test('should throw on a malformed signature', async () => {
      await expect(account.verifyTypedData({
        domain: DOMAIN,
        types: TYPES,
        primaryType: 'Mail',
        message: MESSAGE
      }, 'A bad signature'))
        .rejects.toThrow('invalid BytesLike value')
    })
  })
})
