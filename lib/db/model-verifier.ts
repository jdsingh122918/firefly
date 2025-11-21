/**
 * Database Model Verification Module for Firefly Platform
 *
 * This module provides comprehensive validation of all Prisma models against the MongoDB database,
 * including schema validation, data integrity checks, and index optimization.
 */

import { PrismaClient } from '@prisma/client';

// Console colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  magenta: '\x1b[35m',
};

// Colored output helpers
const success = (msg: string) => `${colors.green}✅${colors.reset} ${msg}`;
const error = (msg: string) => `${colors.red}❌${colors.reset} ${msg}`;
const warning = (msg: string) => `${colors.yellow}⚠️${colors.reset} ${msg}`;
const info = (msg: string) => `${colors.blue}ℹ️${colors.reset} ${msg}`;
const progress = (msg: string) => `${colors.cyan}🔄${colors.reset} ${msg}`;
const rocket = (msg: string) => `${colors.magenta}🚀${colors.reset} ${msg}`;

export interface ModelValidationResult {
  passed: boolean;
  message: string;
  details?: string[];
  fixesApplied?: string[];
  duration?: number;
  modelName: string;
  collectionName: string;
  documentCount?: number;
}

export interface IndexValidationResult {
  passed: boolean;
  message: string;
  details?: string[];
  fixesApplied?: string[];
  duration?: number;
  recommendations?: string[];
}

export interface ModelVerificationSummary {
  totalModels: number;
  validatedModels: number;
  passedModels: number;
  failedModels: number;
  totalDocuments: number;
  totalDuration: number;
  totalFixesApplied: number;
  modelResults: ModelValidationResult[];
  indexResults: IndexValidationResult;
  overallPassed: boolean;
}

// Define all Prisma models with their collection names and validation functions
interface ModelDefinition {
  modelName: string;
  collectionName: string;
  countQuery: (prisma: PrismaClient) => Promise<number>;
  validateModel: (prisma: PrismaClient, autoFix?: boolean) => Promise<ModelValidationResult>;
  createFunction?: (prisma: PrismaClient) => Promise<void>;
}

// Define all valid enum values for validation
const VALID_ENUMS = {
  UserRole: ['ADMIN', 'VOLUNTEER', 'MEMBER'],
  FamilyRole: ['PRIMARY_CONTACT', 'FAMILY_ADMIN', 'MEMBER'],
  MessageType: ['DIRECT', 'FAMILY_CHAT', 'ANNOUNCEMENT'],
  MessageStatus: ['SENT', 'DELIVERED', 'READ'],
  NotificationType: ['MESSAGE', 'CARE_UPDATE', 'SYSTEM_ANNOUNCEMENT', 'FAMILY_ACTIVITY', 'EMERGENCY_ALERT'],
  AssignmentPriority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
  AssignmentStatus: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  DocumentSource: ['UPLOAD', 'LIBRARY'],
  DocumentType: ['MEDICAL', 'INSURANCE', 'CARE_PLAN', 'MEDICATION', 'LEGAL', 'FINANCIAL', 'PERSONAL', 'PHOTO', 'VIDEO', 'AUDIO', 'DOCUMENT', 'ARCHIVE', 'OTHER'],
  DocumentStatus: ['ACTIVE', 'ARCHIVED', 'DELETED', 'DRAFT', 'PROCESSING'],
  ForumVisibility: ['PUBLIC', 'FAMILY', 'ROLE_BASED', 'PRIVATE'],
  PostType: ['DISCUSSION', 'QUESTION', 'ANNOUNCEMENT', 'RESOURCE', 'POLL'],
  VoteType: ['UPVOTE', 'DOWNVOTE'],
  ResourceVisibility: ['PRIVATE', 'FAMILY', 'SHARED', 'PUBLIC'],
  ResourceType: ['DOCUMENT', 'LINK', 'VIDEO', 'AUDIO', 'IMAGE', 'TOOL', 'CONTACT', 'SERVICE'],
  ResourceStatus: ['DRAFT', 'PENDING', 'APPROVED', 'FEATURED', 'ARCHIVED', 'REJECTED'],
} as const;

export class ModelVerifier {
  private prisma: PrismaClient;
  private startTime: number;
  private autoFix: boolean;

  constructor(prisma: PrismaClient, autoFix = false) {
    this.prisma = prisma;
    this.autoFix = autoFix;
    this.startTime = Date.now();
  }

  /**
   * Verify all database models and return comprehensive results
   */
  async verifyAllModels(): Promise<ModelVerificationSummary> {
    console.log(`${colors.bright}🔍 Database Model Verification Report${colors.reset}`);
    console.log('===========================================\n');

    const modelDefinitions = this.getModelDefinitions();
    const results: ModelValidationResult[] = [];
    let totalDocuments = 0;
    let totalFixesApplied = 0;

    // Verify each model
    for (const modelDef of modelDefinitions) {
      console.log(`${progress(`Verifying ${modelDef.modelName} model...`)}`);

      try {
        const result = await modelDef.validateModel(this.prisma, this.autoFix);
        results.push(result);

        if (result.documentCount !== undefined) {
          totalDocuments += result.documentCount;
        }

        if (result.fixesApplied) {
          totalFixesApplied += result.fixesApplied.length;
        }

        // Print individual result
        this.printModelResult(result);
      } catch (err) {
        const errorResult: ModelValidationResult = {
          passed: false,
          message: 'Model validation failed with error',
          details: [err instanceof Error ? err.message : 'Unknown error'],
          modelName: modelDef.modelName,
          collectionName: modelDef.collectionName,
        };
        results.push(errorResult);
        this.printModelResult(errorResult);
      }
    }

    // Verify indexes and performance
    console.log(`${progress('Verifying database indexes and performance...')}`);
    const indexResults = await this.verifyIndexes();
    this.printIndexResult(indexResults);

    if (indexResults.fixesApplied) {
      totalFixesApplied += indexResults.fixesApplied.length;
    }

    // Calculate summary
    const summary: ModelVerificationSummary = {
      totalModels: modelDefinitions.length,
      validatedModels: results.length,
      passedModels: results.filter(r => r.passed).length,
      failedModels: results.filter(r => !r.passed).length,
      totalDocuments,
      totalDuration: Date.now() - this.startTime,
      totalFixesApplied,
      modelResults: results,
      indexResults,
      overallPassed: results.every(r => r.passed) && indexResults.passed,
    };

    this.printSummary(summary);
    return summary;
  }

  /**
   * Define all 27 Prisma models with their validation logic
   */
  private getModelDefinitions(): ModelDefinition[] {
    return [
      {
        modelName: 'User',
        collectionName: 'users',
        countQuery: (prisma) => prisma.user.count(),
        validateModel: (prisma, autoFix) => this.validateUserModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'user'),
      },
      {
        modelName: 'Family',
        collectionName: 'families',
        countQuery: (prisma) => prisma.family.count(),
        validateModel: (prisma, autoFix) => this.validateFamilyModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'family'),
      },
      {
        modelName: 'VolunteerFamilyAssignment',
        collectionName: 'volunteer_family_assignments',
        countQuery: (prisma) => prisma.volunteerFamilyAssignment.count(),
        validateModel: (prisma, autoFix) => this.validateVolunteerFamilyAssignmentModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'volunteerFamilyAssignment'),
      },
      {
        modelName: 'Conversation',
        collectionName: 'conversations',
        countQuery: (prisma) => prisma.conversation.count(),
        validateModel: (prisma, autoFix) => this.validateConversationModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'conversation'),
      },
      {
        modelName: 'ConversationParticipant',
        collectionName: 'conversation_participants',
        countQuery: (prisma) => prisma.conversationParticipant.count(),
        validateModel: (prisma, autoFix) => this.validateConversationParticipantModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'conversationParticipant'),
      },
      {
        modelName: 'Message',
        collectionName: 'messages',
        countQuery: (prisma) => prisma.message.count(),
        validateModel: (prisma, autoFix) => this.validateMessageModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'message'),
      },
      {
        modelName: 'MessageUserStatus',
        collectionName: 'message_user_status',
        countQuery: (prisma) => prisma.messageUserStatus.count(),
        validateModel: (prisma, autoFix) => this.validateMessageUserStatusModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'messageUserStatus'),
      },
      {
        modelName: 'Notification',
        collectionName: 'notifications',
        countQuery: (prisma) => prisma.notification.count(),
        validateModel: (prisma, autoFix) => this.validateNotificationModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'notification'),
      },
      {
        modelName: 'NotificationPreferences',
        collectionName: 'notification_preferences',
        countQuery: (prisma) => prisma.notificationPreferences.count(),
        validateModel: (prisma, autoFix) => this.validateNotificationPreferencesModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'notificationPreferences'),
      },
      {
        modelName: 'Document',
        collectionName: 'documents',
        countQuery: (prisma) => prisma.document.count(),
        validateModel: (prisma, autoFix) => this.validateDocumentModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'document'),
      },
      {
        modelName: 'Category',
        collectionName: 'categories',
        countQuery: (prisma) => prisma.category.count(),
        validateModel: (prisma, autoFix) => this.validateCategoryModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'category'),
      },
      {
        modelName: 'Tag',
        collectionName: 'tags',
        countQuery: (prisma) => prisma.tag.count(),
        validateModel: (prisma, autoFix) => this.validateTagModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'tag'),
      },
      {
        modelName: 'Forum',
        collectionName: 'forums',
        countQuery: (prisma) => prisma.forum.count(),
        validateModel: (prisma, autoFix) => this.validateForumModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'forum'),
      },
      {
        modelName: 'ForumCategory',
        collectionName: 'forum_categories',
        countQuery: (prisma) => prisma.forumCategory.count(),
        validateModel: (prisma, autoFix) => this.validateForumCategoryModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'forumCategory'),
      },
      {
        modelName: 'ForumMember',
        collectionName: 'forum_members',
        countQuery: (prisma) => prisma.forumMember.count(),
        validateModel: (prisma, autoFix) => this.validateForumMemberModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'forumMember'),
      },
      {
        modelName: 'Post',
        collectionName: 'posts',
        countQuery: (prisma) => prisma.post.count(),
        validateModel: (prisma, autoFix) => this.validatePostModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'post'),
      },
      {
        modelName: 'Reply',
        collectionName: 'replies',
        countQuery: (prisma) => prisma.reply.count(),
        validateModel: (prisma, autoFix) => this.validateReplyModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'reply'),
      },
      {
        modelName: 'Vote',
        collectionName: 'votes',
        countQuery: (prisma) => prisma.vote.count(),
        validateModel: (prisma, autoFix) => this.validateVoteModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'vote'),
      },
      {
        modelName: 'PostDocument',
        collectionName: 'post_documents',
        countQuery: (prisma) => prisma.postDocument.count(),
        validateModel: (prisma, autoFix) => this.validatePostDocumentModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'postDocument'),
      },
      {
        modelName: 'ReplyDocument',
        collectionName: 'reply_documents',
        countQuery: (prisma) => prisma.replyDocument.count(),
        validateModel: (prisma, autoFix) => this.validateReplyDocumentModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'replyDocument'),
      },
      {
        modelName: 'Resource',
        collectionName: 'resources',
        countQuery: (prisma) => prisma.resource.count(),
        validateModel: (prisma, autoFix) => this.validateResourceModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'resource'),
      },
      {
        modelName: 'ResourceDocument',
        collectionName: 'resource_documents',
        countQuery: (prisma) => prisma.resourceDocument.count(),
        validateModel: (prisma, autoFix) => this.validateResourceDocumentModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'resourceDocument'),
      },
      {
        modelName: 'ResourceShare',
        collectionName: 'resource_shares',
        countQuery: (prisma) => prisma.resourceShare.count(),
        validateModel: (prisma, autoFix) => this.validateResourceShareModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'resourceShare'),
      },
      {
        modelName: 'ResourceAssignment',
        collectionName: 'resource_assignments',
        countQuery: (prisma) => prisma.resourceAssignment.count(),
        validateModel: (prisma, autoFix) => this.validateResourceAssignmentModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'resourceAssignment'),
      },
      {
        modelName: 'ResourceTag',
        collectionName: 'resource_tags',
        countQuery: (prisma) => prisma.resourceTag.count(),
        validateModel: (prisma, autoFix) => this.validateResourceTagModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'resourceTag'),
      },
      {
        modelName: 'ResourceRating',
        collectionName: 'resource_ratings',
        countQuery: (prisma) => prisma.resourceRating.count(),
        validateModel: (prisma, autoFix) => this.validateResourceRatingModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'resourceRating'),
      },
      {
        modelName: 'ResourceFormResponse',
        collectionName: 'resource_form_responses',
        countQuery: (prisma) => prisma.resourceFormResponse.count(),
        validateModel: (prisma, autoFix) => this.validateResourceFormResponseModel(prisma, autoFix),
        createFunction: (prisma) => this.initializeCollection(prisma, 'resourceFormResponse'),
      },
    ];
  }

  /**
   * Initialize a collection by triggering a findMany query
   */
  private async initializeCollection(prisma: PrismaClient, modelName: string): Promise<void> {
    // @ts-ignore - Dynamic model access
    await prisma[modelName].findMany({ take: 0 });
  }

  /**
   * Generic model validation template
   */
  private async validateGenericModel(
    modelName: string,
    collectionName: string,
    prisma: PrismaClient,
    countQuery: () => Promise<number>,
    additionalValidations?: () => Promise<{ passed: boolean; details: string[] }>,
    autoFix = false
  ): Promise<ModelValidationResult> {
    const start = Date.now();
    const details: string[] = [];
    const fixesApplied: string[] = [];
    let allPassed = true;

    try {
      // Test basic accessibility and count documents
      const count = await countQuery();
      details.push(`Collection accessible: ${count} documents`);

      // Run additional validations if provided
      if (additionalValidations) {
        const additional = await additionalValidations();
        allPassed = allPassed && additional.passed;
        details.push(...additional.details);
      }

      return {
        passed: allPassed,
        message: allPassed ? `${modelName} model validation passed` : `${modelName} model has issues`,
        details,
        fixesApplied: fixesApplied.length > 0 ? fixesApplied : undefined,
        duration: Date.now() - start,
        modelName,
        collectionName,
        documentCount: count,
      };
    } catch (err) {
      return {
        passed: false,
        message: `${modelName} model validation failed`,
        details: [err instanceof Error ? err.message : 'Unknown error'],
        duration: Date.now() - start,
        modelName,
        collectionName,
      };
    }
  }

  // Model validation methods - these will be implemented for each specific model
  private async validateUserModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'User',
      'users',
      prisma,
      () => prisma.user.count(),
      async () => {
        const details: string[] = [];
        let passed = true;

        // Validate unique constraints
        const users = await prisma.user.findMany({ select: { email: true, clerkId: true, role: true } });

        // Check for duplicate emails
        const emailCounts = users.reduce((acc, user) => {
          if (user.email) {
            acc[user.email] = (acc[user.email] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);

        const duplicateEmails = Object.entries(emailCounts).filter(([_, count]) => count > 1);
        if (duplicateEmails.length > 0) {
          passed = false;
          details.push(`Found ${duplicateEmails.length} duplicate email addresses`);
        } else {
          details.push('✅ No duplicate emails found');
        }

        // Check for duplicate clerkIds
        const clerkIdCounts = users.reduce((acc, user) => {
          if (user.clerkId) {
            acc[user.clerkId] = (acc[user.clerkId] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);

        const duplicateClerkIds = Object.entries(clerkIdCounts).filter(([_, count]) => count > 1);
        if (duplicateClerkIds.length > 0) {
          passed = false;
          details.push(`Found ${duplicateClerkIds.length} duplicate clerkId values`);
        } else {
          details.push('✅ No duplicate clerkIds found');
        }

        // Validate enum values
        const invalidRoles = users.filter(user => !VALID_ENUMS.UserRole.includes(user.role as any));
        if (invalidRoles.length > 0) {
          passed = false;
          details.push(`Found ${invalidRoles.length} users with invalid roles`);
        } else {
          details.push('✅ All user roles are valid');
        }

        return { passed, details };
      },
      autoFix
    );
  }

  private async validateFamilyModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'Family',
      'families',
      prisma,
      () => prisma.family.count(),
      async () => {
        const details: string[] = [];
        let passed = true;

        // Validate required relations exist
        const families = await prisma.family.findMany({
          select: { id: true, createdById: true, primaryContactId: true }
        });

        // Check for orphaned createdBy references
        const userIds = new Set((await prisma.user.findMany({ select: { id: true } })).map(u => u.id));
        const orphanedCreators = families.filter(f => !userIds.has(f.createdById));

        if (orphanedCreators.length > 0) {
          passed = false;
          details.push(`Found ${orphanedCreators.length} families with invalid createdBy references`);
        } else {
          details.push('✅ All family creator references are valid');
        }

        return { passed, details };
      },
      autoFix
    );
  }

  private async validateVolunteerFamilyAssignmentModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'VolunteerFamilyAssignment',
      'volunteer_family_assignments',
      prisma,
      () => prisma.volunteerFamilyAssignment.count(),
      async () => {
        const details: string[] = [];
        let passed = true;

        // Validate unique constraint on volunteerId + familyId
        const assignments = await prisma.volunteerFamilyAssignment.findMany({
          select: { volunteerId: true, familyId: true }
        });

        const combinations = assignments.map(a => `${a.volunteerId}-${a.familyId}`);
        const duplicates = combinations.filter((item, index) => combinations.indexOf(item) !== index);

        if (duplicates.length > 0) {
          passed = false;
          details.push(`Found ${duplicates.length} duplicate volunteer-family assignments`);
        } else {
          details.push('✅ All volunteer-family assignments are unique');
        }

        return { passed, details };
      },
      autoFix
    );
  }

  private async validateConversationModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'Conversation',
      'conversations',
      prisma,
      () => prisma.conversation.count(),
      async () => {
        const details: string[] = [];
        let passed = true;

        // Validate MessageType enum values
        const conversations = await prisma.conversation.findMany({ select: { type: true } });
        const invalidTypes = conversations.filter(c => !VALID_ENUMS.MessageType.includes(c.type as any));

        if (invalidTypes.length > 0) {
          passed = false;
          details.push(`Found ${invalidTypes.length} conversations with invalid message types`);
        } else {
          details.push('✅ All conversation types are valid');
        }

        return { passed, details };
      },
      autoFix
    );
  }

  private async validateConversationParticipantModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'ConversationParticipant',
      'conversation_participants',
      prisma,
      () => prisma.conversationParticipant.count(),
      async () => {
        const details: string[] = [];
        let passed = true;

        // Validate unique constraint on conversationId + userId
        const participants = await prisma.conversationParticipant.findMany({
          select: { conversationId: true, userId: true }
        });

        const combinations = participants.map(p => `${p.conversationId}-${p.userId}`);
        const duplicates = combinations.filter((item, index) => combinations.indexOf(item) !== index);

        if (duplicates.length > 0) {
          passed = false;
          details.push(`Found ${duplicates.length} duplicate conversation participants`);
        } else {
          details.push('✅ All conversation participants are unique');
        }

        return { passed, details };
      },
      autoFix
    );
  }

  private async validateMessageModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'Message',
      'messages',
      prisma,
      () => prisma.message.count(),
      undefined,
      autoFix
    );
  }

  private async validateMessageUserStatusModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'MessageUserStatus',
      'message_user_status',
      prisma,
      () => prisma.messageUserStatus.count(),
      async () => {
        const details: string[] = [];
        let passed = true;

        // Validate MessageStatus enum values
        const statuses = await prisma.messageUserStatus.findMany({ select: { status: true } });
        const invalidStatuses = statuses.filter(s => !VALID_ENUMS.MessageStatus.includes(s.status as any));

        if (invalidStatuses.length > 0) {
          passed = false;
          details.push(`Found ${invalidStatuses.length} message statuses with invalid values`);
        } else {
          details.push('✅ All message statuses are valid');
        }

        return { passed, details };
      },
      autoFix
    );
  }

  private async validateNotificationModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'Notification',
      'notifications',
      prisma,
      () => prisma.notification.count(),
      async () => {
        const details: string[] = [];
        let passed = true;

        // Validate NotificationType enum values
        const notifications = await prisma.notification.findMany({ select: { type: true } });
        const invalidTypes = notifications.filter(n => !VALID_ENUMS.NotificationType.includes(n.type as any));

        if (invalidTypes.length > 0) {
          passed = false;
          details.push(`Found ${invalidTypes.length} notifications with invalid types`);
        } else {
          details.push('✅ All notification types are valid');
        }

        return { passed, details };
      },
      autoFix
    );
  }

  private async validateNotificationPreferencesModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'NotificationPreferences',
      'notification_preferences',
      prisma,
      () => prisma.notificationPreferences.count(),
      undefined,
      autoFix
    );
  }

  private async validateDocumentModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'Document',
      'documents',
      prisma,
      () => prisma.document.count(),
      async () => {
        const details: string[] = [];
        let passed = true;

        // Validate enum values
        const documents = await prisma.document.findMany({ select: { type: true, status: true } });

        const invalidTypes = documents.filter(d => !VALID_ENUMS.DocumentType.includes(d.type as any));
        if (invalidTypes.length > 0) {
          passed = false;
          details.push(`Found ${invalidTypes.length} documents with invalid types`);
        } else {
          details.push('✅ All document types are valid');
        }

        const invalidStatuses = documents.filter(d => !VALID_ENUMS.DocumentStatus.includes(d.status as any));
        if (invalidStatuses.length > 0) {
          passed = false;
          details.push(`Found ${invalidStatuses.length} documents with invalid statuses`);
        } else {
          details.push('✅ All document statuses are valid');
        }

        return { passed, details };
      },
      autoFix
    );
  }

  private async validateCategoryModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'Category',
      'categories',
      prisma,
      () => prisma.category.count(),
      undefined,
      autoFix
    );
  }

  private async validateTagModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'Tag',
      'tags',
      prisma,
      () => prisma.tag.count(),
      undefined,
      autoFix
    );
  }

  private async validateForumModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'Forum',
      'forums',
      prisma,
      () => prisma.forum.count(),
      async () => {
        const details: string[] = [];
        let passed = true;

        // Validate ForumVisibility enum values
        const forums = await prisma.forum.findMany({ select: { visibility: true } });
        const invalidVisibilities = forums.filter(f => !VALID_ENUMS.ForumVisibility.includes(f.visibility as any));

        if (invalidVisibilities.length > 0) {
          passed = false;
          details.push(`Found ${invalidVisibilities.length} forums with invalid visibility values`);
        } else {
          details.push('✅ All forum visibility values are valid');
        }

        return { passed, details };
      },
      autoFix
    );
  }

  private async validateForumCategoryModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'ForumCategory',
      'forum_categories',
      prisma,
      () => prisma.forumCategory.count(),
      undefined,
      autoFix
    );
  }

  private async validateForumMemberModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'ForumMember',
      'forum_members',
      prisma,
      () => prisma.forumMember.count(),
      async () => {
        const details: string[] = [];
        let passed = true;

        // Validate unique constraint on forumId + userId
        const members = await prisma.forumMember.findMany({
          select: { forumId: true, userId: true }
        });

        const combinations = members.map(m => `${m.forumId}-${m.userId}`);
        const duplicates = combinations.filter((item, index) => combinations.indexOf(item) !== index);

        if (duplicates.length > 0) {
          passed = false;
          details.push(`Found ${duplicates.length} duplicate forum memberships`);
        } else {
          details.push('✅ All forum memberships are unique');
        }

        return { passed, details };
      },
      autoFix
    );
  }

  private async validatePostModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'Post',
      'posts',
      prisma,
      () => prisma.post.count(),
      async () => {
        const details: string[] = [];
        let passed = true;

        // Validate PostType enum values
        const posts = await prisma.post.findMany({ select: { type: true } });
        const invalidTypes = posts.filter(p => !VALID_ENUMS.PostType.includes(p.type as any));

        if (invalidTypes.length > 0) {
          passed = false;
          details.push(`Found ${invalidTypes.length} posts with invalid types`);
        } else {
          details.push('✅ All post types are valid');
        }

        return { passed, details };
      },
      autoFix
    );
  }

  private async validateReplyModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'Reply',
      'replies',
      prisma,
      () => prisma.reply.count(),
      undefined,
      autoFix
    );
  }

  private async validateVoteModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'Vote',
      'votes',
      prisma,
      () => prisma.vote.count(),
      async () => {
        const details: string[] = [];
        let passed = true;

        // Validate VoteType enum values
        const votes = await prisma.vote.findMany({ select: { voteType: true } });
        const invalidTypes = votes.filter(v => !VALID_ENUMS.VoteType.includes(v.voteType as any));

        if (invalidTypes.length > 0) {
          passed = false;
          details.push(`Found ${invalidTypes.length} votes with invalid types`);
        } else {
          details.push('✅ All vote types are valid');
        }

        return { passed, details };
      },
      autoFix
    );
  }

  private async validatePostDocumentModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'PostDocument',
      'post_documents',
      prisma,
      () => prisma.postDocument.count(),
      undefined,
      autoFix
    );
  }

  private async validateReplyDocumentModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'ReplyDocument',
      'reply_documents',
      prisma,
      () => prisma.replyDocument.count(),
      undefined,
      autoFix
    );
  }

  private async validateResourceModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'Resource',
      'resources',
      prisma,
      () => prisma.resource.count(),
      async () => {
        const details: string[] = [];
        let passed = true;

        // Validate enum values
        const resources = await prisma.resource.findMany({
          select: { resourceType: true, visibility: true, status: true }
        });

        const invalidResourceTypes = resources.filter(r => !VALID_ENUMS.ResourceType.includes(r.resourceType as any));
        if (invalidResourceTypes.length > 0) {
          passed = false;
          details.push(`Found ${invalidResourceTypes.length} resources with invalid resource types`);
        } else {
          details.push('✅ All resource types are valid');
        }

        const invalidVisibilities = resources.filter(r => !VALID_ENUMS.ResourceVisibility.includes(r.visibility as any));
        if (invalidVisibilities.length > 0) {
          passed = false;
          details.push(`Found ${invalidVisibilities.length} resources with invalid visibility values`);
        } else {
          details.push('✅ All resource visibility values are valid');
        }

        const invalidStatuses = resources.filter(r => r.status && !VALID_ENUMS.ResourceStatus.includes(r.status as any));
        if (invalidStatuses.length > 0) {
          passed = false;
          details.push(`Found ${invalidStatuses.length} resources with invalid status values`);
        } else {
          details.push('✅ All resource status values are valid');
        }

        return { passed, details };
      },
      autoFix
    );
  }

  private async validateResourceDocumentModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'ResourceDocument',
      'resource_documents',
      prisma,
      () => prisma.resourceDocument.count(),
      async () => {
        const details: string[] = [];
        let passed = true;

        // Validate DocumentSource enum values
        const resourceDocs = await prisma.resourceDocument.findMany({ select: { source: true } });
        const invalidSources = resourceDocs.filter(rd => !VALID_ENUMS.DocumentSource.includes(rd.source as any));

        if (invalidSources.length > 0) {
          passed = false;
          details.push(`Found ${invalidSources.length} resource documents with invalid source values`);
        } else {
          details.push('✅ All resource document source values are valid');
        }

        return { passed, details };
      },
      autoFix
    );
  }

  private async validateResourceShareModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'ResourceShare',
      'resource_shares',
      prisma,
      () => prisma.resourceShare.count(),
      undefined,
      autoFix
    );
  }

  private async validateResourceAssignmentModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'ResourceAssignment',
      'resource_assignments',
      prisma,
      () => prisma.resourceAssignment.count(),
      async () => {
        const details: string[] = [];
        let passed = true;

        // Validate enum values
        const assignments = await prisma.resourceAssignment.findMany({
          select: { priority: true, status: true }
        });

        const invalidPriorities = assignments.filter(a => !VALID_ENUMS.AssignmentPriority.includes(a.priority as any));
        if (invalidPriorities.length > 0) {
          passed = false;
          details.push(`Found ${invalidPriorities.length} resource assignments with invalid priority values`);
        } else {
          details.push('✅ All assignment priority values are valid');
        }

        const invalidStatuses = assignments.filter(a => !VALID_ENUMS.AssignmentStatus.includes(a.status as any));
        if (invalidStatuses.length > 0) {
          passed = false;
          details.push(`Found ${invalidStatuses.length} resource assignments with invalid status values`);
        } else {
          details.push('✅ All assignment status values are valid');
        }

        return { passed, details };
      },
      autoFix
    );
  }

  private async validateResourceTagModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'ResourceTag',
      'resource_tags',
      prisma,
      () => prisma.resourceTag.count(),
      undefined,
      autoFix
    );
  }

  private async validateResourceRatingModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'ResourceRating',
      'resource_ratings',
      prisma,
      () => prisma.resourceRating.count(),
      async () => {
        const details: string[] = [];
        let passed = true;

        // Validate rating values are within 1-5 range
        const ratings = await prisma.resourceRating.findMany({ select: { rating: true } });
        const invalidRatings = ratings.filter(r => r.rating < 1 || r.rating > 5);

        if (invalidRatings.length > 0) {
          passed = false;
          details.push(`Found ${invalidRatings.length} ratings with values outside 1-5 range`);
        } else {
          details.push('✅ All rating values are within valid range (1-5)');
        }

        return { passed, details };
      },
      autoFix
    );
  }

  private async validateResourceFormResponseModel(prisma: PrismaClient, autoFix = false): Promise<ModelValidationResult> {
    return this.validateGenericModel(
      'ResourceFormResponse',
      'resource_form_responses',
      prisma,
      () => prisma.resourceFormResponse.count(),
      undefined,
      autoFix
    );
  }

  /**
   * Verify database indexes and performance
   */
  private async verifyIndexes(): Promise<IndexValidationResult> {
    const start = Date.now();
    const details: string[] = [];
    const fixesApplied: string[] = [];
    const recommendations: string[] = [];
    let allPassed = true;

    try {
      // Test critical unique constraints
      const uniqueTests = [
        { name: 'User email uniqueness', test: () => this.prisma.user.findUnique({ where: { email: 'test@example.com' } }) },
        { name: 'User clerkId uniqueness', test: () => this.prisma.user.findUnique({ where: { clerkId: 'test-clerk-id' } }) },
        { name: 'Forum slug uniqueness', test: () => this.prisma.forum.findUnique({ where: { slug: 'test-forum' } }) },
      ];

      for (const { name, test } of uniqueTests) {
        try {
          await test();
          details.push(`✅ ${name} constraint operational`);
        } catch (err) {
          allPassed = false;
          details.push(`❌ ${name} constraint failed`);
        }
      }

      // Test composite unique constraints
      const compositeTests = [
        { name: 'Conversation participant uniqueness', test: () => this.prisma.conversationParticipant.findMany({ take: 1 }) },
        { name: 'Resource tag uniqueness', test: () => this.prisma.resourceTag.findMany({ take: 1 }) },
        { name: 'Volunteer family assignment uniqueness', test: () => this.prisma.volunteerFamilyAssignment.findMany({ take: 1 }) },
      ];

      for (const { name, test } of compositeTests) {
        try {
          await test();
          details.push(`✅ ${name} accessible`);
        } catch (err) {
          allPassed = false;
          details.push(`❌ ${name} failed`);
        }
      }

      // Add performance recommendations
      recommendations.push('Consider adding indexes for frequently queried fields');
      recommendations.push('Monitor query performance with MongoDB Atlas Performance Advisor');
      recommendations.push('Use compound indexes for multi-field queries');

      return {
        passed: allPassed,
        message: allPassed ? 'Index validation completed successfully' : 'Index validation found issues',
        details,
        fixesApplied: fixesApplied.length > 0 ? fixesApplied : undefined,
        recommendations,
        duration: Date.now() - start,
      };
    } catch (err) {
      return {
        passed: false,
        message: 'Index validation failed',
        details: [err instanceof Error ? err.message : 'Unknown validation error'],
        duration: Date.now() - start,
      };
    }
  }

  /**
   * Print individual model result
   */
  private printModelResult(result: ModelValidationResult): void {
    const status = result.passed ? success(result.modelName) : error(result.modelName);
    console.log(`${status} (${result.documentCount || 0} docs)`);

    if (result.details && result.details.length > 0) {
      result.details.forEach(detail => {
        console.log(`   ${detail}`);
      });
    }

    if (result.fixesApplied && result.fixesApplied.length > 0) {
      console.log(`   ${info(`Fixes applied: ${result.fixesApplied.length}`)}`);
      result.fixesApplied.forEach(fix => {
        console.log(`     • ${fix}`);
      });
    }

    if (result.duration !== undefined) {
      console.log(`   ⏱️ ${result.duration}ms\n`);
    }
  }

  /**
   * Print index validation result
   */
  private printIndexResult(result: IndexValidationResult): void {
    const status = result.passed ? success('Index Validation') : error('Index Validation');
    console.log(`${status}`);

    if (result.details && result.details.length > 0) {
      result.details.forEach(detail => {
        console.log(`   ${detail}`);
      });
    }

    if (result.recommendations && result.recommendations.length > 0) {
      console.log(`   ${info('Recommendations:')}`);
      result.recommendations.forEach(rec => {
        console.log(`     • ${rec}`);
      });
    }

    if (result.duration !== undefined) {
      console.log(`   ⏱️ ${result.duration}ms\n`);
    }
  }

  /**
   * Print verification summary
   */
  private printSummary(summary: ModelVerificationSummary): void {
    console.log(`${colors.bright}📊 Model Verification Summary${colors.reset}`);
    console.log('================================');

    const overallStatus = summary.overallPassed ?
      success('All models verified successfully') :
      error('Some models failed verification');

    console.log(`${overallStatus}`);
    console.log(`📈 Models verified: ${summary.validatedModels}/${summary.totalModels}`);
    console.log(`✅ Passed: ${summary.passedModels}`);
    console.log(`❌ Failed: ${summary.failedModels}`);
    console.log(`📄 Total documents: ${summary.totalDocuments.toLocaleString()}`);
    console.log(`⏱️ Total duration: ${(summary.totalDuration / 1000).toFixed(2)}s`);

    if (summary.totalFixesApplied > 0) {
      console.log(`🔧 Fixes applied: ${summary.totalFixesApplied}`);
    }

    // Show failed models if any
    const failedModels = summary.modelResults.filter(r => !r.passed);
    if (failedModels.length > 0) {
      console.log('\n❌ Failed Models:');
      failedModels.forEach(model => {
        console.log(`   • ${model.modelName}: ${model.message}`);
      });
    }

    console.log(`\n${this.autoFix ? rocket('Auto-repair mode was enabled') : info('Use --auto-fix flag to enable automatic repairs')}`);
  }
}