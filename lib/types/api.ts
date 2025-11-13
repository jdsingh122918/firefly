/**
 * API-specific type definitions for request/response handling
 * These types complement the main types.ts file with API-focused interfaces
 */

import {
  UserRole,
  FamilyRole,
  MessageType,
  MessageStatus,
  NotificationType
} from "@prisma/client";

/**
 * Export Data Types
 */
export interface ExportParams {
  format: "csv" | "json";
  includeMembers: boolean;
  includeContactInfo: boolean;
  dateRange: "all" | "last30" | "last90" | "lastYear";
}

export interface ExportedFamily {
  id: string;
  name: string;
  description: string | null;
  createdById: string;
  primaryContactId: string | null;
  createdAt: Date;
  updatedAt: Date;
  members?: ExportedUser[];
  createdBy?: ExportedUser;
}

export interface ExportedUser {
  id: string;
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  familyRole: FamilyRole | null;
  phoneNumber: string | null;
  createdAt: Date;
  familyId?: string | null;
}

export interface FamilyExportData {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  primaryContactId: string | null;
  createdBy: {
    id: string;
    email: string;
    name: string;
  } | null;
  memberCount: number;
  members?: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    familyRole: string;
    phoneNumber: string | null;
    createdAt: Date;
    isPrimaryContact: boolean;
  }[];
}

export interface JSONExportResponse {
  exportMetadata: {
    generatedAt: string;
    totalFamilies: number;
    totalMembers: number;
    parameters: ExportParams;
  };
  families: FamilyExportData[];
}

/**
 * User Export Types
 */
export interface UserExportParams {
  format: "csv" | "json";
  includeContactInfo: boolean;
  includeFamilyInfo: boolean;
  roleFilter?: UserRole;
  dateRange: "all" | "last30" | "last90" | "lastYear";
}

export interface UserExportData {
  id: string;
  email?: string;
  firstName: string | null;
  lastName: string | null;
  name: string;
  role: UserRole;
  familyRole?: FamilyRole | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
  phoneNumber?: string | null;
  family?: {
    id: string | null;
    name: string;
    description: string | null;
    memberCount: number;
  };
  createdBy?: {
    id: string;
    email: string;
    name: string;
  } | null;
}

export interface UserJSONExportResponse {
  exportMetadata: {
    generatedAt: string;
    totalUsers: number;
    parameters: UserExportParams;
  };
  users: UserExportData[];
}

/**
 * API Filter Types
 */
export interface UserFilters {
  search?: string;
  role?: UserRole;
  familyId?: string;
  createdById?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
}

export interface FamilyFilters {
  search?: string;
  createdById?: string;
  hasPrimaryContact?: boolean;
  memberCountMin?: number;
  memberCountMax?: number;
}

export interface TagFilters {
  name?: string;
  resourceType?: string;
  familyId?: string;
  createdById?: string;
}

export interface ConversationFilters {
  type?: MessageType;
  familyId?: string;
  participantId?: string;
  isActive?: boolean;
}

export interface MessageFilters {
  conversationId?: string;
  senderId?: string;
  status?: MessageStatus;
  isDeleted?: boolean;
}

export interface NotificationFilters {
  userId?: string;
  type?: NotificationType;
  isRead?: boolean;
  isActionable?: boolean;
}

/**
 * Sort Options
 */
export type SortOrder = "asc" | "desc";

export interface SortOptions<T> {
  sortBy: keyof T | "createdAt" | "updatedAt";
  sortOrder: SortOrder;
}

/**
 * Pagination
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Tag Management Types
 */
export interface TagSortOptions {
  sortBy: "name" | "usageCount" | "createdAt" | "updatedAt";
  sortOrder: "asc" | "desc";
}

export interface TagWithUsageCount {
  id: string;
  name: string;
  resourceType: string;
  familyId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}


export interface DocumentFilters {
  categoryId?: string;
  uploadedById?: string;
  familyId?: string;
  isPublic?: boolean;
  tags?: string[];
}


export interface NotificationCreateInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: NotificationData;
  isActionable?: boolean;
  actionUrl?: string;
  familyId?: string;
}

/**
 * Message Types
 */
export interface MessageMetadata {
  editHistory?: Array<{
    content: string;
    editedAt: Date;
  }>;
  mentions?: string[];
  [key: string]: unknown;
}

export interface MessageCreateInput {
  content: string;
  conversationId: string;
  senderId: string;
  replyToId?: string;
  attachments?: string[];
  metadata?: MessageMetadata;
}

/**
 * Document Metadata Types
 */
export interface DocumentMetadata {
  version?: string;
  revision?: number;
  tags?: string[];
  author?: string;
  checksum?: string;
  lastViewed?: Date;
  viewCount?: number;
  annotations?: Array<{
    page?: number;
    text: string;
    timestamp: Date;
    userId: string;
  }>;
  [key: string]: unknown;
}

/**
 * Notification Data Types
 */
export interface NotificationData {
  entityId?: string;
  entityType?: string;
  actionType?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  relatedUsers?: string[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Conversation Types
 */
export interface ConversationCreateInput {
  title?: string;
  type: MessageType;
  familyId?: string;
  participantIds: string[];
  createdBy: string;
}

/**
 * Statistics Types
 */
export interface UserStatistics {
  totalUsers: number;
  byRole: Record<UserRole, number>;
  verifiedEmails: number;
  verifiedPhones: number;
  recentActivity: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
}

export interface FamilyStatistics {
  totalFamilies: number;
  averageMemberCount: number;
  familiesWithPrimaryContact: number;
  recentlyCreated: {
    last24h: number;
    last7d: number;
    last30d: number;
  };
}

/**
 * Error Response Types
 */
export interface APIError {
  error: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
  code?: string;
  statusCode?: number;
}

/**
 * Success Response Types
 */
export interface APISuccess<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * Webhook Types
 */
export interface ClerkWebhookEvent {
  data: Record<string, unknown>;
  object: string;
  type: string;
}

export interface WebhookUserData {
  id: string;
  email_addresses: Array<{
    email_address: string;
    verification?: {
      status: string;
    };
  }>;
  first_name?: string;
  last_name?: string;
  public_metadata?: {
    role?: UserRole;
    userId?: string;
  };
}

/**
 * Clerk Error Type
 */
export interface ClerkError {
  errors?: Array<{
    message: string;
    longMessage?: string;
    code: string;
    meta?: {
      paramName?: string;
    };
  }>;
  status?: number;
  clerkError?: boolean;
}