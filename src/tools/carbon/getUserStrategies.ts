import { Toolkit } from "@bancor/carbon-sdk/strategy-management";
import { Strategy } from "@bancor/carbon-sdk";
import { initSyncedCache } from "@bancor/carbon-sdk/chain-cache";
import {
  ContractsApi,
  ContractsConfig,
} from "@bancor/carbon-sdk/contracts-api";
import { JsonRpcProvider } from "@ethersproject/providers";
import { SEI_RPC_URL, MAX_BLOCK_AGE } from "../../constants";

/**
 
 */
export async function getUserStrategies(
  config: ContractsConfig,
  user: `0x${string}`,
): Promise<Strategy[] | null> {
  const provider = new JsonRpcProvider(SEI_RPC_URL);
  const api = new ContractsApi(provider, config);
  const { cache } = initSyncedCache(api.reader, undefined, MAX_BLOCK_AGE);
  const carbonSDK = new Toolkit(api, cache, undefined);

  const strategies = await carbonSDK.getUserStrategies(user);

  return strategies;
}
