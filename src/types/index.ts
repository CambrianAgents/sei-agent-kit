import { Address } from "viem"

export interface IToken {
  id: string,
  attributes: {
    address: Address,
    name: string,
    symbol: string,
    decimals: number,
    initialSupply: string,
    logoUrl: string,
  },
};

/**
 * Supported model providers
 */
export enum ModelProviderName {
  ANTHROPIC = "anthropic",
  COHERE = "cohere",
  GOOGLE = "google",
  GROQ = "groq",
  MISTRAL = "mistral",
  OPENAI = "openai",
}

/**
 * Token data
 */
export type TokenData = {
  address: Address,
  name: string,
  symbol: string,
  usd_price: number,
  decimals: number,
  liquidity: number,
  description: string | null,
  change: any
}
