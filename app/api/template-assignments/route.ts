import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@/lib/auth/roles";
import { TemplateAssignmentRepository } from "@/lib/db/repositories/template-assignment.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { ResourceRepository } from "@/lib/db/repositories/resource.repository";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { NotificationType } from "@/lib/types";
import { prisma } from "@/lib/db/prisma";

const templateAssignmentRepository = new TemplateAssignmentRepository();
const userRepository = new UserRepository();
const resourceRepository = new ResourceRepository(prisma);
const notificationRepository = new NotificationRepository();

const assignSchema = z.object({
  resourceId: z.string().min(1, "Resource ID is required"),
  memberIds: z.array(z.string()).min(1, "At least one member must be selected"),
  notes: z.string().optional(),
});

/**
 * POST /api/template-assignments
 * Create template assignments for members
 */
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await userRepository.getUserByClerkId(clerkUserId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only ADMIN and VOLUNTEER can assign templates
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = assignSchema.parse(body);

    // Get resource for notification
    const resource = await resourceRepository.findById(
      validatedData.resourceId,
      user.id,
      user.role
    );
    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    // Create assignments
    // Cast is needed because TypeScript narrows user.role to string literals after the check above
    const results = await templateAssignmentRepository.createAssignments(
      {
        resourceId: validatedData.resourceId,
        assigneeIds: validatedData.memberIds,
        assignedBy: user.id,
        notes: validatedData.notes,
      },
      user.role as UserRole
    );

    // Send notifications to successfully assigned members
    if (results.assigned > 0) {
      const assignerName =
        `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;

      // Get the member IDs that were successfully assigned
      const successfulAssignments = await templateAssignmentRepository.filter({
        resourceId: validatedData.resourceId,
        assignedBy: user.id,
      });

      const recentlyAssignedIds = successfulAssignments
        .filter((a) => {
          // Only include assignments created in the last minute (recent)
          const oneMinuteAgo = new Date(Date.now() - 60000);
          return a.assignedAt > oneMinuteAgo;
        })
        .map((a) => a.assigneeId);

      // Create notifications for each assigned member
      for (const memberId of recentlyAssignedIds) {
        try {
          await notificationRepository.createNotification({
            userId: memberId,
            type: NotificationType.CARE_UPDATE,
            title: "New Template Assigned",
            message: `${assignerName} has assigned "${resource.title}" to you. Please complete this form at your earliest convenience.`,
            data: {
              resourceId: resource.id,
              resourceTitle: resource.title,
              assignedBy: user.id,
              assignedByName: assignerName,
              activityType: "template_assignment",
            },
            isActionable: true,
            actionUrl: `/member/resources/${resource.id}`,
          });
        } catch (notificationError) {
          console.error(
            `Failed to create notification for user ${memberId}:`,
            notificationError
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error creating template assignments:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.issues,
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to create template assignments" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/template-assignments
 * Get template assignments with optional filters
 * - ?resourceId=xxx - Get all assignments for a resource (Admin/Volunteer)
 * - ?userId=xxx - Get assignments for a specific user
 * - ?status=pending|started|completed - Filter by status
 * - No params - Get current user's pending assignments
 */
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await userRepository.getUserByClerkId(clerkUserId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get("resourceId");
    const userId = searchParams.get("userId");
    const status = searchParams.get("status") as
      | "pending"
      | "started"
      | "completed"
      | null;

    // If resourceId is provided, return assignments for that resource
    if (resourceId) {
      // Only Admin and Volunteer can view assignments for a resource
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.VOLUNTEER) {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 }
        );
      }

      const assignments =
        await templateAssignmentRepository.getAssignmentsForResource(resourceId);
      return NextResponse.json({
        success: true,
        assignments,
      });
    }

    // If userId is provided, check permissions and return that user's assignments
    if (userId) {
      // Users can only view their own assignments unless they're Admin/Volunteer
      if (
        userId !== user.id &&
        user.role !== UserRole.ADMIN &&
        user.role !== UserRole.VOLUNTEER
      ) {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 }
        );
      }

      const assignments = await templateAssignmentRepository.getAssignmentsForUser(
        userId,
        status || undefined
      );
      return NextResponse.json({
        success: true,
        assignments,
      });
    }

    // Default: return current user's assignments
    const assignments = await templateAssignmentRepository.getAssignmentsForUser(
      user.id,
      status || undefined
    );

    return NextResponse.json({
      success: true,
      assignments,
    });
  } catch (error) {
    console.error("Error fetching template assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch template assignments" },
      { status: 500 }
    );
  }
}
