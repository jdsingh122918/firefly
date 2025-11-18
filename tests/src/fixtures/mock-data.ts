import { UserRole, FamilyRole, NoteType, NoteVisibility, ResourceContentType, ResourceStatus, PostType, MessageType, MessageStatus, NotificationType, AssignmentStatus, AssignmentPriority } from '@prisma/client'
import { mockStore, type MockUser, type MockFamily, type MockContent, type MockForum, type MockPost, type MockConversation, type MockMessage, type MockAssignment, type MockNotification } from '../setup/mock-store'

// Static test user IDs
export const TEST_USER_IDS = {
  ADMIN: 'test_admin_user',
  VOLUNTEER: 'test_volunteer_user',
  VOLUNTEER_2: 'test_volunteer_2_user',
  MEMBER: 'test_member_user',
  MEMBER_2: 'test_member_2_user',
  MEMBER_3: 'test_member_3_user',
}

// Static test family IDs
export const TEST_FAMILY_IDS = {
  FAMILY_1: 'test_family_1',
  FAMILY_2: 'test_family_2',
}

// Initialize mock data
export function initializeMockData() {
  // Reset store
  mockStore.reset()

  // Create test users
  const adminUser = mockStore.createUser({
    clerkId: 'clerk_admin_123',
    email: 'admin@test.firefly.com',
    firstName: 'Admin',
    lastName: 'User',
    role: UserRole.ADMIN,
    familyId: null,
    familyRole: null,
    phoneNumber: null,
    phoneVerified: false,
    emailVerified: true,
  })

  const volunteerUser = mockStore.createUser({
    clerkId: 'clerk_volunteer_123',
    email: 'volunteer@test.firefly.com',
    firstName: 'Volunteer',
    lastName: 'User',
    role: UserRole.VOLUNTEER,
    familyId: TEST_FAMILY_IDS.FAMILY_1,
    familyRole: FamilyRole.PRIMARY_CONTACT,
    phoneNumber: '+1234567890',
    phoneVerified: true,
    emailVerified: true,
  })

  const volunteer2User = mockStore.createUser({
    clerkId: 'clerk_volunteer_456',
    email: 'volunteer2@test.firefly.com',
    firstName: 'Volunteer',
    lastName: 'Two',
    role: UserRole.VOLUNTEER,
    familyId: TEST_FAMILY_IDS.FAMILY_2,
    familyRole: FamilyRole.PRIMARY_CONTACT,
    phoneNumber: null,
    phoneVerified: false,
    emailVerified: true,
  })

  const memberUser = mockStore.createUser({
    clerkId: 'clerk_member_123',
    email: 'member@test.firefly.com',
    firstName: 'Member',
    lastName: 'User',
    role: UserRole.MEMBER,
    familyId: TEST_FAMILY_IDS.FAMILY_1,
    familyRole: FamilyRole.MEMBER,
    phoneNumber: '+1234567891',
    phoneVerified: true,
    emailVerified: true,
  })

  const member2User = mockStore.createUser({
    clerkId: 'clerk_member_456',
    email: 'member2@test.firefly.com',
    firstName: 'Member',
    lastName: 'Two',
    role: UserRole.MEMBER,
    familyId: TEST_FAMILY_IDS.FAMILY_1,
    familyRole: FamilyRole.MEMBER,
    phoneNumber: null,
    phoneVerified: false,
    emailVerified: true,
  })

  const member3User = mockStore.createUser({
    clerkId: 'clerk_member_789',
    email: 'member3@test.firefly.com',
    firstName: 'Member',
    lastName: 'Three',
    role: UserRole.MEMBER,
    familyId: TEST_FAMILY_IDS.FAMILY_2,
    familyRole: FamilyRole.MEMBER,
    phoneNumber: null,
    phoneVerified: false,
    emailVerified: true,
  })

  // Create test families
  const family1 = mockStore.createFamily({
    name: 'Test Family One',
    description: 'First test family for integration tests',
    createdById: volunteerUser.id,
  })

  const family2 = mockStore.createFamily({
    name: 'Test Family Two',
    description: 'Second test family for integration tests',
    createdById: volunteer2User.id,
  })

  // Update users with family IDs
  mockStore.updateUser(volunteerUser.id, { familyId: family1.id })
  mockStore.updateUser(memberUser.id, { familyId: family1.id })
  mockStore.updateUser(member2User.id, { familyId: family1.id })
  mockStore.updateUser(volunteer2User.id, { familyId: family2.id })
  mockStore.updateUser(member3User.id, { familyId: family2.id })

  // Create test forums
  const publicForum = mockStore.createForum({
    name: 'Public Discussion',
    slug: 'public-discussion',
    description: 'A public forum for all users',
    visibility: 'PUBLIC',
    createdById: adminUser.id,
  })

  const familyForum = mockStore.createForum({
    name: 'Family Support',
    slug: 'family-support',
    description: 'A family-only forum',
    visibility: 'FAMILY',
    createdById: volunteerUser.id,
  })

  // Create test posts
  const testPost = mockStore.createPost({
    forumId: publicForum.id,
    title: 'Welcome to Firefly',
    content: 'This is a test post in the public forum.',
    postType: PostType.DISCUSSION,
    authorId: adminUser.id,
  })

  // Create test content (notes)
  const testNote = mockStore.createContent({
    contentType: 'NOTE',
    title: 'Test Care Plan Note',
    content: 'This is a test care plan note.',
    noteType: NoteType.CARE_PLAN,
    noteVisibility: NoteVisibility.FAMILY,
    resourceType: null,
    resourceStatus: null,
    createdById: volunteerUser.id,
    familyId: family1.id,
  })

  const testPersonalNote = mockStore.createContent({
    contentType: 'NOTE',
    title: 'Personal Note',
    content: 'This is a personal note.',
    noteType: NoteType.PERSONAL,
    noteVisibility: NoteVisibility.PRIVATE,
    resourceType: null,
    resourceStatus: null,
    createdById: memberUser.id,
    familyId: null,
  })

  // Create test content (resources)
  const testResource = mockStore.createContent({
    contentType: 'RESOURCE',
    title: 'Helpful Resource Article',
    content: 'This is a helpful resource article.',
    noteType: null,
    noteVisibility: null,
    resourceType: ResourceContentType.ARTICLE,
    resourceStatus: ResourceStatus.PUBLISHED,
    createdById: adminUser.id,
    familyId: null,
  })

  // Create test conversations
  const directConversation = mockStore.createConversation({
    type: MessageType.DIRECT,
    createdById: volunteerUser.id,
  })

  const familyConversation = mockStore.createConversation({
    type: MessageType.FAMILY_CHAT,
    createdById: volunteerUser.id,
  })

  // Create test messages
  mockStore.createMessage({
    conversationId: directConversation.id,
    senderId: volunteerUser.id,
    content: 'Hello, this is a test message.',
    messageType: MessageType.DIRECT,
    status: MessageStatus.SENT,
  })

  mockStore.createMessage({
    conversationId: familyConversation.id,
    senderId: volunteerUser.id,
    content: 'Family chat message.',
    messageType: MessageType.FAMILY_CHAT,
    status: MessageStatus.DELIVERED,
  })

  // Create test assignments
  mockStore.createAssignment({
    contentId: testNote.id,
    assignedToId: memberUser.id,
    assignedById: volunteerUser.id,
    status: AssignmentStatus.ASSIGNED,
    priority: AssignmentPriority.MEDIUM,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  })

  // Create test notifications
  mockStore.createNotification({
    userId: memberUser.id,
    type: NotificationType.MESSAGE,
    title: 'New Message',
    message: 'You have a new message',
    isRead: false,
  })

  mockStore.createNotification({
    userId: volunteerUser.id,
    type: NotificationType.CARE_UPDATE,
    title: 'Care Plan Updated',
    message: 'A care plan has been updated',
    isRead: true,
  })

  return {
    users: {
      admin: adminUser,
      volunteer: volunteerUser,
      volunteer2: volunteer2User,
      member: memberUser,
      member2: member2User,
      member3: member3User,
    },
    families: {
      family1,
      family2,
    },
    forums: {
      public: publicForum,
      family: familyForum,
    },
    posts: {
      testPost,
    },
    content: {
      testNote,
      testPersonalNote,
      testResource,
    },
    conversations: {
      direct: directConversation,
      family: familyConversation,
    },
  }
}

// Get mock user by role
export function getMockUserByRole(role: UserRole): MockUser | undefined {
  return mockStore.getAllUsers().find(u => u.role === role)
}

// Get mock user by email
export function getMockUserByEmail(email: string): MockUser | undefined {
  return mockStore.getUserByEmail(email)
}

