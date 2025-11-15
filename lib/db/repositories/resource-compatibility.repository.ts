import { ContentRepository, ContentFilters, CreateContentInput, UpdateContentInput } from './content.repository';
import { PrismaClient, ContentType, ResourceContentType, ResourceStatus, NoteVisibility, UserRole } from '@prisma/client';

/**
 * Backward Compatibility Layer for Resource Repository
 *
 * This facade provides the existing ResourceRepository interface while
 * delegating to the unified ContentRepository underneath.
 *
 * This allows existing resource-related code to continue working during
 * the migration without requiring immediate changes to all API endpoints.
 */

export interface ResourceFilters {
  submittedBy?: string;
  familyId?: string;
  contentType?: ResourceContentType[];
  status?: ResourceStatus[];
  visibility?: NoteVisibility[];
  categoryId?: string;
  tags?: string[];
  search?: string;
  featured?: boolean;
  verified?: boolean;
  minRating?: number;
  targetAudience?: string[];
  curatedOnly?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'viewCount' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateResourceInput {
  title: string;
  description?: string;
  content?: string;
  contentType: ResourceContentType;
  url?: string;
  targetAudience?: string[];
  visibility?: NoteVisibility;
  familyId?: string;
  categoryId?: string;
  tags?: string[];
  attachments?: string[];
  externalMeta?: any;
}

export interface UpdateResourceInput extends Partial<CreateResourceInput> {
  status?: ResourceStatus;
  isVerified?: boolean;
}

class ResourceCompatibilityRepository {
  private contentRepository: ContentRepository;

  constructor(private prisma: PrismaClient) {
    this.contentRepository = new ContentRepository(prisma);
  }

  /**
   * Create a new resource (maps to Content with RESOURCE type)
   */
  async create(data: CreateResourceInput, userId: string, userRole: UserRole) {
    const contentData: CreateContentInput = {
      title: data.title,
      description: data.description,
      body: data.content, // Map 'content' field to 'body'
      contentType: ContentType.RESOURCE,
      resourceType: data.contentType,
      visibility: data.visibility || NoteVisibility.PUBLIC, // Resources default to public
      familyId: data.familyId,
      categoryId: data.categoryId,
      tags: data.tags,
      url: data.url,
      targetAudience: data.targetAudience,
      externalMeta: data.externalMeta,
      hasCuration: userRole !== UserRole.ADMIN, // Auto-approve for ADMIN
      hasRatings: true, // Resources always have ratings enabled
      hasSharing: true
    };

    const content = await this.contentRepository.create(contentData, userId, userRole);

    // Transform back to resource-like structure for compatibility
    return this.transformContentToResource(content);
  }

  /**
   * Find resource by ID
   */
  async findById(id: string, userId: string, userRole: UserRole) {
    const content = await this.contentRepository.findById(id, userId, userRole, {
      includeDocuments: true,
      includeShares: true,
      includeRatings: true,
      includeCreator: true,
      includeFamily: true,
      includeCategory: true
    });

    if (!content || content.contentType !== ContentType.RESOURCE) {
      return null;
    }

    return this.transformContentToResource(content);
  }

  /**
   * Filter resources
   */
  async filter(filters: ResourceFilters, userId: string, userRole: UserRole) {
    const contentFilters: ContentFilters = {
      contentType: [ContentType.RESOURCE], // Only RESOURCE content
      resourceType: filters.contentType,
      status: filters.status,
      createdBy: filters.submittedBy, // Map submittedBy to createdBy
      familyId: filters.familyId,
      visibility: filters.visibility,
      categoryId: filters.categoryId,
      tags: filters.tags,
      search: filters.search,
      featured: filters.featured,
      verified: filters.verified,
      minRating: filters.minRating,
      hasCuration: filters.curatedOnly,
      page: filters.page,
      limit: filters.limit,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder
    };

    const result = await this.contentRepository.filter(contentFilters, userId, userRole, {
      includeCreator: true,
      includeFamily: true,
      includeCategory: true,
      includeRatings: true
    });

    return {
      ...result,
      content: result.content.map(content => this.transformContentToResource(content))
    };
  }

  /**
   * Update resource
   */
  async update(id: string, data: UpdateResourceInput, userId: string, userRole: UserRole) {
    const updateData: UpdateContentInput = {
      title: data.title,
      description: data.description,
      body: data.content, // Map 'content' field to 'body'
      resourceType: data.contentType,
      visibility: data.visibility,
      familyId: data.familyId,
      categoryId: data.categoryId,
      tags: data.tags,
      url: data.url,
      targetAudience: data.targetAudience,
      externalMeta: data.externalMeta
    };

    // Handle status updates through curation methods if needed
    const content = await this.contentRepository.update(id, updateData, userId, userRole);
    return this.transformContentToResource(content);
  }

  /**
   * Delete resource
   */
  async delete(id: string, userId: string, userRole: UserRole) {
    return await this.contentRepository.delete(id, userId, userRole);
  }

  /**
   * Increment view count
   */
  async incrementViewCount(id: string) {
    return await this.contentRepository.incrementViewCount(id);
  }

  // ========================================
  // CURATION METHODS (unchanged interface)
  // ========================================

  /**
   * Get resources awaiting curation
   */
  async getCurationQueue(adminId: string, adminRole: UserRole) {
    const content = await this.contentRepository.getCurationQueue(adminId, adminRole);
    return content.map(c => this.transformContentToResource(c));
  }

  /**
   * Approve resource
   */
  async approve(resourceId: string, approverId: string, approverRole: UserRole) {
    const content = await this.contentRepository.approveContent(
      resourceId,
      approverId,
      approverRole
    );
    return this.transformContentToResource(content);
  }

  /**
   * Feature resource
   */
  async feature(resourceId: string, featurerId: string, featurerRole: UserRole) {
    const content = await this.contentRepository.featureContent(
      resourceId,
      featurerId,
      featurerRole
    );
    return this.transformContentToResource(content);
  }

  // ========================================
  // RATING METHODS (unchanged interface)
  // ========================================

  /**
   * Rate resource
   */
  async rate(
    resourceId: string,
    userId: string,
    rating: number,
    review?: string,
    isHelpful?: boolean
  ) {
    return await this.contentRepository.rateContent(
      resourceId,
      userId,
      rating,
      review,
      isHelpful
    );
  }

  // ========================================
  // DOCUMENT METHODS (unchanged interface)
  // ========================================

  /**
   * Attach document to resource
   */
  async attachDocument(
    resourceId: string,
    documentId: string,
    attachedBy: string,
    order: number = 0,
    isMain: boolean = false
  ) {
    return await this.contentRepository.attachDocument(
      resourceId,
      documentId,
      attachedBy,
      order,
      isMain
    );
  }

  /**
   * Detach document from resource
   */
  async detachDocument(
    resourceId: string,
    documentId: string,
    userId: string,
    userRole: UserRole
  ) {
    return await this.contentRepository.detachDocument(
      resourceId,
      documentId,
      userId,
      userRole
    );
  }

  // ========================================
  // SHARING METHODS (tracking-based)
  // ========================================

  /**
   * Track resource share
   */
  async trackShare(
    resourceId: string,
    sharedBy: string,
    shareMethod: string,
    sharedWith?: string,
    shareData?: any
  ) {
    // Create a share record for tracking (RESOURCE style)
    return await this.prisma.contentShare.create({
      data: {
        contentId: resourceId,
        userId: sharedWith || null,
        sharedBy,
        shareMethod,
        shareData
      }
    });
  }

  // ========================================
  // STATISTICS METHODS
  // ========================================

  /**
   * Get resource statistics
   */
  async getStatistics() {
    const [
      totalResources,
      approvedResources,
      featuredResources,
      pendingResources,
      avgRating
    ] = await Promise.all([
      this.prisma.content.count({
        where: { contentType: ContentType.RESOURCE }
      }),
      this.prisma.content.count({
        where: {
          contentType: ContentType.RESOURCE,
          status: ResourceStatus.APPROVED
        }
      }),
      this.prisma.content.count({
        where: {
          contentType: ContentType.RESOURCE,
          status: ResourceStatus.FEATURED
        }
      }),
      this.prisma.content.count({
        where: {
          contentType: ContentType.RESOURCE,
          status: ResourceStatus.PENDING
        }
      }),
      this.prisma.content.aggregate({
        where: {
          contentType: ContentType.RESOURCE,
          rating: { not: null }
        },
        _avg: { rating: true }
      })
    ]);

    return {
      totalResources,
      approvedResources,
      featuredResources,
      pendingResources,
      averageRating: avgRating._avg.rating || 0
    };
  }

  // ========================================
  // PRIVATE TRANSFORMATION METHODS
  // ========================================

  /**
   * Transform Content model back to Resource-like structure for compatibility
   */
  private transformContentToResource(content: any) {
    return {
      id: content.id,
      title: content.title,
      description: content.description,
      content: content.body, // Map 'body' back to 'content'
      contentType: content.resourceType, // Map resourceType to contentType
      url: content.url,

      // File attachments
      attachments: content.attachments || [],

      // Organization
      categoryId: content.categoryId,
      tags: content.tags || [],

      // Access control
      visibility: content.visibility,
      familyId: content.familyId,
      targetAudience: content.targetAudience || [],

      // Curation workflow
      status: content.status,
      submittedBy: content.createdBy, // Map createdBy to submittedBy
      approvedBy: content.approvedBy,
      approvedAt: content.approvedAt,
      featuredBy: content.featuredBy,
      featuredAt: content.featuredAt,

      // Engagement metrics
      viewCount: content.viewCount || 0,
      downloadCount: content.downloadCount || 0,
      shareCount: content.shareCount || 0,
      rating: content.rating,
      ratingCount: content.ratingCount || 0,

      // Metadata
      externalMeta: content.externalMeta,
      isVerified: content.isVerified || false,
      lastVerifiedAt: content.lastVerifiedAt,

      // Timestamps
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,

      // Relations (passed through)
      submitter: content.creator, // Map creator to submitter
      approver: content.approver,
      family: content.family,
      category: content.category,
      documents: content.documents,
      ratings: content.ratings,
      shares: content.shares,

      // Additional computed fields for compatibility
      hasCuration: content.hasCuration || false,
      hasRatings: content.hasRatings || false
    };
  }
}

export { ResourceCompatibilityRepository };