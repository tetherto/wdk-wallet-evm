import * as bip39 from 'bip39'

import { describe, expect, test } from '@jest/globals'

import SeedSignerEvm from '../src/signers/seed-signer-evm.js'
import PrivateKeySignerEvm from '../src/signers/private-key-signer-evm.js'

const VALID_SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'
const VALID_SEED = bip39.mnemonicToSeedSync(VALID_SEED_PHRASE)
const VALID_PRIVATE_KEY = '260905feebf1ec684f36f1599128b85f3a26c2b817f2065a2fc278398449c41f'
const EXPECTED_PUBLIC_KEY = '036c082582225926b9356d95b91a4acffa3511b7cc2a14ef5338c090ea2cc3d0aa'

const MESSAGE = 'Dummy message to sign.'
const EXPECTED_SIGNATURE = '0xd130f94c52bf393206267278ac0b6009e14f11712578e5c1f7afe4a12685c5b96a77a0832692d96fc51f4bd403839572c55042ecbcc92d215879c5c8bb5778c51c'

const EXPECTED_ADDRESS = '0x405005C7c4422390F4B334F64Cf20E0b767131d0'

describe('SeedSignerEvm', () => {
  test('should throw if the seed phrase is invalid', () => {
    expect(() => { new SeedSignerEvm('invalid seed phrase') }) // eslint-disable-line no-new
      .toThrow('The seed phrase is invalid.')
  })

  test('should throw if the path is invalid', () => {
    expect(() => { new SeedSignerEvm(VALID_SEED_PHRASE).derive("a'/b/c") })
      .toThrow('invalid path component')
  })

  test('should throw if both seed and root are provided', () => {
    const root = new SeedSignerEvm(VALID_SEED_PHRASE)
    const child = root.derive("0'/0/0")
    expect(() => { new SeedSignerEvm(VALID_SEED_PHRASE, { root: child }) }) // eslint-disable-line no-new
      .toThrow('Provide either a seed or a root, not both.')
    child.dispose()
    root.dispose()
  })

  test('should create a root signer from a mnemonic', () => {
    const signer = new SeedSignerEvm(VALID_SEED_PHRASE)

    expect(signer.isRoot).toBe(true)
    expect(signer.isPrivateKey).toBe(false)
    expect(signer.address).toBeUndefined()

    signer.dispose()
  })

  test('should derive a child signer with the correct address and path', () => {
    const root = new SeedSignerEvm(VALID_SEED_PHRASE)
    const child = root.derive("0'/0/0")

    expect(child.isRoot).toBe(false)
    expect(child.address).toBe(EXPECTED_ADDRESS)
    expect(child.path).toBe("m/44'/60'/0'/0/0")
    expect(child.index).toBe(0)
    expect(Buffer.from(child.keyPair.privateKey).toString('hex')).toBe(VALID_PRIVATE_KEY)
    expect(Buffer.from(child.keyPair.publicKey).toString('hex')).toBe(EXPECTED_PUBLIC_KEY)

    child.dispose()
    root.dispose()
  })

  test('should derive the same address from raw seed bytes', () => {
    const root = new SeedSignerEvm(VALID_SEED)
    const child = root.derive("0'/0/0")

    expect(child.address).toBe(EXPECTED_ADDRESS)

    child.dispose()
    root.dispose()
  })

  test('should derive the same address when path is provided via constructor opts', () => {
    const signer = new SeedSignerEvm(VALID_SEED_PHRASE, { path: "0'/0/0" })

    expect(signer.isRoot).toBe(false)
    expect(signer.address).toBe(EXPECTED_ADDRESS)

    signer.dispose()
  })

  test('should throw when deriving from a disposed signer', () => {
    const root = new SeedSignerEvm(VALID_SEED_PHRASE)
    root.dispose()

    expect(() => root.derive("0'/0/0")).toThrow('Seed or root is required.')
  })

  test('should return the correct signature', async () => {
    const child = new SeedSignerEvm(VALID_SEED_PHRASE).derive("0'/0/0")

    const signature = await child.sign(MESSAGE)
    expect(signature).toBe(EXPECTED_SIGNATURE)

    child.dispose()
  })

  test('should return the address via getAddress()', async () => {
    const child = new SeedSignerEvm(VALID_SEED_PHRASE).derive("0'/0/0")

    const address = await child.getAddress()
    expect(address).toBe(EXPECTED_ADDRESS)

    child.dispose()
  })

  test('should clear secrets on dispose', () => {
    const root = new SeedSignerEvm(VALID_SEED_PHRASE)
    const child = root.derive("0'/0/0")

    child.dispose()

    expect(child.keyPair.privateKey).toBeNull()
  })
})

describe('PrivateKeySignerEvm', () => {
  test('should create a signer from a hex string', () => {
    const signer = new PrivateKeySignerEvm(VALID_PRIVATE_KEY)

    expect(signer.address).toBe(EXPECTED_ADDRESS)
    expect(signer.isRoot).toBe(false)
    expect(signer.isPrivateKey).toBe(true)
    expect(signer.index).toBe(0)

    signer.dispose()
  })

  test('should create a signer from a Uint8Array', () => {
    const keyBytes = new Uint8Array(Buffer.from(VALID_PRIVATE_KEY, 'hex'))
    const signer = new PrivateKeySignerEvm(keyBytes)

    expect(signer.address).toBe(EXPECTED_ADDRESS)

    signer.dispose()
  })

  test('should return the correct signature', async () => {
    const signer = new PrivateKeySignerEvm(VALID_PRIVATE_KEY)

    const signature = await signer.sign(MESSAGE)
    expect(signature).toBe(EXPECTED_SIGNATURE)

    signer.dispose()
  })

  test('should throw when calling derive', () => {
    const signer = new PrivateKeySignerEvm(VALID_PRIVATE_KEY)

    expect(() => signer.derive()).toThrow('PrivateKeySignerEvm does not support derivation.')

    signer.dispose()
  })

  test('should return the address via getAddress()', async () => {
    const signer = new PrivateKeySignerEvm(VALID_PRIVATE_KEY)

    const address = await signer.getAddress()
    expect(address).toBe(EXPECTED_ADDRESS)

    signer.dispose()
  })

  test('should clear secrets on dispose', () => {
    const signer = new PrivateKeySignerEvm(VALID_PRIVATE_KEY)

    signer.dispose()

    expect(signer.keyPair.privateKey).toBeNull()
  })
})
