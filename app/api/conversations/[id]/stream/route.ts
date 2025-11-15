import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConversationRepository } from "@/lib/db/repositories/conversation.repository";
import { MessageRepository } from "@/lib/db/repositories/message.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";

const conversationRepository = new ConversationRepository();
const messageRepository = new MessageRepository();
const userRepository = new UserRepository();

// Keep track of active connections per conversation
const conversationConnections = new Map<string, Map<string, ReadableStreamDefaultController>>();

/**
 * GET /api/conversations/[id]/stream - Server-Sent Events endpoint for real-time chat messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Get user from database
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return new Response("User not found", { status: 404 });
    }

    const { id } = await params;
    const conversationId = id;

    // Check if user is participant in this conversation
    const isParticipant = await conversationRepository.isUserParticipant(
      conversationId,
      user.id
    );

    if (!isParticipant) {
      return new Response(
        "Access denied: You are not a participant in this conversation",
        { status: 403 }
      );
    }

    console.log("💬 Chat SSE connection established:", {
      conversationId,
      userId: user.id,
      email: user.email,
      timestamp: new Date().toISOString()
    });

    // Create SSE stream for this conversation
    const stream = new ReadableStream({
      start(controller) {
        // Initialize conversation connections if not exists
        if (!conversationConnections.has(conversationId)) {
          conversationConnections.set(conversationId, new Map());
        }

        // Store this user's connection for this conversation
        const userConnections = conversationConnections.get(conversationId)!;
        userConnections.set(user.id, controller);

        // Send initial connection confirmation
        const initialMessage = {
          type: "connected",
          data: {
            timestamp: new Date().toISOString(),
            conversationId,
            message: "Real-time chat connected",
          },
        };

        controller.enqueue(`data: ${JSON.stringify(initialMessage)}\n\n`);

        // Send current typing status (if any users are typing)
        const typingMessage = {
          type: "typing_status",
          data: {
            conversationId,
            typingUsers: [], // TODO: Implement typing tracking
          },
        };
        controller.enqueue(`data: ${JSON.stringify(typingMessage)}\n\n`);

        // Keep connection alive with periodic heartbeat
        const heartbeatInterval = setInterval(() => {
          try {
            const heartbeat = {
              type: "heartbeat",
              data: {
                timestamp: new Date().toISOString(),
                conversationId,
              },
            };
            controller.enqueue(`data: ${JSON.stringify(heartbeat)}\n\n`);
          } catch (error) {
            console.error("❌ Chat heartbeat failed, cleaning up connection:", error);
            clearInterval(heartbeatInterval);

            // Clean up user connection
            const connections = conversationConnections.get(conversationId);
            if (connections) {
              connections.delete(user.id);
              if (connections.size === 0) {
                conversationConnections.delete(conversationId);
              }
            }
          }
        }, 10000); // Send heartbeat every 10 seconds

        // Cleanup on client disconnect
        request.signal.addEventListener("abort", () => {
          console.log("💬 Chat SSE connection closed:", {
            conversationId,
            userId: user.id,
          });

          clearInterval(heartbeatInterval);

          // Remove this user's connection
          const connections = conversationConnections.get(conversationId);
          if (connections) {
            connections.delete(user.id);
            if (connections.size === 0) {
              conversationConnections.delete(conversationId);
            }
          }

          try {
            controller.close();
          } catch {
            // Connection already closed
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
        "X-Accel-Buffering": "no", // Disable Nginx buffering
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("❌ Chat SSE stream error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

/**
 * Utility function to broadcast messages to all connected clients in a conversation
 */
export function broadcastToConversation(conversationId: string, message: any) {
  const connections = conversationConnections.get(conversationId);
  if (!connections || connections.size === 0) {
    return;
  }

  const messageData = `data: ${JSON.stringify(message)}\n\n`;
  const disconnectedUsers: string[] = [];

  connections.forEach((controller, userId) => {
    try {
      controller.enqueue(messageData);
    } catch (error) {
      console.error(`❌ Failed to send message to user ${userId}:`, error);
      disconnectedUsers.push(userId);
    }
  });

  // Clean up disconnected users
  disconnectedUsers.forEach(userId => {
    connections.delete(userId);
  });

  if (connections.size === 0) {
    conversationConnections.delete(conversationId);
  }

  console.log("💬 Broadcasting message to conversation:", {
    conversationId,
    activeConnections: connections.size,
    messageType: message.type,
    timestamp: new Date().toISOString(),
    messageData: message.data ? {
      hasMessage: !!message.data.message,
      messageId: message.data.message?.id,
      senderId: message.data.message?.senderId
    } : null
  });
}

/**
 * Utility function to broadcast typing status to all connected clients in a conversation
 */
export function broadcastTypingStatus(
  conversationId: string,
  userId: string,
  isTyping: boolean,
  userName?: string
) {
  const message = {
    type: "typing_update",
    data: {
      conversationId,
      userId,
      userName,
      isTyping,
      timestamp: new Date().toISOString(),
    },
  };

  broadcastToConversation(conversationId, message);
}

/**
 * Get the number of active connections for a conversation
 */
export function getActiveConnectionsCount(conversationId: string): number {
  const connections = conversationConnections.get(conversationId);
  return connections ? connections.size : 0;
}