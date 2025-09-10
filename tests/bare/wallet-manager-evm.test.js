import test from 'brittle'

import WalletManagerEvm, { WalletAccountEvm } from '@wdk/wallet-evm'

import { JsonRpcProvider } from "ethers" with { imports: "bare-wdk-runtime/package" }

const PROVIDER = 'http://127.0.0.1:8545'

const SEED_PHRASE =
  'cook voyage document eight skate token alien guide drink uncle term abuse'

test('WalletManagerEvm', async (t) => {
  let provider, wallet

  async function beforeEach () {
    provider = new JsonRpcProvider(PROVIDER)

    wallet = new WalletManagerEvm(SEED_PHRASE, {
      provider: PROVIDER
    })
  }

  async function afterEach () {
    wallet.dispose()

    await provider.send('hardhat_reset', [])

    provider.destroy()
  }

  await t.test('getAccount', async (t) => {
    await t.test(
      'should return the account at index 0 by default',
      async (t) => {
        await beforeEach()
        t.teardown(afterEach)

        const account = await wallet.getAccount()

        t.ok(account instanceof WalletAccountEvm)

        t.is(account.path, "m/44'/60'/0'/0/0")
      }
    )

    await t.test('should return the account at the given index', async (t) => {
      await beforeEach()
      t.teardown(afterEach)

      const account = await wallet.getAccount(3)

      t.ok(account instanceof WalletAccountEvm)

      t.is(account.path, "m/44'/60'/0'/0/3")
    })

    await t.test(
      'should throw if the index is a negative number',
      async (t) => {
        await beforeEach()
        t.teardown(afterEach)

        await t.exception.all(
          async () => await wallet.getAccount(-1),
          /invalid path component/
        )
      }
    )
  })

  await t.test('getAccountByPath', async (t) => {
    t.test('should return the account with the given path', async (t) => {
      await beforeEach()
      t.teardown(afterEach)

      const account = await wallet.getAccountByPath("1'/2/3")

      t.ok(account instanceof WalletAccountEvm)

      t.is(account.path, "m/44'/60'/1'/2/3")
    })

    t.test('should throw if the path is invalid', async (t) => {
      await beforeEach()
      t.teardown(afterEach)

      await t.exception.all(
        async () => await wallet.getAccountByPath("a'/b/c"),
        /invalid path component/
      )
    })
  })

  await t.test('getFeeRates', async (t) => {
    await t.test('should return the correct fee rates', async (t) => {
      await beforeEach()
      t.teardown(afterEach)

      const feeRates = await wallet.getFeeRates()

      t.is(feeRates.normal, 3_300_000_000n)

      t.is(feeRates.fast, 6_000_000_000n)
    })

    await t.test(
      'should throw if the wallet is not connected to a provider',
      async (t) => {
        await beforeEach()
        t.teardown(afterEach)

        const wallet = new WalletManagerEvm(SEED_PHRASE)

        await t.exception(
          async () => await wallet.getFeeRates(),
          /The wallet must be connected to a provider to get fee rates\./
        )
      }
    )
  })
})
