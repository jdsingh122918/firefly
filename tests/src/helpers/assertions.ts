import { expect } from 'vitest'

export function assertUserRole(user: any, expectedRole: string): void {
  expect(user).toBeDefined()
  expect(user.role).toBe(expectedRole)
}

export function assertFamilyAccess(families: any[], userRole: string, createdById?: string): void {
  if (userRole === 'VOLUNTEER' && createdById) {
    // Volunteers should only see families they created
    families.forEach(family => {
      expect(family.createdBy?.id).toBe(createdById)
    })
  }
}

export function assertContentVisibility(content: any[], userRole: string, userId?: string): void {
  content.forEach(item => {
    if (item.noteVisibility === 'PRIVATE') {
      // Private content should only be visible to creator
      expect(item.createdBy?.id).toBe(userId)
    }
  })
}

export function assertPagination(response: any): void {
  expect(response).toHaveProperty('total')
  expect(response).toHaveProperty('page')
  expect(response).toHaveProperty('limit')
  expect(typeof response.total).toBe('number')
  expect(typeof response.page).toBe('number')
  expect(typeof response.limit).toBe('number')
}

export function assertErrorResponse(response: any, expectedStatus: number, expectedMessage?: string): void {
  expect(response.status).toBe(expectedStatus)
  if (expectedMessage) {
    expect(response.error || response.message).toContain(expectedMessage)
  }
}

