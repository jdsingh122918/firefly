import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ResourceRepository } from "@/lib/db/repositories/resource.repository";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();
const resourceRepository = new ResourceRepository(prisma);

/**
 * API Routes for Resource Form Responses
 * Handles saving and retrieving form data for interactive resource templates
 */

// GET /api/resources/[id]/form-response - Get user's form response for resource
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: resourceId } = await params;
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
    const formResponse = await resourceRepository.getFormResponse(
      resourceId,
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
        resourceId: formResponse.resourceId,
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

// POST /api/resources/[id]/form-response - Save or update form response
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: resourceId } = await params;
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

    // Check if user has access to this resource
    const resource = await resourceRepository.findById(
      resourceId,
      dbUserId,
      finalUserRole,
    );
    if (!resource) {
      return NextResponse.json(
        { error: "Resource not found or access denied" },
        { status: 404 },
      );
    }

    // Save form response
    const savedResponse = await resourceRepository.saveFormResponse(
      resourceId,
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
        resourceId: savedResponse.resourceId,
        userId: savedResponse.userId,
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

// DELETE /api/resources/[id]/form-response - Delete form response
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: resourceId } = await params;
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

    // Check if user has access to this resource
    const resource = await resourceRepository.findById(
      resourceId,
      dbUserId,
      finalUserRole,
    );
    if (!resource) {
      return NextResponse.json(
        { error: "Resource not found or access denied" },
        { status: 404 },
      );
    }

    // Delete form response
    await resourceRepository.deleteFormResponse(resourceId, dbUserId);

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