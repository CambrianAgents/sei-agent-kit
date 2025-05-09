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
import { get_erc20_balance, erc20_transfer, get_erc721_balance, erc721Transfer, erc721Mint, stakeSei, unstakeSei, getTokenAddressFromTicker, getTokenData} from '../tools';
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
import { getTokenForProvider } from './modelProvider';
import { ModelProviderName } from '../types';
export class SeiAgentKit {
  public publicClient: ViemPublicClient;
  public walletClient: ViemWalletClient;
  public wallet_address: Address;
  public token: string | undefined;
  /**
   * Creates a new SeiAgentKit instance
   * @param private_key The private key for the wallet
   * @param provider The model provider to use
   */
  constructor(
    private_key: string,
    provider: ModelProviderName,
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
    
    this.token = getTokenForProvider(provider);
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

  /**
   * Gets token data
   * @param ticker The token ticker (e.g., "USDC")
   * @returns Token data
   */
  async getTokenData(ticker: string) {
    const address = await getTokenAddressFromTicker(ticker);
    if (!address) {
      throw new Error(`No token address found for ticker: ${ticker}`);
    }
    return getTokenData(address);
  }
}
