import { describe, it, expect } from 'vitest'
import { createPage } from '../../setup/browser'
import { navigateTo, waitForText, assertTextVisible } from '../../helpers/page-helpers'
import { authenticateAs } from '../../setup/auth'
import { UserRole } from '@prisma/client'

describe('Content Hub', () => {
  it('should display content hub for admin', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.ADMIN)
      await navigateTo(page, '/admin/content', UserRole.ADMIN)
      
      await waitForText(page, 'Content', 10000)
    } finally {
      await page.close()
    }
  }, 30000)

  it('should display content hub for member', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.MEMBER)
      await navigateTo(page, '/member/content', UserRole.MEMBER)
      
      await waitForText(page, 'Content', 10000)
    } finally {
      await page.close()
    }
  }, 30000)

  it('should show create content button', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.MEMBER)
      await navigateTo(page, '/member/content', UserRole.MEMBER)
      
      await waitForText(page, 'New Content', 10000)
    } finally {
      await page.close()
    }
  }, 30000)
})

