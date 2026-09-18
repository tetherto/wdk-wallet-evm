import { describe, expect, test } from '@jest/globals'

import { UnsupportedOperationError } from '@tetherto/wdk-wallet'

import PrivateKeySignerEvm from '../../src/signers/private-key-signer-evm.js'

const VALID_PRIVATE_KEY = '260905feebf1ec684f36f1599128b85f3a26c2b817f2065a2fc278398449c41f'
const EXPECTED_PUBLIC_KEY = '036c082582225926b9356d95b91a4acffa3511b7cc2a14ef5338c090ea2cc3d0aa'

const EXPECTED_ADDRESS = '0x405005C7c4422390F4B334F64Cf20E0b767131d0'

const MESSAGE = 'Dummy message to sign.'
const EXPECTED_SIGNATURE = '0xd130f94c52bf393206267278ac0b6009e14f11712578e5c1f7afe4a12685c5b96a77a0832692d96fc51f4bd403839572c55042ecbcc92d215879c5c8bb5778c51c'

const TRANSACTION = {
  to: '0xa460AEbce0d3A4BecAd8ccf9D6D4861296c503Bd',
  value: 1_000n,
  gasLimit: 21_000n,
  maxFeePerGas: 2_000_000_000n,
  maxPriorityFeePerGas: 1_000_000_000n,
  nonce: 0,
  chainId: 31_337n
}
const EXPECTED_SIGNED_TRANSACTION = '0x02f86e827a6980843b9aca00847735940082520894a460aebce0d3a4becad8ccf9d6d4861296c503bd8203e880c080a0189acf1d3170de712fd346182a77b08ccaa1317cdd13daf386f1405d52148171a04a83f7c7df7f258344e1726ac5b94f53fb415f0e41a58399b5031940b293b9ec'

const TYPED_DATA = {
  domain: {
    name: 'TestApp',
    version: '1',
    chainId: 1,
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
  },
  types: {
    Person: [
      { name: 'name', type: 'string' },
      { name: 'wallet', type: 'address' }
    ],
    Mail: [
      { name: 'from', type: 'Person' },
      { name: 'to', type: 'Person' },
      { name: 'contents', type: 'string' }
    ]
  },
  message: {
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
}
const EXPECTED_TYPED_DATA_SIGNATURE = '0xd5d54d9a7fe501ab5dc1532a443a4f70bc8b6ad1c3f09caac9b891efa8701cac5ad1d4830c7bc7ed2688965ed6b04d25e8f55906a843689fdf79100aee3a5dc71c'

describe('PrivateKeySignerEvm', () => {
  describe('constructor', () => {
    test('should create a signer from a hex string', () => {
      const signer = new PrivateKeySignerEvm(VALID_PRIVATE_KEY)

      expect(signer.isDerivable).toBe(false)
      expect(signer.address).toBe(EXPECTED_ADDRESS)
      expect(signer.path).toBeNull()

      signer.dispose()
    })

    test('should create a signer from a Uint8Array', () => {
      const keyBytes = new Uint8Array(Buffer.from(VALID_PRIVATE_KEY, 'hex'))
      const signer = new PrivateKeySignerEvm(keyBytes)

      expect(signer.address).toBe(EXPECTED_ADDRESS)

      signer.dispose()
    })
  })

  describe('keyPair', () => {
    test('should expose the expected key pair bytes', () => {
      const signer = new PrivateKeySignerEvm(VALID_PRIVATE_KEY)

      expect(Buffer.from(signer.keyPair.privateKey).toString('hex')).toBe(VALID_PRIVATE_KEY)
      expect(Buffer.from(signer.keyPair.publicKey).toString('hex')).toBe(EXPECTED_PUBLIC_KEY)

      signer.dispose()
    })
  })

  describe('derive', () => {
    test('should throw when calling derive', async () => {
      const signer = new PrivateKeySignerEvm(VALID_PRIVATE_KEY)

      const promise = signer.derive("0'/0/0")

      await expect(promise).rejects.toThrow(UnsupportedOperationError)
      await expect(promise).rejects.toThrow("Method 'derive(path)' is not supported.")

      signer.dispose()
    })
  })

  describe('getAddress', () => {
    test('should return the address', async () => {
      const signer = new PrivateKeySignerEvm(VALID_PRIVATE_KEY)

      const address = await signer.getAddress()
      expect(address).toBe(EXPECTED_ADDRESS)

      signer.dispose()
    })
  })

  describe('sign', () => {
    test('should return the correct signature', async () => {
      const signer = new PrivateKeySignerEvm(VALID_PRIVATE_KEY)

      const signature = await signer.sign(MESSAGE)
      expect(signature).toBe(EXPECTED_SIGNATURE)

      signer.dispose()
    })
  })

  describe('signTransaction', () => {
    test('should return the signed transaction as a hex string', async () => {
      const signer = new PrivateKeySignerEvm(VALID_PRIVATE_KEY)

      const signedTx = await signer.signTransaction(TRANSACTION)
      expect(signedTx).toBe(EXPECTED_SIGNED_TRANSACTION)

      signer.dispose()
    })
  })

  describe('signTypedData', () => {
    test('should return the correct signature', async () => {
      const signer = new PrivateKeySignerEvm(VALID_PRIVATE_KEY)

      const signature = await signer.signTypedData(TYPED_DATA)
      expect(signature).toBe(EXPECTED_TYPED_DATA_SIGNATURE)

      signer.dispose()
    })
  })

  describe('dispose', () => {
    test('should clear secrets on dispose', () => {
      const signer = new PrivateKeySignerEvm(VALID_PRIVATE_KEY)

      signer.dispose()

      expect(signer.keyPair.privateKey).toBeNull()
    })

    test('should be safe to call dispose more than once', () => {
      const signer = new PrivateKeySignerEvm(VALID_PRIVATE_KEY)

      signer.dispose()

      expect(() => signer.dispose()).not.toThrow()
    })
  })
})
