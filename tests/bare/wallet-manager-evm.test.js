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
  t.pass()
})
