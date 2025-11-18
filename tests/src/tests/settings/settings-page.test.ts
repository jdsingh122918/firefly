import { describe, it, expect } from 'vitest'
import { createPage } from '../../setup/browser'
import { navigateTo, waitForText, assertTextVisible } from '../../helpers/page-helpers'
import { authenticateAs } from '../../setup/auth'
import { UserRole } from '@prisma/client'

describe('Settings Page', () => {
  it('should display settings page for admin', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.ADMIN)
      await navigateTo(page, '/settings', UserRole.ADMIN)
      
      await waitForText(page, 'Settings', 10000)
    } finally {
      await page.close()
    }
  }, 30000)

  it('should display settings for member', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.MEMBER)
      await navigateTo(page, '/settings', UserRole.MEMBER)
      
      await waitForText(page, 'Settings', 10000)
    } finally {
      await page.close()
    }
  }, 30000)
})

