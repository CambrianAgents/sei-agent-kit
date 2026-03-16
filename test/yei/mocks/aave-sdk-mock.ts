/**
 * Mock implementation of Aave SDK for YEI Finance testing
 * Provides controlled responses for testing decimal precision and calculations
 */

import { BigNumber } from 'ethers';
import { toDecimal18, calculateAPR, calculateReward } from '../utils/decimal-utils';

export interface MockReserveData {
  symbol: string;
  decimals: number;
  liquidityRate: BigNumber;
  variableBorrowRate: BigNumber;
  stableBorrowRate: BigNumber;
  totalSupply: BigNumber;
  totalBorrow: BigNumber;
  utilizationRate: BigNumber;
}

export interface MockUserReserveData {
  symbol: string;
  underlyingBalance: BigNumber;
  aTokenBalance: BigNumber;
  currentATokenBalance: BigNumber;
  stableBorrowBalance: BigNumber;
  variableBorrowBalance: BigNumber;
  liquidityRate: BigNumber;
  usageAsCollateralEnabled: boolean;
}

export interface MockIncentiveData {
  symbol: string;
  aTokenIncentivesAPR: BigNumber;
  vTokenIncentivesAPR: BigNumber;
  sTokenIncentivesAPR: BigNumber;
}

/**
 * Mock Aave Client for testing YEI Finance integration
 */
export class MockAaveClient {
  private reserveData: Map<string, MockReserveData> = new Map();
  private userReserveData: Map<string, MockUserReserveData> = new Map();
  private incentiveData: Map<string, MockIncentiveData> = new Map();
  private blockTimestamp: number = Date.now();

  constructor() {
    this.initializeDefaultData();
  }

  /**
   * Initialize with realistic test data
   */
  private initializeDefaultData(): void {
    // USDC Reserve
    this.reserveData.set('USDC', {
      symbol: 'USDC',
      decimals: 6, // USDC has 6 decimals
      liquidityRate: toDecimal18('3.5'), // 3.5% APY
      variableBorrowRate: toDecimal18('5.2'), // 5.2% APR
      stableBorrowRate: toDecimal18('6.8'), // 6.8% APR
      totalSupply: toDecimal18('10000000'), // 10M USDC
      totalBorrow: toDecimal18('7000000'), // 7M USDC borrowed
      utilizationRate: toDecimal18('70'), // 70% utilization
    });

    // ETH Reserve
    this.reserveData.set('ETH', {
      symbol: 'ETH',
      decimals: 18,
      liquidityRate: toDecimal18('2.8'), // 2.8% APY
      variableBorrowRate: toDecimal18('4.1'), // 4.1% APR
      stableBorrowRate: toDecimal18('5.5'), // 5.5% APR
      totalSupply: toDecimal18('50000'), // 50K ETH
      totalBorrow: toDecimal18('30000'), // 30K ETH borrowed
      utilizationRate: toDecimal18('60'), // 60% utilization
    });

    // YEI Token (fictional reward token with 18 decimals)
    this.reserveData.set('YEI', {
      symbol: 'YEI',
      decimals: 18, // CRITICAL: YEI must have 18 decimals
      liquidityRate: toDecimal18('15.0'), // 15% APY
      variableBorrowRate: toDecimal18('18.5'), // 18.5% APR
      stableBorrowRate: toDecimal18('20.0'), // 20% APR
      totalSupply: toDecimal18('1000000'), // 1M YEI
      totalBorrow: toDecimal18('400000'), // 400K YEI borrowed
      utilizationRate: toDecimal18('40'), // 40% utilization
    });

    // Initialize incentive data
    this.incentiveData.set('USDC', {
      symbol: 'USDC',
      aTokenIncentivesAPR: toDecimal18('2.0'), // 2% additional rewards
      vTokenIncentivesAPR: toDecimal18('1.5'), // 1.5% borrow rewards
      sTokenIncentivesAPR: toDecimal18('0.8'), // 0.8% stable borrow rewards
    });

    this.incentiveData.set('ETH', {
      symbol: 'ETH',
      aTokenIncentivesAPR: toDecimal18('1.5'), // 1.5% additional rewards
      vTokenIncentivesAPR: toDecimal18('1.0'), // 1.0% borrow rewards
      sTokenIncentivesAPR: toDecimal18('0.5'), // 0.5% stable borrow rewards
    });

    this.incentiveData.set('YEI', {
      symbol: 'YEI',
      aTokenIncentivesAPR: toDecimal18('5.0'), // 5% additional rewards
      vTokenIncentivesAPR: toDecimal18('3.0'), // 3.0% borrow rewards
      sTokenIncentivesAPR: toDecimal18('2.0'), // 2.0% stable borrow rewards
    });
  }

  /**
   * Mock method to get reserve data
   */
  async getReserveData(asset: string): Promise<MockReserveData> {
    const data = this.reserveData.get(asset);
    if (!data) {
      throw new Error(`Reserve data not found for asset: ${asset}`);
    }
    return { ...data }; // Return copy to prevent modification
  }

  /**
   * Mock method to get user reserve data
   */
  async getUserReserveData(user: string, asset: string): Promise<MockUserReserveData> {
    const key = `${user}-${asset}`;
    let data = this.userReserveData.get(key);
    
    if (!data) {
      // Create default user data
      const reserveData = await this.getReserveData(asset);
      data = {
        symbol: asset,
        underlyingBalance: toDecimal18('0'),
        aTokenBalance: toDecimal18('0'),
        currentATokenBalance: toDecimal18('0'),
        stableBorrowBalance: toDecimal18('0'),
        variableBorrowBalance: toDecimal18('0'),
        liquidityRate: reserveData.liquidityRate,
        usageAsCollateralEnabled: false,
      };
      this.userReserveData.set(key, data);
    }
    
    return { ...data };
  }

  /**
   * Mock method to get incentive data
   */
  async getIncentiveData(asset: string): Promise<MockIncentiveData> {
    const data = this.incentiveData.get(asset);
    if (!data) {
      throw new Error(`Incentive data not found for asset: ${asset}`);
    }
    return { ...data };
  }

  /**
   * Mock supply operation
   */
  async supply(
    user: string,
    asset: string,
    amount: BigNumber
  ): Promise<{ success: boolean; aTokensMinted: BigNumber }> {
    const userData = await this.getUserReserveData(user, asset);
    const reserveData = await this.getReserveData(asset);
    
    // Validate decimal precision for YEI
    if (asset === 'YEI' && reserveData.decimals !== 18) {
      throw new Error('YEI token must have exactly 18 decimals');
    }
    
    // Calculate aTokens minted (1:1 ratio for simplicity)
    const aTokensMinted = amount;
    
    // Update user balances
    userData.underlyingBalance = userData.underlyingBalance.add(amount);
    userData.aTokenBalance = userData.aTokenBalance.add(aTokensMinted);
    userData.currentATokenBalance = userData.currentATokenBalance.add(aTokensMinted);
    
    // Update reserve total supply
    reserveData.totalSupply = reserveData.totalSupply.add(amount);
    
    this.userReserveData.set(`${user}-${asset}`, userData);
    this.reserveData.set(asset, reserveData);
    
    return { success: true, aTokensMinted };
  }

  /**
   * Mock withdraw operation
   */
  async withdraw(
    user: string,
    asset: string,
    amount: BigNumber
  ): Promise<{ success: boolean; amountWithdrawn: BigNumber }> {
    const userData = await this.getUserReserveData(user, asset);
    
    if (userData.currentATokenBalance.lt(amount)) {
      throw new Error('Insufficient aToken balance');
    }
    
    // Update user balances
    userData.currentATokenBalance = userData.currentATokenBalance.sub(amount);
    userData.aTokenBalance = userData.aTokenBalance.sub(amount);
    
    // Update reserve
    const reserveData = await this.getReserveData(asset);
    reserveData.totalSupply = reserveData.totalSupply.sub(amount);
    
    this.userReserveData.set(`${user}-${asset}`, userData);
    this.reserveData.set(asset, reserveData);
    
    return { success: true, amountWithdrawn: amount };
  }

  /**
   * Calculate accrued rewards with precise decimal handling
   */
  async calculateAccruedRewards(
    user: string,
    asset: string,
    timeElapsed: number = 3600 // 1 hour in seconds
  ): Promise<BigNumber> {
    const userData = await this.getUserReserveData(user, asset);
    const incentiveData = await this.getIncentiveData(asset);
    
    if (userData.aTokenBalance.eq(0)) {
      return BigNumber.from(0);
    }
    
    // Calculate rewards based on aToken balance and APR
    // Rewards = balance * APR * time / (365 * 24 * 3600)
    const secondsPerYear = toDecimal18(365 * 24 * 3600);
    const timeElapsedBN = toDecimal18(timeElapsed);
    
    const annualReward = calculateReward(userData.aTokenBalance, incentiveData.aTokenIncentivesAPR);
    const rewards = annualReward.mul(timeElapsedBN).div(secondsPerYear);
    
    return rewards;
  }

  /**
   * Get total rewards earned by user
   */
  async getTotalRewards(user: string): Promise<Map<string, BigNumber>> {
    const rewards = new Map<string, BigNumber>();
    
    // Calculate rewards for all assets user has positions in
    for (const [key, userData] of this.userReserveData) {
      const [userAddr, asset] = key.split('-');
      if (userAddr === user && userData.aTokenBalance.gt(0)) {
        const reward = await this.calculateAccruedRewards(user, asset);
        rewards.set(asset, reward);
      }
    }
    
    return rewards;
  }

  /**
   * Simulate time passing for reward accrual
   */
  advanceTime(seconds: number): void {
    this.blockTimestamp += seconds * 1000;
    
    // Update all user positions with accrued interest
    for (const [key, userData] of this.userReserveData) {
      const [user, asset] = key.split('-');
      if (userData.aTokenBalance.gt(0)) {
        const reserveData = this.reserveData.get(asset);
        if (reserveData) {
          // Simple interest accrual for testing
          const interestRate = reserveData.liquidityRate;
          const timeRate = toDecimal18(seconds).div(toDecimal18(365 * 24 * 3600));
          const interest = userData.aTokenBalance.mul(interestRate).mul(timeRate).div(toDecimal18(10000)); // Divide by 100 for percentage
          
          userData.currentATokenBalance = userData.currentATokenBalance.add(interest);
        }
      }
    }
  }

  /**
   * Reset mock state for clean testing
   */
  reset(): void {
    this.userReserveData.clear();
    this.blockTimestamp = Date.now();
    this.initializeDefaultData();
  }

  /**
   * Set custom reserve data for testing
   */
  setReserveData(asset: string, data: Partial<MockReserveData>): void {
    const existing = this.reserveData.get(asset);
    if (existing) {
      this.reserveData.set(asset, { ...existing, ...data });
    } else {
      throw new Error(`Reserve ${asset} not found`);
    }
  }

  /**
   * Set custom user data for testing
   */
  setUserReserveData(user: string, asset: string, data: Partial<MockUserReserveData>): void {
    const key = `${user}-${asset}`;
    const existing = this.userReserveData.get(key);
    if (existing) {
      this.userReserveData.set(key, { ...existing, ...data });
    } else {
      // Create new entry
      const reserveData = this.reserveData.get(asset);
      if (!reserveData) throw new Error(`Reserve ${asset} not found`);
      
      const defaultData: MockUserReserveData = {
        symbol: asset,
        underlyingBalance: toDecimal18('0'),
        aTokenBalance: toDecimal18('0'),
        currentATokenBalance: toDecimal18('0'),
        stableBorrowBalance: toDecimal18('0'),
        variableBorrowBalance: toDecimal18('0'),
        liquidityRate: reserveData.liquidityRate,
        usageAsCollateralEnabled: false,
      };
      
      this.userReserveData.set(key, { ...defaultData, ...data });
    }
  }

  /**
   * Validate that YEI token configurations are correct
   */
  validateYEIConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      const yeiReserve = this.reserveData.get('YEI');
      if (!yeiReserve) {
        errors.push('YEI reserve data not found');
        return { valid: false, errors };
      }
      
      if (yeiReserve.decimals !== 18) {
        errors.push(`YEI token must have 18 decimals, found: ${yeiReserve.decimals}`);
      }
      
      // Validate that all rates are properly formatted with 18 decimals
      const rates = [
        yeiReserve.liquidityRate,
        yeiReserve.variableBorrowRate,
        yeiReserve.stableBorrowRate
      ];
      
      for (const rate of rates) {
        if (rate.lt(0) || rate.gt(toDecimal18('1000'))) { // Max 1000% APR
          errors.push(`Invalid rate detected: ${rate.toString()}`);
        }
      }
      
      const incentives = this.incentiveData.get('YEI');
      if (incentives) {
        const incentiveRates = [
          incentives.aTokenIncentivesAPR,
          incentives.vTokenIncentivesAPR,
          incentives.sTokenIncentivesAPR
        ];
        
        for (const rate of incentiveRates) {
          if (rate.lt(0) || rate.gt(toDecimal18('100'))) { // Max 100% incentive APR
            errors.push(`Invalid incentive rate detected: ${rate.toString()}`);
          }
        }
      }
      
    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return { valid: errors.length === 0, errors };
  }
}

export default MockAaveClient;