// Regression tests for shared-root disposal. A child derived from a root borrows the
// root only to derive its own account and does NOT retain it, so disposing a child
// clears just the child's account and never touches the root shared with siblings.

import { describe, expect, test } from '@jest/globals'

import WalletManagerEvm, { WalletAccountEvm } from '../index.js'
import SeedSignerEvm from '../src/signers/seed-signer-evm.js'
import PrivateKeySignerEvm from '../src/signers/private-key-signer-evm.js'

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'
const PRIVATE_KEY = '260905feebf1ec684f36f1599128b85f3a26c2b817f2065a2fc278398449c41f'
const MESSAGE = 'Dummy message to sign.'

describe('SeedSignerEvm shared-root disposal', () => {
  test('disposing a derived child leaves the root and siblings intact', async () => {
    const root = new SeedSignerEvm(SEED_PHRASE)
    const a = root.derive("0'/0/0")
    const b = root.derive("0'/0/1")

    const before = await b.sign(MESSAGE)

    a.dispose()

    // Sibling still signs, the root can still derive new children.
    await expect(b.sign(MESSAGE)).resolves.toBe(before)
    expect(() => root.derive("0'/0/2")).not.toThrow()

    // The disposed child cleared only its own key material.
    expect(a.keyPair.privateKey).toBeNull()

    b.dispose()
    root.dispose()
  })

  test('a derived child does not retain the root and cannot derive further', () => {
    const root = new SeedSignerEvm(SEED_PHRASE)
    const child = root.derive("0'/0/0")

    expect(() => child.derive("0'/0/1")).toThrow('Cannot derive: this signer has no root')

    child.dispose()
    root.dispose()
  })

  test('manager: disposing one account does not break other accounts or new derivations', async () => {
    const wallet = new WalletManagerEvm(SEED_PHRASE)

    const acc0 = await wallet.getAccount(0)
    const acc1 = await wallet.getAccount(1)

    const before = await acc1.sign(MESSAGE)

    acc0.dispose()

    // Existing sibling and a freshly derived account both work.
    await expect(acc1.sign(MESSAGE)).resolves.toBe(before)
    const acc2 = await wallet.getAccount(2)
    expect(acc2).toBeInstanceOf(WalletAccountEvm)
    await expect(acc2.sign(MESSAGE)).resolves.toEqual(expect.any(String))

    wallet.dispose()
  })

  test('fromSeed account works and disposes cleanly without leaking the master', () => {
    const account = WalletAccountEvm.fromSeed(SEED_PHRASE, "0'/0/0")

    expect(account).toBeInstanceOf(WalletAccountEvm)

    account.dispose()

    expect(account.keyPair.privateKey).toBeNull()
  })
})

describe('the manager never hands a root signer to an account', () => {
  test('getAccount(name) for a seed signer returns its derived account 0, not the root', async () => {
    const wallet = new WalletManagerEvm(SEED_PHRASE)
    const named = new SeedSignerEvm(SEED_PHRASE)
    wallet.addSigner('seed', named)

    const account = await wallet.getAccount('seed')

    expect(account).toBeInstanceOf(WalletAccountEvm)
    expect(account.path).toBe("m/44'/60'/0'/0/0")

    // Disposing the #self account must not neuter the registered root signer.
    account.dispose()
    expect(() => named.derive("0'/0/1")).not.toThrow()

    wallet.dispose()
  })

  test('disposing a private-key getAccount(name) account does not affect default-signer derivation', async () => {
    const wallet = new WalletManagerEvm(SEED_PHRASE)
    wallet.addSigner('pk', new PrivateKeySignerEvm(PRIVATE_KEY))

    const pkAccount = await wallet.getAccount('pk')
    pkAccount.dispose()

    // The default seed signer is untouched and still derives.
    const acc = await wallet.getAccount(0)
    await expect(acc.sign(MESSAGE)).resolves.toEqual(expect.any(String))

    wallet.dispose()
  })
})
