import { describe, it, expect } from 'vitest'
import { createPage } from '../../setup/browser'
import { navigateTo, waitForText, assertTextVisible } from '../../helpers/page-helpers'
import { authenticateAs } from '../../setup/auth'
import { UserRole } from '@prisma/client'

describe('Volunteer Dashboard', () => {
  it('should display volunteer dashboard', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.VOLUNTEER)
      await navigateTo(page, '/volunteer', UserRole.VOLUNTEER)
      
      await waitForText(page, 'Volunteer', 10000)
      
      // Check for family/member overview
      await assertTextVisible(page, 'Families')
    } finally {
      await page.close()
    }
  }, 30000)

  it('should show family management options', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.VOLUNTEER)
      await navigateTo(page, '/volunteer', UserRole.VOLUNTEER)
      
      await waitForText(page, 'Families', 10000)
    } finally {
      await page.close()
    }
  }, 30000)
})

