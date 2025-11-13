import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { ResourceContentType, ResourceStatus, NoteVisibility } from "@prisma/client";
import { UserRole } from "@/lib/auth/roles";
import { ResourceRepository } from "@/lib/db/repositories/resource.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { NotificationType } from "@/lib/types";

const resourceRepository = new ResourceRepository();
const userRepository = new UserRepository();
const notificationRepository = new NotificationRepository();

// Validation schema for creating a resource
const createResourceSchema = z.object({
  title: z
    .string()
    .min(1, "Resource title is required")
    .max(200, "Resource title must be less than 200 characters"),
  description: z
    .string()
    .min(1, "Resource description is required")
    .max(2000, "Resource description must be less than 2,000 characters"),
  content: z
    .string()
    .min(1, "Resource content is required")
    .max(50000, "Resource content must be less than 50,000 characters"),
  type: z.enum(["DOCUMENT", "LINK", "VIDEO", "AUDIO", "IMAGE", "TOOL", "CONTACT", "SERVICE"]).default("DOCUMENT"),
  visibility: z.enum(["PRIVATE", "FAMILY", "SHARED", "PUBLIC"]).default("PRIVATE"),
  familyId: z.string().optional(),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  externalUrl: z.string().url().optional(),
  sourceAttribution: z.string().max(200).optional(),
  expertiseLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).default("BEGINNER"),
  estimatedDuration: z.number().min(1).max(10080).optional(), // Duration in minutes, max 1 week
  prerequisites: z.array(z.string()).optional(),
  learningObjectives: z.array(z.string()).optional(),
  relatedResources: z.array(z.string()).optional(),
  attachments: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// GET /api/resources - List resources with filtering and curation
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database to check role
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("📚 GET /api/resources - User:", {
      role: user.role,
      email: user.email,
    });

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const createdBy = searchParams.get("createdBy");
    const familyId = searchParams.get("familyId");
    const type = searchParams.get("type") as ResourceContentType | null;
    const visibility = searchParams.get("visibility") as NoteVisibility | null;
    const status = searchParams.get("status") as ResourceStatus | null;
    const categoryId = searchParams.get("categoryId");
    const search = searchParams.get("search");
    const tags = searchParams.get("tags")?.split(",").filter(Boolean);
    const expertiseLevel = searchParams.get("expertiseLevel");
    const minRating = searchParams.get("minRating") ? parseFloat(searchParams.get("minRating")!) : undefined;
    const maxDuration = searchParams.get("maxDuration") ? parseInt(searchParams.get("maxDuration")!) : undefined;
    const featured = searchParams.get("featured") === "true";
    const curatedOnly = searchParams.get("curatedOnly") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const rawSortBy = searchParams.get("sortBy") || "createdAt";
    // Map frontend sortBy values to repository expected values
    const sortByMap: Record<string, "createdAt" | "title" | "viewCount" | "downloadCount" | "rating"> = {
      "createdAt": "createdAt",
      "updatedAt": "createdAt", // Map updatedAt to createdAt
      "title": "title",
      "averageRating": "rating",
      "totalViews": "viewCount",
    };
    const sortBy = sortByMap[rawSortBy] || "createdAt";
    const sortOrder = searchParams.get("sortOrder") as "asc" | "desc" || "desc";
    const includeRatings = searchParams.get("includeRatings") === "true";
    const includeDocuments = searchParams.get("includeDocuments") === "true";

    // Build filters object
    const filters = {
      ...(createdBy && { createdBy }),
      ...(familyId && { familyId }),
      ...(type && { type }),
      ...(visibility && { visibility }),
      ...(status && { status }),
      ...(categoryId && { categoryId }),
      ...(search && { search }),
      ...(tags && { tags }),
      ...(expertiseLevel && { expertiseLevel }),
      ...(minRating !== undefined && { minRating }),
      ...(maxDuration !== undefined && { maxDuration }),
      ...(featured && { featured }),
      ...(curatedOnly && { curatedOnly }),
      isDeleted: false,
    };

    console.log("🔍 Resource filters applied:", filters);

    // Get resources with access control and pagination
    const result = await resourceRepository.getResources(filters, {
      page,
      limit,
      sortBy,
      sortOrder,
      includeRatings,
    });

    console.log("✅ Resources retrieved:", {
      total: result.total,
      page: result.page,
      filters
    });

    // Format response
    const formattedResources = result.items.map(resource => ({
      id: resource.id,
      title: resource.title,
      description: resource.description,
      content: resource.content?.substring(0, 1000) || '', // Truncate for list view
      type: resource.contentType,
      visibility: resource.visibility,
      status: resource.status,
      familyId: resource.familyId,
      family: resource.family ? {
        id: resource.family.id,
        name: resource.family.name,
      } : null,
      categoryId: resource.categoryId,
      category: resource.category ? {
        id: resource.category.id,
        name: resource.category.name,
        color: resource.category.color,
        icon: resource.category.icon,
      } : null,
      tags: resource.tags,
      externalUrl: resource.url,
      sourceAttribution: null, // TODO: Implement sourceAttribution field
      expertiseLevel: null, // TODO: Implement expertiseLevel field
      estimatedDuration: null, // TODO: Implement estimatedDuration field
      prerequisites: [], // TODO: Implement prerequisites field
      learningObjectives: [], // TODO: Implement learningObjectives field
      relatedResources: [], // TODO: Implement relatedResources field
      attachments: resource.attachments,
      isFeatured: resource.status === ResourceStatus.FEATURED,
      isApproved: resource.status === ResourceStatus.APPROVED || resource.status === ResourceStatus.FEATURED,
      approvedAt: resource.approvedAt,
      averageRating: resource.rating || 0,
      totalRatings: resource.ratingCount || 0,
      totalViews: resource.viewCount,
      totalShares: resource.shareCount,
      totalBookmarks: 0, // TODO: Implement totalBookmarks field
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
      publishedAt: resource.approvedAt, // Use approvedAt as publishedAt
      creator: resource.submitter ? {
        id: resource.submitter.id,
        name: resource.submitter.firstName
          ? `${resource.submitter.firstName} ${resource.submitter.lastName || ""}`.trim()
          : resource.submitter.email,
        email: resource.submitter.email,
        role: resource.submitter.role,
      } : null,
      approvedBy: resource.approver ? {
        id: resource.approver.id,
        name: resource.approver.firstName
          ? `${resource.approver.firstName} ${resource.approver.lastName || ""}`.trim()
          : resource.approver.email,
        email: resource.approver.email,
        role: resource.approver.role,
      } : null,
      userRating: null, // TODO: Implement user rating lookup
      userBookmark: false, // TODO: Implement user bookmark lookup
      documents: [], // TODO: Implement document inclusion
    }));

    return NextResponse.json({
      resources: formattedResources,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
      filters: {
        createdBy: createdBy || null,
        familyId: familyId || null,
        type: type || null,
        visibility: visibility || null,
        status: status || null,
        categoryId: categoryId || null,
        search: search || null,
        tags: tags || null,
        expertiseLevel: expertiseLevel || null,
        minRating,
        maxDuration,
        featured,
        curatedOnly,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching resources:", error);
    return NextResponse.json(
      { error: "Failed to fetch resources" },
      { status: 500 },
    );
  }
}

// POST /api/resources - Create a new resource
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database to check role
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createResourceSchema.parse(body);

    console.log("📚 Creating resource:", {
      data: validatedData,
      createdBy: user.email,
    });

    // Determine initial status based on visibility and user role
    let initialStatus: ResourceStatus = ResourceStatus.DRAFT;

    if (validatedData.visibility === "SHARED" || validatedData.visibility === "PUBLIC") {
      // Resources requiring curation start as pending unless created by admin/curator
      if (user.role === UserRole.ADMIN) {
        initialStatus = ResourceStatus.APPROVED;
      } else {
        initialStatus = ResourceStatus.PENDING;
      }
    } else {
      // Private and family resources are approved immediately
      initialStatus = ResourceStatus.APPROVED;
    }

    // Create resource
    const resource = await resourceRepository.createResource({
      title: validatedData.title,
      description: validatedData.description,
      content: validatedData.content,
      contentType: validatedData.type as ResourceContentType,
      visibility: validatedData.visibility as NoteVisibility,
      status: initialStatus,
      submittedBy: user.id,
      familyId: validatedData.familyId,
      categoryId: validatedData.categoryId,
      tags: validatedData.tags || [],
      url: validatedData.externalUrl,
      attachments: validatedData.attachments || [],
    });

    console.log("✅ Resource created successfully:", {
      resourceId: resource.id,
      title: resource.title,
      type: resource.contentType,
      visibility: resource.visibility,
      status: resource.status,
    });

    // Create curation notifications for pending resources
    if (initialStatus === ResourceStatus.PENDING) {
      createCurationNotifications(resource.id, user.id);
    }

    return NextResponse.json(
      {
        success: true,
        resource: {
          id: resource.id,
          title: resource.title,
          description: resource.description,
          content: resource.content,
          type: resource.contentType,
          visibility: resource.visibility,
          status: resource.status,
          familyId: resource.familyId,
          family: resource.family ? {
            id: resource.family.id,
            name: resource.family.name,
          } : null,
          categoryId: resource.categoryId,
          category: resource.category ? {
            id: resource.category.id,
            name: resource.category.name,
            color: resource.category.color,
          } : null,
          tags: resource.tags,
          externalUrl: resource.url,
          sourceAttribution: null, // TODO: Add to database schema
          expertiseLevel: null, // TODO: Add to database schema
          estimatedDuration: null, // TODO: Add to database schema
          prerequisites: [], // TODO: Add to database schema
          learningObjectives: [], // TODO: Add to database schema
          attachments: resource.attachments,
          averageRating: resource.rating || 0,
          totalRatings: resource.ratingCount,
          createdAt: resource.createdAt,
          creator: resource.submitter ? {
            id: resource.submitter.id,
            name: resource.submitter.firstName
              ? `${resource.submitter.firstName} ${resource.submitter.lastName || ""}`.trim()
              : resource.submitter.email,
            email: resource.submitter.email,
          } : null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("❌ Error creating resource:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        },
        { status: 400 },
      );
    }

    // Handle specific repository errors
    if (error instanceof Error) {
      if (error.message.includes("Category not found")) {
        return NextResponse.json(
          { error: "Category not found or not active" },
          { status: 400 },
        );
      }
      if (error.message.includes("Family not found")) {
        return NextResponse.json(
          { error: "Family not found or access denied" },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create resource" },
      { status: 500 },
    );
  }
}

// Helper function to create curation notifications for pending resources
async function createCurationNotifications(
  resourceId: string,
  authorId: string
): Promise<void> {
  try {
    // Get resource and author details
    const resource = await resourceRepository.getResourceById(resourceId, authorId);
    const author = await userRepository.getUserById(authorId);

    if (!resource || !author) return;

    // Get admin users who can approve resources
    const adminUsers = await userRepository.getUsersByRole(UserRole.ADMIN);

    // Create notifications for admin users
    const notifications = adminUsers.map((admin) => ({
      userId: admin.id,
      type: NotificationType.FAMILY_ACTIVITY,
      title: "New resource pending approval",
      message: `${author.firstName} ${author.lastName || ""} submitted a resource for curation: "${resource.title}"`,
      data: {
        resourceId,
        resourceTitle: resource.title,
        resourceType: resource.contentType,
        authorId,
        authorName: `${author.firstName} ${author.lastName || ""}`,
        activityType: "resource_submitted"
      },
      actionUrl: `/admin/resources/${resourceId}`,
      isActionable: true
    }));

    // Create notifications in parallel
    await Promise.all(
      notifications.map((notification) =>
        notificationRepository.createNotification(notification),
      ),
    );

    console.log("✅ Curation notifications sent:", {
      resourceId,
      notificationCount: notifications.length
    });
  } catch (error) {
    console.error("❌ Failed to create curation notifications:", error);
    // Don't throw error as this is not critical for resource creation
  }
}