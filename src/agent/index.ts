import {
  WalletClient as ViemWalletClient,
  createPublicClient,
  http,
  PublicClient as ViemPublicClient,
  Address,
  Account,
  createWalletClient,
} from "viem";
import { sei } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { TradeActionBNStr, PayableOverrides, StrategyUpdate, EncodedStrategyBNStr } from '@bancor/carbon-sdk';
import { ContractsConfig } from '@bancor/carbon-sdk/contracts-api';
import { MarginalPriceOptions } from '@bancor/carbon-sdk/strategy-management';
import {
  get_erc20_balance, erc20_transfer, get_erc721_balance, erc721Transfer, erc721Mint, stakeSei, unstakeSei, getTokenAddressFromTicker, addLiquidity, removeLiquidity,
  composeTradeBySourceTx,
  composeTradeByTargetTx,
  createBuySellStrategy,
  createOverlappingStrategy,
  deleteStrategy,
  getLiquidityByPair,
  getMaxRateByPair,
  getMinRateByPair,
  getRateLiquidityDepthsByPair,
  getUserStrategies,
  hasLiquidityByPair,
  updateStrategy,
} from '../tools';
import { Config } from '../interfaces';
import {
  mintTakara,
  borrowTakara,
  repayTakara,
  redeemTakara,
  getRedeemableAmount,
  getBorrowBalance,
  type RedeemTakaraParams,
  getTakaraTTokenAddress
} from '../tools/takara';
import { swap } from '../tools/symphony/swap';
import { StrategyType } from "../tools/carbon";

export class SeiAgentKit {
  public publicClient: ViemPublicClient;
  public walletClient: ViemWalletClient;
  public wallet_address: Address;
  public config: Config;

  /**
   * Creates a new SeiAgentKit instance
   * @param private_key The private key for the wallet
   * @param configOrKey The configuration object or OpenAI API key
   */
  constructor(
    private_key: string,
    configOrKey: Config | string | null,
  ) {
    const account = privateKeyToAccount(private_key as Address);
    this.publicClient = createPublicClient({
      chain: sei,
      transport: http()
    });
    this.wallet_address = account.address;
    this.walletClient = createWalletClient({
      account,
      chain: sei,
      transport: http()
    });

    // Handle both old and new patterns
    if (typeof configOrKey === "string" || configOrKey === null) {
      this.config = { OPENAI_API_KEY: configOrKey || "" };
    } else {
      this.config = configOrKey;
    }
  }

  /**
   * Gets the ERC20 token balance
   * @param contract_address Optional ERC-20 token contract address. If not provided, gets native SEI balance
   * @returns Promise with formatted balance as string
   */
  async getERC20Balance(contract_address?: Address): Promise<string> {
    return get_erc20_balance(this, contract_address);
  }

  /**
   * Transfers SEI tokens or ERC-20 tokens
   * @param amount Amount to transfer as a string (e.g., "1.5" for 1.5 tokens)
   * @param recipient Recipient address
   * @param ticker Optional token ticker (if not provided, transfers native SEI)
   * @returns Promise with transaction result
   */
  async ERC20Transfer(
    amount: string,
    recipient: Address,
    ticker?: string,
  ): Promise<string> {
    return erc20_transfer(this, amount, recipient, ticker);
  }

  /**
   * Gets the ERC721 token balance
   * @param tokenAddress The ERC-721 token contract address
   * @returns Promise with balance as string
   */
  async getERC721Balance(tokenAddress: Address): Promise<string> {
    return get_erc721_balance(this, tokenAddress);
  }

  /**
   * Transfers an ERC721 token
   * @param amount Deprecated parameter (kept for compatibility)
   * @param recipient The recipient address
   * @param tokenAddress The ERC-721 token contract address
   * @param tokenId The token ID to transfer
   * @returns Promise with transaction details or error message
   */
  async ERC721Transfer(
    amount: string,
    recipient: Address,
    tokenAddress: Address,
    tokenId: string,
  ): Promise<string> {
    return erc721Transfer(this, BigInt(amount), recipient, tokenAddress, BigInt(tokenId));
  }

  /**
   * Mints an ERC721 token
   * @param recipient The recipient address that will receive the minted token
   * @param tokenAddress The ERC-721 token contract address
   * @param tokenId The token ID to mint
   * @returns Promise with transaction details or error message
   */
  async ERC721Mint(
    recipient: Address,
    tokenAddress: Address,
    tokenId: bigint,
  ): Promise<string> {
    return erc721Mint(this, recipient, tokenAddress, tokenId);
  }

  /**
   * Gets a token address from its ticker symbol
   * @param ticker The token ticker symbol (e.g., "SEI", "USDC")
   * @returns Promise with token address or null if not found
   */
  async getTokenAddressFromTicker(
    ticker: string,
  ): Promise<Address | null> {
    return getTokenAddressFromTicker(ticker);
  }

  /**
   * Stakes SEI tokens on the network
   * @param amount Amount of SEI to stake as a string (e.g., "1.5" for 1.5 SEI)
   * @returns Promise with transaction hash or error message
   */
  async stake(amount: string) {
    return stakeSei(this, amount);
  }

  /**
   * Unstakes SEI tokens from the network
   * @param amount Amount of SEI to unstake as a string (e.g., "1.5" for 1.5 SEI)
   * @returns Promise with transaction hash or error message
   */
  async unstake(amount: string) {
    return unstakeSei(this, amount);
  }

  /**
   * Swaps tokens using the Symphony aggregator
   * @param amount The amount of tokens to swap as a string (e.g., "1.5")
   * @param tokenIn The address of the token to swap from
   * @param tokenOut The address of the token to swap to
   * @returns Transaction details as a string
   */
  async swap(amount: string, tokenIn: Address, tokenOut: Address): Promise<string> {
    return swap(this, amount, tokenIn, tokenOut);
  }

  
  // Takara Protocol methods
  /**
   * Mints tTokens by depositing underlying tokens into the Takara Protocol
   * @param ticker The token ticker (e.g., "USDC")
   * @param mintAmount The amount to mint in human-readable format
   * @returns Transaction hash and expected tToken amount
   */
  async mintTakara(ticker: string, mintAmount: string) {
    return mintTakara(this, { ticker, mintAmount });
  }

  /**
   * Borrows underlying tokens from the Takara Protocol using tTokens as collateral
   * @param ticker The token ticker (e.g., "USDC")
   * @param borrowAmount The amount to borrow in human-readable format
   * @returns Transaction hash and borrowed amount
   */
  async borrowTakara(ticker: string, borrowAmount: string) {
    return borrowTakara(this, { ticker, borrowAmount });
  }

  /**
   * Repays borrowed tokens to the Takara Protocol
   * @param ticker The token ticker (e.g., "USDC")
   * @param repayAmount The amount to repay in human-readable format, or "MAX" to repay full balance
   * @returns Transaction hash and amount repaid
   */
  async repayTakara(ticker: string, repayAmount: string) {
    return repayTakara(this, { ticker, repayAmount });
  }

  /**
   * Redeems tTokens from the Takara Protocol to get underlying tokens back
   * @param ticker The token ticker (e.g., "USDC")
   * @param redeemAmount The amount to redeem in human-readable format, or "MAX" to redeem all
   * @param redeemType Whether to redeem underlying tokens or tTokens
   * @returns Transaction details and redemption status
   */
 async redeemTakara(ticker: string, redeemAmount: string, redeemType: RedeemTakaraParams['redeemType'] = 'underlying') {
    return redeemTakara(this, { ticker, redeemAmount, redeemType });
  }

  /**
   * Calculates the amount of underlying tokens that can be redeemed by a user
   * @param ticker The token ticker (e.g., "USDC")
   * @param userAddress Optional address of the user to check
   * @returns Information about redeemable amounts
   */
  async getRedeemableAmount(ticker: string, userAddress?: Address) {
    const tTokenAddress = getTakaraTTokenAddress(ticker);
    if (!tTokenAddress) {
      throw new Error(`No Takara tToken found for ticker: ${ticker}`);
    }
    return getRedeemableAmount(this, tTokenAddress, userAddress);
  }

  /**
   * Retrieves the current borrow balance for a user
   * @param ticker The token ticker (e.g., "USDC")
   * @param userAddress Optional address of the user to check
   * @returns Information about the borrow balance
   */
  async getBorrowBalance(ticker: string, userAddress?: Address) {
    const tTokenAddress = getTakaraTTokenAddress(ticker);
    if (!tTokenAddress) {
      throw new Error(`No Takara tToken found for ticker: ${ticker}`);
    }
    return getBorrowBalance(this, tTokenAddress, userAddress);
  }

  // DragonSwap methods
  /**
   * Adds liquidity to a DragonSwap pool
   * @param token0 The first token address
   * @param token1 The second token address
   * @param amount0 The amount of the first token to add as a string (e.g., "1.5")
   * @param amount1 The amount of the second token to add as a string (e.g., "100")
   * @param fee The fee tier of the pool (e.g., 500 for 0.05%, 3000 for 0.3%, 10000 for 1%)
   * @param tickLower The lower tick of the position
   * @param tickUpper The upper tick of the position
   * @returns Transaction hash or details
   */
  async addDragonSwapLiquidity(
    token0: Address,
    token1: Address,
    amount0: string,
    amount1: string,
    fee: number,
    tickLower: number,
    tickUpper: number,
  ): Promise<string> {
    return addLiquidity(
      this,
      token0,
      token1,
      amount0,
      amount1,
      fee,
      tickLower,
      tickUpper
    );
  }

  /**
   * Removes liquidity from a DragonSwap pool
   * @param tokenId The ID of the NFT position token
   * @param liquidity Optional: The amount of liquidity to remove (if undefined, removes all)
   * @returns Transaction hash or details
   */
  async removeDragonSwapLiquidity(
    tokenId: bigint,
    liquidity?: bigint,
  ): Promise<string> {
    return removeLiquidity(this, tokenId, liquidity);
  }

  // Carbon SDK Methods
  /**
   * Composes a trade transaction based on the source token amount using Carbon SDK.
   * @param config The Carbon contracts configuration.
   * @param sourceToken The address of the source token.
   * @param targetToken The address of the target token.
   * @param tradeActions An array of trade actions.
   * @param deadline The transaction deadline timestamp.
   * @param minReturn The minimum amount of target tokens to receive.
   * @param overrides Optional transaction overrides.
   * @returns Promise with the transaction hash or null.
   */
  async composeTradeBySourceTx(
    config: ContractsConfig,
    sourceToken: string,
    targetToken: string,
    tradeActions: TradeActionBNStr[],
    deadline: string,
    minReturn: string,
    overrides?: PayableOverrides
  ): Promise<string | null> {
    return composeTradeBySourceTx(this, config, sourceToken, targetToken, tradeActions, deadline, minReturn, overrides);
  }

  /**
   * Composes a trade transaction based on the target token amount using Carbon SDK.
   * @param config The Carbon contracts configuration.
   * @param sourceToken The address of the source token.
   * @param targetToken The address of the target token.
   * @param tradeActions An array of trade actions.
   * @param deadline The transaction deadline timestamp.
   * @param maxInput The maximum amount of source tokens to spend.
   * @param overrides Optional transaction overrides.
   * @returns Promise with the transaction hash or null.
   */
  async composeTradeByTargetTx(
    config: ContractsConfig,
    sourceToken: string,
    targetToken: string,
    tradeActions: TradeActionBNStr[],
    deadline: string,
    maxInput: string,
    overrides?: PayableOverrides
  ): Promise<string | null> {
    return composeTradeByTargetTx(this, config, sourceToken, targetToken, tradeActions, deadline, maxInput, overrides);
  }

  /**
   * Creates a buy/sell strategy using Carbon SDK.
   * @param config The Carbon contracts configuration.
   * @param baseToken The address of the base token.
   * @param quoteToken The address of the quote token.
   * @param buyPriceLow The lower bound of the buy price range.
   * @param buyPriceMarginal The marginal buy price.
   * @param buyPriceHigh The upper bound of the buy price range.
   * @param buyBudget The budget allocated for buying.
   * @param sellPriceLow The lower bound of the sell price range.
   * @param sellPriceMarginal The marginal sell price.
   * @param sellPriceHigh The upper bound of the sell price range.
   * @param sellBudget The budget allocated for selling.
   * @param overrides Optional transaction overrides.
   * @returns Promise with the transaction hash or null.
   */
  async createBuySellStrategy(
    config: ContractsConfig,
    type: StrategyType,
    baseToken: string,
    quoteToken: string,
    buyRange: string | string[] | undefined,
    sellRange: string | string[] | undefined,
    buyBudget: string | undefined,
    sellBudget: string | undefined,
    overrides?: PayableOverrides,
  ): Promise<string | null> {
    return createBuySellStrategy(this, config, type, baseToken, quoteToken, buyRange, sellRange, buyBudget, sellBudget, overrides);
  }

  /**
   * Creates an overlapping LP strategy using Carbon SDK.
   * @param config The Carbon contracts configuration.
   * @param baseToken The address of the base token.
   * @param quoteToken The address of the quote token.
   * @param sellPriceLow The lower bound of the sell price range.
   * @param buyPriceHigh The upper bound of the buy price range.
   * @param buyBudget The budget allocated for buying.
   * @param sellBudget The budget allocated for selling.
   * @param overrides Optional transaction overrides.
   * @returns Promise with the transaction hash or null.
   */
  async createOverlappingStrategy(
    config: ContractsConfig,
    baseToken: string,
    quoteToken: string,
    sellPriceLow: string | undefined,
    buyPriceHigh: string | undefined,
    buyBudget: string | undefined,
    sellBudget: string | undefined,
    fee: number,
    overrides?: PayableOverrides,
  ): Promise<string | null> {
    return createOverlappingStrategy(this, config, baseToken, quoteToken, sellPriceLow, buyPriceHigh, buyBudget, sellBudget, fee, overrides);
  }

  /**
   * Deletes a strategy using Carbon SDK.
   * @param config The Carbon contracts configuration.
   * @param strategyId The ID of the strategy to delete.
   * @returns Promise with the transaction hash or null.
   */
  async deleteStrategy(
    config: ContractsConfig,
    strategyId: string
  ): Promise<string | null> {
    return deleteStrategy(this, config, strategyId);
  }

  /**
   * Gets the liquidity for a token pair using Carbon SDK.
   * @param config The Carbon contracts configuration.
   * @param sourceToken The address of the source token.
   * @param targetToken The address of the target token.
   * @returns Promise with the liquidity information or null.
   */
  async getLiquidityByPair(
    config: ContractsConfig,
    sourceToken: string,
    targetToken: string
  ): Promise<string | null> {
    return getLiquidityByPair(this, config, sourceToken, targetToken);
  }

  /**
   * Gets the maximum rate for a token pair using Carbon SDK.
   * @param config The Carbon contracts configuration.
   * @param sourceToken The address of the source token.
   * @param targetToken The address of the target token.
   * @returns Promise with the maximum rate or null.
   */
  async getMaxRateByPair(
    config: ContractsConfig,
    sourceToken: string,
    targetToken: string
  ): Promise<string | null> {
    return getMaxRateByPair(this, config, sourceToken, targetToken);
  }

  /**
   * Gets the minimum rate for a token pair using Carbon SDK.
   * @param config The Carbon contracts configuration.
   * @param sourceToken The address of the source token.
   * @param targetToken The address of the target token.
   * @returns Promise with the minimum rate or null.
   */
  async getMinRateByPair(
    config: ContractsConfig,
    sourceToken: string,
    targetToken: string
  ): Promise<string | null> {
    return getMinRateByPair(this, config, sourceToken, targetToken);
  }

  /**
   * Gets the rate liquidity depths for a token pair using Carbon SDK.
   * @param config The Carbon contracts configuration.
   * @param sourceToken The address of the source token.
   * @param targetToken The address of the target token.
   * @param rates An array of rates to query.
   * @returns Promise with the liquidity depth information or null.
   */
  async getRateLiquidityDepthsByPair(
    config: ContractsConfig,
    sourceToken: string,
    targetToken: string,
    rates: string[]
  ): Promise<string | null> {
    return getRateLiquidityDepthsByPair(this, config, sourceToken, targetToken, rates);
  }

  /**
   * Gets the strategies for a user using Carbon SDK.
   * @param config The Carbon contracts configuration.
   * @param user Optional user address. Defaults to the agent's wallet address.
   * @returns Promise with the user's strategies or null.
   */
  async getUserStrategies(
    config: ContractsConfig,
    user?: `0x${string}`
  ): Promise<string | null> {
    return getUserStrategies(this, config, user);
  }

  /**
   * Checks if there is liquidity for a token pair using Carbon SDK.
   * @param config The Carbon contracts configuration.
   * @param sourceToken The address of the source token.
   * @param targetToken The address of the target token.
   * @returns Promise with a boolean indicating liquidity presence or null.
   */
  async hasLiquidityByPair(
    config: ContractsConfig,
    sourceToken: string,
    targetToken: string
  ): Promise<string | null> {
    return hasLiquidityByPair(this, config, sourceToken, targetToken);
  }

  /**
   * Updates a strategy using Carbon SDK.
   * @param config The Carbon contracts configuration.
   * @param strategyId The ID of the strategy to update.
   * @param update The strategy update data.
   * @param encoded The encoded strategy data.
   * @param buyPriceMarginal Optional marginal buy price options.
   * @param sellPriceMarginal Optional marginal sell price options.
   * @param overrides Optional transaction overrides.
   * @returns Promise with the transaction hash or null.
   */
  async updateStrategy(
    config: ContractsConfig,
    strategyId: string,
    update: StrategyUpdate,
    encoded: EncodedStrategyBNStr,
    buyPriceMarginal?: MarginalPriceOptions | string,
    sellPriceMarginal?: MarginalPriceOptions | string,
    overrides?: PayableOverrides
  ): Promise<string | null> {
    return updateStrategy(this, config, strategyId, update, encoded, buyPriceMarginal, sellPriceMarginal, overrides);
  }
  
}