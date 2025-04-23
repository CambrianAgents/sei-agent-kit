import { Address } from 'viem';


/**
 * Mapping of token tickers to their corresponding Takara tToken addresses
 */
export const TAKARA_TOKEN_MAP: Record<string, Address> = {
    "SEI": "0xA26b9BFe606d29F16B5Aecf30F9233934452c4E2",
    "USDC": "0xC3c9e322F4aAe352ace79D0E62ADe3563fB86e87",
    "USDT": "0xc68351B9B3638A6f4A3Ae100Bd251e227BbD7479",
    "FASTUSD": "0x92e51466482146E71b692ced2265284968E8B3d6",
    "ISEI": "0xda642A7821E91eD285262fead162E5fd17200429",
};

/**
 * Reverse mapping of tToken addresses to their corresponding token tickers
 * This can be useful for displaying token names in UIs
 */
export const TAKARA_ADDRESS_TO_TICKER: Record<string, string> = 
  Object.entries(TAKARA_TOKEN_MAP).reduce((acc, [ticker, address]) => {
    acc[address.toLowerCase()] = ticker;
    return acc;
  }, {} as Record<string, string>);

/**
 * Get the Takara tToken address for a given token ticker
 * @param ticker The token ticker (e.g., "USDC")
 * @returns The corresponding tToken address or null if not found
 */
export function getTakaraTTokenAddress(ticker: string): Address | null {
  const normalizedTicker = ticker.toUpperCase();
  
  // Handle case where the user inputs the "t" version
  if (normalizedTicker.startsWith('T') && normalizedTicker.length > 1) {
    const baseTicker = normalizedTicker.substring(1);
    return TAKARA_TOKEN_MAP[baseTicker] || null;
  }
  
  return TAKARA_TOKEN_MAP[normalizedTicker] || null;
}

/**
 * Get the token ticker for a given Takara tToken address
 * @param address The tToken address
 * @returns The corresponding token ticker or null if not found
 */
export function getTickerFromTakaraTTokenAddress(address: Address): string | null {
  return TAKARA_ADDRESS_TO_TICKER[address.toLowerCase()] || null;
}

/**
 * Validates if a ticker has a corresponding Takara tToken
 * @param ticker The token ticker to validate
 * @returns True if the ticker has a corresponding tToken
 */
export function isSupportedTakaraToken(ticker: string): boolean {
  const normalizedTicker = ticker.toUpperCase();
  
  // Handle case where the user inputs the "t" version
  if (normalizedTicker.startsWith('T') && normalizedTicker.length > 1) {
    const baseTicker = normalizedTicker.substring(1);
    return baseTicker in TAKARA_TOKEN_MAP;
  }
  
  return normalizedTicker in TAKARA_TOKEN_MAP;
}

/**
 * Get a list of all supported Takara tokens
 * @returns Array of token tickers supported by Takara
 */
export function getAllSupportedTakaraTokens(): string[] {
    return Object.keys(TAKARA_TOKEN_MAP);
  }