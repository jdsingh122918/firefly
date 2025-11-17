import { mockStore, type MockFamily } from '../setup/mock-store'

export function createTestFamily(overrides: Partial<Omit<MockFamily, 'id' | 'createdAt' | 'updatedAt'>> = {}): MockFamily {
  const defaults = {
    name: `Test Family ${Date.now()}`,
    description: 'A test family',
    createdById: '', // Must be provided
  }

  return mockStore.createFamily({ ...defaults, ...overrides })
}

