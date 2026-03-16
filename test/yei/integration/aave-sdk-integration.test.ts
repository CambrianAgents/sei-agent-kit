/**
 * YEI Finance - Aave SDK Integration Tests
 * End-to-end tests for YEI Finance integration with Aave protocol
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BigNumber } from 'ethers';
import { 
  toDecimal18, 
  fromDecimal18,
  calculateAPR,
  calculateReward,
  DecimalAssertions
} from '../utils/decimal-utils';
import MockAaveClient from '../mocks/aave-sdk-mock';

describe('YEI Finance - Aave SDK Integration', () => {
  let mockClient: MockAaveClient;
  const testUsers = [
    '0x1234567890123456789012345678901234567890',
    '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    '0x9876543210987654321098765432109876543210'
  ];

  beforeEach(() => {
    mockClient = new MockAaveClient();
  });

  afterEach(() => {
    mockClient.reset();
  });

  describe('Full Workflow Integration', () => {
    it('should complete supply-earn-withdraw cycle with correct decimals', async () => {
      const user = testUsers[0];
      const supplyAmount = toDecimal18('1000');
      const asset = 'YEI';

      // Step 1: Supply YEI tokens
      const supplyResult = await mockClient.supply(user, asset, supplyAmount);
      expect(supplyResult.success).toBe(true);
      DecimalAssertions.expectDecimal18(supplyResult.aTokensMinted);

      // Step 2: Verify balance and configuration
      const userData = await mockClient.getUserReserveData(user, asset);
      expect(userData.aTokenBalance.eq(supplyAmount)).toBe(true);
      
      const reserveData = await mockClient.getReserveData(asset);
      expect(reserveData.decimals).toBe(18); // Critical YEI requirement

      // Step 3: Let time pass to earn rewards
      mockClient.advanceTime(30 * 24 * 3600); // 30 days

      // Step 4: Check accrued rewards
      const accruedRewards = await mockClient.calculateAccruedRewards(user, asset, 30 * 24 * 3600);
      DecimalAssertions.expectDecimal18(accruedRewards);
      expect(accruedRewards.gt(BigNumber.from('0'))).toBe(true);

      // Step 5: Verify APR calculations match expectations
      const incentiveData = await mockClient.getIncentiveData(asset);
      const expectedAnnualReward = calculateReward(supplyAmount, incentiveData.aTokenIncentivesAPR);
      const expectedMonthlyReward = expectedAnnualReward.div(12);
      
      DecimalAssertions.expectApproxEqual(
        accruedRewards,
        expectedMonthlyReward,
        expectedMonthlyReward.div(100), // 1% tolerance
        'Accrued rewards should match calculated monthly reward'
      );

      // Step 6: Withdraw funds
      const updatedUserData = await mockClient.getUserReserveData(user, asset);
      const finalBalance = updatedUserData.currentATokenBalance;
      
      const withdrawResult = await mockClient.withdraw(user, asset, finalBalance);
      expect(withdrawResult.success).toBe(true);
      expect(withdrawResult.amountWithdrawn.eq(finalBalance)).toBe(true);

      // Step 7: Verify complete withdrawal
      const finalUserData = await mockClient.getUserReserveData(user, asset);
      expect(finalUserData.aTokenBalance.eq(BigNumber.from('0'))).toBe(true);
    });

    it('should handle multi-asset portfolio with correct decimal handling', async () => {
      const user = testUsers[0];
      const assets = [
        { symbol: 'YEI', amount: toDecimal18('1000'), expectedDecimals: 18 },
        { symbol: 'ETH', amount: toDecimal18('5'), expectedDecimals: 18 },
        { symbol: 'USDC', amount: toDecimal18('2000'), expectedDecimals: 6 }
      ];

      // Supply to multiple assets
      for (const { symbol, amount, expectedDecimals } of assets) {
        const reserveData = await mockClient.getReserveData(symbol);
        expect(reserveData.decimals).toBe(expectedDecimals);

        const result = await mockClient.supply(user, symbol, amount);
        expect(result.success).toBe(true);
        DecimalAssertions.expectDecimal18(result.aTokensMinted);
      }

      // Advance time for reward accrual
      mockClient.advanceTime(7 * 24 * 3600); // 1 week

      // Check total portfolio rewards
      const totalRewards = await mockClient.getTotalRewards(user);
      expect(totalRewards.size).toBe(3);

      let portfolioValue = BigNumber.from('0');
      for (const [symbol, rewards] of totalRewards) {
        DecimalAssertions.expectDecimal18(rewards);
        expect(rewards.gt(BigNumber.from('0'))).toBe(true);
        portfolioValue = portfolioValue.add(rewards);

        console.log(`${symbol} rewards: ${fromDecimal18(rewards)}`);
      }

      expect(portfolioValue.gt(BigNumber.from('0'))).toBe(true);
      console.log(`Total portfolio rewards value: ${fromDecimal18(portfolioValue)}`);

      // YEI should have highest rewards due to higher APR
      const yeiRewards = totalRewards.get('YEI')!;
      const ethRewards = totalRewards.get('ETH')!;
      const usdcRewards = totalRewards.get('USDC')!;

      expect(yeiRewards.gt(ethRewards)).toBe(true);
      expect(yeiRewards.gt(usdcRewards)).toBe(true);
    });

    it('should maintain precision across complex operations', async () => {
      const user = testUsers[0];
      const asset = 'YEI';
      const operations = [
        { action: 'supply', amount: toDecimal18('1000.123456789012345678') },
        { action: 'wait', time: 86400 }, // 1 day
        { action: 'supply', amount: toDecimal18('500.987654321098765432') },
        { action: 'wait', time: 86400 * 7 }, // 1 week
        { action: 'withdraw', amount: toDecimal18('200.111111111111111111') },
        { action: 'wait', time: 86400 * 3 }, // 3 days
      ];

      let expectedBalance = BigNumber.from('0');
      let lastBalance = BigNumber.from('0');

      for (const operation of operations) {
        if (operation.action === 'supply') {
          await mockClient.supply(user, asset, operation.amount);
          expectedBalance = expectedBalance.add(operation.amount);
          
        } else if (operation.action === 'withdraw') {
          const userData = await mockClient.getUserReserveData(user, asset);
          const currentBalance = userData.currentATokenBalance;
          
          await mockClient.withdraw(user, asset, operation.amount);
          expectedBalance = currentBalance.sub(operation.amount);
          
        } else if (operation.action === 'wait') {
          mockClient.advanceTime(operation.time);
          
          const userData = await mockClient.getUserReserveData(user, asset);
          const currentBalance = userData.currentATokenBalance;
          
          // Should have grown due to interest
          if (lastBalance.gt(BigNumber.from('0'))) {
            expect(currentBalance.gte(lastBalance)).toBe(true);
          }
          
          lastBalance = currentBalance;
        }

        // Always check decimal precision is maintained
        const userData = await mockClient.getUserReserveData(user, asset);
        DecimalAssertions.expectDecimal18(userData.aTokenBalance);
        DecimalAssertions.expectDecimal18(userData.currentATokenBalance);
      }

      console.log(`Final balance: ${fromDecimal18(lastBalance)} YEI`);
    });
  });

  describe('Multi-user Scenarios', () => {
    it('should handle concurrent users with different balance scales', async () => {
      const scenarios = [
        { user: testUsers[0], amount: toDecimal18('1000000'), description: 'Whale user' },
        { user: testUsers[1], amount: toDecimal18('1000'), description: 'Regular user' },
        { user: testUsers[2], amount: toDecimal18('1'), description: 'Small user' }
      ];

      // All users supply different amounts
      for (const { user, amount, description } of scenarios) {
        const result = await mockClient.supply(user, 'YEI', amount);
        expect(result.success).toBe(true);
        
        console.log(`${description} supplied: ${fromDecimal18(amount)} YEI`);
      }

      // Advance time for reward accrual
      mockClient.advanceTime(24 * 3600); // 1 day

      // Check rewards are proportional to balances
      const userRewards: { user: string; amount: BigNumber; rewards: BigNumber; description: string }[] = [];

      for (const { user, amount, description } of scenarios) {
        const rewards = await mockClient.calculateAccruedRewards(user, 'YEI', 24 * 3600);
        userRewards.push({ user, amount, rewards, description });
        
        DecimalAssertions.expectDecimal18(rewards);
        expect(rewards.gt(BigNumber.from('0'))).toBe(true);
        
        console.log(`${description} rewards: ${fromDecimal18(rewards)} YEI`);
      }

      // Verify proportionality (larger balances = larger rewards)
      const whaleUser = userRewards[0];
      const regularUser = userRewards[1];
      const smallUser = userRewards[2];

      expect(whaleUser.rewards.gt(regularUser.rewards)).toBe(true);
      expect(regularUser.rewards.gt(smallUser.rewards)).toBe(true);

      // Check approximate proportionality
      const whaleToRegularRatio = whaleUser.amount.div(regularUser.amount);
      const rewardRatio = whaleUser.rewards.div(regularUser.rewards);
      
      // Should be approximately equal (within 10% tolerance)
      const tolerance = whaleToRegularRatio.div(10);
      const diff = whaleToRegularRatio.gt(rewardRatio) 
        ? whaleToRegularRatio.sub(rewardRatio)
        : rewardRatio.sub(whaleToRegularRatio);
      
      expect(diff.lte(tolerance)).toBe(true);
    });

    it('should maintain system integrity under load', async () => {
      const numUsers = testUsers.length;
      const operationsPerUser = 10;
      const amounts = [
        toDecimal18('100'),
        toDecimal18('500'),
        toDecimal18('1000')
      ];

      // Perform multiple operations for each user
      for (let userIndex = 0; userIndex < numUsers; userIndex++) {
        const user = testUsers[userIndex];
        let userBalance = BigNumber.from('0');

        for (let op = 0; op < operationsPerUser; op++) {
          const amount = amounts[op % amounts.length];
          
          if (op % 3 === 0) {
            // Supply operation
            await mockClient.supply(user, 'YEI', amount);
            userBalance = userBalance.add(amount);
            
          } else if (op % 3 === 1 && userBalance.gt(amount)) {
            // Withdraw operation (if enough balance)
            await mockClient.withdraw(user, 'YEI', amount);
            userBalance = userBalance.sub(amount);
            
          } else {
            // Time advance for interest accrual
            mockClient.advanceTime(3600); // 1 hour
          }

          // Verify system consistency
          const userData = await mockClient.getUserReserveData(user, 'YEI');
          DecimalAssertions.expectDecimal18(userData.aTokenBalance);
          DecimalAssertions.expectDecimal18(userData.currentATokenBalance);
        }
      }

      // Final system validation
      const validation = mockClient.validateYEIConfiguration();
      expect(validation.valid).toBe(true);

      // Check reserve totals are consistent
      const reserveData = await mockClient.getReserveData('YEI');
      DecimalAssertions.expectDecimal18(reserveData.totalSupply);
      expect(reserveData.totalSupply.gte(BigNumber.from('0'))).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle invalid decimal configurations gracefully', async () => {
      // Temporarily corrupt YEI configuration
      mockClient.setReserveData('YEI', { decimals: 6 });

      const user = testUsers[0];
      const amount = toDecimal18('1000');

      // Should reject supply due to invalid decimal configuration
      await expect(
        mockClient.supply(user, 'YEI', amount)
      ).rejects.toThrow('YEI token must have exactly 18 decimals');

      // Validation should catch the error
      const validation = mockClient.validateYEIConfiguration();
      expect(validation.valid).toBe(false);
    });

    it('should handle precision edge cases in real workflows', async () => {
      const user = testUsers[0];
      const verySmallAmount = BigNumber.from('1'); // 1 wei
      const asset = 'YEI';

      // Supply very small amount
      const supplyResult = await mockClient.supply(user, asset, verySmallAmount);
      expect(supplyResult.success).toBe(true);

      // Calculate rewards (might be 0 due to precision limits)
      const rewards = await mockClient.calculateAccruedRewards(user, asset, 86400);
      DecimalAssertions.expectDecimal18(rewards);
      expect(rewards.gte(BigNumber.from('0'))).toBe(true);

      // Should be able to withdraw original amount
      const withdrawResult = await mockClient.withdraw(user, asset, verySmallAmount);
      expect(withdrawResult.success).toBe(true);
    });

    it('should maintain consistency during system stress', async () => {
      const user = testUsers[0];
      const asset = 'YEI';
      
      // Rapid supply/withdraw cycles
      for (let i = 0; i < 100; i++) {
        const amount = toDecimal18('10');
        
        await mockClient.supply(user, asset, amount);
        
        if (i % 10 === 0) {
          mockClient.advanceTime(360); // 6 minutes
        }
        
        if (i % 2 === 1) {
          // Withdraw half the time
          await mockClient.withdraw(user, asset, amount);
        }
      }

      // System should remain consistent
      const userData = await mockClient.getUserReserveData(user, asset);
      DecimalAssertions.expectDecimal18(userData.aTokenBalance);
      DecimalAssertions.expectDecimal18(userData.currentATokenBalance);
      
      const validation = mockClient.validateYEIConfiguration();
      expect(validation.valid).toBe(true);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should simulate realistic DeFi user behavior', async () => {
      const user = testUsers[0];
      const scenarios = [
        {
          description: 'Initial large supply',
          action: async () => {
            await mockClient.supply(user, 'YEI', toDecimal18('5000'));
            mockClient.advanceTime(7 * 24 * 3600); // 1 week
          }
        },
        {
          description: 'Partial withdrawal for other opportunities',
          action: async () => {
            await mockClient.withdraw(user, 'YEI', toDecimal18('2000'));
            mockClient.advanceTime(3 * 24 * 3600); // 3 days
          }
        },
        {
          description: 'Market dip - buy more YEI',
          action: async () => {
            await mockClient.supply(user, 'YEI', toDecimal18('3000'));
            mockClient.advanceTime(14 * 24 * 3600); // 2 weeks
          }
        },
        {
          description: 'Final harvest and exit',
          action: async () => {
            const userData = await mockClient.getUserReserveData(user, 'YEI');
            const balance = userData.currentATokenBalance;
            await mockClient.withdraw(user, 'YEI', balance);
          }
        }
      ];

      let totalRewardsEarned = BigNumber.from('0');
      let maxBalance = BigNumber.from('0');

      for (const scenario of scenarios) {
        console.log(`\nExecuting: ${scenario.description}`);
        
        await scenario.action();
        
        const userData = await mockClient.getUserReserveData(user, 'YEI');
        const currentBalance = userData.currentATokenBalance;
        
        if (currentBalance.gt(maxBalance)) {
          maxBalance = currentBalance;
        }

        const rewards = await mockClient.calculateAccruedRewards(user, 'YEI');
        totalRewardsEarned = totalRewardsEarned.add(rewards);
        
        console.log(`Balance: ${fromDecimal18(currentBalance)} YEI`);
        console.log(`Current rewards: ${fromDecimal18(rewards)} YEI`);
        
        // Verify decimal precision throughout
        DecimalAssertions.expectDecimal18(currentBalance);
        DecimalAssertions.expectDecimal18(rewards);
      }

      console.log(`\nFinal statistics:`);
      console.log(`Maximum balance reached: ${fromDecimal18(maxBalance)} YEI`);
      console.log(`Total rewards earned: ${fromDecimal18(totalRewardsEarned)} YEI`);

      // Should have earned meaningful rewards
      expect(totalRewardsEarned.gt(BigNumber.from('0'))).toBe(true);
    });
  });
});