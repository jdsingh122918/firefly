import { describe, it, expect } from 'vitest'
import { createPage } from '../../setup/browser'
import { navigateTo, waitForText, assertTextVisible } from '../../helpers/page-helpers'
import { authenticateAs } from '../../setup/auth'
import { UserRole } from '@prisma/client'

describe('Notifications', () => {
  it('should display notifications page for admin', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.ADMIN)
      await navigateTo(page, '/admin/notifications', UserRole.ADMIN)
      
      await waitForText(page, 'Notifications', 10000)
    } finally {
      await page.close()
    }
  }, 30000)

  it('should display notifications for member', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.MEMBER)
      await navigateTo(page, '/member/notifications', UserRole.MEMBER)
      
      await waitForText(page, 'Notifications', 10000)
    } finally {
      await page.close()
    }
  }, 30000)
})

