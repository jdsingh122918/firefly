import { describe, it, expect } from 'vitest'
import { createPage } from '../../setup/browser'
import { navigateTo, waitForText, assertTextVisible, getElementCount } from '../../helpers/page-helpers'
import { authenticateAs } from '../../setup/auth'
import { UserRole } from '@prisma/client'

describe('Admin Dashboard', () => {
  it('should display admin dashboard with stats', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.ADMIN)
      await navigateTo(page, '/admin', UserRole.ADMIN)
      
      // Wait for dashboard to load
      await waitForText(page, 'Admin Dashboard', 10000)
      
      // Check for stat cards
      await assertTextVisible(page, 'Total Users')
      await assertTextVisible(page, 'Families')
      await assertTextVisible(page, 'Total Notes')
      await assertTextVisible(page, 'Forums')
    } finally {
      await page.close()
    }
  }, 30000)

  it('should display user management section', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.ADMIN)
      await navigateTo(page, '/admin', UserRole.ADMIN)
      
      await waitForText(page, 'User & Family Management', 10000)
      
      // Check for user stats
      const statCards = await getElementCount(page, '[class*="Card"]')
      expect(statCards).toBeGreaterThan(0)
    } finally {
      await page.close()
    }
  }, 30000)

  it('should display care documentation metrics', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.ADMIN)
      await navigateTo(page, '/admin', UserRole.ADMIN)
      
      await waitForText(page, 'Care Documentation', 10000)
      await assertTextVisible(page, 'Total Notes')
      await assertTextVisible(page, 'Care Plans')
    } finally {
      await page.close()
    }
  }, 30000)

  it('should display community engagement metrics', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.ADMIN)
      await navigateTo(page, '/admin', UserRole.ADMIN)
      
      await waitForText(page, 'Community Engagement', 10000)
      await assertTextVisible(page, 'Forums')
      await assertTextVisible(page, 'Posts')
    } finally {
      await page.close()
    }
  }, 30000)
})

