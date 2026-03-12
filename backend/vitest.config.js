import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    
    // Use forks pool for clean process isolation
    // This ensures each test file runs in a fresh Node.js process
    pool: 'forks',
    poolOptions: {
      forks: {
        execArgv: ['-r', 'dotenv/config'],
        // Single fork to prevent database contention
        singleFork: true,
      },
    },
    
    // Sequential execution prevents DB collisions
    // All test files share the same database
    fileParallelism: false,
    
    // Global setup for Docker orchestration and migrations
    globalSetup: './tests/global-setup.js',
    
    // Per-test setup for database cleanup
    setupFiles: ['./tests/setup.js'],
    
    // Test pattern - only run integration tests
    include: ['tests/integration/**/*.test.js'],
    
    // Reporters
    reporters: ['verbose'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        'scripts/',
        'migrations/',
        '**/*.config.js',
        'src/server.js', // Entry point with server startup
      ],
      include: [
        'src/**/*.js',
      ],
    },
    
    // Timeouts - generous for Docker operations
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    
    // Isolate tests - clean environment for each test
    isolate: true,
    
    // Max concurrency - 1 since we share a database
    maxConcurrency: 1,
  },
});
