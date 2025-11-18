import { describe, it, expect } from 'vitest'
import { createPage } from '../../setup/browser'
import { navigateTo, waitForText, assertTextVisible } from '../../helpers/page-helpers'
import { authenticateAs } from '../../setup/auth'
import { UserRole } from '@prisma/client'

describe('Assignments', () => {
  it('should display assignments dashboard for admin', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.ADMIN)
      await navigateTo(page, '/admin/assignments', UserRole.ADMIN)
      
      await waitForText(page, 'Assignment', 10000)
    } finally {
      await page.close()
    }
  }, 30000)

  it('should display assignments for member', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.MEMBER)
      await navigateTo(page, '/member/assignments', UserRole.MEMBER)
      
      await waitForText(page, 'Assignment', 10000)
    } finally {
      await page.close()
    }
  }, 30000)
})

