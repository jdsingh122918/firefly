import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole, ResourceStatus, ResourceType, ResourceVisibility } from "@prisma/client";
import { ResourceRepository } from "@/lib/db/repositories/resource.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { NotificationType } from "@/lib/types";
import { prisma } from "@/lib/db/prisma";

const resourceRepository = new ResourceRepository(prisma);
const userRepository = new UserRepository();
const notificationRepository = new NotificationRepository();

// Validation schema for updating a resource
const updateResourceSchema = z.object({
  title: z
    .string()
    .min(1, "Resource title is required")
    .max(200, "Resource title must be less than 200 characters")
    .optional(),
  description: z.string().max(2000, "Resource description must be less than 2,000 characters").nullable().optional(),
  body: z.string().max(50000, "Resource content must be less than 50,000 characters").nullable().optional(),
  resourceType: z.enum(["DOCUMENT", "LINK", "VIDEO", "AUDIO", "IMAGE", "TOOL", "CONTACT", "SERVICE"]).optional(),
  visibility: z.enum(["PRIVATE", "FAMILY", "SHARED", "PUBLIC"]).optional(),
  status: z.enum(["DRAFT", "PENDING", "APPROVED", "FEATURED", "REJECTED", "ARCHIVED"]).optional(),
  familyId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  url: z.string().url().nullable().optional(),
  sourceAttribution: z.string().max(200).optional(),
  expertiseLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
  estimatedDuration: z.number().min(1).max(10080).optional(),
  prerequisites: z.array(z.string()).optional(),
  learningObjectives: z.array(z.string()).optional(),
  relatedResources: z.array(z.string()).optional(),
  attachments: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  isFeatured: z.boolean().optional(),
  rejectionReason: z.string().max(1000).optional(),
  targetAudience: z.array(z.string()).optional(),
  hasAssignments: z.boolean().optional(),
  hasCuration: z.boolean().optional(),
  hasRatings: z.boolean().optional(),
  hasSharing: z.boolean().optional(),
  // Legacy fields from frontend (not in Resource model - will be ignored)
  isPinned: z.boolean().optional(),
  allowComments: z.boolean().optional(),
  allowEditing: z.boolean().optional(),
});

// GET /api/resources/[id] - Get resource by ID with access control
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const { searchParams } = new URL(request.url);
    const includeRatings = searchParams.get("includeRatings") === "true";
    const includeDocuments = searchParams.get("includeDocuments") === "true";
    const includeBookmarks = searchParams.get("includeBookmarks") === "true";
    const trackView = searchParams.get("trackView") !== "false"; // Default to true

    console.log("📚 GET /api/resources/[id] - User:", {
      role: user.role,
      email: user.email,
      resourceId: id,
    });

    // Get resource with access control and relations
    const resource = await resourceRepository.findById(id, user.id, user.role, {
      includeSubmitter: true,
      includeApprover: true,
      includeFamily: true,
      includeCategory: true,
    });

    if (!resource) {
      return NextResponse.json(
        { error: "Resource not found or access denied" },
        { status: 404 }
      );
    }

    console.log("✅ Resource retrieved:", {
      resourceId: resource.id,
      title: resource.title,
      type: resource.resourceType,
      visibility: resource.visibility,
      status: resource.status,
      viewCount: resource.viewCount,
    });

    // Format response
    const formattedResource = {
      id: resource.id,
      title: resource.title,
      description: resource.description,
      body: resource.body,
      resourceType: resource.resourceType,
      visibility: resource.visibility,
      status: resource.status,
      familyId: resource.familyId,
      family: null, // TODO: Include family relation in repository query
      categoryId: resource.categoryId,
      category: null, // TODO: Include category relation in repository query
      tags: resource.tags,
      url: resource.url,
      sourceAttribution: null, // TODO: Implement sourceAttribution field
      expertiseLevel: null, // TODO: Implement expertiseLevel field
      estimatedDuration: null, // TODO: Implement estimatedDuration field
      prerequisites: [], // TODO: Implement prerequisites field
      learningObjectives: [], // TODO: Implement learningObjectives field
      relatedResources: [], // TODO: Implement relatedResources field
      attachments: resource.attachments,
      metadata: resource.externalMeta || {},
      isFeatured: resource.status === ResourceStatus.FEATURED,
      isApproved: resource.status === ResourceStatus.APPROVED || resource.status === ResourceStatus.FEATURED,
      approvedAt: resource.approvedAt,
      rejectionReason: null, // TODO: Implement rejectionReason field
      isDeleted: false, // TODO: Implement isDeleted field
      averageRating: resource.rating || 0,
      totalRatings: resource.ratingCount || 0,
      totalViews: resource.viewCount,
      totalShares: resource.shareCount,
      totalBookmarks: 0, // TODO: Implement totalBookmarks field
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
      publishedAt: resource.approvedAt, // Use approvedAt as publishedAt
      creator: (resource as any).submitter ? {
        id: (resource as any).submitter.id,
        name: (resource as any).submitter.firstName
          ? `${(resource as any).submitter.firstName} ${(resource as any).submitter.lastName || ""}`.trim()
          : (resource as any).submitter.email,
        email: (resource as any).submitter.email,
        role: (resource as any).submitter.role,
      } : null,
      approvedBy: (resource as any).approver ? {
        id: (resource as any).approver.id,
        name: (resource as any).approver.firstName
          ? `${(resource as any).approver.firstName} ${(resource as any).approver.lastName || ""}`.trim()
          : (resource as any).approver.email,
        email: (resource as any).approver.email,
        role: (resource as any).approver.role,
      } : null,
      userRating: null, // TODO: Implement user rating lookup
      userBookmark: false, // TODO: Implement user bookmark lookup
      documents: includeDocuments && (resource as any).documents ? (resource as any).documents.map((doc: any) => ({
        id: doc.id,
        title: doc.title,
        fileName: doc.fileName,
        originalFileName: doc.originalFileName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        type: doc.type,
        filePath: doc.filePath,
        duration: doc.duration,
        width: doc.width,
        height: doc.height,
        thumbnailPath: doc.thumbnailPath,
        order: 0, // TODO: Implement document order field
      })) : [],
    };

    return NextResponse.json({
      success: true,
      data: formattedResource,
    });
  } catch (error) {
    console.error("❌ Error fetching resource:", error);

    // Handle access denied errors specifically
    if (error instanceof Error && error.message.includes("Access denied")) {
      return NextResponse.json(
        { error: "Access denied to this resource" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch resource" },
      { status: 500 },
    );
  }
}

// PUT /api/resources/[id] - Update resource
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const validatedData = updateResourceSchema.parse(body);

    console.log("📚 Updating resource:", {
      resourceId: id,
      fields: Object.keys(validatedData),
      updatedBy: user.email,
    });

    // Check permissions and handle status transitions
    const currentResource = await resourceRepository.findById(id, user.id, user.role);
    if (!currentResource) {
      return NextResponse.json(
        { error: "Resource not found or access denied" },
        { status: 404 }
      );
    }

    // Handle status change permissions
    if (validatedData.status && validatedData.status !== currentResource.status) {
      const canChangeStatus = await checkResourceStatusChangePermissions(
        currentResource,
        user,
        validatedData.status
      );
      if (!canChangeStatus) {
        return NextResponse.json(
          { error: "Insufficient permissions to change resource status" },
          { status: 403 }
        );
      }
    }

    // Handle curation actions (approve/reject)
    let approvedBy = undefined;
    let approvedAt = undefined;

    if (validatedData.status === ResourceStatus.APPROVED && currentResource.status === ResourceStatus.PENDING) {
      approvedBy = user.id;
      approvedAt = new Date();
    }

    // Extract only valid Resource model fields (exclude frontend-only fields)
    const { isPinned, allowComments, allowEditing, ...resourceData } = validatedData;

    // Convert null values to undefined for repository compatibility
    const cleanedResourceData = Object.fromEntries(
      Object.entries(resourceData).map(([key, value]) => [key, value === null ? undefined : value])
    );

    // Update resource with access control
    const updatedResource = await resourceRepository.update(id, {
      ...cleanedResourceData,
      ...(approvedBy && { approvedBy }),
      ...(approvedAt && { approvedAt }),
    }, user.id, user.role);

    console.log("✅ Resource updated successfully:", {
      resourceId: updatedResource.id,
      title: updatedResource.title,
      changes: Object.keys(validatedData),
    });

    // Create notifications for status changes
    if (validatedData.status && currentResource.status && validatedData.status !== currentResource.status) {
      createResourceStatusNotifications(
        id,
        currentResource.status,
        validatedData.status,
        user.id,
        validatedData.rejectionReason
      );
    }

    return NextResponse.json({
      success: true,
      resource: {
        id: updatedResource.id,
        title: updatedResource.title,
        description: updatedResource.description,
        body: updatedResource.body,
        resourceType: updatedResource.resourceType,
        visibility: updatedResource.visibility,
        status: updatedResource.status,
        familyId: updatedResource.familyId,
        family: null, // TODO: Load family relation if needed
        categoryId: updatedResource.categoryId,
        category: null, // TODO: Load category relation if needed
        tags: updatedResource.tags,
        url: updatedResource.url,
        sourceAttribution: null, // TODO: Implement sourceAttribution field
        expertiseLevel: null, // TODO: Implement expertiseLevel field
        estimatedDuration: null, // TODO: Implement estimatedDuration field
        prerequisites: [], // TODO: Implement prerequisites field
        learningObjectives: [], // TODO: Implement learningObjectives field
        attachments: updatedResource.attachments,
        isFeatured: updatedResource.status === ResourceStatus.FEATURED,
        isApproved: updatedResource.status === ResourceStatus.APPROVED || updatedResource.status === ResourceStatus.FEATURED,
        approvedAt: updatedResource.approvedAt,
        rejectionReason: null, // TODO: Implement rejectionReason field
        averageRating: updatedResource.rating || 0,
        totalRatings: updatedResource.ratingCount || 0,
        updatedAt: updatedResource.updatedAt,
        publishedAt: updatedResource.approvedAt, // Use approvedAt as publishedAt
        creator: updatedResource.submitter ? {
          id: updatedResource.submitter.id,
          name: updatedResource.submitter.firstName
            ? `${updatedResource.submitter.firstName} ${updatedResource.submitter.lastName || ""}`.trim()
            : updatedResource.submitter.email,
          email: updatedResource.submitter.email,
          role: updatedResource.submitter.role,
        } : null,
        approvedBy: updatedResource.approver ? {
          id: updatedResource.approver.id,
          name: updatedResource.approver.firstName
            ? `${updatedResource.approver.firstName} ${updatedResource.approver.lastName || ""}`.trim()
            : updatedResource.approver.email,
          email: updatedResource.approver.email,
          role: updatedResource.approver.role,
        } : null,
      },
    });
  } catch (error) {
    console.error("❌ Error updating resource:", error);

    if (error instanceof z.ZodError) {
      console.error("❌ Resource validation error:", {
        resourceId: id,
        errors: error.issues.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      });

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
      if (error.message.includes("Resource not found")) {
        return NextResponse.json(
          { error: "Resource not found" },
          { status: 404 },
        );
      }
      if (error.message.includes("Access denied")) {
        return NextResponse.json(
          { error: "Access denied to edit this resource" },
          { status: 403 },
        );
      }
      if (error.message.includes("Category not found")) {
        return NextResponse.json(
          { error: "Category not found or not active" },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to update resource" },
      { status: 500 },
    );
  }
}

// DELETE /api/resources/[id] - Soft delete resource
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    console.log("📚 Deleting resource:", {
      resourceId: id,
      deletedBy: user.email,
    });

    // Delete resource with access control (only creator or admin can delete)
    await resourceRepository.delete(id, user.id, user.role);

    console.log("✅ Resource deleted successfully:", {
      resourceId: id,
    });

    return NextResponse.json({
      success: true,
      message: "Resource deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting resource:", error);

    // Handle specific repository errors
    if (error instanceof Error) {
      if (error.message.includes("Resource not found")) {
        return NextResponse.json(
          { error: "Resource not found" },
          { status: 404 },
        );
      }
      if (error.message.includes("Only the resource creator")) {
        return NextResponse.json(
          { error: "Only the resource creator can delete this resource" },
          { status: 403 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to delete resource" },
      { status: 500 },
    );
  }
}

// Helper function to check resource status change permissions
async function checkResourceStatusChangePermissions(
  resource: any,
  user: any,
  newStatus: ResourceStatus
): Promise<boolean> {
  // Resource creator can change status for their own resources (except for approval/rejection)
  if (resource.submittedBy === user.id) {
    // Authors cannot approve their own resources
    if (newStatus === ResourceStatus.APPROVED && resource.status === ResourceStatus.PENDING) {
      return user.role === UserRole.ADMIN;
    }
    return true;
  }

  // Admin can change any status
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  // Curators/moderators can approve/reject pending resources
  if (newStatus === ResourceStatus.APPROVED || newStatus === ResourceStatus.REJECTED) {
    return user.role === UserRole.ADMIN; // For now, only admins can curate
  }

  return false;
}

// Helper function to create resource status change notifications
async function createResourceStatusNotifications(
  resourceId: string,
  oldStatus: ResourceStatus,
  newStatus: ResourceStatus,
  changedByUserId: string,
  rejectionReason?: string
): Promise<void> {
  try {
    // Get resource and status changer details
    const resource = await resourceRepository.findById(resourceId, changedByUserId, UserRole.ADMIN);
    const statusChanger = await userRepository.getUserById(changedByUserId);

    if (!resource || !statusChanger) return;

    // Only notify for significant status changes
    const notifiableTransitions = [
      { from: "PENDING_REVIEW", to: "PUBLISHED" },
      { from: "PENDING_REVIEW", to: "REJECTED" },
      { from: "DRAFT", to: "PUBLISHED" },
    ];

    const isNotifiable = notifiableTransitions.some(
      t => t.from === oldStatus && t.to === newStatus
    );

    if (!isNotifiable) return;

    // Don't notify if the resource creator is changing their own status
    if (resource.submittedBy === changedByUserId) return;

    let notificationData: any = {
      userId: resource.submittedBy,
      type: NotificationType.FAMILY_ACTIVITY,
      data: {
        resourceId,
        resourceTitle: resource.title,
        resourceType: resource.resourceType,
        oldStatus,
        newStatus,
        changedByUserId,
        changedByName: `${statusChanger.firstName} ${statusChanger.lastName || ""}`,
        activityType: "resource_status_changed"
      },
      actionUrl: `/resources/${resourceId}`,
      isActionable: true
    };

    if (newStatus === ResourceStatus.APPROVED) {
      notificationData.title = "Your resource has been approved";
      notificationData.message = `Great news! Your resource "${resource.title}" has been approved and is now live.`;
    } else if (newStatus === ResourceStatus.REJECTED) {
      notificationData.title = "Your resource needs attention";
      notificationData.message = rejectionReason
        ? `Your resource "${resource.title}" was not approved. Reason: ${rejectionReason}`
        : `Your resource "${resource.title}" was not approved. Please review and resubmit.`;
      notificationData.data.rejectionReason = rejectionReason;
    }

    await notificationRepository.createNotification(notificationData);

    console.log("✅ Resource status notification sent:", {
      resourceId,
      oldStatus,
      newStatus,
    });
  } catch (error) {
    console.error("❌ Failed to create resource status notification:", error);
    // Don't throw error as this is not critical for status change functionality
  }
}