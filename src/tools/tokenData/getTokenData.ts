import { TokenData } from "../../types";
import { Address } from "viem"

export async function getTokenData(address: Address): Promise<TokenData> {
  const response = await fetch(`https://sei-api.dragonswap.app/api/v1/tokens/${address}`);
  const data = await response.json();
  return data;
}