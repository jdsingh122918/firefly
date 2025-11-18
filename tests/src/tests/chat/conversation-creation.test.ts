import { describe, it, expect } from 'vitest'
import { createPage } from '../../setup/browser'
import { navigateTo, waitForText, assertTextVisible } from '../../helpers/page-helpers'
import { authenticateAs } from '../../setup/auth'
import { UserRole } from '@prisma/client'

describe('Chat Conversations', () => {
  it('should display chat list for admin', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.ADMIN)
      await navigateTo(page, '/admin/chat', UserRole.ADMIN)
      
      await waitForText(page, 'Chat', 10000)
    } finally {
      await page.close()
    }
  }, 30000)

  it('should display chat list for member', async () => {
    const page = await createPage()
    try {
      await authenticateAs(page, UserRole.MEMBER)
      await navigateTo(page, '/member/chat', UserRole.MEMBER)
      
      await waitForText(page, 'Chat', 10000)
    } finally {
      await page.close()
    }
  }, 30000)
})

