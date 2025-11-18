import { describe, it, expect } from 'vitest'
import { createPage } from '../../setup/browser'
import { navigateTo, waitForText, assertTextVisible } from '../../helpers/page-helpers'
import { authenticateAs } from '../../setup/auth'
import { UserRole } from '@prisma/client'

describe('Member Dashboard', () => {
  it('should display member dashboard', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.MEMBER)
      await navigateTo(page, '/member', UserRole.MEMBER)
      
      await waitForText(page, 'Welcome', 10000)
      
      // Check for personal info sections
      await assertTextVisible(page, 'My Family')
    } finally {
      await page.close()
    }
  }, 30000)

  it('should show quick access actions', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.MEMBER)
      await navigateTo(page, '/member', UserRole.MEMBER)
      
      await waitForText(page, 'Quick Access', 10000)
      
      // Check for quick action buttons
      await assertTextVisible(page, 'Chat')
      await assertTextVisible(page, 'Content')
    } finally {
      await page.close()
    }
  }, 30000)

  it('should display family information if assigned', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.MEMBER)
      await navigateTo(page, '/member', UserRole.MEMBER)
      
      await waitForText(page, 'My Family', 10000)
    } finally {
      await page.close()
    }
  }, 30000)
})

