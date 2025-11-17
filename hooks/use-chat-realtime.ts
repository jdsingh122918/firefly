"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { Message } from "@/lib/types";

// Debug logging flag - set to false to reduce console noise
const DEBUG_CHAT = false;

interface ChatRealtimeState {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  typingUsers: { userId: string; userName: string }[];
}

interface UseChatRealtimeOptions {
  conversationId: string;
  autoConnect?: boolean;
  onNewMessage?: (message: Message) => void;
  onMessageUpdated?: (message: Message) => void;
  onMessageDeleted?: (messageId: string) => void;
  onTypingUpdate?: (userId: string, isTyping: boolean, userName?: string) => void;
  onReactionAdded?: (messageId: string, emoji: string, userId: string, userName: string) => void;
  onReactionRemoved?: (messageId: string, emoji: string, userId: string, userName: string) => void;
  onConnectionChange?: (connected: boolean) => void;
  enablePollingFallback?: boolean;
  pollingInterval?: number;
}

export function useChatRealtime(options: UseChatRealtimeOptions) {
  const {
    conversationId,
    autoConnect = true,
    onNewMessage,
    onMessageUpdated,
    onMessageDeleted,
    onTypingUpdate,
    onReactionAdded,
    onReactionRemoved,
    onConnectionChange,
    enablePollingFallback = true,
    pollingInterval = 5000, // 5 seconds for chat polling
  } = options;

  const { isSignedIn, getToken } = useAuth();
  const [state, setState] = useState<ChatRealtimeState>({
    isConnected: false,
    isLoading: false,
    error: null,
    typingUsers: [],
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCount = useRef(0);
  const maxRetries = 3;
  const baseRetryDelay = 2000;

  // Use refs to store latest callback functions to prevent re-render loops
  const callbacksRef = useRef({
    onNewMessage,
    onMessageUpdated,
    onMessageDeleted,
    onTypingUpdate,
    onConnectionChange,
  });

  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onNewMessage,
      onMessageUpdated,
      onMessageDeleted,
      onTypingUpdate,
      onConnectionChange,
    };
  }, [onNewMessage, onMessageUpdated, onMessageDeleted, onTypingUpdate, onConnectionChange]);

  // Calculate exponential backoff delay
  const getRetryDelay = useCallback(() => {
    return Math.min(baseRetryDelay * Math.pow(2, retryCount.current), 10000);
  }, []);

  // Handle incoming SSE messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "connected":
          if (DEBUG_CHAT) if (DEBUG_CHAT) console.log("💬 Chat SSE connected:", data.data);
          setState(prev => ({ ...prev, isConnected: true, error: null }));
          callbacksRef.current.onConnectionChange?.(true);
          retryCount.current = 0; // Reset retry count on successful connection
          break;

        case "new_message":
          if (DEBUG_CHAT) if (DEBUG_CHAT) console.log("💬 New message received:", data.data.message);
          // Ensure message has required properties for Message interface
          if (data.data.message && data.data.message.sender) {
            callbacksRef.current.onNewMessage?.(data.data.message);
          }
          break;

        case "message_updated":
          if (DEBUG_CHAT) console.log("💬 Message updated:", data.data.message);
          // Ensure message has required properties for Message interface
          if (data.data.message && data.data.message.sender) {
            callbacksRef.current.onMessageUpdated?.(data.data.message);
          }
          break;

        case "message_deleted":
          if (DEBUG_CHAT) console.log("💬 Message deleted:", data.data.messageId);
          callbacksRef.current.onMessageDeleted?.(data.data.messageId);
          break;

        case "typing_update":
          if (DEBUG_CHAT) console.log("💬 Typing update:", data.data);
          const { userId, userName, isTyping } = data.data;
          callbacksRef.current.onTypingUpdate?.(userId, isTyping, userName);

          setState(prev => {
            const typingUsers = prev.typingUsers.filter(u => u.userId !== userId);
            if (isTyping) {
              typingUsers.push({ userId, userName: userName || "Unknown" });
            }
            return { ...prev, typingUsers };
          });
          break;

        case "message_reaction_added":
          if (DEBUG_CHAT) console.log("😀 Reaction added:", data.data);
          const { messageId: addMessageId, emoji: addEmoji, userId: addUserId, userName: addUserName } = data.data;
          callbacksRef.current.onReactionAdded?.(addMessageId, addEmoji, addUserId, addUserName);
          break;

        case "message_reaction_removed":
          if (DEBUG_CHAT) console.log("😞 Reaction removed:", data.data);
          const { messageId: removeMessageId, emoji: removeEmoji, userId: removeUserId, userName: removeUserName } = data.data;
          callbacksRef.current.onReactionRemoved?.(removeMessageId, removeEmoji, removeUserId, removeUserName);
          break;

        case "typing_status":
          if (DEBUG_CHAT) console.log("💬 Typing status:", data.data);
          setState(prev => ({
            ...prev,
            typingUsers: data.data.typingUsers || [],
          }));
          break;

        case "heartbeat":
          // Keep connection alive - no action needed
          break;

        default:
          if (DEBUG_CHAT) console.log("💬 Unknown SSE message type:", data.type);
      }
    } catch (error) {
      console.error("❌ Error parsing chat SSE message:", error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connect to SSE stream
  const connect = useCallback(async () => {
    if (!isSignedIn || !conversationId) {
      if (DEBUG_CHAT) console.log("💬 Chat SSE connection skipped:", {
        isSignedIn,
        conversationId,
      });
      return;
    }

    // Check loading state without making it a dependency
    const currentState = eventSourceRef.current;
    if (currentState) {
      if (DEBUG_CHAT) console.log("💬 Chat SSE already connected");
      return;
    }

    if (DEBUG_CHAT) console.log("💬 Starting Chat SSE connection:", {
      conversationId,
      timestamp: new Date().toISOString()
    });

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Get auth token for the request
      const token = await getToken();
      const headers: Record<string, string> = {
        "Cache-Control": "no-cache",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Create EventSource connection
      const streamUrl = `/api/conversations/${conversationId}/stream`;
      if (DEBUG_CHAT) console.log("💬 Creating EventSource connection:", { streamUrl });

      const eventSource = new EventSource(
        streamUrl,
        // Note: EventSource doesn't support custom headers in browser
        // The auth will be handled by cookies/session
      );

      eventSource.onmessage = handleMessage;

      eventSource.onerror = (error) => {
        console.error("❌ Chat SSE error:", error);
        setState(prev => ({
          ...prev,
          isConnected: false,
          error: "Connection lost",
        }));
        callbacksRef.current.onConnectionChange?.(false);

        // Implement exponential backoff retry
        if (retryCount.current < maxRetries) {
          const delay = getRetryDelay();
          if (DEBUG_CHAT) console.log(`🔄 Retrying chat SSE connection in ${delay}ms (attempt ${retryCount.current + 1}/${maxRetries})`);

          retryTimeoutRef.current = setTimeout(() => {
            retryCount.current++;
            connect();
          }, delay);
        } else {
          if (DEBUG_CHAT) console.log("🔄 Max retries reached, falling back to polling");
          // Fall back to polling if enabled
          if (enablePollingFallback) {
            startPolling();
          }
        }
      };

      eventSource.onopen = () => {
        if (DEBUG_CHAT) console.log("💬 Chat SSE connection opened successfully:", {
          conversationId,
          readyState: eventSource.readyState,
          timestamp: new Date().toISOString()
        });
      };

      eventSourceRef.current = eventSource;

    } catch (error) {
      console.error("❌ Failed to connect to chat SSE:", error);
      setState(prev => ({
        ...prev,
        isConnected: false,
        isLoading: false,
        error: error instanceof Error ? error.message : "Connection failed",
      }));
      callbacksRef.current.onConnectionChange?.(false);

      // Fall back to polling if enabled
      if (enablePollingFallback) {
        startPolling();
      }
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [isSignedIn, conversationId, getToken, handleMessage, getRetryDelay, enablePollingFallback]);

  // Polling fallback for when SSE fails
  const startPolling = useCallback(() => {
    if (DEBUG_CHAT) console.log("🔄 Starting chat polling fallback");

    pollingIntervalRef.current = setInterval(() => {
      // In real implementation, this would fetch recent messages
      // For now, we'll just indicate that polling is active
      if (DEBUG_CHAT) console.log("🔄 Chat polling tick");
    }, pollingInterval);

    setState(prev => ({
      ...prev,
      isConnected: true, // Consider polling as "connected"
      error: "Using polling fallback",
    }));
    callbacksRef.current.onConnectionChange?.(true);
  }, [pollingInterval]);

  // Disconnect from SSE stream
  const disconnect = useCallback(() => {
    if (DEBUG_CHAT) console.log("💬 Disconnecting chat SSE");

    // Clear retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Clear polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Close EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Reset state
    setState({
      isConnected: false,
      isLoading: false,
      error: null,
      typingUsers: [],
    });
    callbacksRef.current.onConnectionChange?.(false);
    retryCount.current = 0;
  }, []);

  // Auto-connect when conditions are met
  useEffect(() => {
    if (autoConnect && isSignedIn && conversationId && !eventSourceRef.current) {
      connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, isSignedIn, conversationId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Send typing indicator
  const sendTypingIndicator = useCallback(async (isTyping: boolean) => {
    if (!isSignedIn || !conversationId) {
      return;
    }

    try {
      await fetch(`/api/conversations/${conversationId}/typing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isTyping }),
      });
    } catch (error) {
      console.error("❌ Failed to send typing indicator:", error);
    }
  }, [isSignedIn, conversationId]);

  return {
    ...state,
    connect,
    disconnect,
    sendTypingIndicator,
  };
}