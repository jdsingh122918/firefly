// Base types from Prisma (TYPE-ONLY IMPORTS)
import type {
  User as PrismaUser,
  Family as PrismaFamily,
  Message,
  MessageUserStatus,
  Notification,
  NotificationPreferences,
  // Conversation types (Session 022)
  Conversation as PrismaConversation,
  ConversationParticipant as PrismaConversationParticipant,
  // Forum types (Session 010)
  Forum as PrismaForum,
  Post as PrismaPost,
  Reply as PrismaReply,
  Vote as PrismaVote,
  ForumMember as PrismaForumMember,
  ForumCategory as PrismaForumCategory,
  // Unified Resources system
  Resource as PrismaResource,
  ResourceRating as PrismaResourceRating,
  ResourceShare as PrismaResourceShare,
  ResourceDocument as PrismaResourceDocument,
  ResourceTag as PrismaResourceTag,
  ResourceFormResponse as PrismaResourceFormResponse,
} from "@prisma/client";

// Enums from Prisma (VALUE IMPORTS - used at runtime)
import {
  UserRole,
  NotificationType,
  MessageType,
  MessageStatus,
  ForumVisibility,
  PostType,
  VoteType,
  ResourceVisibility,
  ResourceType,
  ResourceStatus,
  DocumentSource,
} from "@prisma/client";

// Re-export type-only imports
export type {
  PrismaUser,
  PrismaFamily,
  Message,
  MessageUserStatus,
  Notification,
  NotificationPreferences,
  // Conversation types (Session 022)
  PrismaConversation,
  PrismaConversationParticipant,
  // Forum types (Session 010)
  PrismaForum,
  PrismaPost,
  PrismaReply,
  PrismaVote,
  PrismaForumMember,
  PrismaForumCategory,
  // Unified Resources system
  PrismaResource,
  PrismaResourceRating,
  PrismaResourceShare,
  PrismaResourceDocument,
  PrismaResourceTag,
  PrismaResourceFormResponse,
};

// Re-export enums as values (so they can be used at runtime)
export {
  UserRole,
  NotificationType,
  MessageType,
  MessageStatus,
  ForumVisibility,
  PostType,
  VoteType,
  ResourceVisibility,
  ResourceType,
  ResourceStatus,
  DocumentSource,
};

// Family-specific roles
export enum FamilyRole {
  PRIMARY_CONTACT = "PRIMARY_CONTACT",
  FAMILY_ADMIN = "FAMILY_ADMIN",
  MEMBER = "MEMBER",
}

// Enhanced User interface
export interface User {
  id: string;
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  familyId: string | null;
  familyRole: FamilyRole | null;
  createdById: string | null;
  phoneNumber: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  family?: Family | null;
  createdBy?: User | null;
}

// Enhanced Family interface
export interface Family {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  primaryContactId: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: User;
  members?: User[];
}

// Family management input types
export interface CreateFamilyInput {
  name: string;
  description?: string;
  createdById: string;
  primaryContactId?: string;
}

export interface BulkMemberAssignmentInput {
  userIds: string[];
  targetFamilyId: string;
  familyRole?: FamilyRole;
}

export interface MemberTransferInput {
  userId: string;
  fromFamilyId: string;
  toFamilyId: string;
  newFamilyRole?: FamilyRole;
}

export interface FamilyMergeInput {
  sourceFamilyId: string;
  targetFamilyId: string;
  keepSourceName?: boolean;
}

export interface UpdateFamilyRoleInput {
  userId: string;
  familyId: string;
  newFamilyRole: FamilyRole;
}

export interface CreateUserInput {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  familyId?: string;
  familyRole?: FamilyRole;
  createdById?: string;
  phoneNumber?: string;
}

// Conversation types (Session 022)
export interface CreateConversationInput {
  title?: string;
  type: MessageType;
  familyId?: string;
  createdBy: string;
  participantIds: string[];
}

export interface ConversationSearchOptions {
  type?: MessageType;
  familyId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

// Enhanced conversation types with relations
export interface Conversation extends PrismaConversation {
  family?: {
    id: string;
    name: string;
    description?: string;
  };
  participants: ConversationParticipant[];
  messages?: Message[];
}

export interface ConversationParticipant extends PrismaConversationParticipant {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: UserRole;
    familyRole?: FamilyRole;
  };
  conversation?: {
    id: string;
    title?: string;
    type: MessageType;
  };
}

// Message types (Session 022)
export interface CreateMessageInput {
  content: string;
  conversationId: string;
  senderId: string;
  replyToId?: string;
  attachments?: string[];
  metadata?: any;
}

export interface UpdateMessageInput {
  content?: string;
  attachments?: string[];
  metadata?: any;
}

export interface MessageSearchOptions {
  query?: string;
  conversationId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// Document types
export enum DocumentType {
  MEDICAL = "MEDICAL",
  INSURANCE = "INSURANCE",
  CARE_PLAN = "CARE_PLAN",
  MEDICATION = "MEDICATION",
  LEGAL = "LEGAL",
  FINANCIAL = "FINANCIAL",
  PERSONAL = "PERSONAL",
  PHOTO = "PHOTO",
  VIDEO = "VIDEO",
  OTHER = "OTHER",
}

export enum DocumentStatus {
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
  DELETED = "DELETED",
  DRAFT = "DRAFT",
  PROCESSING = "PROCESSING",
}

// Resource content types (unified system)

export interface Document {
  id: string;
  title: string;
  description?: string;
  filePath: string;
  fileName: string;
  originalFileName?: string;
  fileSize?: number;
  mimeType?: string;
  type: DocumentType;
  status: DocumentStatus;
  uploadedBy: string;
  familyId?: string;
  tags: string[];
  // Multimedia metadata (Session 010: Added for audio/video support)
  duration?: number; // Duration in seconds (for audio/video)
  width?: number; // Width in pixels (for images/video)
  height?: number; // Height in pixels (for images/video)
  thumbnailPath?: string; // Path to generated thumbnail
  previewPath?: string; // Path to preview/low-res version
  metadata: Record<string, unknown>;
  isPublic: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  uploadedByUser?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  family?: {
    id: string;
    name: string;
  };
}

export interface CreateDocumentInput {
  title: string;
  description?: string;
  filePath: string;
  fileName: string;
  originalFileName?: string;
  fileSize?: number;
  mimeType?: string;
  type?: DocumentType;
  status?: DocumentStatus;
  uploadedBy: string;
  familyId?: string;
  // Multimedia metadata
  duration?: number;
  width?: number;
  height?: number;
  thumbnailPath?: string;
  previewPath?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  isPublic?: boolean;
  expiresAt?: Date;
}

export interface UpdateDocumentInput {
  title?: string;
  description?: string;
  filePath?: string;
  fileName?: string;
  type?: DocumentType;
  status?: DocumentStatus;
  familyId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  isPublic?: boolean;
  expiresAt?: Date;
}

// Tag and Category interfaces
export interface Tag {
  id: string;
  name: string;
  description?: string;
  color?: string;
  categoryId?: string;
  familyId?: string;
  isSystemTag: boolean;
  isActive: boolean;
  usageCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  category?: Category;
  createdByUser?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  family?: {
    id: string;
    name: string;
  };
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string;
  familyId?: string;
  isSystemCategory: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  parent?: Category;
  children?: Category[];
  tags?: Tag[];
  tagCount?: number;
  createdByUser?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  family?: {
    id: string;
    name: string;
  };
}

export interface ResourceTag {
  id: string;
  resourceId: string;
  tagId: string;
  createdAt: Date;
  resource?: Resource;
  tag?: Tag;
}

export interface CreateTagInput {
  name: string;
  description?: string;
  color?: string;
  categoryId?: string;
  familyId?: string;
  createdBy: string;
}

export interface UpdateTagInput {
  name?: string;
  description?: string;
  color?: string;
  categoryId?: string;
  isActive?: boolean;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string;
  familyId?: string;
  createdBy: string;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string;
  isActive?: boolean;
}

// Notification types for email
export interface NotificationEmailData {
  recipientName: string;
  unsubscribeUrl: string;
  [key: string]: unknown;
}

export interface MessageNotificationData extends NotificationEmailData {
  senderName: string;
  conversationTitle?: string;
  messagePreview: string;
  conversationUrl: string;
  familyName?: string;
  messageCount?: number;
}

export interface CareUpdateNotificationData extends NotificationEmailData {
  familyName: string;
  updateTitle: string;
  updateContent: string;
  updateUrl: string;
  updateAuthor: string;
  updateDate: string;
}

export interface EmergencyAlertNotificationData extends NotificationEmailData {
  alertTitle: string;
  alertContent: string;
  alertUrl: string;
  familyName: string;
  contactInfo: string;
  issueDate: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface AnnouncementNotificationData extends NotificationEmailData {
  announcementTitle: string;
  announcementContent: string;
  announcementUrl: string;
  authorName: string;
  publishDate: string;
  priority?: "low" | "normal" | "high" | "urgent";
}

export interface FamilyActivityNotificationData extends NotificationEmailData {
  familyName: string;
  activityTitle: string;
  activityDescription: string;
  activityUrl: string;
  activityDate: string;
  participants: string[];
}

// Input types for creating notifications
export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
  isActionable?: boolean;
  actionUrl?: string;
  expiresAt?: Date;
}

export interface UpdateNotificationPreferencesInput {
  emailEnabled?: boolean;
  emailMessages?: boolean;
  emailCareUpdates?: boolean;
  emailAnnouncements?: boolean;
  emailFamilyActivity?: boolean;
  emailEmergencyAlerts?: boolean;
  inAppEnabled?: boolean;
  inAppMessages?: boolean;
  inAppCareUpdates?: boolean;
  inAppAnnouncements?: boolean;
  inAppFamilyActivity?: boolean;
  inAppEmergencyAlerts?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
}

// ====================================
// FORUM SYSTEM TYPES (Session 010)
// ====================================

// Enhanced Forum interface
export interface Forum {
  id: string;
  title: string;
  description?: string;
  slug: string;
  icon?: string;
  color?: string;
  visibility: ForumVisibility;
  familyId?: string;
  allowedRoles: string[];
  createdBy: string;
  moderators: string[];
  rules?: string;
  settings?: Record<string, unknown>;
  isActive: boolean;
  isArchived: boolean;
  postCount: number;
  memberCount: number;
  lastActivityAt: Date;
  lastPostAt?: Date;
  lastPostBy?: string;
  createdAt: Date;
  updatedAt: Date;

  // Relations
  family?: Family;
  creator?: User;
  posts?: Post[];
  members?: ForumMember[];
  categories?: ForumCategory[];
}

export interface ForumCategory {
  id: string;
  forumId: string;
  name: string;
  description?: string;
  slug: string;
  color?: string;
  icon?: string;
  order: number;
  postCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Relations
  forum?: Forum;
  posts?: Post[];
}

export interface ForumMember {
  id: string;
  forumId: string;
  userId: string;
  role: string;
  joinedAt: Date;
  lastViewedAt: Date;
  postCount: number;
  replyCount: number;
  notifications: boolean;

  // Relations
  forum?: Forum;
  user?: User;
}

export interface Post {
  id: string;
  forumId: string;
  categoryId?: string;
  authorId: string;
  title: string;
  content: string;
  slug: string;
  type: PostType;
  isPinned: boolean;
  isLocked: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  deleteReason?: string;
  attachments: string[];
  tags: string[];
  metadata?: Record<string, unknown>;
  viewCount: number;
  replyCount: number;
  upvoteCount: number;
  downvoteCount: number;
  score: number;
  lastReplyAt?: Date;
  lastReplyBy?: string;
  createdAt: Date;
  updatedAt: Date;
  editedAt?: Date;

  // Relations
  forum?: Forum;
  category?: ForumCategory;
  author?: User;
  replies?: Reply[];
  votes?: Vote[];
  documents?: Document[];
}

export interface Reply {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  parentId?: string;
  depth: number;
  attachments: string[];
  metadata?: Record<string, unknown>;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  deleteReason?: string;
  upvoteCount: number;
  downvoteCount: number;
  score: number;
  createdAt: Date;
  updatedAt: Date;
  editedAt?: Date;

  // Relations
  post?: Post;
  author?: User;
  parent?: Reply;
  children?: Reply[];
  votes?: Vote[];
  documents?: Document[];
}

export interface Vote {
  id: string;
  userId: string;
  postId?: string;
  replyId?: string;
  voteType: VoteType;
  createdAt: Date;
  updatedAt: Date;

  // Relations
  user?: User;
  post?: Post;
  reply?: Reply;
}

// Forum Input Types
export interface CreateForumInput {
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  visibility?: ForumVisibility;
  familyId?: string;
  allowedRoles?: string[];
  createdBy: string;
  rules?: string;
  settings?: Record<string, unknown>;
}

export interface UpdateForumInput {
  title?: string;
  description?: string;
  icon?: string;
  color?: string;
  visibility?: ForumVisibility;
  allowedRoles?: string[];
  moderators?: string[];
  rules?: string;
  settings?: Record<string, unknown>;
  isActive?: boolean;
  isArchived?: boolean;
}

export interface CreatePostInput {
  forumId: string;
  categoryId?: string;
  authorId: string;
  title: string;
  content: string;
  type?: PostType;
  attachments?: string[];
  documentIds?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
  type?: PostType;
  categoryId?: string;
  attachments?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
  isPinned?: boolean;
  isLocked?: boolean;
}

export interface CreateReplyInput {
  postId: string;
  authorId: string;
  content: string;
  parentId?: string;
  attachments?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateReplyInput {
  content?: string;
  attachments?: string[];
  metadata?: Record<string, unknown>;
}

export interface CreateVoteInput {
  userId: string;
  postId?: string;
  replyId?: string;
  voteType: VoteType;
}

export interface ForumMembershipInput {
  forumId: string;
  userId: string;
  role?: string;
  notifications?: boolean;
}

// Forum Filter Types
export interface ForumFilters {
  visibility?: ForumVisibility;
  familyId?: string;
  createdBy?: string;
  isActive?: boolean;
  isArchived?: boolean;
  search?: string;
  tags?: string[];
}

export interface PostFilters {
  forumId?: string;
  categoryId?: string;
  authorId?: string;
  type?: PostType;
  isPinned?: boolean;
  isLocked?: boolean;
  isDeleted?: boolean;
  tags?: string[];
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface ReplyFilters {
  postId?: string;
  authorId?: string;
  parentId?: string;
  depth?: number;
  isDeleted?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

// Forum Statistics
export interface ForumStatistics {
  totalForums: number;
  totalPosts: number;
  totalReplies: number;
  totalMembers: number;
  activeForums: number;
  recentActivity: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
  topContributors: Array<{
    userId: string;
    username: string;
    postCount: number;
    replyCount: number;
  }>;
}

export interface PostStatistics {
  viewCount: number;
  replyCount: number;
  upvoteCount: number;
  downvoteCount: number;
  score: number;
  engagementRate: number;
}


// ====================================
// RESOURCES SYSTEM TYPES (Session 010)
// ====================================

// Unified Resource interface
export interface Resource {
  id: string;
  title: string;
  description?: string;
  body?: string; // Main content (markdown/rich text)
  resourceType: ResourceType; // Type of resource (DOCUMENT, LINK, VIDEO, etc.)

  // Organization fields
  visibility: ResourceVisibility;
  familyId?: string;
  categoryId?: string;
  tags: string[];
  attachments: string[]; // Legacy field for migration

  // Ownership and access
  createdBy: string;
  sharedWith: string[]; // User IDs for shared resources

  // Feature flags
  hasCuration: boolean; // Enable curation workflow
  hasRatings: boolean; // Enable rating system
  hasSharing: boolean; // Enable advanced sharing

  // Archive and deletion (simplified)
  isArchived: boolean;
  isDeleted: boolean;
  deletedAt?: Date;

  // Resource fields
  url?: string; // External URL for links/videos
  targetAudience: string[]; // Target user roles
  status?: ResourceStatus; // Curation workflow status
  submittedBy?: string; // Different from createdBy for resources
  approvedBy?: string;
  approvedAt?: Date;
  featuredBy?: string;
  featuredAt?: Date;
  isVerified: boolean;
  lastVerifiedAt?: Date;
  externalMeta?: Record<string, unknown>; // Metadata for external resources

  // Engagement metrics
  viewCount: number;
  downloadCount: number;
  shareCount: number;
  rating?: number; // Average rating (1-5)
  ratingCount: number; // Number of ratings

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Relations
  creator?: User;
  family?: Family;
  category?: Category;
  documents?: PrismaResourceDocument[];
  shares?: ResourceShare[];
  structuredTags?: ResourceTag[];
  ratings?: ResourceRating[];
  formResponses?: ResourceFormResponse[];
  submitter?: User;
  approver?: User;
}

export interface ResourceRating {
  id: string;
  resourceId: string;
  userId: string;
  rating: number;
  review?: string;
  isHelpful?: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Relations
  resource?: Resource;
  user?: User;
}

export interface ResourceShare {
  id: string;
  resourceId: string;
  sharedBy: string;
  sharedWith?: string;
  shareMethod: string;
  shareData?: Record<string, unknown>;
  sharedAt: Date;

  // Relations
  resource?: Resource;
  sharer?: User;
  recipient?: User;
}

export interface ResourceFormResponse {
  id: string;
  resourceId: string;
  respondentId: string;
  formData: Record<string, unknown>;
  isComplete: boolean;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Relations
  resource?: Resource;
  respondent?: User;
}

// Resource Input Types
export interface CreateResourceInput {
  title: string;
  description?: string;
  body?: string; // Main content (markdown/rich text)
  resourceType: ResourceType;
  visibility?: ResourceVisibility;
  familyId?: string;
  categoryId?: string;
  tags?: string[];
  attachments?: string[];
  createdBy: string;
  sharedWith?: string[];
  hasCuration?: boolean;
  hasRatings?: boolean;
  hasSharing?: boolean;
  url?: string;
  targetAudience?: string[];
  status?: ResourceStatus;
  submittedBy?: string;
  externalMeta?: Record<string, unknown>;
}

export interface UpdateResourceInput {
  title?: string;
  description?: string;
  body?: string;
  resourceType?: ResourceType;
  visibility?: ResourceVisibility;
  categoryId?: string;
  tags?: string[];
  attachments?: string[];
  sharedWith?: string[];
  hasCuration?: boolean;
  hasRatings?: boolean;
  hasSharing?: boolean;
  isArchived?: boolean;
  isDeleted?: boolean;
  url?: string;
  targetAudience?: string[];
  status?: ResourceStatus;
  isVerified?: boolean;
  externalMeta?: Record<string, unknown>;
}

export interface CreateResourceRatingInput {
  resourceId: string;
  userId: string;
  rating: number; // 1-5 stars
  review?: string;
  isHelpful?: boolean;
}

export interface ShareResourceInput {
  resourceId: string;
  sharedBy: string;
  sharedWith?: string;
  shareMethod: string;
  shareData?: Record<string, unknown>;
}

// Resource Filter Types
export interface ResourceFilters {
  createdBy?: string;
  submittedBy?: string;
  familyId?: string;
  categoryId?: string;
  resourceType?: ResourceType;
  status?: ResourceStatus;
  visibility?: ResourceVisibility;
  tags?: string[];
  isVerified?: boolean;
  targetAudience?: string[];
  hasCuration?: boolean;
  hasRatings?: boolean;
  hasSharing?: boolean;
  isArchived?: boolean;
  isDeleted?: boolean;
  isSystemGenerated?: boolean;
  search?: string;
  ratingMin?: number;
  ratingMax?: number;
  createdAfter?: Date;
  createdBefore?: Date;
}

// Resource Statistics Types
export interface ResourceStatistics {
  totalResources: number;
  approvedResources: number;
  featuredResources: number;
  pendingResources: number;
  totalRatings: number;
  totalShares: number;
  averageRating: number;
  topCategories: {
    categoryId: string;
    count: number;
  }[];
}

// Generic pagination result
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Authentication context
export interface AuthContext {
  userId?: string;
  user?: User;
  clerkUserId?: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

export interface TagWithUsage {
  id: string;
  name: string;
  description?: string;
  color?: string;
  categoryId?: string;
  familyId?: string;
  isSystemTag: boolean;
  usageCount: number;
  createdAt: Date;
}

// ====================================
// TEMPLATE ASSIGNMENT TYPES
// ====================================

export type TemplateAssignmentStatus = 'pending' | 'started' | 'completed';

export interface TemplateAssignment {
  id: string;
  resourceId: string;
  assigneeId: string;
  assignedBy: string;
  assignedAt: Date;
  status: TemplateAssignmentStatus;
  startedAt?: Date;
  completedAt?: Date;
  notes?: string;

  // Relations
  resource?: Resource;
  assignee?: User;
  assigner?: User;
}

export interface CreateTemplateAssignmentInput {
  resourceId: string;
  assigneeIds: string[];
  assignedBy: string;
  notes?: string;
}

export interface TemplateAssignmentFilters {
  resourceId?: string;
  assigneeId?: string;
  assignedBy?: string;
  status?: TemplateAssignmentStatus;
}

export interface AssignableMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  familyId: string | null;
  familyName?: string;
  alreadyAssigned: boolean;
  completedAt?: Date | null;
}
