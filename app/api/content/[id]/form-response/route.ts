import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ContentRepository } from "@/lib/db/repositories/content.repository";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();
const contentRepository = new ContentRepository(prisma);

/**
 * API Routes for Content Form Responses
 * Handles saving and retrieving form data for interactive content templates
 */

// GET /api/content/[id]/form-response - Get user's form response for content
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: contentId } = await params;
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user role and database ID with dual-path pattern
    const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role;
    let finalUserRole = userRole;
    let dbUserId: string | undefined;

    // Get user's database record for ID and role
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });

    if (dbUser) {
      dbUserId = dbUser.id;
      if (!finalUserRole) finalUserRole = dbUser.role as UserRole;
    }

    if (!finalUserRole || !dbUserId) {
      return NextResponse.json(
        { error: "User role or database record not found" },
        { status: 403 },
      );
    }

    // Get form response
    const formResponse = await contentRepository.getFormResponse(
      contentId,
      dbUserId,
    );

    if (!formResponse) {
      return NextResponse.json(
        { formResponse: null, hasResponse: false },
        { status: 200 },
      );
    }

    return NextResponse.json({
      formResponse: {
        id: formResponse.id,
        formData: formResponse.formData,
        completedAt: formResponse.completedAt,
        updatedAt: formResponse.updatedAt,
        isComplete: Boolean(formResponse.completedAt),
        content: formResponse.content,
      },
      hasResponse: true,
    });
  } catch (error) {
    console.error("Error fetching form response:", error);
    return NextResponse.json(
      { error: "Failed to fetch form response" },
      { status: 500 },
    );
  }
}

// POST /api/content/[id]/form-response - Save or update form response
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: contentId } = await params;
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { formData, isComplete = false } = body;

    if (!formData) {
      return NextResponse.json(
        { error: "Form data is required" },
        { status: 400 },
      );
    }

    // Get user role and database ID with dual-path pattern
    const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role;
    let finalUserRole = userRole;
    let dbUserId: string | undefined;

    // Get user's database record for ID and role
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });

    if (dbUser) {
      dbUserId = dbUser.id;
      if (!finalUserRole) finalUserRole = dbUser.role as UserRole;
    }

    if (!finalUserRole || !dbUserId) {
      return NextResponse.json(
        { error: "User role or database record not found" },
        { status: 403 },
      );
    }

    // Check if user has access to this content
    const content = await contentRepository.findById(
      contentId,
      dbUserId,
      finalUserRole,
    );
    if (!content) {
      return NextResponse.json(
        { error: "Content not found or access denied" },
        { status: 404 },
      );
    }

    // Save form response
    const savedResponse = await contentRepository.saveFormResponse(
      contentId,
      dbUserId,
      formData,
      isComplete,
    );

    return NextResponse.json({
      success: true,
      formResponse: {
        id: savedResponse.id,
        formData: savedResponse.formData,
        completedAt: savedResponse.completedAt,
        updatedAt: savedResponse.updatedAt,
        isComplete: Boolean(savedResponse.completedAt),
        content: savedResponse.content,
        user: savedResponse.user,
      },
    });
  } catch (error) {
    console.error("Error saving form response:", error);
    return NextResponse.json(
      { error: "Failed to save form response" },
      { status: 500 },
    );
  }
}

// DELETE /api/content/[id]/form-response - Delete form response
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: contentId } = await params;
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user role and database ID with dual-path pattern
    const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role;
    let finalUserRole = userRole;
    let dbUserId: string | undefined;

    // Get user's database record for ID and role
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });

    if (dbUser) {
      dbUserId = dbUser.id;
      if (!finalUserRole) finalUserRole = dbUser.role as UserRole;
    }

    if (!finalUserRole || !dbUserId) {
      return NextResponse.json(
        { error: "User role or database record not found" },
        { status: 403 },
      );
    }

    // Check if user has access to this content
    const content = await contentRepository.findById(
      contentId,
      dbUserId,
      finalUserRole,
    );
    if (!content) {
      return NextResponse.json(
        { error: "Content not found or access denied" },
        { status: 404 },
      );
    }

    // Delete form response
    await contentRepository.deleteFormResponse(contentId, dbUserId);

    return NextResponse.json({
      success: true,
      message: "Form response deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting form response:", error);
    return NextResponse.json(
      { error: "Failed to delete form response" },
      { status: 500 },
    );
  }
}
