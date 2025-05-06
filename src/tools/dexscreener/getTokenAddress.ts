import { Address } from "viem";

/**
 * Gets a token address from DexScreener API based on ticker symbol
 * @param ticker Token ticker symbol to search for
 * @returns Promise with token address or null if not found
 */
export async function getTokenAddressFromTicker(
  ticker: string,
): Promise<Address | null> {
  console.log(`Getting token address for ${ticker}...`);
  if (typeof ticker !== 'string' || ticker.trim() === '') {
    throw new Error("Ticker must be a non-empty string");
  }

  try {
    // Make API request
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(ticker)}`,
    );

    if (!response.ok) {
      throw new Error(`DexScreener API request failed with status: ${response.status}`);
    }

    const data = await response.json();

    // Validate response data
    if (!data) {
      throw new Error("Invalid response data from DexScreener API");
    }

    if (!data.pairs || !Array.isArray(data.pairs) || data.pairs.length === 0) {
      console.warn(`No pairs found for ticker: ${ticker}`);
      return null;
    }

    // Filter for Sei v2 chain pairs
    let seiPairs = data.pairs.filter((pair: any) => {
      if (!pair || typeof pair !== 'object') return false;
      if (!pair.chainId || typeof pair.chainId !== 'string') return false;
      return pair.chainId === "seiv2";
    });

    if (!seiPairs.length) {
      console.warn(`No Sei v2 pairs found for ticker: ${ticker}`);
      return null;
    }

    // Filter by matching base token symbol
    seiPairs = seiPairs.filter(
      (pair: any) => {
        if (!pair?.baseToken?.symbol) return false;
        return pair.baseToken.symbol.toLowerCase() === ticker.toLowerCase();
      }
    );

    if (!seiPairs.length) {
      console.warn(`No matching pairs found for ticker symbol: ${ticker}`);
      return null;
    }

    // Validate base token address
    const firstPair = seiPairs[0];
    if (!firstPair?.baseToken?.address) {
      throw new Error(`Invalid token data structure for ticker: ${ticker}`);
    }

    return firstPair.baseToken.address.toLowerCase() as Address;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(errorMsg)
    throw error;
  }
}