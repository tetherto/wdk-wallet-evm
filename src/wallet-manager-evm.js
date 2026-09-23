// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'

import WalletManager, { InvalidSignerError, ProviderRequiredError } from '@tetherto/wdk-wallet'

import WalletAccountEvm from './wallet-account-evm.js'
import SeedSignerEvm, { BIP_44_ETH_DERIVATION_PATH_PREFIX } from './signers/seed-signer-evm.js'

/** @typedef {import('./signers/signer-evm.js').ISignerEvm} ISignerEvm */
/** @typedef {import('ethers').Provider} Provider */

/** @typedef {import("@tetherto/wdk-wallet").FeeRates} FeeRates */
/** @typedef {import("@tetherto/wdk-wallet").NoSuchElementError} NoSuchElementError */
/** @typedef {import("@tetherto/wdk-wallet").UnsupportedOperationError} UnsupportedOperationError */
/** @typedef {import("@tetherto/wdk-wallet").ValueError} ValueError */

/** @typedef {import('./wallet-account-evm.js').EvmWalletConfig} EvmWalletConfig */

/** @extends {WalletManager<ISignerEvm>} */
export default class WalletManagerEvm extends WalletManager {
  /**
   * Multiplier for normal fee rate calculations (in %).
   *
   * @protected
   * @type {bigint}
   */
  static _FEE_RATE_NORMAL_MULTIPLIER = 110n

  /**
   * Multiplier for fast fee rate calculations (in %).
   *
   * @protected
   * @type {bigint}
   */
  static _FEE_RATE_FAST_MULTIPLIER = 200n

  /**
   * Creates a new wallet manager for evm blockchains from a BIP-39 seed.
   *
   * @overload
   * @param {string | Uint8Array} seed - The BIP-39 seed phrase or raw seed bytes.
   * @param {EvmWalletConfig} [config] - The configuration object.
   * @throws {ValueError} If the seed phrase is invalid.
   */

  /**
   * Creates a new wallet manager for evm blockchains from a default signer.
   *
   * The default signer must be derivable (it must be able to derive child accounts);
   * non-derivable signers (e.g. private-key signers) are not allowed as the default but
   * may be registered by name via {@link addSigner}. To use a single non-derivable signer
   * outside of the wallet manager, create a standalone account instead.
   * **Warning:** the signer is kept exactly as given, not cloned -- if you still hold a
   * reference to it and dispose it directly, every subsequent {@link getAccount}/
   * {@link getAccountByPath} call that falls back to the default signer (i.e. without an
   * explicit `signerName`) fails, since deriving from a disposed signer isn't possible.
   * Conversely, the manager never disposes a signer you supplied: {@link dispose} wipes
   * only the default signer it creates internally from a seed.
   *
   * @overload
   * @param {ISignerEvm} signer - The default signer.
   * @param {EvmWalletConfig} [config] - The configuration object.
   * @throws {InvalidSignerError} If the default signer does not support account derivation.
   */
  constructor (seedOrSigner, config = {}) {
    const isSeed = typeof seedOrSigner === 'string' || seedOrSigner instanceof Uint8Array
    let signer = seedOrSigner
    if (isSeed) {
      signer = new SeedSignerEvm(seedOrSigner, BIP_44_ETH_DERIVATION_PATH_PREFIX)
    }
    if (!signer.isDerivable) {
      throw new InvalidSignerError('The default signer must be derivable. Non-derivable signers (e.g. private-key signers) can only be registered by name via addSigner.')
    }
    super(signer, config)

    /**
     * If true, disposes the default signer on calls to the 'dispose' method.
     *
     * @protected
     * @type {boolean}
     */
    this._shouldWipeDefaultSignerOnDisposal = isSeed

    /**
     * The evm wallet configuration.
     *
     * @protected
     * @type {EvmWalletConfig}
     */
    this._config = config

    /**
     * An ethers provider to interact with a node of the blockchain. Shared with every account
     * this manager creates, so two accounts never open two clients for the same endpoint.
     *
     * @protected
     * @type {Provider | undefined}
     */
    this._provider = WalletAccountEvm._buildProvider(config)
  }

  /**
   * Returns the wallet account at a specific index.
   *
   * @overload
   * @param {number} [index] - The index of the account to get (default: 0).
   * @param {Object} [options] - Account options.
   * @param {string} [options.signerName] - The signer name. Omit to use the default signer.
   * @returns {Promise<WalletAccountEvm>} The account.
   * @throws {NoSuchElementError} If a signer name is given but no signer exists with that name.
   * @throws {UnsupportedOperationError} If the signer doesn't support account derivation.
   */

  /**
   * Returns the wallet account associated with a registered signer.
   *
   * The registered signer is used exactly as given, wherever it happens to sit -- this
   * overload never derives. For a private-key signer that's its one account; for a derivable
   * signer, it's the account at that signer's own current path, unchanged. If you want a
   * derived leaf from a derivable named signer (e.g. a second seed registered as a bank of
   * accounts), use {@link getAccount}(index, { signerName }) or {@link getAccountByPath}(path,
   * { signerName }) instead -- both of those always derive, and throw clearly if the named
   * signer can't.
   *
   * **Warning:** the returned account wraps the registered signer itself, exactly where it
   * sits -- e.g. a second seed registered at the intermediate path "m/44'/60'" yields the
   * account AT "m/44'/60'", not at a derived leaf, which is rarely what you want to transact
   * with. Disposing the returned account leaves the registered signer untouched.
   *
   * @overload
   * @param {string} signerName - The signer name registered via {@link addSigner}.
   * @returns {Promise<WalletAccountEvm>} The account.
   * @throws {NoSuchElementError} If no signer exists with the given name.
   */

  async getAccount (indexOrSignerName = 0, options = {}) {
    if (typeof indexOrSignerName === 'string') {
      const key = indexOrSignerName
      if (this._accounts[key]) {
        return this._accounts[key]
      }
      const signer = this.getSigner(indexOrSignerName)
      const account = new WalletAccountEvm(signer, this._accountConfig())
      this._accounts[key] = account
      return account
    }

    const { signerName } = options
    return await this.getAccountByPath(`0'/0/${indexOrSignerName}`, { signerName })
  }

  /**
   * Returns the wallet account at a specific derivation path.
   *
   * @param {string} path - The derivation path (e.g. "0'/0/0").
   * @param {Object} [options] - Account options.
   * @param {string} [options.signerName] - The signer name. Omit to use the default signer.
   * @returns {Promise<WalletAccountEvm>} The account.
   * @throws {NoSuchElementError} If a signer name is given but no signer exists with that name.
   * @throws {UnsupportedOperationError} If the signer doesn't support account derivation.
   */
  async getAccountByPath (path, options = {}) {
    const { signerName } = options
    const key = signerName ? `${signerName}:${path}` : path
    if (this._accounts[key]) {
      return this._accounts[key]
    }
    const signer = this.getSigner(signerName)
    const childSigner = await signer.derive(path)
    const account = new WalletAccountEvm(childSigner, { ...this._accountConfig(), shouldWipeSignerOnDisposal: true })
    this._accounts[key] = account
    return account
  }

  /**
   * Builds the account config, injecting the manager's shared provider so accounts reuse
   * it instead of opening their own client.
   *
   * @private
   * @returns {EvmWalletConfig} The account configuration.
   */
  _accountConfig () {
    return { ...this._config, provider: this._provider }
  }

  /**
   * Returns the current fee rates.
   *
   * @returns {Promise<FeeRates>} The fee rates (in weis).
   * @throws {ProviderRequiredError} If the wallet is not connected to a provider.
   */
  async getFeeRates () {
    if (!this._provider) {
      throw new ProviderRequiredError('The wallet must be connected to a provider to get fee rates.')
    }

    const data = await this._provider.getFeeData()

    const feeRate = data.maxFeePerGas || data.gasPrice

    return {
      normal: feeRate * WalletManagerEvm._FEE_RATE_NORMAL_MULTIPLIER / 100n,
      fast: feeRate * WalletManagerEvm._FEE_RATE_FAST_MULTIPLIER / 100n
    }
  }

  /**
    * Disposes all the wallet accounts, erasing their private keys from the memory.
   */
  dispose () {
    if (this._shouldWipeDefaultSignerOnDisposal) {
      this._defaultSigner.dispose()
    }

    super.dispose()
  }
}
