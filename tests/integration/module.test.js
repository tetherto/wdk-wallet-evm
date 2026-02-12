import hre from 'hardhat'

import { ContractFactory } from 'ethers'

import { describe, expect, test, beforeEach, afterEach } from '@jest/globals'

import WalletManagerEvm from '../../index.js'

import TestToken from './../artifacts/TestToken.json' with { type: 'json' }

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

const ACCOUNT_0 = {
  index: 0,
  path: "m/44'/60'/0'/0/0",
  address: '0x405005C7c4422390F4B334F64Cf20E0b767131d0',
  keyPair: {
    privateKey: '260905feebf1ec684f36f1599128b85f3a26c2b817f2065a2fc278398449c41f',
    publicKey: '036c082582225926b9356d95b91a4acffa3511b7cc2a14ef5338c090ea2cc3d0aa'
  }
}

const ACCOUNT_1 = {
  index: 1,
  path: "m/44'/60'/0'/0/1",
  address: '0xcC81e04BadA16DEf9e1AFB027B859bec42BE49dB',
  keyPair: {
    privateKey: 'ba3d34b786d909f83be1422b75ea18005843ff979862619987fb0bab59580158',
    publicKey: '02f8d04c3de44e53e5b0ef2f822a29087e6af80114560956518767c64fec6b0f69'
  }
}

const INITIAL_BALANCE = 1_000_000_000_000_000_000n
const INITIAL_TOKEN_BALANCE = 1_000_000n

async function deployTestToken () {
  const [signer] = await hre.ethers.getSigners()

  const factory = new ContractFactory(TestToken.abi, TestToken.bytecode, signer)
  const contract = await factory.deploy()
  const transaction = await contract.deploymentTransaction()

  await transaction.wait()

  return contract
}

describe('@tetherto/wdk-wallet-evm', () => {
  let testToken,
    wallet

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

    for (const account of [ACCOUNT_0, ACCOUNT_1]) {
      await sendEthersTo(account.address, INITIAL_BALANCE)

      await sendTestTokensTo(account.address, INITIAL_TOKEN_BALANCE)
    }

    wallet = new WalletManagerEvm(SEED_PHRASE, {
      provider: hre.network.provider
    })
  })

  afterEach(async () => {
    await hre.network.provider.send('hardhat_reset')
  })

  test('should derive an account, quote the cost of a tx and send the tx', async () => {
    const account = await wallet.getAccount(0)

    const TRANSACTION = {
      to: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
      value: 1_000
    }

    const EXPECTED_FEE = 42_921_547_517_892n

    const { fee: feeEstimate } = await account.quoteSendTransaction(TRANSACTION)

    expect(feeEstimate).toBe(EXPECTED_FEE)

    const { hash, fee } = await account.sendTransaction(TRANSACTION)

    const transaction = await hre.ethers.provider.getTransaction(hash)

    expect(transaction.hash).toBe(hash)
    expect(transaction.to).toBe(TRANSACTION.to)
    expect(transaction.value).toBe(BigInt(TRANSACTION.value))

    expect(fee).toBe(EXPECTED_FEE)
  })

  test('should derive two accounts, send a tx from account 1 to 2 and get the correct balances', async () => {
    const account0 = await wallet.getAccount(0)

    const account1 = await wallet.getAccount(1)

    const TRANSACTION = {
      to: await account1.getAddress(),
      value: 1_000
    }

    const { hash } = await account0.sendTransaction(TRANSACTION)

    const { fee } = await hre.ethers.provider.getTransactionReceipt(hash)

    const balanceAccount0 = await account0.getBalance()
    const balanceAccount1 = await account1.getBalance()

    expect(balanceAccount0).toBe(INITIAL_BALANCE - fee - 1_000n)
    expect(balanceAccount1).toBe(INITIAL_BALANCE + 1_000n)
  })

  test('should derive an account by its path, quote the cost of transferring a token and transfer a token', async () => {
    const account = await wallet.getAccountByPath("0'/0/0")

    const TRANSFER = {
      token: testToken.target,
      recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
      amount: 100
    }

    const EXPECTED_FEE = 106_538_470_978_176n

    const { fee: feeEstimate } = await account.quoteTransfer(TRANSFER)

    expect(feeEstimate).toBe(EXPECTED_FEE)

    const { hash, fee } = await account.transfer(TRANSFER)
    const transaction = await hre.ethers.provider.getTransaction(hash)
    const data = testToken.interface.encodeFunctionData('transfer', [TRANSFER.recipient, TRANSFER.amount])

    expect(transaction.hash).toBe(hash)
    expect(transaction.to).toBe(TRANSFER.token)
    expect(transaction.value).toBe(0n)

    expect(transaction.data).toBe(data)

    expect(fee).toBe(EXPECTED_FEE)
  })

  test('should derive two accounts by their paths, transfer a token from account 1 to 2 and get the correct balances and token balances', async () => {
    const account0 = await wallet.getAccountByPath("0'/0/0")
    const account1 = await wallet.getAccountByPath("0'/0/1")

    const TRANSFER = {
      token: testToken.target,
      recipient: await account1.getAddress(),
      amount: 100
    }

    const { hash } = await account0.transfer(TRANSFER)

    const { fee } = await hre.ethers.provider.getTransactionReceipt(hash)

    const balanceAccount0 = await account0.getBalance()

    expect(balanceAccount0).toBe(INITIAL_BALANCE - fee)

    const tokenBalanceAccount0 = await account0.getTokenBalance(testToken.target)
    const tokenBalanceAccount1 = await account1.getTokenBalance(testToken.target)

    expect(tokenBalanceAccount0).toBe(INITIAL_TOKEN_BALANCE - 100n)
    expect(tokenBalanceAccount1).toBe(INITIAL_TOKEN_BALANCE + 100n)
  })

  test('should derive two accounts, approve x tokens from account 1 to 2, transfer x tokens from account 1 to 2 and get the correct balances and token balances', async () => {
    const account0 = await wallet.getAccount(0)

    const account1 = await wallet.getAccount(1)

    const TRANSACTION_APPROVE = {
      to: testToken.target,
      value: 0,
      data: testToken.interface.encodeFunctionData('approve', [
        await account1.getAddress(),
        100
      ])
    }

    const { hash: approveHash } = await account0.sendTransaction(TRANSACTION_APPROVE)

    const { fee: approveFee } = await hre.ethers.provider.getTransactionReceipt(approveHash)

    const TRANSACTION_TRANSFER_FROM = {
      from: await account1.getAddress(),
      to: testToken.target,
      value: 0,
      data: testToken.interface.encodeFunctionData('transferFrom', [
        await account0.getAddress(),
        await account1.getAddress(),
        100
      ])
    }

    const { hash: transferFromHash } = await account1.sendTransaction(TRANSACTION_TRANSFER_FROM)

    const { fee: transferFromFee } = await hre.ethers.provider.getTransactionReceipt(transferFromHash)

    const balanceAccount0 = await account0.getBalance()
    const balanceAccount1 = await account1.getBalance()

    expect(balanceAccount0).toBe(INITIAL_BALANCE - approveFee)
    expect(balanceAccount1).toBe(INITIAL_BALANCE - transferFromFee)

    const tokenBalanceAccount0 = await account0.getTokenBalance(testToken.target)
    const tokenBalanceAccount1 = await account1.getTokenBalance(testToken.target)

    expect(tokenBalanceAccount0).toBe(INITIAL_TOKEN_BALANCE - 100n)
    expect(tokenBalanceAccount1).toBe(INITIAL_TOKEN_BALANCE + 100n)
  })

  test('should derive an account, sign a message and verify its signature', async () => {
    const account = await wallet.getAccount(0)

    const MESSAGE = 'Hello, world!'

    const signature = await account.sign(MESSAGE)
    const isValid = await account.verify(MESSAGE, signature)
    expect(isValid).toBe(true)
  })

  test('should derive an account, sign typed data and verify its signature', async () => {
    const account0 = await wallet.getAccountByPath("0'/0/0")

    const TYPED_DATA = {
      domain: {
        name: 'Test',
        version: '1',
        chainId: 1,
        verifyingContract: '0x0000000000000000000000000000000000000000'
      },
      types: {
        Message: [
          { name: 'content', type: 'string' }
        ]
      },
      message: {
        content: 'Hello, world!'
      }
    }

    const signature = await account0.signTypedData(TYPED_DATA)

    const isValid = await account0.verifyTypedData(TYPED_DATA, signature)
    expect(isValid).toBe(true)
  })

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
      token: testToken.target,
      recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
      amount: 100
    }

    for (const account of [account0, account1]) {
      expect(account.keyPair.privateKey).toBe(undefined)

      await expect(account.sign(MESSAGE)).rejects.toThrow('Uint8Array expected')
      await expect(account.sendTransaction(TRANSACTION)).rejects.toThrow('Uint8Array expected')
      await expect(account.transfer(TRANSFER)).rejects.toThrow('Uint8Array expected')
    }
  })

  test('should create a wallet with a low transfer max fee, derive an account, try to transfer some tokens and gracefully fail', async () => {
    const wallet = new WalletManagerEvm(SEED_PHRASE, {
      provider: hre.network.provider,
      transferMaxFee: 0
    })

    const account = await wallet.getAccount(0)

    const TRANSFER = {
      token: testToken.target,
      recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
      amount: 100
    }

    await expect(account.transfer(TRANSFER))
      .rejects.toThrow('Exceeded maximum fee cost for transfer operation.')
  })
})
