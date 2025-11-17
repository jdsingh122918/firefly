import { http, HttpResponse } from 'msw'
import { UserRole } from '@prisma/client'
import { mockStore } from './mock-store'
import { getMockUserByRole, getMockUserByEmail } from '../fixtures/mock-data'
import { getMockAuthHeaders } from './auth'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

// Extract user from request headers
function getUserFromRequest(request: Request): { userId: string; role: UserRole } | null {
  const authHeader = request.headers.get('Authorization')
  const clerkUserId = request.headers.get('X-Clerk-User-Id')
  
  if (!authHeader || !clerkUserId) {
    return null
  }

  const user = mockStore.getUserByClerkId(clerkUserId)
  if (!user) {
    return null
  }

  return {
    userId: user.id,
    role: user.role,
  }
}

// Auth handlers
const authHandlers = [
  // GET /api/auth/get-user-role
  http.get(`${BASE_URL}/api/auth/get-user-role`, async ({ request }) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = mockStore.getUser(user.userId)
    return HttpResponse.json({
      role: dbUser?.role || user.role,
      userId: user.userId,
    })
  }),
]

// User handlers
const userHandlers = [
  // GET /api/users
  http.get(`${BASE_URL}/api/users`, async ({ request }) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = mockStore.getUser(user.userId)
    if (!dbUser || (dbUser.role !== UserRole.ADMIN && dbUser.role !== UserRole.VOLUNTEER)) {
      return HttpResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const url = new URL(request.url)
    const search = url.searchParams.get('search')
    const roleFilter = url.searchParams.get('role')
    const familyId = url.searchParams.get('familyId')

    let users = mockStore.getAllUsers()

    // Apply filters
    if (search) {
      users = users.filter(u => 
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.firstName?.toLowerCase().includes(search.toLowerCase()) ||
        u.lastName?.toLowerCase().includes(search.toLowerCase())
      )
    }

    if (roleFilter) {
      users = users.filter(u => u.role === roleFilter)
    }

    if (familyId) {
      users = users.filter(u => u.familyId === familyId)
    }

    return HttpResponse.json({
      users: users.map(u => ({
        id: u.id,
        clerkId: u.clerkId,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
        role: u.role,
        familyId: u.familyId,
        phoneNumber: u.phoneNumber,
        phoneVerified: u.phoneVerified,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt.toISOString(),
      })),
      total: users.length,
    })
  }),

  // POST /api/users
  http.post(`${BASE_URL}/api/users`, async ({ request }) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = mockStore.getUser(user.userId)
    if (!dbUser || dbUser.role !== UserRole.ADMIN) {
      return HttpResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json() as { email: string; firstName?: string; lastName?: string; role: UserRole; familyId?: string }
    
    const newUser = mockStore.createUser({
      clerkId: `clerk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: body.email,
      firstName: body.firstName || null,
      lastName: body.lastName || null,
      role: body.role,
      familyId: body.familyId || null,
      familyRole: null,
      phoneNumber: null,
      phoneVerified: false,
      emailVerified: false,
    })

    return HttpResponse.json({
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      role: newUser.role,
    }, { status: 201 })
  }),

  // GET /api/users/:id
  http.get(`${BASE_URL}/api/users/:id`, async ({ request, params }) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params as { id: string }
    const targetUser = mockStore.getUser(id)
    
    if (!targetUser) {
      return HttpResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return HttpResponse.json({
      id: targetUser.id,
      clerkId: targetUser.clerkId,
      email: targetUser.email,
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      role: targetUser.role,
      familyId: targetUser.familyId,
      phoneNumber: targetUser.phoneNumber,
      phoneVerified: targetUser.phoneVerified,
      emailVerified: targetUser.emailVerified,
      createdAt: targetUser.createdAt.toISOString(),
    })
  }),

  // DELETE /api/users/:id
  http.delete(`${BASE_URL}/api/users/:id`, async ({ request, params }) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = mockStore.getUser(user.userId)
    if (!dbUser || dbUser.role !== UserRole.ADMIN) {
      return HttpResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id } = params as { id: string }
    const deleted = mockStore.deleteUser(id)
    
    if (!deleted) {
      return HttpResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return HttpResponse.json({ success: true })
  }),
]

// Family handlers
const familyHandlers = [
  // GET /api/families
  http.get(`${BASE_URL}/api/families`, async ({ request }) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = mockStore.getUser(user.userId)
    if (!dbUser) {
      return HttpResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let families = mockStore.getAllFamilies()

    // Volunteers can only see families they created
    if (dbUser.role === UserRole.VOLUNTEER) {
      families = families.filter(f => f.createdById === dbUser.id)
    }

    const familiesWithMembers = families.map(family => {
      const members = mockStore.getAllUsers().filter(u => u.familyId === family.id)
      const creator = mockStore.getUser(family.createdById)
      
      return {
        id: family.id,
        name: family.name,
        description: family.description,
        createdAt: family.createdAt.toISOString(),
        createdBy: creator ? {
          id: creator.id,
          name: `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.email,
          email: creator.email,
        } : null,
        members: members.map(m => ({
          id: m.id,
          name: `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email,
          email: m.email,
          role: m.role,
        })),
        memberCount: members.length,
      }
    })

    return HttpResponse.json({
      families: familiesWithMembers,
      total: familiesWithMembers.length,
    })
  }),

  // POST /api/families
  http.post(`${BASE_URL}/api/families`, async ({ request }) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = mockStore.getUser(user.userId)
    if (!dbUser || (dbUser.role !== UserRole.ADMIN && dbUser.role !== UserRole.VOLUNTEER)) {
      return HttpResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json() as { name: string; description?: string }
    
    const newFamily = mockStore.createFamily({
      name: body.name,
      description: body.description || null,
      createdById: dbUser.id,
    })

    return HttpResponse.json({
      id: newFamily.id,
      name: newFamily.name,
      description: newFamily.description,
    }, { status: 201 })
  }),

  // GET /api/families/:id
  http.get(`${BASE_URL}/api/families/:id`, async ({ request, params }) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params as { id: string }
    const family = mockStore.getFamily(id)
    
    if (!family) {
      return HttpResponse.json({ error: 'Family not found' }, { status: 404 })
    }

    const members = mockStore.getAllUsers().filter(u => u.familyId === family.id)
    const creator = mockStore.getUser(family.createdById)

    return HttpResponse.json({
      id: family.id,
      name: family.name,
      description: family.description,
      createdAt: family.createdAt.toISOString(),
      createdBy: creator ? {
        id: creator.id,
        name: `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.email,
        email: creator.email,
      } : null,
      members: members.map(m => ({
        id: m.id,
        email: m.email,
        firstName: m.firstName,
        lastName: m.lastName,
        role: m.role,
        familyRole: m.familyRole,
      })),
      memberCount: members.length,
    })
  }),
]

// Forum handlers
const forumHandlers = [
  // GET /api/forums
  http.get(`${BASE_URL}/api/forums`, async ({ request }) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const forums = mockStore.getAllForums()
    const forumsWithDetails = forums.map(forum => {
      const creator = mockStore.getUser(forum.createdById)
      const posts = mockStore.getAllPosts().filter(p => p.forumId === forum.id)
      
      return {
        id: forum.id,
        name: forum.name,
        slug: forum.slug,
        description: forum.description,
        visibility: forum.visibility,
        createdAt: forum.createdAt.toISOString(),
        createdBy: creator ? {
          id: creator.id,
          name: `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.email,
        } : null,
        postCount: posts.length,
      }
    })

    return HttpResponse.json({
      forums: forumsWithDetails,
      total: forumsWithDetails.length,
    })
  }),

  // GET /api/forums/by-slug/:slug
  http.get(`${BASE_URL}/api/forums/by-slug/:slug`, async ({ request, params }) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { slug } = params as { slug: string }
    const forum = mockStore.getForumBySlug(slug)
    
    if (!forum) {
      return HttpResponse.json({ error: 'Forum not found' }, { status: 404 })
    }

    const creator = mockStore.getUser(forum.createdById)
    const posts = mockStore.getAllPosts().filter(p => p.forumId === forum.id)

    return HttpResponse.json({
      id: forum.id,
      name: forum.name,
      slug: forum.slug,
      description: forum.description,
      visibility: forum.visibility,
      createdAt: forum.createdAt.toISOString(),
      createdBy: creator ? {
        id: creator.id,
        name: `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.email,
      } : null,
      postCount: posts.length,
    })
  }),
]

// Post handlers
const postHandlers = [
  // GET /api/posts
  http.get(`${BASE_URL}/api/posts`, async ({ request }) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const forumId = url.searchParams.get('forumId')

    let posts = mockStore.getAllPosts()

    if (forumId) {
      posts = posts.filter(p => p.forumId === forumId)
    }

    const postsWithDetails = posts.map(post => {
      const author = mockStore.getUser(post.authorId)
      const forum = mockStore.getForum(post.forumId)
      
      return {
        id: post.id,
        title: post.title,
        content: post.content,
        postType: post.postType,
        visibility: post.visibility,
        forumId: post.forumId,
        forum: forum ? {
          id: forum.id,
          name: forum.name,
          slug: forum.slug,
        } : null,
        author: author ? {
          id: author.id,
          name: `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.email,
          email: author.email,
        } : null,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      }
    })

    return HttpResponse.json({
      posts: postsWithDetails,
      total: postsWithDetails.length,
    })
  }),

  // POST /api/posts
  http.post(`${BASE_URL}/api/posts`, async ({ request }) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as { forumId: string; title: string; content: string; postType: string; visibility: string }
    
    const newPost = mockStore.createPost({
      forumId: body.forumId,
      title: body.title,
      content: body.content,
      postType: body.postType as any,
      visibility: body.visibility as any,
      authorId: user.userId,
    })

    return HttpResponse.json({
      id: newPost.id,
      title: newPost.title,
      content: newPost.content,
    }, { status: 201 })
  }),
]

// Content handlers
const contentHandlers = [
  // GET /api/content
  http.get(`${BASE_URL}/api/content`, async ({ request }) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const contentType = url.searchParams.get('contentType')
    const familyId = url.searchParams.get('familyId')

    let content = mockStore.getAllContent()

    if (contentType) {
      content = content.filter(c => c.contentType === contentType)
    }

    if (familyId) {
      content = content.filter(c => c.familyId === familyId)
    }

    const contentWithDetails = content.map(item => {
      const creator = mockStore.getUser(item.createdById)
      
      return {
        id: item.id,
        contentType: item.contentType,
        title: item.title,
        content: item.content,
        noteType: item.noteType,
        noteVisibility: item.noteVisibility,
        resourceType: item.resourceType,
        resourceStatus: item.resourceStatus,
        createdBy: creator ? {
          id: creator.id,
          name: `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.email,
        } : null,
        familyId: item.familyId,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      }
    })

    return HttpResponse.json({
      content: contentWithDetails,
      total: contentWithDetails.length,
    })
  }),

  // POST /api/content
  http.post(`${BASE_URL}/api/content`, async ({ request }) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as any
    
    const newContent = mockStore.createContent({
      contentType: body.contentType,
      title: body.title,
      content: body.content,
      noteType: body.noteType || null,
      noteVisibility: body.noteVisibility || null,
      resourceType: body.resourceType || null,
      resourceStatus: body.resourceStatus || null,
      createdById: user.userId,
      familyId: body.familyId || null,
    })

    return HttpResponse.json({
      id: newContent.id,
      title: newContent.title,
      contentType: newContent.contentType,
    }, { status: 201 })
  }),
]

// Notification handlers
const notificationHandlers = [
  // GET /api/notifications
  http.get(`${BASE_URL}/api/notifications`, async ({ request }) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const notifications = mockStore.getAllNotifications().filter(n => n.userId === user.userId)

    return HttpResponse.json({
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
      total: notifications.length,
      unreadCount: notifications.filter(n => !n.isRead).length,
    })
  }),

  // PATCH /api/notifications/:id
  http.patch(`${BASE_URL}/api/notifications/:id`, async ({ request, params }) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params as { id: string }
    const body = await request.json() as { isRead?: boolean }
    
    const notification = mockStore.getNotification(id)
    if (!notification || notification.userId !== user.userId) {
      return HttpResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    const updated = mockStore.updateNotification(id, { isRead: body.isRead ?? true })
    return HttpResponse.json({
      id: updated!.id,
      isRead: updated!.isRead,
    })
  }),
]

// Assignment handlers
const assignmentHandlers = [
  // GET /api/assignments
  http.get(`${BASE_URL}/api/assignments`, async ({ request }) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const assignedTo = url.searchParams.get('assignedTo')
    const status = url.searchParams.get('status')

    let assignments = mockStore.getAllAssignments()

    if (assignedTo) {
      assignments = assignments.filter(a => a.assignedToId === assignedTo)
    }

    if (status) {
      assignments = assignments.filter(a => a.status === status)
    }

    const assignmentsWithDetails = assignments.map(assignment => {
      const assignee = mockStore.getUser(assignment.assignedToId)
      const assigner = mockStore.getUser(assignment.assignedById)
      const content = assignment.contentId ? mockStore.getContent(assignment.contentId) : null
      
      return {
        id: assignment.id,
        contentId: assignment.contentId,
        content: content ? {
          id: content.id,
          title: content.title,
        } : null,
        assignedTo: assignee ? {
          id: assignee.id,
          name: `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() || assignee.email,
        } : null,
        assignedBy: assigner ? {
          id: assigner.id,
          name: `${assigner.firstName || ''} ${assigner.lastName || ''}`.trim() || assigner.email,
        } : null,
        status: assignment.status,
        priority: assignment.priority,
        dueDate: assignment.dueDate?.toISOString() || null,
        createdAt: assignment.createdAt.toISOString(),
      }
    })

    return HttpResponse.json({
      assignments: assignmentsWithDetails,
      total: assignmentsWithDetails.length,
    })
  }),
]

// Chat/Conversation handlers
const conversationHandlers = [
  // GET /api/conversations
  http.get(`${BASE_URL}/api/conversations`, async ({ request }) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversations = mockStore.getAllConversations()
    const conversationsWithDetails = conversations.map(conv => {
      const messages = mockStore.getAllMessages().filter(m => m.conversationId === conv.id)
      const unreadCount = messages.filter(m => m.status !== MessageStatus.READ && m.senderId !== user.userId).length
      
      return {
        id: conv.id,
        type: conv.type,
        createdAt: conv.createdAt.toISOString(),
        messageCount: messages.length,
        unreadCount,
      }
    })

    return HttpResponse.json({
      conversations: conversationsWithDetails,
      total: conversationsWithDetails.length,
    })
  }),

  // GET /api/conversations/:id/messages
  http.get(`${BASE_URL}/api/conversations/:id/messages`, async ({ request, params }) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params as { id: string }
    const messages = mockStore.getAllMessages().filter(m => m.conversationId === id)

    const messagesWithDetails = messages.map(msg => {
      const sender = mockStore.getUser(msg.senderId)
      
      return {
        id: msg.id,
        content: msg.content,
        sender: sender ? {
          id: sender.id,
          name: `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || sender.email,
        } : null,
        status: msg.status,
        createdAt: msg.createdAt.toISOString(),
      }
    })

    return HttpResponse.json({
      messages: messagesWithDetails,
      total: messagesWithDetails.length,
    })
  }),

  // POST /api/conversations/:id/messages
  http.post(`${BASE_URL}/api/conversations/:id/messages`, async ({ request, params }) => {
    const user = getUserFromRequest(request)
    if (!user) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params as { id: string }
    const body = await request.json() as { content: string }
    
    const newMessage = mockStore.createMessage({
      conversationId: id,
      senderId: user.userId,
      content: body.content,
      messageType: MessageType.DIRECT,
      status: MessageStatus.SENT,
    })

    return HttpResponse.json({
      id: newMessage.id,
      content: newMessage.content,
    }, { status: 201 })
  }),
]

// Combine all handlers
export const handlers = [
  ...authHandlers,
  ...userHandlers,
  ...familyHandlers,
  ...forumHandlers,
  ...postHandlers,
  ...contentHandlers,
  ...notificationHandlers,
  ...assignmentHandlers,
  ...conversationHandlers,
]

