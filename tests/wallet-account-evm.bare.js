import test from "brittle";
import { WalletAccountEvm } from "@wdk/wallet-evm";
import { getPublicKey } from "@noble/secp256k1";
import { ContractFactory, verifyMessage, Wallet, JsonRpcProvider, isAddress } from "ethers" with { imports: "bare-wdk-runtime/package" };
import TestToken from './artifacts/TestToken.json' with { type: 'json' }

const BIP_44_ETH_DERIVATION_PATH_PREFIX = "m/44'/60'";

const TEST_SEED =
  "anger burst story spy face pattern whale quit delay fiction ball solve";
const TEST_CONFIG = {
  provider: "http://127.0.0.1:8545/",
  transferMaxFee: 1_000_000_000_000_000n, // 1_000_000 GWEI
};

async function deployTestToken() {
  const provider = new JsonRpcProvider(TEST_CONFIG.provider);
  const signer = Wallet.fromPhrase(TEST_SEED, provider);

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

async function delay(ms = 500) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("WalletAccountEvm", async function (t) {
  await t.test(
    "should successfully initialize a wallet account with custom path",
    async function (t) {
      const custom_index = 3;
      const custom_path = "0'/0/" + custom_index;

      const { keyPair, path, index } = new WalletAccountEvm(
        TEST_SEED,
        custom_path,
        TEST_CONFIG
      );

      const publicKey = getPublicKey(keyPair.privateKey);

      t.alike(publicKey, keyPair.publicKey);
      t.is(path, BIP_44_ETH_DERIVATION_PATH_PREFIX + "/" + custom_path);
      t.is(index, custom_index);
    }
  );

  await t.test(
    "should successfully initialize a wallet account with default path",
    async function (t) {
      const account = new WalletAccountEvm(TEST_SEED, "0'/0/0", TEST_CONFIG);

      await t.test("should successfully sign a message", async function (t) {
        const message = "Hello, Ethereum blockchain!";
        const signature = await account.sign(message);

        const address = await account.getAddress();
        const recovered = verifyMessage(message, signature);

        t.is(address.toLowerCase(), recovered.toLowerCase());
      });

      await t.test(
        "should successfully verify a valid signature",
        async function (t) {
          const message = "Hello, Ethereum blockchain!";
          const signature = await account.sign(message);

          const isValid = await account.verify(message, signature);

          t.ok(isValid);
        }
      );

      await t.test(
        "should throw errors on verifying an invalid signature",
        async function (t) {
          const message = "Hello, Ethereum blockchain!";
          const invalidSignature = "0x1234567890abcdef";

          await t.exception(async () => {
            try {
              await account.verify(message, invalidSignature);
            } catch (er) {
              throw Error(er);
            }
          });
        }
      );

      await t.test("should successfully get ETH balance", async function (t) {
        const balance = await account.getBalance();

        t.is(typeof balance, "bigint");
      });

      await t.test(
        "should successfully quote a transaction",
        async function (t) {
          const { fee } = await account.quoteSendTransaction({
            to: Wallet.createRandom().address,
            value: 1000000000000000000n, // 1 ETH in wei
            gasLimit: 21000,
          });

          t.is(typeof fee, "bigint");
        }
      );

      await t.test(
        "should successfully send a transaction",
        async function (t) {
          const provider = new JsonRpcProvider(TEST_CONFIG.provider);

          const recipient = Wallet.createRandom();
          const value = 1_000000000_000000000n; // 1 ETH in wei

          const preRecipientBalance = await provider.getBalance(
            recipient.address
          );

          const { hash } = await account.sendTransaction({
            to: recipient.address,
            value,
            gasLimit: 21000,
          });
          await delay();

          const postRecipientBalance = await provider.getBalance(
            recipient.address
          );

          t.is(typeof hash, "string");
          t.is(postRecipientBalance - preRecipientBalance, value);
        }
      );

      await t.test("should successfully get a tx receipt", async function (t) {
        const recipient = Wallet.createRandom();

        const { hash } = await account.sendTransaction({
          to: recipient.address,
          value: 1_000000000_000000000n, // 1 ETH in wei
          gasLimit: 21000,
        });
        await delay();

        const address = await account.getAddress();
        const receipt = await account.getTransactionReceipt(hash);

        t.is(receipt.from.toLowerCase(), address.toLowerCase());
        t.is(receipt.to.toLowerCase(), recipient.address.toLowerCase());
        t.is(receipt.hash.toLowerCase(), hash.toLowerCase());
      });
    }
  );

  await t.test(
    "should successfully interact with an ERC20 contract",
    async function (t) {
      const contract = await deployTestToken();
      const account = new WalletAccountEvm(TEST_SEED, "0'/0/0", TEST_CONFIG);

      await t.test("should successfully get token balance", async function (t) {
        const balance = await account.getTokenBalance(contract.target);

        t.is(typeof balance, "bigint");
      });

      await t.test(
        "should successfully quote a transfer-token transaction",
        async function (t) {
          const { fee } = await account.quoteTransfer({
            token: contract.target,
            recipient: Wallet.createRandom().address,
            amount: 1000000n,
          });

          t.is(typeof fee, "bigint");
        }
      );

      await t.test("should successfully transfer token", async function (t) {
        const recipient = Wallet.createRandom();
        const amount = 1000000n; // 1 USDT (6 decimals)

        const preRecipientBalance = await contract.balanceOf(recipient.address);

        const { hash, fee } = await account.transfer({
          token: contract.target,
          recipient: recipient.address,
          amount,
        });
        await delay();

        const postRecipientBalance = await contract.balanceOf(
          recipient.address
        );

        t.is(typeof hash, "string");
        t.ok(fee < TEST_CONFIG.transferMaxFee);
        t.is(postRecipientBalance - preRecipientBalance, amount);
      });
    }
  );

  await t.test("should successfully dispose the wallet", async function (t) {
    const account = new WalletAccountEvm(TEST_SEED, "0'/0/0", TEST_CONFIG);

    t.execution(() => account.dispose());
  });

  await t.test("should throw on missing provider", async function (t) {
    const accountWithoutProvider = new WalletAccountEvm(TEST_SEED, "0'/0/0");

    await t.exception(async () => await accountWithoutProvider.getBalance());
  });

  await t.test(
    "should successfully initialize a read-only account",
    async function (t) {
      const account = new WalletAccountEvm(TEST_SEED, "0'/0/0", TEST_CONFIG);
      const readOnlyAccount = await account.toReadOnlyAccount();

      const address = await readOnlyAccount.getAddress();

      t.ok(isAddress(address));
    }
  );
});
