# YEI Finance Test Suite

A comprehensive testing framework for YEI Finance integration with focus on decimal precision and reward calculations.

## 🎯 Overview

This test suite ensures the YEI Finance protocol maintains **18 decimal precision** for all reward calculations and provides accurate APR computations with proper Aave SDK integration.

## 📁 Directory Structure

```
test/yei/
├── unit/                           # Unit tests
│   ├── decimal-configuration.test.ts    # 18-decimal enforcement
│   ├── apr-calculations.test.ts         # APR calculation accuracy
│   └── reward-balance-calculations.test.ts # Balance tracking precision
├── integration/                    # Integration tests
│   ├── aave-sdk-integration.test.ts     # Aave protocol integration
│   └── full-workflow.test.ts            # End-to-end workflows
├── fixtures/                       # Test data and scenarios
│   └── test-scenarios.ts               # Predefined test scenarios
├── mocks/                          # Mock implementations
│   └── aave-sdk-mock.ts               # Mock Aave client
├── utils/                          # Testing utilities
│   └── decimal-utils.ts               # Decimal precision utilities
├── yei-finance-test-suite.ts       # Main test runner
└── README.md                       # This documentation
```

## 🔒 Critical Requirements

### 1. Decimal Precision
- **YEI tokens MUST use exactly 18 decimals**
- All reward calculations maintain 18-decimal precision
- No precision loss in mathematical operations
- Proper handling of very small and very large amounts

### 2. APR Calculations
- Accurate percentage calculations with proper rounding
- Time-based reward accrual with precise decimal handling
- Compound interest calculations with 18-decimal precision
- Consistent inverse relationship between APR and reward calculations

### 3. Balance Tracking
- Precise balance tracking across supply/withdraw operations
- Interest accrual with maintained decimal precision
- Multi-user concurrent operations without precision loss
- Overflow/underflow protection with proper error handling

## 🧪 Test Categories

### Unit Tests (Critical Foundation)

#### 1. Decimal Configuration Tests
```typescript
// Tests YEI token 18-decimal requirement
✓ Enforces 18 decimal precision for YEI token
✓ Validates decimal conversion accuracy  
✓ Handles edge cases with 18 decimal precision
✓ Detects invalid decimal configurations
✓ Maintains precision in mathematical operations
```

#### 2. APR Calculation Tests
```typescript
// Tests APR calculation accuracy
✓ Calculates APR correctly with 18 decimal precision
✓ Handles zero reward and zero principal cases
✓ Maintains precision with very small/large amounts
✓ Consistent inverse relationship (APR ↔ reward)
✓ Compound interest calculations with precision
```

#### 3. Reward Balance Tests
```typescript  
// Tests balance tracking precision
✓ Tracks aToken balances with 18 decimal precision
✓ Handles multiple supply operations accurately
✓ Tracks interest accrual accurately over time
✓ Prevents overdraft with precise validation
✓ Maintains consistency across operations
```

### Integration Tests (End-to-End Validation)

#### 4. Aave SDK Integration Tests
```typescript
// Tests full Aave protocol integration
✓ Completes supply-earn-withdraw cycle with correct decimals
✓ Handles multi-asset portfolio with correct decimal handling  
✓ Maintains precision across complex operations
✓ Handles concurrent users with different balance scales
✓ Maintains system integrity under load
```

#### 5. Full Workflow Tests
```typescript
// Tests complete workflows with realistic scenarios
✓ Decimal precision workflows
✓ APR calculation workflows  
✓ Portfolio management workflows
✓ Error handling workflows
✓ Real-world simulation workflows
✓ Stress test workflows (1000+ operations)
```

## 🚀 Running the Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Required dependencies for YEI Finance tests
npm install ethers vitest @types/node
```

### Run All Tests
```bash
# Run complete YEI Finance test suite
npx vitest test/yei/yei-finance-test-suite.ts

# Run with coverage
npx vitest test/yei/ --coverage

# Run in watch mode for development
npx vitest test/yei/ --watch
```

### Run Specific Test Categories
```bash
# Unit tests only
npx vitest test/yei/unit/

# Integration tests only  
npx vitest test/yei/integration/

# Specific test file
npx vitest test/yei/unit/decimal-configuration.test.ts
```

## 📊 Test Data Generation

The test suite includes comprehensive test data generators:

```typescript
// Generate test amounts with 18 decimal precision
const amounts = TestDataGenerator.generateTestAmounts();
// [0.000001, 1, 100, 1000, 10000, 1000000, 1000000000]

// Generate realistic APR scenarios
const aprs = TestDataGenerator.generateTestAPRs();  
// [0.01%, 1%, 5%, 10%, 25%, 50%, 100%]

// Generate edge case scenarios
const edgeCases = TestDataGenerator.generateEdgeCases();
// Minimum amounts, large principals, boundary conditions
```

## 🔍 Key Test Utilities

### Decimal Utilities
```typescript
// Convert to 18-decimal BigNumber
const amount = toDecimal18('1000.123456789012345678');

// Convert from 18-decimal to string
const readable = fromDecimal18(amount, 6); // "1000.123457"

// Validate 18-decimal precision
const isValid = validateDecimal18(amount); // true

// Calculate APR with precision
const apr = calculateAPR(principal, reward);

// Calculate rewards from APR
const reward = calculateReward(principal, apr);
```

### Assertion Helpers
```typescript
// Assert 18-decimal precision
DecimalAssertions.expectDecimal18(value);

// Assert approximate equality with tolerance
DecimalAssertions.expectApproxEqual(
  actual, expected, tolerance, message
);
```

## 🎭 Mock Implementations

### MockAaveClient Features
```typescript
const mockClient = new MockAaveClient();

// Supply/withdraw operations with decimal validation
await mockClient.supply(user, 'YEI', amount);
await mockClient.withdraw(user, 'YEI', amount);

// Time advancement for reward accrual testing
mockClient.advanceTime(seconds);

// Reward calculations with precise decimals
const rewards = await mockClient.calculateAccruedRewards(user, 'YEI', time);

// Portfolio-wide reward tracking
const totalRewards = await mockClient.getTotalRewards(user);

// YEI configuration validation
const validation = mockClient.validateYEIConfiguration();
```

## 📈 Test Scenarios

### Real-World Scenarios
- **DeFi Summer Simulation**: High APR periods with multiple users
- **Bear Market Stress**: Low APR with user withdrawals  
- **Whale vs Small User**: Different balance scales interaction
- **Portfolio Diversification**: Multi-asset decimal handling

### Stress Test Scenarios  
- **High Volume Operations**: 1000+ concurrent operations
- **Concurrent Users**: Multiple users with interleaved operations
- **Precision Edge Cases**: Very small and very large amounts
- **Time-based Accrual**: Long-term reward accumulation

### Error Scenarios
- **Insufficient Balance**: Overdraft prevention
- **Invalid Decimals**: Non-18 decimal configuration rejection
- **Precision Loss**: Mathematical operation validation
- **System Corruption**: Recovery from invalid states

## ⚠️ Critical Validations

### Pre-Test Validations
1. ✅ Decimal precision constant = 18
2. ✅ YEI token configuration valid (18 decimals)  
3. ✅ Decimal utilities functioning correctly
4. ✅ Test data generation working
5. ✅ Mock client initialization successful

### Post-Test Validations  
1. ✅ YEI configuration still valid
2. ✅ No precision loss detected
3. ✅ All decimal operations maintained accuracy
4. ✅ Balance consistency across all operations
5. ✅ Error handling worked as expected

## 📋 Test Coverage Requirements

### Unit Test Coverage
- **Decimal Configuration**: 100% - All decimal scenarios covered
- **APR Calculations**: 100% - All mathematical operations tested  
- **Balance Calculations**: 100% - All balance operations validated

### Integration Test Coverage
- **Aave SDK Integration**: 95% - Core integration flows covered
- **Full Workflows**: 90% - Major user scenarios tested
- **Error Handling**: 100% - All error conditions tested

### Overall Coverage Target: **95%+**

## 🔧 Configuration

### Vitest Configuration
```typescript
// vitest.config.ts for YEI Finance tests
export default {
  test: {
    testTimeout: 30000, // 30 seconds for complex calculations
    setupFiles: ['test/yei/setup.ts'],
    coverage: {
      reporter: ['text', 'html', 'lcov'],
      include: ['test/yei/**/*.ts'],
      exclude: ['test/yei/**/*.test.ts', 'test/yei/mocks/**']
    }
  }
};
```

## 🎯 Success Criteria

A successful test run must:

1. ✅ **All tests pass** (100% pass rate)
2. ✅ **18-decimal precision maintained** throughout all operations  
3. ✅ **APR calculations accurate** to within 0.000001% tolerance
4. ✅ **Balance tracking precise** to within 1 wei tolerance
5. ✅ **Aave SDK integration** functioning correctly
6. ✅ **Error handling robust** for all edge cases
7. ✅ **Performance acceptable** (<30s for full suite)
8. ✅ **No precision loss** detected in any operation

## 🚨 Failure Investigation

If tests fail:

1. **Check decimal precision**: Ensure all amounts use 18 decimals
2. **Verify YEI configuration**: Must be exactly 18 decimals
3. **Review calculations**: Check for precision loss in math operations  
4. **Validate mock behavior**: Ensure mocks maintain precision
5. **Check edge cases**: Verify boundary conditions handled correctly
6. **Review error messages**: Look for specific precision-related errors

## 📞 Support

For test-related issues:
- Check test logs for specific failure details
- Verify YEI token configuration (18 decimals required)
- Ensure proper decimal precision in all calculations
- Review mock implementations for accuracy
- Validate test data generation for edge cases

---

**Remember**: YEI Finance requires **exactly 18 decimal precision** for all reward calculations. Any deviation from this requirement will cause tests to fail and should be treated as a critical error.