import { Toolkit } from "@bancor/carbon-sdk/strategy-management";
import { initSyncedCache } from "@bancor/carbon-sdk/chain-cache";
import {
  ContractsApi,
  ContractsConfig,
} from "@bancor/carbon-sdk/contracts-api";
import { JsonRpcProvider } from "@ethersproject/providers";

import { SeiAgentKit } from "../../index";
import { SEI_RPC_URL, MAX_BLOCK_AGE } from "../../constants";
import { Account } from "viem";

/**
 
 */
export async function deleteStrategy(
  agent: SeiAgentKit,
  config: ContractsConfig,
  strategyId: string,
): Promise<string | null> {
  const provider = new JsonRpcProvider(SEI_RPC_URL);
  const api = new ContractsApi(provider, config);
  const { cache } = initSyncedCache(api.reader, undefined, MAX_BLOCK_AGE);
  const carbonSDK = new Toolkit(api, cache, undefined);

  const populatedTx = await carbonSDK.deleteStrategy(strategyId);

  const viemTx = {
    chain: agent.walletClient.chain,
    account: agent.walletClient.account as Account,
    to: populatedTx.to as `0x${string}`,
    data: populatedTx.data as `0x${string}`,
    value: 0n,
    gas: populatedTx.gasLimit
      ? BigInt(populatedTx.gasLimit.toString())
      : undefined,
    nonce: populatedTx.nonce,
  };

  const txHash = await agent.walletClient.sendTransaction(viemTx);
  return txHash;
}
