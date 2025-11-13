import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@/lib/auth/roles";
import { FamilyRepository } from "@/lib/db/repositories/family.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { NotificationRepository } from "@/lib/db/repositories/notification.repository";
import { NotificationType } from "@/lib/types";

const familyRepository = new FamilyRepository();
const userRepository = new UserRepository();
const notificationRepository = new NotificationRepository();

// Validation schema for adding a member to family
const addMemberSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// POST /api/families/[id]/members - Add member to family
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // Only ADMIN and VOLUNTEER can assign members to families
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const familyId = id;

    // Check if family exists
    const family = await familyRepository.getFamilyById(familyId);
    if (!family) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    // Check if volunteer can modify this family
    if (user.role === UserRole.VOLUNTEER && family.createdById !== user.id) {
      return NextResponse.json(
        { error: "You can only modify families you created" },
        { status: 403 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = addMemberSchema.parse(body);

    // Get the user to be added
    const memberToAdd = await userRepository.getUserById(validatedData.userId);
    if (!memberToAdd) {
      return NextResponse.json(
        { error: "User to add not found" },
        { status: 404 },
      );
    }

    // Check if user is already assigned to a family
    if (memberToAdd.familyId) {
      return NextResponse.json(
        {
          error: `User is already assigned to family: ${memberToAdd.family?.name || "Unknown"}`,
        },
        { status: 400 },
      );
    }

    console.log("👨‍👩‍👧‍👦 Adding member to family:", {
      familyId,
      familyName: family.name,
      memberEmail: memberToAdd.email,
      assignedBy: user.email,
    });

    // Assign user to family
    await userRepository.assignFamily(memberToAdd.id, familyId);

    console.log("✅ Member added to family successfully");

    // Create family activity notifications
    await createFamilyMemberAddedNotification(familyId, memberToAdd.id, user.id);

    // Get updated family data
    const updatedFamily = await familyRepository.getFamilyById(familyId);

    return NextResponse.json(
      {
        success: true,
        message: "Member added to family successfully",
        family: {
          id: updatedFamily!.id,
          name: updatedFamily!.name,
          memberCount: updatedFamily!.members?.length || 0,
        },
        addedMember: {
          id: memberToAdd.id,
          name: memberToAdd.firstName
            ? `${memberToAdd.firstName} ${memberToAdd.lastName || ""}`.trim()
            : memberToAdd.email,
          email: memberToAdd.email,
          role: memberToAdd.role,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("❌ Error adding member to family:", error);

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
      { error: "Failed to add member to family" },
      { status: 500 },
    );
  }
}

// GET /api/families/[id]/members - Get family members
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Only ADMIN and VOLUNTEER can view family members
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const familyId = id;

    // Get family with members
    const family = await familyRepository.getFamilyById(familyId);
    if (!family) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    console.log("👥 Getting family members:", {
      familyId,
      memberCount: (family.members || [])?.length || 0,
    });

    return NextResponse.json({
      familyId: family.id,
      familyName: family.name,
      members: (family.members || []).map((member) => ({
        id: member.id,
        name: member.firstName
          ? `${member.firstName} ${member.lastName || ""}`.trim()
          : member.email,
        email: member.email,
        role: member.role,
        phoneNumber: member.phoneNumber,
        joinedAt: member.updatedAt,
      })),
      totalMembers: (family.members || []).length,
    });
  } catch (error) {
    console.error("❌ Error fetching family members:", error);
    return NextResponse.json(
      { error: "Failed to fetch family members" },
      { status: 500 },
    );
  }
}

// Helper function to create notifications when a member is added to family
async function createFamilyMemberAddedNotification(
  familyId: string,
  newMemberId: string,
  addedById: string,
): Promise<void> {
  try {
    // Get family details
    const family = await familyRepository.getFamilyById(familyId);
    if (!family) return;

    // Get new member details
    const newMember = await userRepository.getUserById(newMemberId);
    if (!newMember) return;

    // Get person who added the member
    const addedBy = await userRepository.getUserById(addedById);
    if (!addedBy) return;

    // Notify the new member about being added to family
    await notificationRepository.createNotification({
      userId: newMemberId,
      type: NotificationType.FAMILY_ACTIVITY,
      title: "Welcome to Your Family",
      message: `You have been added to the ${family.name} family by ${addedBy.firstName} ${addedBy.lastName || ""}`,
      data: {
        familyId,
        familyName: family.name,
        addedById,
        addedByName: `${addedBy.firstName} ${addedBy.lastName || ""}`,
        activityType: "member_added_welcome"
      },
      actionUrl: `/families/${familyId}`,
      isActionable: true
    });

    // Notify existing family members about new member (exclude the new member and person who added them)
    const existingMembers = family.members?.filter(
      member => member.id !== newMemberId && member.id !== addedById
    ) || [];

    if (existingMembers.length > 0) {
      const memberNotifications = existingMembers.map((member) => ({
        userId: member.id,
        type: NotificationType.FAMILY_ACTIVITY,
        title: "New Family Member",
        message: `${newMember.firstName} ${newMember.lastName || ""} has joined the ${family.name} family`,
        data: {
          familyId,
          familyName: family.name,
          newMemberId,
          newMemberName: `${newMember.firstName} ${newMember.lastName || ""}`,
          addedById,
          addedByName: `${addedBy.firstName} ${addedBy.lastName || ""}`,
          activityType: "member_added_notification"
        },
        actionUrl: `/families/${familyId}`,
        isActionable: true
      }));

      // Create notifications in parallel
      await Promise.all(
        memberNotifications.map((notification) =>
          notificationRepository.createNotification(notification),
        ),
      );
    }

    // Notify admin users (exclude those already notified)
    const adminUsers = await userRepository.getUsersByRole(UserRole.ADMIN);
    const adminsToNotify = adminUsers.filter(admin =>
      admin.id !== addedById &&
      admin.id !== newMemberId &&
      !existingMembers.some(member => member.id === admin.id)
    );

    if (adminsToNotify.length > 0) {
      const adminNotifications = adminsToNotify.map((admin) => ({
        userId: admin.id,
        type: NotificationType.FAMILY_ACTIVITY,
        title: "Family Membership Update",
        message: `${newMember.firstName} ${newMember.lastName || ""} was added to the ${family.name} family`,
        data: {
          familyId,
          familyName: family.name,
          newMemberId,
          newMemberName: `${newMember.firstName} ${newMember.lastName || ""}`,
          addedById,
          addedByName: `${addedBy.firstName} ${addedBy.lastName || ""}`,
          activityType: "member_added_admin"
        },
        actionUrl: `/admin/families/${familyId}`,
        isActionable: true
      }));

      await Promise.all(
        adminNotifications.map((notification) =>
          notificationRepository.createNotification(notification),
        ),
      );
    }

    console.log("✅ Family member addition notifications sent:", {
      familyId,
      familyName: family.name,
      newMemberId,
      newMemberName: `${newMember.firstName} ${newMember.lastName || ""}`,
      existingMemberCount: existingMembers.length,
      adminCount: adminsToNotify.length
    });
  } catch (error) {
    console.error("❌ Failed to create family member addition notifications:", error);
    // Don't throw error as this is not critical for adding members
  }
}
