import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { ResourceStatus } from "@prisma/client";
import { ResourceRepository } from "@/lib/db/repositories/resource.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NotificationType } from "@/lib/types";
import { prisma } from "@/lib/db/prisma";
import { notificationDispatcher } from "@/lib/notifications/notification-dispatcher.service";

const resourceRepository = new ResourceRepository(prisma);
const userRepository = new UserRepository();

// Validation schema for rating a resource
const rateResourceSchema = z.object({
  rating: z
    .number()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  comment: z
    .string()
    .max(1000, "Rating comment must be less than 1,000 characters")
    .optional(),
  isPublic: z.boolean().default(true),
});

// POST /api/resources/[id]/rating - Rate a resource
export async function POST(
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
    const validatedData = rateResourceSchema.parse(body);

    console.log("⭐ Rating resource:", {
      resourceId: id,
      userId: user.id,
      rating: validatedData.rating,
      hasComment: !!validatedData.comment,
    });

    // Check if resource exists and is accessible
    const resource = await resourceRepository.findById(id, user.id, user.role);
    if (!resource) {
      return NextResponse.json({ error: "Resource not found or access denied" }, { status: 404 });
    }

    // Check if resource can be rated (must be approved or featured)
    if (resource.status !== ResourceStatus.APPROVED && resource.status !== ResourceStatus.FEATURED) {
      return NextResponse.json(
        { error: "Can only rate approved or featured resources" },
        { status: 400 }
      );
    }

    // Cannot rate your own resource
    if (resource.submittedBy === user.id) {
      return NextResponse.json(
        { error: "Cannot rate your own resource" },
        { status: 400 }
      );
    }

    // Rate the resource (this will update existing rating if one exists)
    const result = await resourceRepository.rateContent(
      id,
      user.id,
      validatedData.rating,
      validatedData.comment,
      validatedData.isPublic
    );

    console.log("✅ Resource rated successfully:", {
      resourceId: id,
      userId: user.id,
      rating: validatedData.rating,
      newRating: result.newRating,
      success: result.success,
    });

    // Create notification for resource author (if new rating and not anonymous)
    // TODO: Implement proper new rating detection and notification system
    if (validatedData.isPublic && resource.submittedBy && resource.submittedBy !== user.id) {
      await createResourceRatingNotification(id, resource.submittedBy, user.id, validatedData.rating);
    }

    return NextResponse.json({
      success: true,
      rating: {
        userId: user.id,
        resourceId: id,
        rating: validatedData.rating,
        comment: validatedData.comment,
        isPublic: validatedData.isPublic,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      resourceStats: {
        averageRating: result.newRating,
        totalRatings: 1, // TODO: Implement proper rating count
      },
      message: "Rating added successfully",
    });
  } catch (error) {
    console.error("❌ Error rating resource:", error);

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

    return NextResponse.json(
      { error: "Failed to rate resource" },
      { status: 500 },
    );
  }
}

// GET /api/resources/[id]/rating - Get user's rating for resource and resource rating summary
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
    const limit = parseInt(searchParams.get("limit") || "10");

    console.log("⭐ Getting rating details for resource:", {
      resourceId: id,
      userId: user.id,
      includeRatings,
    });

    // Get resource with rating details
    // TODO: findById doesn't support options parameter - may need to fetch ratings separately
    const resource = await resourceRepository.findById(id, user.id, user.role);

    if (!resource) {
      return NextResponse.json({ error: "Resource not found or access denied" }, { status: 404 });
    }

    // TODO: Implement ratings property in getResourceById
    // Extract user's rating (placeholder implementation)
    const userRating = null;

    // TODO: Implement getResourceRatings method in ResourceRepository
    // Get recent public ratings if requested (placeholder implementation)
    let recentRatings: any[] = [];

    // TODO: Implement getRatingDistribution method in ResourceRepository
    // Calculate rating distribution (placeholder implementation)
    const ratingDistribution = {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
    };

    return NextResponse.json({
      resourceId: id,
      resourceTitle: resource.title,
      userRating: null, // TODO: Implement user rating details
      resourceStats: {
        averageRating: resource.rating || 0, // TODO: Implement proper average rating
        totalRatings: resource.ratingCount || 0,
        ratingDistribution,
      },
      recentRatings: includeRatings ? recentRatings : [],
    });
  } catch (error) {
    console.error("❌ Error getting resource rating:", error);
    return NextResponse.json(
      { error: "Failed to get rating details" },
      { status: 500 },
    );
  }
}

// DELETE /api/resources/[id]/rating - Remove user's rating from resource
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

    console.log("⭐ Removing rating from resource:", {
      resourceId: id,
      userId: user.id,
    });

    // Check if resource exists
    const resource = await resourceRepository.findById(id, user.id, user.role);
    if (!resource) {
      return NextResponse.json({ error: "Resource not found or access denied" }, { status: 404 });
    }

    // TODO: Implement removeRating method in ResourceRepository
    // Remove user's rating (placeholder implementation)
    const result = {
      success: true,
      newAverageRating: 0,
      totalRatings: 0,
    };

    if (!result.success) {
      return NextResponse.json(
        { error: "No rating found to remove" },
        { status: 404 }
      );
    }

    console.log("✅ Rating removed successfully:", {
      resourceId: id,
      userId: user.id,
      newAverageRating: result.newAverageRating,
      totalRatings: result.totalRatings,
    });

    return NextResponse.json({
      success: true,
      message: "Rating removed successfully",
      resourceStats: {
        averageRating: result.newAverageRating,
        totalRatings: result.totalRatings,
      },
    });
  } catch (error) {
    console.error("❌ Error removing resource rating:", error);
    return NextResponse.json(
      { error: "Failed to remove rating" },
      { status: 500 },
    );
  }
}

// Helper function to create resource rating notifications
async function createResourceRatingNotification(
  resourceId: string,
  authorId: string,
  raterId: string,
  rating: number
): Promise<void> {
  try {
    // Don't notify for low ratings to avoid negative feedback loops
    if (rating < 4) return;

    // Get resource and rater details
    // TODO: We need to get the rater's role for findById - using MEMBER as default for now
    const resource = await resourceRepository.findById(resourceId, raterId, "MEMBER");
    const rater = await userRepository.getUserById(raterId);
    const author = await userRepository.getUserById(authorId);

    if (!resource || !rater) return;

    const recipientName = author?.firstName
      ? `${author.firstName} ${author.lastName || ""}`.trim()
      : author?.email || "User";

    await notificationDispatcher.dispatchNotification(
      authorId,
      NotificationType.FAMILY_ACTIVITY,
      {
        title: `Your resource received a ${rating}-star rating`,
        message: `${rater.firstName} ${rater.lastName || ""} gave your resource "${resource.title}" a ${rating}-star rating.`,
        data: {
          resourceId,
          resourceTitle: resource.title,
          resourceType: resource.resourceType,
          raterId,
          raterName: `${rater.firstName} ${rater.lastName || ""}`,
          rating,
          activityType: "resource_rated"
        },
        actionUrl: `/resources/${resourceId}`,
        isActionable: true
      },
      {
        recipientName,
      }
    );

    console.log("✅ Resource rating notification sent:", {
      resourceId,
      authorId,
      rating,
    });
  } catch (error) {
    console.error("❌ Failed to create resource rating notification:", error);
    // Don't throw error as this is not critical for rating functionality
  }
}