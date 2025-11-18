import { describe, it, expect } from 'vitest'
import { createPage } from '../../setup/browser'
import { navigateTo, waitForText, assertTextVisible, fillInput, getElementCount } from '../../helpers/page-helpers'
import { authenticateAs } from '../../setup/auth'
import { UserRole } from '@prisma/client'

describe('User List (Admin)', () => {
  it('should display user list page', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.ADMIN)
      await navigateTo(page, '/admin/users', UserRole.ADMIN)
      
      await waitForText(page, 'Users', 10000)
      await assertTextVisible(page, 'Manage platform users')
    } finally {
      await page.close()
    }
  }, 30000)

  it('should show create user button', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.ADMIN)
      await navigateTo(page, '/admin/users', UserRole.ADMIN)
      
      await waitForText(page, 'Create User', 10000)
    } finally {
      await page.close()
    }
  }, 30000)

  it('should allow searching users', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.ADMIN)
      await navigateTo(page, '/admin/users', UserRole.ADMIN)
      
      // Wait for search input
      await page.waitForSelector('input[placeholder*="Search"]', { timeout: 10000 })
      
      // Search functionality would be tested here
      await assertTextVisible(page, 'Search')
    } finally {
      await page.close()
    }
  }, 30000)
})

