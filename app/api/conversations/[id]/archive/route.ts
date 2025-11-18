import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConversationRepository } from "@/lib/db/repositories/conversation.repository";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conversationRepo = new ConversationRepository();

    // Check if user has permission to archive this conversation
    const hasPermission = await conversationRepo.getUserPermissions(id, clerkUserId);

    if (!hasPermission || !hasPermission.canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Archive the conversation (set isActive to false)
    const archivedConversation = await conversationRepo.updateConversation(id, {
      isActive: false,
    });

    if (!archivedConversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Conversation archived successfully",
      data: archivedConversation,
    });
  } catch (error) {
    console.error("❌ Error archiving conversation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}