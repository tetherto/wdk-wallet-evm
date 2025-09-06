import test from 'brittle'
import WalletManagerEvm from '@wdk/wallet-evm'
import { isAddress } from "ethers" with { imports: "bare-wdk-runtime/package" }

const TEST_SEED =
  'anger burst story spy face pattern whale quit delay fiction ball solve'
const TEST_CONFIG = {
  provider: 'http://127.0.0.1:8545/',
  transferMaxFee: 50000000000
}

test('WalletManagerEvm', async function (t) {
  await t.test(
    'should successfully initialize a wallet manager',
    async function (t) {
      const walletManager = new WalletManagerEvm(TEST_SEED, TEST_CONFIG)
      await t.test(
        'should successfully get account by default index',
        async function (t) {
          const account = await walletManager.getAccount()

          const address = await account.getAddress()

          t.ok(isAddress(address))
          t.is(typeof account.path, 'string')
          t.is(account.index, 0)
        }
      )

      await t.test(
        'should successfully get account by index #1',
        async function (t) {
          const account = await walletManager.getAccount(1)

          const address = await account.getAddress()

          t.ok(isAddress(address))
          t.is(typeof account.path, 'string')
          t.is(account.index, 1)
        }
      )

      await t.test(
        'should successfully get account by path',
        async function (t) {
          const account = await walletManager.getAccountByPath("0'/0/2")

          const address = await account.getAddress()

          t.ok(isAddress(address))
          t.is(typeof account.path, 'string')
          t.is(account.index, 2)
        }
      )

      await t.test('should successfully get fee rates', async function (t) {
        const { normal, fast } = await walletManager.getFeeRates()

        t.is(typeof normal, 'bigint')
        t.is(typeof fast, 'bigint')
        t.ok(fast >= normal)
      })
    }
  )

  await t.test('should throw on invalid seed phrase', async function (t) {
    t.exception(() => new WalletManagerEvm('invalid seed phrase'))
  })
})
