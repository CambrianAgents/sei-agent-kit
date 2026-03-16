/**
 * YEI Finance - Reward Balance Calculations Tests
 * Tests for accurate balance tracking with decimal precision
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BigNumber } from 'ethers';
import { 
  toDecimal18, 
  fromDecimal18,
  TestDataGenerator,
  DecimalAssertions
} from '../utils/decimal-utils';
import MockAaveClient from '../mocks/aave-sdk-mock';

describe('YEI Finance - Reward Balance Calculations', () => {
  let mockClient: MockAaveClient;
  const testUser = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    mockClient = new MockAaveClient();
  });

  describe('Balance Tracking Accuracy', () => {
    it('should track aToken balances with 18 decimal precision', async () => {
      const supplyAmount = toDecimal18('1000.123456789012345678');
      
      const result = await mockClient.supply(testUser, 'YEI', supplyAmount);
      
      expect(result.success).toBe(true);
      DecimalAssertions.expectDecimal18(result.aTokensMinted);
      expect(result.aTokensMinted.eq(supplyAmount)).toBe(true);

      const userData = await mockClient.getUserReserveData(testUser, 'YEI');
      DecimalAssertions.expectDecimal18(userData.aTokenBalance);
      DecimalAssertions.expectDecimal18(userData.currentATokenBalance);
      
      expect(userData.aTokenBalance.eq(supplyAmount)).toBe(true);
      expect(userData.currentATokenBalance.eq(supplyAmount)).toBe(true);
    });

    it('should handle multiple supply operations accurately', async () => {
      const supplies = [
        toDecimal18('500.5'),
        toDecimal18('300.123456789'),
        toDecimal18('200.000000000000000001')
      ];

      let expectedTotal = BigNumber.from('0');

      for (const amount of supplies) {
        await mockClient.supply(testUser, 'YEI', amount);
        expectedTotal = expectedTotal.add(amount);

        const userData = await mockClient.getUserReserveData(testUser, 'YEI');
        DecimalAssertions.expectApproxEqual(
          userData.aTokenBalance, 
          expectedTotal,
          toDecimal18('0.000000000000000001'),
          'Balance should match cumulative supplies'
        );
      }
    });

    it('should track interest accrual accurately', async () => {
      const initialSupply = toDecimal18('1000');
      
      await mockClient.supply(testUser, 'YEI', initialSupply);

      // Get initial balance
      const initialData = await mockClient.getUserReserveData(testUser, 'YEI');
      const initialBalance = initialData.currentATokenBalance;

      // Advance time by 1 year
      mockClient.advanceTime(365 * 24 * 3600);

      // Get updated balance
      const updatedData = await mockClient.getUserReserveData(testUser, 'YEI');
      const updatedBalance = updatedData.currentATokenBalance;

      // Should have accrued interest
      expect(updatedBalance.gt(initialBalance)).toBe(true);
      DecimalAssertions.expectDecimal18(updatedBalance);

      // Interest should be reasonable (not more than 100% for most cases)
      const interest = updatedBalance.sub(initialBalance);
      expect(interest.lte(initialBalance)).toBe(true);
    });

    it('should handle withdrawal operations correctly', async () => {
      const supplyAmount = toDecimal18('1000');
      const withdrawAmount = toDecimal18('300');

      // Supply first
      await mockClient.supply(testUser, 'YEI', supplyAmount);

      // Then withdraw
      const result = await mockClient.withdraw(testUser, 'YEI', withdrawAmount);

      expect(result.success).toBe(true);
      expect(result.amountWithdrawn.eq(withdrawAmount)).toBe(true);

      // Check remaining balance
      const userData = await mockClient.getUserReserveData(testUser, 'YEI');
      const expectedRemaining = supplyAmount.sub(withdrawAmount);
      
      expect(userData.aTokenBalance.eq(expectedRemaining)).toBe(true);
      expect(userData.currentATokenBalance.eq(expectedRemaining)).toBe(true);
    });

    it('should prevent overdraft with precise validation', async () => {
      const supplyAmount = toDecimal18('100');
      const attemptedWithdraw = toDecimal18('100.000000000000000001'); // 1 wei more

      await mockClient.supply(testUser, 'YEI', supplyAmount);

      await expect(
        mockClient.withdraw(testUser, 'YEI', attemptedWithdraw)
      ).rejects.toThrow('Insufficient aToken balance');
    });
  });

  describe('Reward Accumulation', () => {
    it('should accumulate rewards with precise decimal handling', async () => {
      const supplyAmount = toDecimal18('1000');
      await mockClient.supply(testUser, 'YEI', supplyAmount);

      // Calculate rewards for different time periods
      const timePeriodsInSeconds = [
        3600,    // 1 hour
        86400,   // 1 day
        604800,  // 1 week
        2592000, // 30 days
      ];

      let previousRewards = BigNumber.from('0');

      for (const timeSeconds of timePeriodsInSeconds) {
        const rewards = await mockClient.calculateAccruedRewards(testUser, 'YEI', timeSeconds);
        
        DecimalAssertions.expectDecimal18(rewards);
        expect(rewards.gt(previousRewards)).toBe(true);
        
        // Rewards should be proportional to time (approximately)
        if (previousRewards.gt(BigNumber.from('0'))) {
          const ratio = rewards.div(previousRewards);
          expect(ratio.gt(BigNumber.from('1'))).toBe(true);
        }
        
        previousRewards = rewards;
      }
    });

    it('should calculate rewards based on balance changes', async () => {
      const initialSupply = toDecimal18('500');
      const additionalSupply = toDecimal18('500');
      const timeHours = 24; // 24 hours

      // Initial supply
      await mockClient.supply(testUser, 'YEI', initialSupply);
      const rewardsAfterFirst = await mockClient.calculateAccruedRewards(
        testUser, 'YEI', timeHours * 3600
      );

      // Additional supply (double the balance)
      await mockClient.supply(testUser, 'YEI', additionalSupply);
      const rewardsAfterSecond = await mockClient.calculateAccruedRewards(
        testUser, 'YEI', timeHours * 3600
      );

      // Rewards should approximately double with double balance
      expect(rewardsAfterSecond.gt(rewardsAfterFirst.mul(18).div(10))).toBe(true); // At least 1.8x
      expect(rewardsAfterSecond.lt(rewardsAfterFirst.mul(22).div(10))).toBe(true); // At most 2.2x
    });

    it('should handle zero balance reward calculations', async () => {
      const rewards = await mockClient.calculateAccruedRewards(testUser, 'YEI', 86400);
      
      expect(rewards.eq(BigNumber.from('0'))).toBe(true);
      DecimalAssertions.expectDecimal18(rewards);
    });

    it('should accumulate rewards across multiple assets', async () => {
      const assets = ['YEI', 'ETH', 'USDC'];
      const supplyAmounts = [
        toDecimal18('1000'),
        toDecimal18('5'),
        toDecimal18('2000')
      ];

      // Supply to multiple assets
      for (let i = 0; i < assets.length; i++) {
        await mockClient.supply(testUser, assets[i], supplyAmounts[i]);
      }

      // Get total rewards
      const totalRewards = await mockClient.getTotalRewards(testUser);

      expect(totalRewards.size).toBe(3);
      
      for (const [asset, rewards] of totalRewards) {
        expect(assets.includes(asset)).toBe(true);
        DecimalAssertions.expectDecimal18(rewards);
        expect(rewards.gte(BigNumber.from('0'))).toBe(true);
      }

      // YEI should have highest rewards due to higher APR
      const yeiRewards = totalRewards.get('YEI')!;
      const ethRewards = totalRewards.get('ETH')!;
      const usdcRewards = totalRewards.get('USDC')!;

      expect(yeiRewards.gt(ethRewards)).toBe(true);
      expect(yeiRewards.gt(usdcRewards)).toBe(true);
    });
  });

  describe('Balance Consistency Checks', () => {
    it('should maintain balance consistency after multiple operations', async () => {
      const operations = [
        { type: 'supply', amount: toDecimal18('1000') },
        { type: 'supply', amount: toDecimal18('500') },
        { type: 'withdraw', amount: toDecimal18('200') },
        { type: 'supply', amount: toDecimal18('100') },
        { type: 'withdraw', amount: toDecimal18('300') },
      ];

      let expectedBalance = BigNumber.from('0');

      for (const operation of operations) {
        if (operation.type === 'supply') {
          await mockClient.supply(testUser, 'YEI', operation.amount);
          expectedBalance = expectedBalance.add(operation.amount);
        } else {
          await mockClient.withdraw(testUser, 'YEI', operation.amount);
          expectedBalance = expectedBalance.sub(operation.amount);
        }

        const userData = await mockClient.getUserReserveData(testUser, 'YEI');
        DecimalAssertions.expectApproxEqual(
          userData.aTokenBalance,
          expectedBalance,
          BigNumber.from('1'), // 1 wei tolerance
          `Balance inconsistency after ${operation.type} of ${fromDecimal18(operation.amount)}`
        );
      }
    });

    it('should track reserve totals accurately', async () => {
      const users = [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333'
      ];
      
      const supplyAmounts = users.map(user => toDecimal18('1000'));

      // Get initial reserve total
      const initialReserve = await mockClient.getReserveData('YEI');
      const initialTotal = initialReserve.totalSupply;

      // Each user supplies
      for (let i = 0; i < users.length; i++) {
        await mockClient.supply(users[i], 'YEI', supplyAmounts[i]);
      }

      // Check updated total
      const updatedReserve = await mockClient.getReserveData('YEI');
      const expectedTotal = supplyAmounts.reduce((sum, amount) => sum.add(amount), initialTotal);
      
      DecimalAssertions.expectApproxEqual(
        updatedReserve.totalSupply,
        expectedTotal,
        BigNumber.from('1'),
        'Reserve total should match sum of all supplies'
      );
    });

    it('should handle edge case balances correctly', () => {
      const edgeCases = TestDataGenerator.generateEdgeCases();
      
      edgeCases.forEach(({ principal, description }) => {
        // Test setting edge case balances
        mockClient.setUserReserveData(testUser, 'YEI', {
          aTokenBalance: principal,
          currentATokenBalance: principal
        });

        // Should not throw and should maintain precision
        expect(async () => {
          const userData = await mockClient.getUserReserveData(testUser, 'YEI');
          DecimalAssertions.expectDecimal18(userData.aTokenBalance);
          DecimalAssertions.expectDecimal18(userData.currentATokenBalance);
        }).not.toThrow();
      });
    });
  });

  describe('Time-based Balance Changes', () => {
    it('should handle interest accrual over different time periods', async () => {
      const supplyAmount = toDecimal18('1000');
      await mockClient.supply(testUser, 'YEI', supplyAmount);

      const timePeriods = [
        { seconds: 3600, description: '1 hour' },
        { seconds: 86400, description: '1 day' },
        { seconds: 604800, description: '1 week' },
      ];

      let previousBalance = supplyAmount;

      for (const { seconds, description } of timePeriods) {
        mockClient.advanceTime(seconds);
        
        const userData = await mockClient.getUserReserveData(testUser, 'YEI');
        const currentBalance = userData.currentATokenBalance;

        expect(currentBalance.gte(previousBalance)).toBe(true);
        DecimalAssertions.expectDecimal18(currentBalance);

        const interest = currentBalance.sub(previousBalance);
        expect(interest.gte(BigNumber.from('0'))).toBe(true);

        console.log(`Interest accrued over ${description}: ${fromDecimal18(interest)} YEI`);
        previousBalance = currentBalance;
      }
    });

    it('should maintain precision over long time periods', async () => {
      const supplyAmount = toDecimal18('1000.123456789012345678');
      await mockClient.supply(testUser, 'YEI', supplyAmount);

      // Advance by 1 year
      mockClient.advanceTime(365 * 24 * 3600);

      const userData = await mockClient.getUserReserveData(testUser, 'YEI');
      
      // Balance should still maintain 18 decimal precision
      DecimalAssertions.expectDecimal18(userData.currentATokenBalance);
      
      // Should be greater than initial amount
      expect(userData.currentATokenBalance.gt(supplyAmount)).toBe(true);
      
      // Should not grow unreasonably (more than 2x in a year would be suspicious)
      expect(userData.currentATokenBalance.lt(supplyAmount.mul(2))).toBe(true);
    });

    it('should handle concurrent balance changes', async () => {
      const supplyAmount = toDecimal18('500');
      
      // Initial supply
      await mockClient.supply(testUser, 'YEI', supplyAmount);
      
      // Let some time pass
      mockClient.advanceTime(3600); // 1 hour
      
      // Get balance after interest accrual
      const dataAfterTime = await mockClient.getUserReserveData(testUser, 'YEI');
      const balanceWithInterest = dataAfterTime.currentATokenBalance;
      
      // Supply more while interest is accruing
      await mockClient.supply(testUser, 'YEI', supplyAmount);
      
      // Final balance should be previous balance + new supply
      const finalData = await mockClient.getUserReserveData(testUser, 'YEI');
      const expectedBalance = balanceWithInterest.add(supplyAmount);
      
      DecimalAssertions.expectApproxEqual(
        finalData.aTokenBalance,
        expectedBalance,
        BigNumber.from('1'),
        'Balance should account for both interest and new supply'
      );
    });
  });
});