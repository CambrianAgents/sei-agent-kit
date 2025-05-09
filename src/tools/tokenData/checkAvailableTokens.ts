export async function checkAvailableTokens(): Promise<Array<{name: string, symbol: string}>> {
  const response = await fetch(`https://sei-api.dragonswap.app/api/v1/tokens/`);
  let data = await response.json();


    // Check if data is an object with tokens array or another structure
    const tokens = Array.isArray(data) ? data : (data.tokens || data.data || []);
    

  return tokens.map((token: any) => ({
    name: token.name,
    symbol: token.symbol
  }));
}