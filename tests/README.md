# Firefly Integration Test Suite

Comprehensive integration test suite for the Firefly platform using Puppeteer and Vitest.

## Overview

This test suite provides:
- End-to-end browser testing with Puppeteer
- Mocked external services (Clerk, database) using MSW
- Test dashboard UI for viewing and running tests
- Comprehensive coverage of all 79 pages across 3 user roles

## Setup

1. Install dependencies:
```bash
cd tests
npm install
```

2. Install dashboard dependencies:
```bash
cd dashboard
npm install
```

3. Configure environment (optional):
```bash
cp .env.example .env
# Edit .env with your settings
```

## Running Tests

**Important**: Before running integration tests, start the Next.js app in test mode:

```bash
# From the project root
INTEGRATION_TEST_MODE=true npm run dev
```

The app will be available at `http://localhost:3000` with test mode enabled, which allows mock authentication to bypass Clerk validation.

### Run all tests:
```bash
npm test
```

### Run tests in watch mode:
```bash
npm run test:watch
```

### Run tests with UI:
```bash
npm run test:ui
```

### Run tests in headed mode (see browser):
```bash
npm run test:headed
```

### Run specific test file:
```bash
npm test -- src/tests/auth/sign-in.test.ts
```

## Test Dashboard

Start the dashboard:
```bash
cd dashboard
npm run dev
```

The dashboard will be available at `http://localhost:3001`

## Test Structure

- `src/setup/` - Test infrastructure (browser, mocks, auth)
- `src/fixtures/` - Test data and fixtures
- `src/helpers/` - Page and API interaction helpers
- `src/tests/` - Test files organized by feature
- `src/utils/` - Test runner and result storage
- `dashboard/` - Next.js dashboard app
- `results/` - Test execution results (git-ignored)

## Mock Services

All external services are mocked:
- **Clerk Authentication**: Mock session tokens and user metadata
- **Database**: In-memory data store with CRUD operations
- **API Endpoints**: MSW handlers for all API routes

## Writing Tests

Example test:
```typescript
import { describe, it, expect } from 'vitest'
import { createPage } from '../../setup/browser'
import { navigateTo, waitForText } from '../../helpers/page-helpers'
import { authenticateAs } from '../../setup/auth'
import { UserRole } from '@prisma/client'

describe('My Feature', () => {
  it('should do something', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.ADMIN)
      await navigateTo(page, '/admin/my-page', UserRole.ADMIN)
      await waitForText(page, 'Expected Text', 10000)
      // Assertions...
    } finally {
      await page.close()
    }
  }, 30000)
})
```

## Environment Variables

- `TEST_BASE_URL` - Base URL for test app (default: http://localhost:3000)
- `HEADLESS` - Browser headless mode (default: true)
- `MOCK_DATA_PATH` - Optional path to custom mock data JSON file

## Test Coverage

The suite covers:
- Authentication & routing (3 pages)
- Admin dashboard (30 pages)
- Volunteer dashboard (26 pages)
- Member dashboard (20 pages)
- Settings (1 page)

Total: 79 pages across all user roles.

## Results

Test results are stored in `results/` directory:
- Individual test results: `{testId}.json`
- Test suite results: `suite_{suiteId}.json`
- Screenshots: `results/screenshots/`

## Troubleshooting

### Tests fail to connect to app
- Ensure the main Firefly app is running on `http://localhost:3000`
- Check `TEST_BASE_URL` environment variable

### Browser doesn't launch
- Install Chromium dependencies: `sudo apt-get install -y chromium-browser` (Linux)
- Or set `HEADLESS=false` to see what's happening

### Mock data not working
- Check that `initializeMockData()` is called in test setup
- Verify MSW handlers are properly registered

## Security Notes

- **Puppeteer**: Updated to v24.15.0+ (resolves high-severity vulnerabilities)
- **@mswjs/data**: Removed (package deprecated, not needed)
- **Remaining vulnerabilities**: 5 moderate severity issues in Vitest's dev dependencies (esbuild/vite). These only affect the development server and are acceptable for a test environment. To resolve, upgrade to Vitest 4.x (breaking changes).

