import { describe, it, expect } from 'vitest'
import { createPage } from '../../setup/browser'
import { navigateTo, waitForText, assertTextVisible } from '../../helpers/page-helpers'
import { authenticateAs } from '../../setup/auth'
import { UserRole } from '@prisma/client'

describe('Forum Navigation', () => {
  it('should display forums list for admin', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.ADMIN)
      await navigateTo(page, '/admin/forums', UserRole.ADMIN)
      
      await waitForText(page, 'Forums', 10000)
      await assertTextVisible(page, 'Community discussions')
    } finally {
      await page.close()
    }
  }, 30000)

  it('should display forums list for member', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.MEMBER)
      await navigateTo(page, '/member/forums', UserRole.MEMBER)
      
      await waitForText(page, 'Forums', 10000)
    } finally {
      await page.close()
    }
  }, 30000)

  it('should allow creating forum (admin)', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.ADMIN)
      await navigateTo(page, '/admin/forums', UserRole.ADMIN)
      
      await waitForText(page, 'Create Forum', 10000)
    } finally {
      await page.close()
    }
  }, 30000)
})

