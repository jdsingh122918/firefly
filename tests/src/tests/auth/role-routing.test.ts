import { describe, it, expect } from 'vitest'
import { createPage } from '../../setup/browser'
import { navigateTo, waitForText, assertTextVisible } from '../../helpers/page-helpers'
import { authenticateAs } from '../../setup/auth'
import { UserRole } from '@prisma/client'

describe('Role-Based Routing', () => {
  it('should route ADMIN users to /admin dashboard', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.ADMIN)
      await navigateTo(page, '/', UserRole.ADMIN)
      await page.waitForTimeout(2000)
      
      const url = page.url()
      expect(url).toContain('/admin')
      
      // Check for admin dashboard content
      await waitForText(page, 'Admin Dashboard', 5000)
    } finally {
      await page.close()
    }
  }, 30000)

  it('should route VOLUNTEER users to /volunteer dashboard', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.VOLUNTEER)
      await navigateTo(page, '/volunteer', UserRole.VOLUNTEER)
      await page.waitForTimeout(2000)
      
      const url = page.url()
      expect(url).toContain('/volunteer')
      
      // Check for volunteer dashboard content
      await waitForText(page, 'Volunteer', 5000)
    } finally {
      await page.close()
    }
  }, 30000)

  it('should route MEMBER users to /member dashboard', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.MEMBER)
      await navigateTo(page, '/member', UserRole.MEMBER)
      await page.waitForTimeout(2000)
      
      const url = page.url()
      expect(url).toContain('/member')
      
      // Check for member dashboard content
      await waitForText(page, 'Welcome', 5000)
    } finally {
      await page.close()
    }
  }, 30000)

  it('should prevent unauthorized access to admin routes', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.MEMBER)
      await navigateTo(page, '/admin', UserRole.MEMBER)
      await page.waitForTimeout(2000)
      
      // Should redirect or show error
      const url = page.url()
      // Either redirected to sign-in or member dashboard
      expect(url).not.toContain('/admin')
    } finally {
      await page.close()
    }
  }, 30000)
})

