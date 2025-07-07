import hre from 'hardhat'

import { ContractFactory } from 'ethers'

import { describe, expect, test, beforeAll, afterAll } from '@jest/globals'

import WalletManagerEvm from '../../index.js'

import TestToken from './../abis/TestToken.json' with { type: 'json' }

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

const ACCOUNT0 = {
  index: 0,
  path: "m/44'/60'/0'/0/0",
  address: '0x405005C7c4422390F4B334F64Cf20E0b767131d0',
  keyPair: {
    privateKey: '260905feebf1ec684f36f1599128b85f3a26c2b817f2065a2fc278398449c41f',
    publicKey: '036c082582225926b9356d95b91a4acffa3511b7cc2a14ef5338c090ea2cc3d0aa'
  }
}

const ACCOUNT1 = {
  index: 1,
  path: "m/44'/60'/0'/0/1",
  address: '0xcC81e04BadA16DEf9e1AFB027B859bec42BE49dB',
  keyPair: {
    privateKey: 'ba3d34b786d909f83be1422b75ea18005843ff979862619987fb0bab59580158',
    publicKey: '02f8d04c3de44e53e5b0ef2f822a29087e6af80114560956518767c64fec6b0f69'
  }
}

async function deployTestToken () {
  const [signer] = await hre.ethers.getSigners()

  const factory = new ContractFactory(TestToken.abi, TestToken.bytecode, signer)
  const contract = await factory.deploy()
  const transaction = await contract.deploymentTransaction()

  await transaction.wait()

  return contract
}

describe('@wdk/wallet-evm', () => {
  let wallet
  let account0, account1

  async function reset () {
    await hre.network.provider.send('hardhat_reset')
  }

  beforeAll(async () => {
    await reset()
    wallet = new WalletManagerEvm(SEED_PHRASE, {
      provider: hre.network.provider
    })
    account0 = await wallet.getAccountByPath("0'/0/0")
    account1 = await wallet.getAccountByPath("0'/0/1")
  })

  afterAll(async () => {
    await hre.network.provider.send('hardhat_reset')
  })

  test('should derive an account, quote the cost of a tx, send the tx and return the correct balance', async () => {
    const txAmount = 1_000

    wallet = new WalletManagerEvm(SEED_PHRASE, {
      provider: hre.network.provider
    })
    account0 = await wallet.getAccountByPath("0'/0/0")
    account1 = await wallet.getAccountByPath("0'/0/1")

    expect(account0.index).toBe(ACCOUNT0.index)

    expect(account0.path).toBe(ACCOUNT0.path)

    expect(account0.keyPair).toEqual({
      privateKey: new Uint8Array(Buffer.from(ACCOUNT0.keyPair.privateKey, 'hex')),
      publicKey: new Uint8Array(Buffer.from(ACCOUNT0.keyPair.publicKey, 'hex'))
    })

    expect(account1.index).toBe(ACCOUNT1.index)

    expect(account1.path).toBe(ACCOUNT1.path)

    expect(account1.keyPair).toEqual({
      privateKey: new Uint8Array(Buffer.from(ACCOUNT1.keyPair.privateKey, 'hex')),
      publicKey: new Uint8Array(Buffer.from(ACCOUNT1.keyPair.publicKey, 'hex'))
    })

    const TRANSACTION = {
      to: await account1.getAddress(),
      value: txAmount
    }

    const EXPECTED_FEE = 63_003_000_000_000

    const { fee: estimatedFee } = await account0.quoteSendTransaction(TRANSACTION)

    expect(estimatedFee).toBe(EXPECTED_FEE)

    const startBalance0 = await account0.getBalance()
    const startBalance1 = await account1.getBalance()

    const { hash, fee } = await account0.sendTransaction(TRANSACTION)
    const receipt = await hre.ethers.provider.getTransactionReceipt(hash)

    expect(fee).toBe(estimatedFee)
    expect(receipt.status).toBe(1)

    const actualFee = receipt.fee

    const endBalance0 = await account0.getBalance()

    const expectedBalance0 = startBalance0 - txAmount - parseInt(actualFee)
    expect(endBalance0).toEqual(expectedBalance0)

    const endBalance1 = await account1.getBalance()

    expect(endBalance1).toEqual(startBalance1 + txAmount)
  })

  test('should send a tx from account 0 to 1 and return the correct balance for account 1', async () => {
    const txAmount = 1_000

    const TRANSACTION = {
      to: await account1.getAddress(),
      value: txAmount
    }

    const startBalance1 = await account1.getBalance()

    const { hash } = await account0.sendTransaction(TRANSACTION)
    const receipt = await hre.ethers.provider.getTransactionReceipt(hash)

    expect(receipt.status).toBe(1)

    const endBalance1 = await account1.getBalance()

    expect(endBalance1).toEqual(startBalance1 + txAmount)
  })

  test('should quote the cost of sending test tokens to from account0 to account1 and check the fee', async () => {
    const txAmount = 100
    const testToken = await deployTestToken()

    const TRANSACTION = {
      token: testToken.target,
      recipient: await account1.getAddress(),
      amount: txAmount
    }

    const EXPECTED_FEE = 121_999_315_190_976

    const { fee } = await account0.quoteTransfer(TRANSACTION)

    expect(fee).toBe(EXPECTED_FEE)

    const startBalance0 = await account0.getBalance()

    const startTokenBalance0 = await account0.getTokenBalance(testToken.target)
    const startTokenBalance1 = await account1.getTokenBalance(testToken.target)

    const { hash } = await account0.transfer(TRANSACTION)
    const receipt = await hre.ethers.provider.getTransactionReceipt(hash)

    const actualFee = receipt.fee

    expect(receipt.status).toBe(1)

    const endBalance0 = await account0.getBalance()
    
    const expectedBalance0 = startBalance0 - parseInt(actualFee)
    expect(endBalance0).toEqual(expectedBalance0)

    const endTokenBalance0 = await account0.getTokenBalance(testToken.target)

    const expectedTokenBalance0 = startTokenBalance0 - txAmount
    expect(endTokenBalance0).toEqual(expectedTokenBalance0)

    const endTokenBalance1 = await account1.getTokenBalance(testToken.target)

    expect(endTokenBalance1).toEqual(startTokenBalance1 + txAmount)
  })

  test('should send test tokens from account 0 to 1 and return the correct balance for account 1', async () => {
    const txAmount = 100
    const testToken = await deployTestToken()

    const TRANSACTION = {
      token: testToken.target,
      recipient: await account1.getAddress(),
      amount: txAmount
    }

    const startTokenBalance1 = await account1.getTokenBalance(testToken.target)

    const { hash } = await account0.transfer(TRANSACTION)
    const receipt = await hre.ethers.provider.getTransactionReceipt(hash)

    expect(receipt.status).toBe(1)

    const endTokenBalance1 = await account1.getTokenBalance(testToken.target)

    expect(endTokenBalance1).toEqual(startTokenBalance1 + txAmount)
  })

  test('should approve and send test tokens to user 1 from user 0 using transferFrom', async () => {
    const txAmount = 100
    const testToken = await deployTestToken()

    const tokenBalance = await account0.getTokenBalance(testToken.target)
    expect(tokenBalance).toBe(1000000000000000000)

    const startTokenBalance0 = await account0.getTokenBalance(testToken.target)
    const startTokenBalance1 = await account1.getTokenBalance(testToken.target)

    const TRANSACTION_WITH_DATA_APPROVE = {
      to: testToken.target,
      value: 0,
      data: testToken.interface.encodeFunctionData('approve', [
        await account1.getAddress(),
        txAmount
      ])
    }

    const { hash: hashApprove } = await account0.sendTransaction(TRANSACTION_WITH_DATA_APPROVE)

    const receiptApprove = await hre.ethers.provider.getTransactionReceipt(hashApprove)

    expect(receiptApprove.status).toBe(1)

    const allowance = await testToken.allowance(await account0.getAddress(), await account1.getAddress())
    expect(allowance).toBe(BigInt(txAmount))

    const TRANSACTION = {
      to: await account1.getAddress(),
      value: 1_000_000_000_000_000
    }
    const { hash: hashSend } = await account0.sendTransaction(TRANSACTION)
    const receiptSend = await hre.ethers.provider.getTransactionReceipt(hashSend)

    expect(receiptSend.status).toBe(1)
    expect(await account1.getBalance()).toBeGreaterThan(0)

    const TRANSACTION_WITH_DATA_TRANSFER_FROM = {
      to: testToken.target,
      from: await account1.getAddress(),
      value: 0,
      data: testToken.interface.encodeFunctionData('transferFrom', [
        await account0.getAddress(),
        await account1.getAddress(),
        txAmount
      ])
    }

    const { hash: hashTransferFrom } = await account1.sendTransaction(TRANSACTION_WITH_DATA_TRANSFER_FROM)

    const receiptTransferFrom = await hre.ethers.provider.getTransactionReceipt(hashTransferFrom)

    expect(receiptTransferFrom.status).toBe(1)

    const endTokenBalance0 = await account0.getTokenBalance(testToken.target)

    const expectedTokenBalance0 = startTokenBalance0 - txAmount
    expect(endTokenBalance0).toEqual(expectedTokenBalance0)

    const endTokenBalance1 = await account1.getTokenBalance(testToken.target)

    expect(endTokenBalance1).toEqual(startTokenBalance1 + txAmount)
  })

  test('should sign a message and verify its signature', async () => {
    const message = 'Hello, world!'

    const signature = await account0.sign(message)
    expect(signature).toBeDefined()

    const verified = await account0.verify(message, signature)
    expect(verified).toBe(true)
  })

  test('should dispose the wallet and throw an error when trying to access the private key', async () => {
    const message = 'Hello, world!'

    wallet.dispose()

    expect(() => {
        account0.keyPair.privateKey // eslint-disable-line
    }).toThrow('Uint8Array expected')

    expect(() => {
        account1.keyPair.privateKey // eslint-disable-line
    }).toThrow('Uint8Array expected')

    await expect(account0.sendTransaction({ to: await account1.getAddress(), value: 1000 })).rejects.toThrow('Uint8Array expected')

    await expect(account0.sign(message)).rejects.toThrow('Uint8Array expected')
  })

  test('should create a wallet with a low transfer max fee, send a transaction with a low transfer max fee and throw an error', async () => {
    const maxFee = 1_000_000
    const testToken = await deployTestToken()
    wallet = new WalletManagerEvm(SEED_PHRASE, {
      provider: hre.network.provider,
      transferMaxFee: maxFee
    })
    account0 = await wallet.getAccountByPath("0'/0/0")
    account1 = await wallet.getAccountByPath("0'/0/1")

    const TRANSACTION = {
      token: testToken.target,
      recipient: await account1.getAddress(),
      amount: 100000000000000
    }

    await expect(account0.transfer(TRANSACTION)).rejects.toThrow('Exceeded maximum fee cost for transfer operation.')
  })
})
