import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ResourceRepository, AssignmentFilters, AssignmentInput } from "@/lib/db/repositories/resource.repository";
import { prisma } from "@/lib/db/prisma";
import { AssignmentPriority, AssignmentStatus, UserRole } from "@prisma/client";

/**
 * GET /api/assignments
 *
 * Get assignments for the current user with pagination and stats
 * Query parameters:
 * - view: "assigned" (assignments assigned to user) or "created" (assignments created by user)
 * - page: page number (default: 1)
 * - limit: items per page (default: 50)
 * - status: filter by status (comma-separated)
 * - priority: filter by priority (comma-separated)
 * - sortBy: sort field (createdAt, updatedAt, title, dueDate, priority)
 * - sortOrder: sort order (asc, desc)
 */
export async function GET(request: NextRequest) {
  console.log('🔍 [API /assignments] GET request received');
  try {
    // Check authentication
    const { userId } = await auth();
    console.log('🔑 [API /assignments] Auth check:', {
      hasUserId: !!userId,
      userId: userId?.substring(0, 8) + '...' // Log partial ID for debugging
    });

    if (!userId) {
      console.error('🚫 [API /assignments] No user ID in auth');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get database user
    console.log('🔎 [API /assignments] Looking up database user...');
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true }
    });
    if (!dbUser) {
      console.error('🚫 [API /assignments] Database user not found for Clerk ID:', userId);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    console.log('✅ [API /assignments] Database user found:', {
      dbUserId: dbUser.id,
      role: dbUser.role
    });

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "assigned";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const sortBy = searchParams.get("sortBy") as AssignmentFilters["sortBy"] || "createdAt";
    const sortOrder = searchParams.get("sortOrder") as "asc" | "desc" || "desc";

    console.log('📋 [API /assignments] Parsed parameters:', {
      view,
      page,
      limit,
      sortBy,
      sortOrder,
      url: request.url
    });

    // Parse status filter
    let status: AssignmentStatus[] | undefined;
    const statusParam = searchParams.get("status");
    if (statusParam) {
      status = statusParam.split(",").filter(s =>
        Object.values(AssignmentStatus).includes(s as AssignmentStatus)
      ) as AssignmentStatus[];
    }

    // Parse priority filter
    let priority: AssignmentPriority[] | undefined;
    const priorityParam = searchParams.get("priority");
    if (priorityParam) {
      priority = priorityParam.split(",").filter(p =>
        Object.values(AssignmentPriority).includes(p as AssignmentPriority)
      ) as AssignmentPriority[];
    }

    // Build filters
    const filters: AssignmentFilters = {
      page,
      limit,
      sortBy,
      sortOrder,
      status,
      priority,
    };

    // Get assignments using repository
    console.log('🏗️ [API /assignments] Creating resource repository...');
    const resourceRepository = new ResourceRepository(prisma);
    let result;

    console.log('📊 [API /assignments] Calling repository method for view:', view);
    if (view === "assigned") {
      console.log('👤 [API /assignments] Getting assignments FOR user:', dbUser.id);
      result = await resourceRepository.getAssignmentsForUser(dbUser.id, filters);
    } else if (view === "created") {
      console.log('✍️ [API /assignments] Getting assignments CREATED BY user:', dbUser.id);
      result = await resourceRepository.getAssignmentsCreatedByUser(
        dbUser.id,
        dbUser.role as UserRole,
        filters
      );
    } else {
      console.error('❌ [API /assignments] Invalid view parameter:', view);
      return NextResponse.json(
        { error: "Invalid view parameter. Must be 'assigned' or 'created'" },
        { status: 400 }
      );
    }

    console.log('📦 [API /assignments] Repository result:', {
      assignmentsCount: result?.assignments?.length || 0,
      hasStats: !!result?.stats,
      hasPagination: !!result?.pagination,
      statsData: result?.stats
    });

    // Return response in expected format
    console.log('✅ [API /assignments] Sending successful response');
    return NextResponse.json({
      assignments: result.assignments,
      stats: result.stats,
      pagination: result.pagination,
    });

  } catch (error) {
    console.error("💥 [API /assignments] Error fetching assignments:", {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/assignments
 *
 * Create a new assignment for a resource
 * Request body:
 * - resourceId: string (required)
 * - assignedTo: string (required)
 * - priority: AssignmentPriority
 * - dueDate: string (ISO date)
 * - title: string (optional)
 * - description: string (optional)
 * - estimatedMinutes: number (optional)
 * - tags: string[] (optional)
 */
export async function POST(request: NextRequest) {
  console.log('📝 [API /assignments] POST request received');
  try {
    // Check authentication
    const { userId } = await auth();
    console.log('🔑 [API /assignments] Auth check for POST:', {
      hasUserId: !!userId,
      userId: userId?.substring(0, 8) + '...'
    });

    if (!userId) {
      console.error('🚫 [API /assignments] No user ID in auth for POST');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get database user
    console.log('🔎 [API /assignments] Looking up database user for POST...');
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true }
    });
    if (!dbUser) {
      console.error('🚫 [API /assignments] Database user not found for POST:', userId);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    console.log('✅ [API /assignments] Database user found for POST:', {
      dbUserId: dbUser.id,
      role: dbUser.role
    });

    // Parse request body
    const body = await request.json();
    console.log('📦 [API /assignments] Request body:', {
      hasResourceId: !!body.resourceId,
      hasAssignedTo: !!body.assignedTo,
      priority: body.priority,
      hasDueDate: !!body.dueDate
    });

    const { resourceId, assignedTo, priority, dueDate, title, description, estimatedMinutes, tags } = body;

    // Validate required fields
    if (!resourceId) {
      console.error('❌ [API /assignments] Missing resourceId');
      return NextResponse.json({ error: "Resource ID is required" }, { status: 400 });
    }

    if (!assignedTo) {
      console.error('❌ [API /assignments] Missing assignedTo');
      return NextResponse.json({ error: "assignedTo user ID is required" }, { status: 400 });
    }

    // Build assignment data
    const assignmentData: AssignmentInput = {
      title: title || "Resource Assignment",
      description,
      assignedTo,
      priority: priority || AssignmentPriority.MEDIUM,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      estimatedMinutes,
      tags: tags || []
    };

    console.log('🏗️ [API /assignments] Creating assignment with data:', {
      resourceId,
      assignmentData: {
        ...assignmentData,
        dueDate: assignmentData.dueDate?.toISOString()
      }
    });

    // Create assignment using repository
    const resourceRepository = new ResourceRepository(prisma);
    const assignment = await resourceRepository.createAssignment(
      resourceId,
      assignmentData,
      dbUser.id,
      dbUser.role as UserRole
    );

    console.log('✅ [API /assignments] Assignment created successfully:', {
      assignmentId: assignment.id,
      resourceId: assignment.resourceId,
      assignedTo: assignment.assignedTo
    });

    return NextResponse.json({
      assignment,
      message: "Assignment created successfully"
    }, { status: 201 });

  } catch (error) {
    console.error("💥 [API /assignments] Error creating assignment:", {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes('Permission denied')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: "Failed to create assignment" },
      { status: 500 }
    );
  }
}