import { UserRole, FamilyRole, NoteType, NoteVisibility, ResourceContentType, ResourceStatus, PostType, MessageType, MessageStatus, NotificationType, AssignmentStatus, AssignmentPriority } from '@prisma/client'

// Mock data store - in-memory data structures
export interface MockUser {
  id: string
  clerkId: string
  email: string
  firstName: string | null
  lastName: string | null
  role: UserRole
  familyId: string | null
  familyRole: FamilyRole | null
  phoneNumber: string | null
  phoneVerified: boolean
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
}

export interface MockFamily {
  id: string
  name: string
  description: string | null
  createdById: string
  createdAt: Date
  updatedAt: Date
}

export interface MockContent {
  id: string
  contentType: 'NOTE' | 'RESOURCE'
  title: string
  content: string
  noteType: NoteType | null
  noteVisibility: NoteVisibility | null
  resourceType: ResourceContentType | null
  resourceStatus: ResourceStatus | null
  createdById: string
  familyId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface MockForum {
  id: string
  name: string
  slug: string
  description: string | null
  visibility: 'PUBLIC' | 'FAMILY' | 'PRIVATE'
  createdById: string
  createdAt: Date
  updatedAt: Date
}

export interface MockPost {
  id: string
  forumId: string
  title: string
  content: string
  postType: PostType
  authorId: string
  createdAt: Date
  updatedAt: Date
}

export interface MockConversation {
  id: string
  type: MessageType
  createdById: string
  createdAt: Date
  updatedAt: Date
}

export interface MockMessage {
  id: string
  conversationId: string
  senderId: string
  content: string
  messageType: MessageType
  status: MessageStatus
  createdAt: Date
  updatedAt: Date
}

export interface MockAssignment {
  id: string
  contentId: string | null
  assignedToId: string
  assignedById: string
  status: AssignmentStatus
  priority: AssignmentPriority
  dueDate: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface MockNotification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  isRead: boolean
  createdAt: Date
  updatedAt: Date
}

class MockStore {
  private users: Map<string, MockUser> = new Map()
  private families: Map<string, MockFamily> = new Map()
  private content: Map<string, MockContent> = new Map()
  private forums: Map<string, MockForum> = new Map()
  private posts: Map<string, MockPost> = new Map()
  private conversations: Map<string, MockConversation> = new Map()
  private messages: Map<string, MockMessage> = new Map()
  private assignments: Map<string, MockAssignment> = new Map()
  private notifications: Map<string, MockNotification> = new Map()

  // User operations
  createUser(user: Omit<MockUser, 'id' | 'createdAt' | 'updatedAt'>): MockUser {
    const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newUser: MockUser = {
      ...user,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.users.set(id, newUser)
    return newUser
  }

  getUser(id: string): MockUser | undefined {
    return this.users.get(id)
  }

  getUserByClerkId(clerkId: string): MockUser | undefined {
    return Array.from(this.users.values()).find(u => u.clerkId === clerkId)
  }

  getUserByEmail(email: string): MockUser | undefined {
    return Array.from(this.users.values()).find(u => u.email === email)
  }

  getAllUsers(): MockUser[] {
    return Array.from(this.users.values())
  }

  updateUser(id: string, updates: Partial<MockUser>): MockUser | undefined {
    const user = this.users.get(id)
    if (!user) return undefined
    const updated = { ...user, ...updates, updatedAt: new Date() }
    this.users.set(id, updated)
    return updated
  }

  deleteUser(id: string): boolean {
    return this.users.delete(id)
  }

  // Family operations
  createFamily(family: Omit<MockFamily, 'id' | 'createdAt' | 'updatedAt'>): MockFamily {
    const id = `family_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newFamily: MockFamily = {
      ...family,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.families.set(id, newFamily)
    return newFamily
  }

  getFamily(id: string): MockFamily | undefined {
    return this.families.get(id)
  }

  getAllFamilies(): MockFamily[] {
    return Array.from(this.families.values())
  }

  updateFamily(id: string, updates: Partial<MockFamily>): MockFamily | undefined {
    const family = this.families.get(id)
    if (!family) return undefined
    const updated = { ...family, ...updates, updatedAt: new Date() }
    this.families.set(id, updated)
    return updated
  }

  deleteFamily(id: string): boolean {
    return this.families.delete(id)
  }

  // Content operations
  createContent(content: Omit<MockContent, 'id' | 'createdAt' | 'updatedAt'>): MockContent {
    const id = `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newContent: MockContent = {
      ...content,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.content.set(id, newContent)
    return newContent
  }

  getContent(id: string): MockContent | undefined {
    return this.content.get(id)
  }

  getAllContent(): MockContent[] {
    return Array.from(this.content.values())
  }

  updateContent(id: string, updates: Partial<MockContent>): MockContent | undefined {
    const content = this.content.get(id)
    if (!content) return undefined
    const updated = { ...content, ...updates, updatedAt: new Date() }
    this.content.set(id, updated)
    return updated
  }

  deleteContent(id: string): boolean {
    return this.content.delete(id)
  }

  // Forum operations
  createForum(forum: Omit<MockForum, 'id' | 'createdAt' | 'updatedAt'>): MockForum {
    const id = `forum_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newForum: MockForum = {
      ...forum,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.forums.set(id, newForum)
    return newForum
  }

  getForum(id: string): MockForum | undefined {
    return this.forums.get(id)
  }

  getForumBySlug(slug: string): MockForum | undefined {
    return Array.from(this.forums.values()).find(f => f.slug === slug)
  }

  getAllForums(): MockForum[] {
    return Array.from(this.forums.values())
  }

  // Post operations
  createPost(post: Omit<MockPost, 'id' | 'createdAt' | 'updatedAt'>): MockPost {
    const id = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newPost: MockPost = {
      ...post,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.posts.set(id, newPost)
    return newPost
  }

  getPost(id: string): MockPost | undefined {
    return this.posts.get(id)
  }

  getAllPosts(): MockPost[] {
    return Array.from(this.posts.values())
  }

  // Conversation operations
  createConversation(conversation: Omit<MockConversation, 'id' | 'createdAt' | 'updatedAt'>): MockConversation {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newConv: MockConversation = {
      ...conversation,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.conversations.set(id, newConv)
    return newConv
  }

  getConversation(id: string): MockConversation | undefined {
    return this.conversations.get(id)
  }

  getAllConversations(): MockConversation[] {
    return Array.from(this.conversations.values())
  }

  // Message operations
  createMessage(message: Omit<MockMessage, 'id' | 'createdAt' | 'updatedAt'>): MockMessage {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newMessage: MockMessage = {
      ...message,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.messages.set(id, newMessage)
    return newMessage
  }

  getMessage(id: string): MockMessage | undefined {
    return this.messages.get(id)
  }

  getAllMessages(): MockMessage[] {
    return Array.from(this.messages.values())
  }

  // Assignment operations
  createAssignment(assignment: Omit<MockAssignment, 'id' | 'createdAt' | 'updatedAt'>): MockAssignment {
    const id = `assign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newAssignment: MockAssignment = {
      ...assignment,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.assignments.set(id, newAssignment)
    return newAssignment
  }

  getAssignment(id: string): MockAssignment | undefined {
    return this.assignments.get(id)
  }

  getAllAssignments(): MockAssignment[] {
    return Array.from(this.assignments.values())
  }

  updateAssignment(id: string, updates: Partial<MockAssignment>): MockAssignment | undefined {
    const assignment = this.assignments.get(id)
    if (!assignment) return undefined
    const updated = { ...assignment, ...updates, updatedAt: new Date() }
    this.assignments.set(id, updated)
    return updated
  }

  // Notification operations
  createNotification(notification: Omit<MockNotification, 'id' | 'createdAt' | 'updatedAt'>): MockNotification {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newNotification: MockNotification = {
      ...notification,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.notifications.set(id, newNotification)
    return newNotification
  }

  getNotification(id: string): MockNotification | undefined {
    return this.notifications.get(id)
  }

  getAllNotifications(): MockNotification[] {
    return Array.from(this.notifications.values())
  }

  updateNotification(id: string, updates: Partial<MockNotification>): MockNotification | undefined {
    const notification = this.notifications.get(id)
    if (!notification) return undefined
    const updated = { ...notification, ...updates, updatedAt: new Date() }
    this.notifications.set(id, updated)
    return updated
  }

  // Reset all data
  reset(): void {
    this.users.clear()
    this.families.clear()
    this.content.clear()
    this.forums.clear()
    this.posts.clear()
    this.conversations.clear()
    this.messages.clear()
    this.assignments.clear()
    this.notifications.clear()
  }
}

export const mockStore = new MockStore()

