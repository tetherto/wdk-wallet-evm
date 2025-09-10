import test from 'brittle'

import { WalletAccountReadOnlyEvm } from '@wdk/wallet-evm'

import { ContractFactory, Wallet, JsonRpcProvider } from "ethers" with { imports: "bare-wdk-runtime/package" }

import TestToken from '../artifacts/TestToken.json' with { type: 'json' }

const PROVIDER = 'http://127.0.0.1:8545'

const ADDRESS = '0x405005C7c4422390F4B334F64Cf20E0b767131d0'

const INITIAL_BALANCE = 1_000_000_000_000_000_000n
const INITIAL_TOKEN_BALANCE = 1_000_000n

async function deployTestToken () {
  const [signer] = getSigners()

  const factory = new ContractFactory(
    TestToken.abi,
    TestToken.bytecode,
    signer
  )
  const contract = await factory.deploy()

  const transaction = contract.deploymentTransaction()
  await transaction.wait()

  return contract
}

async function delay (ms = 100) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getSigners () {
  const signer = Wallet.fromPhrase(
    'anger burst story spy face pattern whale quit delay fiction ball solve',
    new JsonRpcProvider(PROVIDER)
  )
  return [signer]
}

test('WalletAccountReadOnlyEvm', async function (t) {
  let provider, testToken, account

  async function sendEthersTo (to, value) {
    const [signer] = getSigners()
    const transaction = await signer.sendTransaction({ to, value })
    await transaction.wait()
    await delay()
  }

  async function sendTestTokensTo (to, value) {
    const transaction = await testToken.transfer(to, value)
    await transaction.wait()
    await delay()
  }

  async function beforeEach () {
    provider = new JsonRpcProvider(PROVIDER)

    testToken = await deployTestToken()

    await sendEthersTo(ADDRESS, INITIAL_BALANCE)

    await sendTestTokensTo(ADDRESS, INITIAL_TOKEN_BALANCE)

    account = new WalletAccountReadOnlyEvm(ADDRESS, {
      provider: PROVIDER
    })
  }

  async function afterEach () {
    await provider.send('hardhat_reset', [])

    provider.destroy()
  }

  await t.test('getBalance', async (t) => {
    await t.test(
      'should return the correct balance of the account',
      async (t) => {
        await beforeEach()
        t.teardown(afterEach)

        const balance = await account.getBalance()

        t.is(balance, INITIAL_BALANCE)
      }
    )

    await t.test(
      'should throw if the account is not connected to a provider',
      async (t) => {
        await beforeEach()
        t.teardown(afterEach)

        const account = new WalletAccountReadOnlyEvm(ADDRESS)

        await t.exception.all(
          async () => await account.getBalance(),
          /The wallet must be connected to a provider to retrieve balances\./
        )
      }
    )
  })

  await t.test('getTokenBalance', async (t) => {
    await t.test(
      'should return the correct token balance of the account',
      async (t) => {
        await beforeEach()
        t.teardown(afterEach)

        const balance = await account.getTokenBalance(testToken.target)

        t.is(balance, INITIAL_TOKEN_BALANCE)
      }
    )

    await t.test(
      'should throw if the account is not connected to a provider',
      async (t) => {
        await beforeEach()
        t.teardown(afterEach)

        const account = new WalletAccountReadOnlyEvm(ADDRESS)

        await t.exception.all(
          async () => await account.getTokenBalance(testToken.target),
          /The wallet must be connected to a provider to retrieve token balances\./
        )
      }
    )
  })

  await t.test('quoteSendTransaction', async (t) => {
    await t.test('should successfully quote a transaction', async (t) => {
      await beforeEach()
      t.teardown(afterEach)

      const TRANSACTION = {
        to: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        value: 1_000
      }

      const EXPECTED_FEE = 49_611_983_472_910n

      const { fee } = await account.quoteSendTransaction(TRANSACTION)

      t.is(fee, EXPECTED_FEE)
    })

    await t.test(
      'should successfully quote a transaction with arbitrary data',
      async (t) => {
        await beforeEach()
        t.teardown(afterEach)

        const TRANSACTION_WITH_DATA = {
          to: testToken.target,
          value: 0,
          data: testToken.interface.encodeFunctionData('balanceOf', [
            '0x636e9c21f27d9401ac180666bf8DC0D3FcEb0D24'
          ])
        }

        const EXPECTED_FEE = 57_395_969_261_360n

        const { fee } = await account.quoteSendTransaction(
          TRANSACTION_WITH_DATA
        )

        t.is(fee, EXPECTED_FEE)
      }
    )

    await t.test(
      'should throw if the account is not connected to a provider',
      async (t) => {
        await beforeEach()
        t.teardown(afterEach)

        const account = new WalletAccountReadOnlyEvm(ADDRESS)

        await t.exception.all(
          async () => await account.quoteSendTransaction({}),
          /The wallet must be connected to a provider to quote send transaction operations\./
        )
      }
    )
  })

  await t.test('quoteTransfer', async (t) => {
    await t.test(
      'should successfully quote a transfer operation',
      async (t) => {
        await beforeEach()
        t.teardown(afterEach)

        const TRANSFER = {
          token: testToken.target,
          recipient: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
          amount: 100
        }

        const EXPECTED_FEE = 123_145_253_772_480n

        const { fee } = await account.quoteTransfer(TRANSFER)

        t.is(fee, EXPECTED_FEE)
      }
    )

    await t.test(
      'should throw if the account is not connected to a provider',
      async (t) => {
        await beforeEach()
        t.teardown(afterEach)

        const account = new WalletAccountReadOnlyEvm(ADDRESS)

        await t.exception.all(
          account.quoteTransfer({}),
          /The wallet must be connected to a provider to quote transfer operations\./
        )
      }
    )
  })

  await t.test('getTransactionReceipt', async (t) => {
    await t.test('should return the correct transaction receipt', async (t) => {
      await beforeEach()
      t.teardown(afterEach)

      const [sender] = getSigners()

      const TRANSACTION = {
        to: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
        value: 0
      }

      const { hash } = await sender.sendTransaction(TRANSACTION)

      const receipt = await account.getTransactionReceipt(hash)

      t.is(receipt.hash, hash)
      t.is(receipt.to, TRANSACTION.to)
      t.is(receipt.status, 1)
    })

    await t.test(
      'should return null if the transaction has not been included in a block yet',
      async (t) => {
        await beforeEach()
        t.teardown(afterEach)

        const HASH =
          '0xe60970cd7685466037bac1ff337e08265ac9f48af70a12529bdca5caf5a2b14b'

        const receipt = await account.getTransactionReceipt(HASH)

        t.is(receipt, null)
      }
    )

    await t.test(
      'should throw if the account is not connected to a provider',
      async (t) => {
        await beforeEach()
        t.teardown(afterEach)

        const HASH =
          '0xe60970cd7685466037bac1ff337e08265ac9f48af70a12529bdca5caf5a2b14b'

        const account = new WalletAccountReadOnlyEvm(ADDRESS)

        await t.exception.all(
          async () => await account.getTransactionReceipt(HASH),
          /The wallet must be connected to a provider to fetch transaction receipts\./
        )
      }
    )
  })
})
