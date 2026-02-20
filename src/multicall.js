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

import { AbiCoder, concat, decodeBase64, hexlify } from 'ethers'

/** @typedef {import('ethers').Provider} Provider */

/**
 * @internal
 * @typedef {Object} MulticallRequest
 * @property {string} to - The target contract address.
 * @property {string} data - The ABI-encoded calldata.
 */

/**
 * @internal
 * @typedef {Object} MulticallResult
 * @property {boolean} status - Whether the call succeeded.
 * @property {string} data - The ABI-encoded return data.
 */

/**
 * Compiled multicall constructor bytecode. Executes calls via staticcall and
 * returns results without deploying. Source: ethers-io/ext-provider-multicall (MIT).
 *
 * @type {string}
 */
const _MULTICALL_BYTECODE = hexlify(decodeBase64('YIBgQFI0gBVhABBXYACA/VtQYEBRYQSxOAOAYQSxgzmBAWBAgZBSYQAvkWECWlZbYACBUWABYEBgAgoDgREVYQBKV2EASmEBr1ZbYEBRkICCUoBgIAJgIAGCAWBAUoAVYQCQV4FgIAFbYECAUYCCAZCRUmAAgVJgYGAgggFSgVJgIAGQYAGQA5CBYQBoV5BQW1CQUGAAW4JRgRAVYQE/V2EA8oOCgVGBEGEAtFdhALRhA+NWW2AgAmAgAQFRYAABUYSDgVGBEGEA0ldhANJhA+NWW2AgAmAgAQFRYCABUWEBbmQBAAAAAAJkAQAAAACQBFZbg4OBUYEQYQEEV2EBBGED41ZbYCACYCABAVFgAAGEhIFRgRBhASFXYQEhYQPjVltgIJCBApGQkQGBAVEBkZCRUpAVFZBSYAEBYQCWVltQYABDgmBAUWAgAWEBVZKRkGEEElZbYEBRYCCBgwMDgVKQYEBSkFCAUWAgggHzW2AAYGBgQFGQUGAAgVJgIIEBYEBSYACAhFFgIIYBh1r6YD89AWAfGRaCAWBAUj2CUpFQPWAAYCCDAT6SUJKQUFZbf05Ie3EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYABSYEFgBFJgJGAA/VtgQIBRkIEBYAFgQGACCgOBEYKCEBcVYQIAV2ECAGEBr1ZbYEBSkFZbYEBRYB+CAWAfGRaBAWABYEBgAgoDgRGCghAXFWECLldhAi5hAa9WW2BAUpGQUFZbYABbg4EQFWECUVeBgQFRg4IBUmAgAWECOVZbUFBgAJEBUlZbYABgIIKEAxIVYQJsV2AAgP1bgVFgAWBAYAIKA4ERFWECgldgAID9W4IBYB+BAYQTYQKTV2AAgP1bgFFgAWBAYAIKA4ERFWECrFdhAqxhAa9WW2AggQJhArxgIIIBYQIGVluRglJgIIGEAYEBkpCBAZCHhBEVYQLYV2AAgP1bYCCFAZJQW4ODEBVhA9hXglFgAWBAYAIKA4ERFWEC/VdgAID9W4UBYECBigNgHxkBEhVhAxNXYACA/VthAxthAd5WW2AgggFRYAFgoGACCgOBFoEUYQM1V2AAgP1bgVJgQIIBUWABYEBgAgoDgREVYQNQV2AAgP1bYCCBhAEBklBQiWAfgwESYQNoV2AAgP1bgVFgAWBAYAIKA4ERFWEDgVdhA4FhAa9WW2EDlGAfggFgHxkWYCABYQIGVluBgVKLYCCDhgEBERVhA6lXYACA/VthA7qCYCCDAWAghwFhAjZWW4BgIIQBUlBQgIRSUFBgIIIBkVBgIIMBklBhAt9WW5eWUFBQUFBQUFZbf05Ie3EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYABSYDJgBFJgJGAA/VtgAGBAggGEg1JgQGAghAFSgIRRgINSYGCFAZFQYGBgIIIChgEBklBgIIYBYABbgoEQFWEEo1dgXxmHhgMBhFKBUYBRFRWGUmAggQFRkFBgQGAghwFSgFGAYECIAVJhBICBYGCJAWAghQFhAjZWW2AfAWAfGRaVkJUBYGABlFBgIJOEAZORkJEBkGABAWEEQFZbUJKXllBQUFBQUFBW/g=='))

/**
 * Executes multiple read-only contract calls in a single RPC round-trip.
 *
 * @internal
 * @param {Provider} provider - An ethers provider.
 * @param {MulticallRequest[]} calls - The calls to batch.
 * @returns {Promise<MulticallResult[]>} The result of each call.
 */
export async function multicall (provider, calls) {
  if (calls.length === 0) {
    return []
  }

  const data = concat([
    _MULTICALL_BYTECODE,
    AbiCoder.defaultAbiCoder().encode(
      ['tuple(address, bytes)[]'],
      [calls.map(call => [call.to, call.data])]
    )
  ])

  const resultData = await provider.call({ data })

  const [, results] = AbiCoder.defaultAbiCoder().decode(
    ['uint', 'tuple(bool, bytes)[]'],
    resultData
  )

  return results.map(result => ({
    status: result[0],
    data: result[1]
  }))
}
