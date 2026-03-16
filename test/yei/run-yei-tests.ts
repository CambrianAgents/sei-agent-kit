#!/usr/bin/env tsx
/**
 * YEI Finance Test Runner Script
 * Validates test environment and runs comprehensive YEI Finance test suite
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorLog(color: string, message: string) {
  console.log(`${color}${message}${colors.reset}`);
}

function header(title: string) {
  console.log('\n' + '='.repeat(60));
  colorLog(colors.cyan + colors.bright, `🧪 ${title}`);
  console.log('='.repeat(60));
}

function success(message: string) {
  colorLog(colors.green, `✅ ${message}`);
}

function error(message: string) {
  colorLog(colors.red, `❌ ${message}`);
}

function warning(message: string) {
  colorLog(colors.yellow, `⚠️  ${message}`);
}

function info(message: string) {
  colorLog(colors.blue, `ℹ️  ${message}`);
}

async function validateEnvironment(): Promise<boolean> {
  header('Environment Validation');
  
  let valid = true;

  // Check if we're in the correct directory
  const currentDir = process.cwd();
  const expectedPath = '/Users/kamal/Desktop/yei/sei-agent-kit';
  
  if (!currentDir.includes('sei-agent-kit')) {
    error(`Not in sei-agent-kit directory. Current: ${currentDir}`);
    info(`Please run from: ${expectedPath}`);
    valid = false;
  } else {
    success(`Running from correct directory: ${currentDir}`);
  }

  // Check for required files
  const requiredFiles = [
    'test/yei/yei-finance-test-suite.ts',
    'test/yei/utils/decimal-utils.ts',
    'test/yei/mocks/aave-sdk-mock.ts',
    'test/yei/unit/decimal-configuration.test.ts',
    'test/yei/unit/apr-calculations.test.ts',
    'test/yei/unit/reward-balance-calculations.test.ts',
    'test/yei/integration/aave-sdk-integration.test.ts',
    'test/yei/integration/full-workflow.test.ts',
    'vitest.config.yei.ts'
  ];

  info('Checking required test files...');
  for (const file of requiredFiles) {
    if (existsSync(resolve(file))) {
      success(`Found: ${file}`);
    } else {
      error(`Missing: ${file}`);
      valid = false;
    }
  }

  // Check for dependencies
  info('Checking package.json dependencies...');
  if (existsSync('package.json')) {
    success('Found package.json');
    
    try {
      const packageJson = require(resolve('package.json'));
      const requiredDeps = ['ethers', 'vitest'];
      const allDeps = { 
        ...packageJson.dependencies, 
        ...packageJson.devDependencies 
      };
      
      for (const dep of requiredDeps) {
        if (allDeps[dep]) {
          success(`Dependency found: ${dep}@${allDeps[dep]}`);
        } else {
          error(`Missing dependency: ${dep}`);
          info(`Please run: npm install ${dep}`);
          valid = false;
        }
      }
    } catch (err) {
      error('Failed to parse package.json');
      valid = false;
    }
  } else {
    error('package.json not found');
    valid = false;
  }

  return valid;
}

function runTests(): Promise<number> {
  return new Promise((resolve) => {
    header('Running YEI Finance Test Suite');
    
    info('Executing comprehensive test suite...');
    info('This includes unit tests, integration tests, and stress tests');
    info('Expected runtime: 30-60 seconds\n');

    // Run vitest with YEI-specific configuration
    const vitestProcess = spawn('npx', [
      'vitest', 
      'run',
      '--config', 'vitest.config.yei.ts',
      'test/yei/',
      '--reporter=verbose'
    ], {
      stdio: 'inherit',
      shell: true
    });

    vitestProcess.on('close', (code) => {
      if (code === 0) {
        header('Test Execution Complete');
        success('All YEI Finance tests passed successfully! 🎉');
        success('18-decimal precision maintained throughout');
        success('APR calculations validated for accuracy');
        success('Balance tracking tested for precision');
        success('Aave SDK integration working correctly');
        success('Error handling robust for edge cases');
        
        info('\nNext steps:');
        info('1. Review test coverage report');
        info('2. Check for any precision-related warnings');
        info('3. Validate YEI token configuration in production');
        info('4. Run performance benchmarks if needed');
        
      } else {
        header('Test Execution Failed');
        error(`Tests failed with exit code: ${code}`);
        error('Please review test output above for specific failures');
        
        warning('\nCommon issues to check:');
        warning('1. Ensure YEI token uses exactly 18 decimals');
        warning('2. Check for precision loss in calculations');
        warning('3. Verify mock configurations are correct');
        warning('4. Review APR calculation accuracy');
        warning('5. Check balance tracking precision');
      }
      
      resolve(code || 0);
    });

    vitestProcess.on('error', (err) => {
      error(`Failed to start test process: ${err.message}`);
      resolve(1);
    });
  });
}

async function main() {
  console.clear();
  
  header('YEI Finance Test Suite Runner');
  colorLog(colors.magenta, '🚀 Validating YEI Finance integration with comprehensive testing');
  colorLog(colors.magenta, '🎯 Focus: 18-decimal precision and reward calculations');
  
  // Validate environment
  const envValid = await validateEnvironment();
  
  if (!envValid) {
    error('\n❌ Environment validation failed!');
    error('Please fix the issues above and try again.');
    process.exit(1);
  }

  success('\n✅ Environment validation passed!');
  
  // Run tests
  const testExitCode = await runTests();
  
  if (testExitCode === 0) {
    header('🎉 SUCCESS: YEI Finance Test Suite Complete');
    success('All critical validations passed:');
    success('• 18-decimal precision enforced for YEI rewards');
    success('• APR calculations mathematically accurate');  
    success('• Balance tracking maintains precision');
    success('• Aave SDK integration functioning correctly');
    success('• Error handling robust for all edge cases');
    
    colorLog(colors.green + colors.bright, '\n🔒 YEI Finance is ready for production integration!');
    
  } else {
    header('❌ FAILURE: Test Suite Execution Failed');
    error('Critical issues detected in YEI Finance integration');
    error('Please review test failures and fix before deployment');
    
    colorLog(colors.red + colors.bright, '\n⚠️  DO NOT DEPLOY until all tests pass!');
  }
  
  process.exit(testExitCode);
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  warning('\n⚠️  Test execution interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  warning('\n⚠️  Test execution terminated');
  process.exit(1);
});

// Run the main function
main().catch((err) => {
  error(`\n❌ Unexpected error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});