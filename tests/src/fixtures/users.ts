import { UserRole, FamilyRole } from '@prisma/client'
import { mockStore, type MockUser } from '../setup/mock-store'

export function createTestUser(overrides: Partial<MockUser> = {}): MockUser {
  const defaults: Omit<MockUser, 'id' | 'createdAt' | 'updatedAt'> = {
    clerkId: `clerk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    email: `test_${Date.now()}@test.firefly.com`,
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.MEMBER,
    familyId: null,
    familyRole: null,
    phoneNumber: null,
    phoneVerified: false,
    emailVerified: true,
  }

  return mockStore.createUser({ ...defaults, ...overrides })
}

export function createTestAdmin(): MockUser {
  return createTestUser({
    role: UserRole.ADMIN,
    email: `admin_${Date.now()}@test.firefly.com`,
    firstName: 'Admin',
  })
}

export function createTestVolunteer(): MockUser {
  return createTestUser({
    role: UserRole.VOLUNTEER,
    email: `volunteer_${Date.now()}@test.firefly.com`,
    firstName: 'Volunteer',
  })
}

export function createTestMember(): MockUser {
  return createTestUser({
    role: UserRole.MEMBER,
    email: `member_${Date.now()}@test.firefly.com`,
    firstName: 'Member',
  })
}

