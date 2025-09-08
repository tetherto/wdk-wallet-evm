import { test } from "brittle";
import { WalletAccountEvm } from "@wdk/wallet-evm";

import * as bip39 from "bip39" with { imports: "bare-wdk-runtime/package" };
import { ContractFactory, Wallet, JsonRpcProvider } from "ethers" with { imports: "bare-wdk-runtime/package" }
import TestToken from '../artifacts/TestToken.json' with { type: 'json' }

const getProvider = () => new JsonRpcProvider("http://127.0.0.1:8545");

const SEED_PHRASE =
  "cook voyage document eight skate token alien guide drink uncle term abuse";

const INVALID_SEED_PHRASE = "invalid seed phrase";

const SEED = bip39.mnemonicToSeedSync(SEED_PHRASE);

const ACCOUNT = {
  index: 0,
  path: "m/44'/60'/0'/0/0",
  address: "0x405005C7c4422390F4B334F64Cf20E0b767131d0",
  keyPair: {
    privateKey:
      "260905feebf1ec684f36f1599128b85f3a26c2b817f2065a2fc278398449c41f",
    publicKey:
      "036c082582225926b9356d95b91a4acffa3511b7cc2a14ef5338c090ea2cc3d0aa",
  },
};

const INITIAL_BALANCE = 1_000_000_000_000_000_000n;
const INITIAL_TOKEN_BALANCE = 1_000_000n;

async function deployTestToken() {
  const [signer] = getSigners();

  const factory = new ContractFactory(
    TestToken.abi,
    TestToken.bytecode,
    signer
  );
  const contract = await factory.deploy();

  const transaction = contract.deploymentTransaction();
  await transaction.wait();

  return contract;
}

async function delay(ms = 100) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSigners() {
  const signer = Wallet.fromPhrase(
    "anger burst story spy face pattern whale quit delay fiction ball solve",
    getProvider()
  );
  return [signer];
}

test("WalletAccountEvm", async function (t) {
  let testToken, account;

  async function sendEthersTo(to, value) {
    const [signer] = getSigners();
    const transaction = await signer.sendTransaction({ to, value });
    await transaction.wait();
    await delay();
  }

  async function sendTestTokensTo(to, value) {
    const transaction = await testToken.transfer(to, value);
    await transaction.wait();
    await delay();
  }

  async function beforeEach() {
    testToken = await deployTestToken();

    await sendEthersTo(ACCOUNT.address, INITIAL_BALANCE);

    await sendTestTokensTo(ACCOUNT.address, INITIAL_TOKEN_BALANCE);

    account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0", {
      provider: getProvider()._getConnection().url,
    });
  }

  async function afterEach() {
    account.dispose();

    await getProvider().send("hardhat_reset", []);
  }

  await t.test("constructor", async (t) => {
    await t.test(
      "should successfully initialize an account for the given seed phrase and path",
      async (t) => {
        await beforeEach();
        t.teardown(afterEach);

        const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0");

        t.is(account.index, ACCOUNT.index);

        t.is(account.path, ACCOUNT.path);

        t.alike(account.keyPair, {
          privateKey: new Uint8Array(
            Buffer.from(ACCOUNT.keyPair.privateKey, "hex")
          ),
          publicKey: new Uint8Array(
            Buffer.from(ACCOUNT.keyPair.publicKey, "hex")
          ),
        });
      }
    );

    await t.test(
      "should successfully initialize an account for the given seed and path",
      async (t) => {
        await beforeEach();
        t.teardown(afterEach);

        const account = new WalletAccountEvm(SEED, "0'/0/0");

        t.is(account.index, ACCOUNT.index);

        t.is(account.path, ACCOUNT.path);

        t.alike(account.keyPair, {
          privateKey: new Uint8Array(
            Buffer.from(ACCOUNT.keyPair.privateKey, "hex")
          ),
          publicKey: new Uint8Array(
            Buffer.from(ACCOUNT.keyPair.publicKey, "hex")
          ),
        });
      }
    );

    await t.test("should throw if the seed phrase is invalid", async (t) => {
      await beforeEach();
      t.teardown(afterEach);

      t.exception.all(() => {
        new WalletAccountEvm(INVALID_SEED_PHRASE, "0'/0/0");
      }, /The seed phrase is invalid\./);
    });

    await t.test("should throw if the path is invalid", async (t) => {
      await beforeEach();
      t.teardown(afterEach);

      t.exception.all(() => {
        new WalletAccountEvm(SEED_PHRASE, "a'/b/c");
      }, /invalid path component/);
    });
  });

  await t.test("sign", async (t) => {
    const MESSAGE = "Dummy message to sign.";

    const EXPECTED_SIGNATURE =
      "0xd130f94c52bf393206267278ac0b6009e14f11712578e5c1f7afe4a12685c5b96a77a0832692d96fc51f4bd403839572c55042ecbcc92d215879c5c8bb5778c51c";

    await t.test("should return the correct signature", async (t) => {
      await beforeEach();
      t.teardown(afterEach);

      const signature = await account.sign(MESSAGE);

      t.is(signature, EXPECTED_SIGNATURE);
    });
  });

  await t.test("verify", async (t) => {
    const MESSAGE = "Dummy message to sign.";

    const SIGNATURE =
      "0xd130f94c52bf393206267278ac0b6009e14f11712578e5c1f7afe4a12685c5b96a77a0832692d96fc51f4bd403839572c55042ecbcc92d215879c5c8bb5778c51c";

    await t.test("should return true for a valid signature", async (t) => {
      await beforeEach();
      t.teardown(afterEach);

      const result = await account.verify(MESSAGE, SIGNATURE);

      t.ok(result);
    });

    await t.test("should return false for an invalid signature", async (t) => {
      await beforeEach();
      t.teardown(afterEach);

      const result = await account.verify("Another message.", SIGNATURE);

      t.not(result);
    });

    await t.test("should throw on a malformed signature", async (t) => {
      await beforeEach();
      t.teardown(afterEach);

      await t.exception.all(async () => {
        await account.verify(MESSAGE, "A bad signature");
      }, /invalid BytesLike value/);
    });
  });

  await t.test("sendTransaction", async (t) => {
    await t.test("should successfully send a transaction", async (t) => {
      await beforeEach();
      t.teardown(afterEach);

      const TRANSACTION = {
        to: "0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd",
        value: 1_000,
      };
      const EXPECTED_FEE = 49_611_983_472_910n;
      const { hash, fee } = await account.sendTransaction(TRANSACTION);
      const transaction = await getProvider().getTransaction(hash);
      t.is(transaction.hash, hash);
      t.is(transaction.to, TRANSACTION.to);
      t.is(transaction.value, BigInt(TRANSACTION.value));
      t.is(fee, EXPECTED_FEE);
    });

    await t.test(
      "should successfully send a transaction with arbitrary data",
      async (t) => {
        await beforeEach();
        t.teardown(afterEach);

        const TRANSACTION_WITH_DATA = {
          to: testToken.target,
          value: 0,
          data: testToken.interface.encodeFunctionData("balanceOf", [
            "0x636e9c21f27d9401ac180666bf8DC0D3FcEb0D24",
          ]),
        };

        const EXPECTED_FEE = 57_395_969_261_360n;

        const { hash, fee } = await account.sendTransaction(
          TRANSACTION_WITH_DATA
        );

        const transaction = await getProvider().getTransaction(hash);

        t.is(transaction.hash, hash);
        t.is(transaction.to, TRANSACTION_WITH_DATA.to);
        t.is(transaction.value, BigInt(TRANSACTION_WITH_DATA.value));

        t.is(transaction.data, TRANSACTION_WITH_DATA.data);

        t.is(fee, EXPECTED_FEE);
      }
    );

    await t.test(
      "should throw if the account is not connected to a provider",
      async (t) => {
        await beforeEach();
        t.teardown(afterEach);

        const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0");

        await t.exception.all(async () => {
          await account.sendTransaction({});
        }, /The wallet must be connected to a provider to send transactions\./);
      }
    );
  });

  await t.test("transfer", async (t) => {
    await t.test("should successfully transfer tokens", async (t) => {
      await beforeEach();
      t.teardown(afterEach);

      const TRANSFER = {
        token: testToken.target,
        recipient: "0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd",
        amount: 100,
      };

      const EXPECTED_FEE = 123_145_253_772_480n;

      const { hash, fee } = await account.transfer(TRANSFER);
      const transaction = await getProvider().getTransaction(hash);
      const data = testToken.interface.encodeFunctionData("transfer", [
        TRANSFER.recipient,
        TRANSFER.amount,
      ]);

      t.is(transaction.hash, hash);
      t.is(transaction.to, TRANSFER.token);
      t.is(transaction.value, 0n);

      t.is(transaction.data, data);

      t.is(fee, EXPECTED_FEE);
    });

    await t.test(
      "should throw if transfer fee exceeds the transfer max fee configuration",
      async (t) => {
        await beforeEach();
        t.teardown(afterEach);

        const TRANSFER = {
          token: testToken.target,
          recipient: "0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd",
          amount: 100,
        };

        const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0", {
          provider: getProvider()._getConnection().url,
          transferMaxFee: 0,
        });

        await t.exception.all(async () => {
          await account.transfer(TRANSFER);
        }, /Exceeded maximum fee cost for transfer operation\./);
      }
    );

    await t.test(
      "should throw if the account is not connected to a provider",
      async (t) => {
        await beforeEach();
        t.teardown(afterEach);

        const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0");

        await t.exception.all(async () => {
          await account.transfer({});
        }, /The wallet must be connected to a provider to transfer tokens\./);
      }
    );
  });
});
