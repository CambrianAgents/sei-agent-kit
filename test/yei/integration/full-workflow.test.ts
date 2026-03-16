/**
 * YEI Finance - Full Workflow Integration Tests
 * Complete end-to-end workflow testing with all YEI Finance features
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BigNumber } from 'ethers';
import { 
  toDecimal18, 
  fromDecimal18,
  DecimalAssertions
} from '../utils/decimal-utils';
import MockAaveClient from '../mocks/aave-sdk-mock';
import { 
  TEST_USERS, 
  TEST_ASSETS,
  DECIMAL_TEST_SCENARIOS,
  APR_TEST_SCENARIOS,
  PORTFOLIO_TEST_SCENARIOS,
  ERROR_TEST_SCENARIOS,
  REAL_WORLD_SCENARIOS,
  generateStressTestOperations,
  type TestScenario
} from '../fixtures/test-scenarios';

describe('YEI Finance - Full Workflow Integration', () => {
  let mockClient: MockAaveClient;

  beforeEach(() => {
    mockClient = new MockAaveClient();
  });

  describe('Decimal Precision Workflows', () => {
    DECIMAL_TEST_SCENARIOS.forEach((scenario) => {
      it(`should handle ${scenario.name}`, async () => {
        // Execute scenario operations
        for (const operation of scenario.setup.operations) {
          if (operation.type === 'supply') {
            const result = await mockClient.supply(
              operation.user, 
              operation.asset, 
              operation.amount
            );
            
            expect(result.success).toBe(operation.expectedSuccess);
            
            if (result.success) {
              DecimalAssertions.expectDecimal18(result.aTokensMinted);
            }
          }
        }

        // Verify expected outcomes
        if (scenario.expected.finalBalances) {
          for (const [user, expectedBalance] of scenario.expected.finalBalances) {
            const asset = scenario.setup.operations[0].asset;
            const userData = await mockClient.getUserReserveData(user, asset);
            
            DecimalAssertions.expectApproxEqual(
              userData.aTokenBalance,
              expectedBalance,
              BigNumber.from('1'),
              `${scenario.description}: Balance mismatch for user ${user}`
            );
          }
        }

        console.log(`✓ Completed: ${scenario.description}`);
      });
    });
  });

  describe('APR Calculation Workflows', () => {
    APR_TEST_SCENARIOS.forEach((scenario) => {
      it(`should handle ${scenario.name}`, async () => {
        // Execute operations
        for (const operation of scenario.setup.operations) {
          if (operation.type === 'supply') {
            await mockClient.supply(operation.user, operation.asset, operation.amount);
          }
        }

        // Advance time if specified
        if (scenario.setup.timeAdvances) {
          for (const timeAdvance of scenario.setup.timeAdvances) {
            mockClient.advanceTime(timeAdvance);
            
            // Check rewards at each time point
            for (const operation of scenario.setup.operations) {
              if (operation.type === 'supply') {
                const rewards = await mockClient.calculateAccruedRewards(
                  operation.user, 
                  operation.asset, 
                  timeAdvance
                );
                
                DecimalAssertions.expectDecimal18(rewards);
                expect(rewards.gte(BigNumber.from('0'))).toBe(true);
                
                console.log(`Rewards after ${timeAdvance}s: ${fromDecimal18(rewards)} ${operation.asset}`);
              }
            }
          }
        }

        // Verify APR ranges if specified
        if (scenario.expected.aprRanges) {
          for (const [asset, range] of scenario.expected.aprRanges) {
            const reserveData = await mockClient.getReserveData(asset);
            const actualAPR = reserveData.liquidityRate;
            
            expect(actualAPR.gte(range.min)).toBe(true);
            expect(actualAPR.lte(range.max)).toBe(true);
          }
        }

        console.log(`✓ Completed: ${scenario.description}`);
      });
    });
  });

  describe('Portfolio Management Workflows', () => {
    PORTFOLIO_TEST_SCENARIOS.forEach((scenario) => {
      it(`should handle ${scenario.name}`, async () => {
        // Execute all operations
        for (const operation of scenario.setup.operations) {
          await mockClient.supply(operation.user, operation.asset, operation.amount);
        }

        // Advance time for reward accrual
        if (scenario.setup.timeAdvances) {
          for (const timeAdvance of scenario.setup.timeAdvances) {
            mockClient.advanceTime(timeAdvance);
          }
        }

        // Check portfolio rewards
        const user = scenario.setup.users[0];
        const totalRewards = await mockClient.getTotalRewards(user.address);

        expect(totalRewards.size).toBeGreaterThan(0);

        let totalPortfolioValue = BigNumber.from('0');
        for (const [asset, rewards] of totalRewards) {
          DecimalAssertions.expectDecimal18(rewards);
          expect(rewards.gt(BigNumber.from('0'))).toBe(true);
          totalPortfolioValue = totalPortfolioValue.add(rewards);
          
          console.log(`${asset} rewards: ${fromDecimal18(rewards)}`);
        }

        console.log(`Total portfolio rewards: ${fromDecimal18(totalPortfolioValue)}`);
        
        // Verify expected reward ranges
        if (scenario.expected.totalRewards) {
          for (const [asset, expectedReward] of scenario.expected.totalRewards) {
            const actualReward = totalRewards.get(asset);
            expect(actualReward).toBeDefined();
            
            if (actualReward) {
              // Allow 10% tolerance for time-based calculations
              const tolerance = expectedReward.div(10);
              DecimalAssertions.expectApproxEqual(
                actualReward,
                expectedReward,
                tolerance,
                `${asset} rewards should match expected value`
              );
            }
          }
        }

        console.log(`✓ Completed: ${scenario.description}`);
      });
    });
  });

  describe('Error Handling Workflows', () => {
    ERROR_TEST_SCENARIOS.forEach((scenario) => {
      it(`should handle ${scenario.name}`, async () => {
        let encounteredErrors: string[] = [];

        // Execute operations and collect errors
        for (const operation of scenario.setup.operations) {
          try {
            if (operation.type === 'supply') {
              const result = await mockClient.supply(
                operation.user, 
                operation.asset, 
                operation.amount
              );
              
              if (!operation.expectedSuccess) {
                // Should have thrown an error but didn't
                expect(result.success).toBe(false);
              }
              
            } else if (operation.type === 'withdraw') {
              await mockClient.withdraw(operation.user, operation.asset, operation.amount);
              
              if (!operation.expectedSuccess) {
                throw new Error('Expected withdrawal to fail but it succeeded');
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            encounteredErrors.push(errorMessage);
            
            if (operation.expectedError) {
              expect(errorMessage).toContain(operation.expectedError);
            }
          }
        }

        // Verify expected errors occurred
        if (scenario.expected.errors) {
          for (const expectedError of scenario.expected.errors) {
            const foundError = encounteredErrors.some(error => error.includes(expectedError));
            expect(foundError).toBe(true);
          }
        }

        console.log(`✓ Completed: ${scenario.description}`);
      });
    });
  });

  describe('Real-world Simulation Workflows', () => {
    REAL_WORLD_SCENARIOS.forEach((scenario) => {
      it(`should handle ${scenario.name}`, async () => {
        // Setup custom asset configurations if needed
        for (const asset of scenario.setup.assets) {
          if (asset.symbol === 'YEI') {
            mockClient.setReserveData('YEI', {
              decimals: asset.decimals,
              liquidityRate: asset.liquidityRate,
              variableBorrowRate: asset.borrowRate
            });
          }
        }

        // Execute operations
        let totalSupplied = BigNumber.from('0');
        for (const operation of scenario.setup.operations) {
          if (operation.type === 'supply') {
            await mockClient.supply(operation.user, operation.asset, operation.amount);
            totalSupplied = totalSupplied.add(operation.amount);
          }
        }

        // Advance time for reward accrual
        if (scenario.setup.timeAdvances) {
          for (const timeAdvance of scenario.setup.timeAdvances) {
            mockClient.advanceTime(timeAdvance);
          }
        }

        // Analyze results
        let totalRewardsEarned = BigNumber.from('0');
        let userCount = 0;
        
        for (const user of scenario.setup.users) {
          const userRewards = await mockClient.getTotalRewards(user.address);
          
          if (userRewards.size > 0) {
            userCount++;
            for (const [asset, rewards] of userRewards) {
              totalRewardsEarned = totalRewardsEarned.add(rewards);
              console.log(`User ${user.description}: ${fromDecimal18(rewards)} ${asset} rewards`);
            }
          }
        }

        console.log(`\nScenario Summary:`);
        console.log(`Active users: ${userCount}`);
        console.log(`Total supplied: ${fromDecimal18(totalSupplied)} tokens`);
        console.log(`Total rewards earned: ${fromDecimal18(totalRewardsEarned)} tokens`);

        if (totalSupplied.gt(BigNumber.from('0'))) {
          const rewardRate = totalRewardsEarned.mul(toDecimal18('100')).div(totalSupplied);
          console.log(`Effective reward rate: ${fromDecimal18(rewardRate)}%`);
        }

        console.log(`✓ Completed: ${scenario.description}`);
      });
    });
  });

  describe('Stress Test Workflows', () => {
    it('should handle high volume operations', async () => {
      const operationCount = 1000;
      const operations = generateStressTestOperations(
        TEST_USERS.slice(0, 2), // Use 2 users
        [TEST_ASSETS[0]], // YEI only
        operationCount
      );

      let successCount = 0;
      let errorCount = 0;
      const userBalances = new Map<string, BigNumber>();

      console.log(`\nExecuting ${operationCount} operations...`);

      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        
        try {
          if (operation.type === 'supply') {
            const result = await mockClient.supply(
              operation.user, 
              operation.asset, 
              operation.amount
            );
            
            if (result.success) {
              successCount++;
              const currentBalance = userBalances.get(operation.user) || BigNumber.from('0');
              userBalances.set(operation.user, currentBalance.add(operation.amount));
            }
            
          } else if (operation.type === 'withdraw') {
            const userData = await mockClient.getUserReserveData(operation.user, operation.asset);
            
            if (userData.aTokenBalance.gte(operation.amount)) {
              await mockClient.withdraw(operation.user, operation.asset, operation.amount);
              successCount++;
              
              const currentBalance = userBalances.get(operation.user) || BigNumber.from('0');
              userBalances.set(operation.user, currentBalance.sub(operation.amount));
            } else {
              errorCount++; // Expected error - insufficient balance
            }
          }

          // Periodic time advances
          if (i % 100 === 0) {
            mockClient.advanceTime(3600); // 1 hour
          }

          // Periodic validation
          if (i % 250 === 0) {
            const validation = mockClient.validateYEIConfiguration();
            expect(validation.valid).toBe(true);
          }

        } catch (error) {
          errorCount++;
        }
      }

      console.log(`Operations completed:`);
      console.log(`- Successful: ${successCount}`);
      console.log(`- Errors (expected): ${errorCount}`);
      console.log(`- Success rate: ${(successCount / operationCount * 100).toFixed(2)}%`);

      // Final validation
      const finalValidation = mockClient.validateYEIConfiguration();
      expect(finalValidation.valid).toBe(true);

      // Check final balances
      for (const [user, expectedBalance] of userBalances) {
        const userData = await mockClient.getUserReserveData(user, 'YEI');
        DecimalAssertions.expectDecimal18(userData.aTokenBalance);
        
        console.log(`Final balance for ${user}: ${fromDecimal18(userData.aTokenBalance)}`);
      }

      expect(successCount).toBeGreaterThan(operationCount * 0.7); // At least 70% success rate
    });

    it('should maintain system integrity under concurrent operations', async () => {
      const numConcurrentUsers = 4;
      const operationsPerUser = 100;
      
      // Simulate concurrent operations by interleaving user operations
      for (let round = 0; round < operationsPerUser; round++) {
        for (let userIndex = 0; userIndex < numConcurrentUsers; userIndex++) {
          const user = TEST_USERS[userIndex % TEST_USERS.length];
          const amount = toDecimal18((round + 1) * 10); // Varying amounts
          
          try {
            if (round % 3 === 0) {
              // Supply
              await mockClient.supply(user.address, 'YEI', amount);
            } else if (round % 3 === 1) {
              // Try to withdraw (may fail if insufficient balance)
              const userData = await mockClient.getUserReserveData(user.address, 'YEI');
              if (userData.aTokenBalance.gte(amount.div(2))) {
                await mockClient.withdraw(user.address, 'YEI', amount.div(2));
              }
            } else {
              // Time advance
              mockClient.advanceTime(60); // 1 minute
            }
            
          } catch (error) {
            // Expected errors are fine (e.g., insufficient balance)
          }
        }

        // Periodic system validation
        if (round % 25 === 0) {
          const validation = mockClient.validateYEIConfiguration();
          expect(validation.valid).toBe(true);
          
          // Check reserve consistency
          const reserveData = await mockClient.getReserveData('YEI');
          DecimalAssertions.expectDecimal18(reserveData.totalSupply);
          expect(reserveData.totalSupply.gte(BigNumber.from('0'))).toBe(true);
        }
      }

      console.log(`✓ Completed concurrent operations test`);
      
      // Final comprehensive validation
      const finalValidation = mockClient.validateYEIConfiguration();
      expect(finalValidation.valid).toBe(true);

      // Generate final report
      console.log(`\nFinal System State:`);
      const reserveData = await mockClient.getReserveData('YEI');
      console.log(`Total supply: ${fromDecimal18(reserveData.totalSupply)} YEI`);
      
      for (let i = 0; i < numConcurrentUsers; i++) {
        const user = TEST_USERS[i];
        const userData = await mockClient.getUserReserveData(user.address, 'YEI');
        console.log(`${user.description}: ${fromDecimal18(userData.aTokenBalance)} YEI`);
      }
    });
  });
});