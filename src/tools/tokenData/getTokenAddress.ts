import { Address } from "viem";
import { TokenData } from "../../types";

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
    const response = await fetch(
      "https://sei-api.dragonswap.app/api/v1/tokens/"
    );

    if (!response.ok) {
      throw new Error(`DexScreener API request failed with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Check if data is an object with tokens array or another structure
    const tokens = Array.isArray(data) ? data : (data.tokens || data.data || []);
    
    // Find the token with matching symbol (case-insensitive)
    const token = tokens.find(
      (token: TokenData) => token.symbol.toLowerCase() === ticker.toLowerCase()
    );
    
    if (token) {
      return token.address as Address;
    } else {
      console.log(`Token with ticker ${ticker} not found.`);
      return null;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(errorMsg);
    throw error;
  }
}
   