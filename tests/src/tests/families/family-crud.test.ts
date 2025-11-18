import { describe, it, expect } from 'vitest'
import { createPage } from '../../setup/browser'
import { navigateTo, waitForText, assertTextVisible, clickButton } from '../../helpers/page-helpers'
import { authenticateAs } from '../../setup/auth'
import { UserRole } from '@prisma/client'

describe('Family CRUD Operations', () => {
  it('should display family list for admin', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.ADMIN)
      await navigateTo(page, '/admin/families', UserRole.ADMIN)
      
      await waitForText(page, 'Families', 10000)
      await assertTextVisible(page, 'Manage families')
    } finally {
      await page.close()
    }
  }, 30000)

  it('should display family list for volunteer', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.VOLUNTEER)
      await navigateTo(page, '/volunteer/families', UserRole.VOLUNTEER)
      
      await waitForText(page, 'Families', 10000)
    } finally {
      await page.close()
    }
  }, 30000)

  it('should show create family button for volunteers', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.VOLUNTEER)
      await navigateTo(page, '/volunteer/families', UserRole.VOLUNTEER)
      
      await waitForText(page, 'Create Family', 10000)
    } finally {
      await page.close()
    }
  }, 30000)
})

