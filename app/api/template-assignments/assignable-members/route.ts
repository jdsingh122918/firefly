import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { UserRole } from "@/lib/auth/roles";
import { TemplateAssignmentRepository } from "@/lib/db/repositories/template-assignment.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const templateAssignmentRepository = new TemplateAssignmentRepository();
const userRepository = new UserRepository();

/**
 * GET /api/template-assignments/assignable-members
 * Get list of members that can be assigned to a template
 * - Admin sees all MEMBER users
 * - Volunteer sees only members from their assigned families
 *
 * Query params:
 * - resourceId (required): The template to check existing assignments against
 * - query (optional): Search filter for name/email
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

    // Only ADMIN and VOLUNTEER can access this endpoint
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.VOLUNTEER) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get("resourceId");
    const query = searchParams.get("query")?.trim() || undefined;

    if (!resourceId) {
      return NextResponse.json(
        { error: "resourceId is required" },
        { status: 400 }
      );
    }

    // Get assignable members using repository method
    // Cast is needed because TypeScript narrows user.role to string literals after the check above
    const result = await templateAssignmentRepository.getAssignableMembers(
      resourceId,
      user.id,
      user.role as UserRole,
      query
    );

    return NextResponse.json({
      success: true,
      members: result.members,
    });
  } catch (error) {
    console.error("Error fetching assignable members:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignable members" },
      { status: 500 }
    );
  }
}
