import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from './mocks'
import { closeBrowser } from './browser'
import { mockStore } from './mock-store'
import { initializeMockData } from '../fixtures/mock-data'

// Setup MSW server
const server = setupServer(...handlers)

// Global test setup
beforeAll(() => {
  // Start MSW server
  server.listen({ onUnhandledRequest: 'warn' })
  
  // Initialize mock data
  initializeMockData()
})

afterAll(async () => {
  // Cleanup
  server.close()
  await closeBrowser()
})

beforeEach(() => {
  // Reset mock store state between tests (but keep initial data)
  // This ensures tests are isolated
  const currentUsers = mockStore.getAllUsers()
  const currentFamilies = mockStore.getAllFamilies()
  
  // Reset store
  mockStore.reset()
  
  // Re-initialize base data
  initializeMockData()
})

afterEach(() => {
  // Additional cleanup if needed
})

