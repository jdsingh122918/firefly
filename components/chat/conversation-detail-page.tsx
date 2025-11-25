"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { UserRole } from "@prisma/client";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  Send,
  MoreVertical,
  Users,
  Phone,
  Video,
  Paperclip,
  Smile,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { SlackStyleInput } from "@/components/chat/slack-style-input";
import { UploadedFile } from "@/hooks/use-file-upload";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDistanceToNow } from "date-fns";
import { MessageList } from "./message-list";
import { useChatRealtime } from "@/hooks/use-chat-realtime";
import { useMessageReactions } from "@/components/chat/message-reactions";
import { useAutoDismissNotifications } from "@/hooks/use-auto-dismiss-notifications";
import { MessageMetadata, MessageReaction } from "@/lib/types/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddParticipantDialog } from "./add-participant-dialog";

interface Conversation {
  id: string;
  title?: string;
  type: string;
  familyId?: string;
  family?: {
    id: string;
    name: string;
  };
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  participants: {
    id: string;
    userId: string;
    canWrite: boolean;
    canManage: boolean;
    joinedAt: string;
    user: {
      id: string;
      firstName?: string;
      lastName?: string;
      email: string;
      role: UserRole;
      imageUrl?: string;
    };
  }[];
}

interface Message {
  id: string;
  content: string;
  conversationId: string;
  senderId: string;
  replyToId?: string;
  isEdited: boolean;
  editedAt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  attachments: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  sender: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    role: UserRole;
    imageUrl?: string;
  };
  replyTo?: Message;
}

interface ConversationDetailPageProps {
  conversationId: string;
  userRole: UserRole;
  userId: string;
}

// Debug flag for message loading - set to false in production
const DEBUG_MESSAGES = false;

// Utility function to remove duplicate messages by ID
const deduplicateMessages = (messages: Message[]): Message[] => {
  const seen = new Set<string>();
  return messages.filter(message => {
    // Ensure message has required properties
    if (!message || !message.id) {
      return false;
    }
    if (seen.has(message.id)) {
      return false;
    }
    seen.add(message.id);
    return true;
  });
};

export function ConversationDetailPage({
  conversationId,
  userRole,
  userId,
}: ConversationDetailPageProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [messageAttachments, setMessageAttachments] = useState<UploadedFile[]>([]);
  const [sending, setSending] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reaction state management
  const {
    reactions,
    addReaction,
    removeReaction,
    setMessageReactions,
    getMessageReactions
  } = useMessageReactions();

  // Auto-dismiss notifications when viewing this conversation
  useAutoDismissNotifications("conversationId", conversationId, {
    enabled: !!conversationId && !loading && isLoaded && isSignedIn,
  });

  // API functions for reactions - Define handleRemoveReaction first to avoid circular dependency
  const handleRemoveReaction = useCallback(async (messageId: string, emoji: string) => {
    console.log('🗑️ Remove Reaction Debug:', {
      messageId,
      emoji,
      userId,
      conversationId,
      timestamp: new Date().toISOString()
    });

    if (!userId) {
      console.error('❌ No userId available for removing reaction');
      setError("You must be signed in to remove reactions");
      return;
    }

    if (!messageId || !emoji) {
      console.error('❌ Missing messageId or emoji for removal:', { messageId, emoji });
      setError("Invalid reaction removal request");
      return;
    }

    const apiUrl = `/api/conversations/${conversationId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`;
    console.log('📡 Making DELETE API request:', {
      url: apiUrl,
      method: 'DELETE',
      encodedEmoji: encodeURIComponent(emoji)
    });

    // Remove optimistically for better UX
    console.log('⚡ Removing reaction optimistically');
    const userName = 'You'; // Simple fallback since this is the current user's action
    removeReaction(messageId, emoji, userId, userName);

    try {
      const response = await fetch(apiUrl, {
        method: 'DELETE',
      });

      console.log('📊 DELETE API Response:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error('❌ Failed to parse delete error response:', parseError);
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }

        console.error('❌ Delete API Error Response:', errorData);

        // Rollback optimistic removal - add the reaction back
        console.log('🔄 Rolling back optimistic removal due to API error');
        addReaction(messageId, emoji, userId, userName);

        setError(`Failed to remove reaction: ${errorData.error || 'Unknown error'}`);
        return;
      }

      console.log('✅ Delete API Success - Optimistic removal confirmed');
      // Reaction already removed optimistically, just clear any errors
      setError(null);

      console.log('✨ Reaction removed successfully:', { messageId, emoji, userId });
    } catch (error) {
      console.error('💥 Delete Network/JavaScript Error:', error);

      // Rollback optimistic removal on network error - add the reaction back
      console.log('🔄 Rolling back optimistic removal due to network error');
      addReaction(messageId, emoji, userId, userName);

      // Provide user feedback for network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setError("Network error: Please check your connection and try again");
      } else {
        setError(`Failed to remove reaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }, [conversationId, userId, removeReaction, addReaction, setError]);

  // API functions for reactions - Toggle behavior (add if not present, remove if present)
  const handleAddReaction = useCallback(async (messageId: string, emoji: string) => {
    console.log('🎭 Emoji Click Debug:', {
      messageId,
      emoji,
      userId,
      conversationId,
      timestamp: new Date().toISOString()
    });

    if (!userId) {
      console.error('❌ No userId available for reaction');
      setError("You must be signed in to react to messages");
      return;
    }

    if (!messageId || !emoji) {
      console.error('❌ Missing messageId or emoji:', { messageId, emoji });
      setError("Invalid reaction request");
      return;
    }

    // Check if user already reacted with this emoji
    const messageReactions = getMessageReactions(messageId);
    const emojiReactions = messageReactions[emoji] || [];
    const userAlreadyReacted = emojiReactions.some(reaction => reaction.userId === userId);

    console.log('🔍 Reaction State Check:', {
      messageReactions,
      emojiReactions,
      userAlreadyReacted,
      currentUserId: userId
    });

    if (userAlreadyReacted) {
      console.log('👤 User already reacted, removing reaction instead');
      // If user already reacted, remove the reaction instead
      handleRemoveReaction(messageId, emoji);
      return;
    }

    const apiUrl = `/api/conversations/${conversationId}/messages/${messageId}/reactions`;
    console.log('📡 Making API request:', {
      url: apiUrl,
      method: 'POST',
      body: { emoji }
    });

    // Add optimistic reaction immediately for better UX
    console.log('⚡ Adding optimistic reaction');
    const userName = 'You'; // Simple fallback since this is the current user's action
    addReaction(messageId, emoji, userId, userName);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji }),
      });

      console.log('📊 API Response:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error('❌ Failed to parse error response:', parseError);
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }

        console.error('❌ API Error Response:', errorData);

        // Rollback optimistic update
        console.log('🔄 Rolling back optimistic reaction due to API error');
        removeReaction(messageId, emoji, userId, userName);

        // Handle "already reacted" case gracefully
        if (errorData.error?.includes('Already reacted')) {
          console.log('🔄 Server says already reacted, trying to remove reaction instead');
          // Try to remove the reaction instead (server state and local state are out of sync)
          handleRemoveReaction(messageId, emoji);
          return;
        }

        // Show user-friendly error
        setError(`Failed to add reaction: ${errorData.error || 'Unknown error'}`);
        return;
      }

      console.log('✅ API Success - Optimistic reaction confirmed');
      // Reaction already added optimistically, just clear any errors
      setError(null);

      console.log('✨ Reaction added successfully:', { messageId, emoji, userId });
    } catch (error) {
      console.error('💥 Network/JavaScript Error:', error);

      // Rollback optimistic update on network error
      console.log('🔄 Rolling back optimistic reaction due to network error');
      removeReaction(messageId, emoji, userId, userName);

      // Provide user feedback for network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setError("Network error: Please check your connection and try again");
      } else {
        setError(`Failed to add reaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }, [conversationId, userId, addReaction, removeReaction, getMessageReactions, handleRemoveReaction, setError]);

  // Real-time chat functionality
  const {
    isConnected,
    typingUsers,
    sendTypingIndicator,
  } = useChatRealtime({
    conversationId,
    onNewMessage: (newMessage) => {
      setMessages(prev => {
        // Avoid duplicates by checking if message already exists
        if (prev.some(msg => msg.id === newMessage.id)) {
          return prev;
        }
        // Add the new message and ensure no duplicates exist
        const updatedMessages = [...prev, newMessage] as Message[];
        return deduplicateMessages(updatedMessages);
      });
    },
    onMessageUpdated: (updatedMessage) => {
      setMessages(prev => {
        const updatedMessages = prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg) as Message[];
        return deduplicateMessages(updatedMessages);
      });
    },
    onMessageDeleted: (messageId) => {
      setMessages(prev => {
        const updatedMessages = prev.map(msg =>
          msg.id === messageId
            ? { ...msg, isDeleted: true, content: "[This message was deleted]" }
            : msg
        ) as Message[];
        return deduplicateMessages(updatedMessages);
      });
    },
    onConnectionChange: (connected) => {
      // Connection status change handled by component state
    },
    onReactionAdded: (messageId, emoji, userId, userName) => {
      addReaction(messageId, emoji, userId, userName);
    },
    onReactionRemoved: (messageId, emoji, userId, userName) => {
      removeReaction(messageId, emoji, userId, userName);
    },
  });

  // Clear reactions when navigating to a new conversation
  useEffect(() => {
    // Reset reaction state when conversation changes
    setMessages([]);
    initializedMessagesRef.current.clear();
    // Note: reaction state will be reinitialized when new messages load
  }, [conversationId]);

  // Auto-dismiss error messages after 5 seconds
  useEffect(() => {
    if (error) {
      const timeout = setTimeout(() => {
        setError(null);
      }, 5000); // Clear error after 5 seconds

      return () => clearTimeout(timeout);
    }
  }, [error]);

  // Initialize reactions from database when messages are loaded
  const initializedMessagesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    messages.forEach(msg => {
      // Only initialize if we haven't already for this message
      if (
        msg.metadata?.reactions &&
        Object.keys(msg.metadata.reactions).length > 0 &&
        !initializedMessagesRef.current.has(msg.id)
      ) {
        setMessageReactions(msg.id, msg.metadata.reactions as Record<string, MessageReaction[]>);
        initializedMessagesRef.current.add(msg.id);
      }
    });
  }, [messages]);

  // Memoize messages with reactions to prevent infinite render loops
  const messagesWithReactions = useMemo(() => {
    return messages.map(msg => {
      const localReactions = getMessageReactions(msg.id);
      const databaseReactions = (msg.metadata?.reactions as Record<string, MessageReaction[]>) || {};

      // Merge database reactions with local reactions (local takes precedence for optimistic updates)
      const mergedReactions = { ...databaseReactions, ...localReactions };

      return {
        ...msg,
        metadata: {
          ...msg.metadata,
          reactions: mergedReactions
        }
      };
    });
  }, [messages, getMessageReactions]);

  // Fetch conversation and initial messages
  const fetchConversationData = useCallback(async () => {
    // Wait for auth to be loaded and ensure user is signed in
    if (!isLoaded || !isSignedIn) {
      return;
    }

    // Validate conversationId
    if (!conversationId || typeof conversationId !== 'string') {
      setError("Invalid conversation ID");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log("🔍 Fetching conversation data:", {
        conversationId,
        conversationUrl: `/api/conversations/${conversationId}`,
        messagesUrl: `/api/conversations/${conversationId}/messages?limit=50`
      });

      const [conversationResponse, messagesResponse] = await Promise.all([
        fetch(`/api/conversations/${conversationId}`, {
          credentials: 'include', // Ensure cookies are sent
        }),
        fetch(`/api/conversations/${conversationId}/messages?limit=50`, {
          credentials: 'include', // Ensure cookies are sent
        }),
      ]);

      console.log("📡 API Response status:", {
        conversation: conversationResponse.status,
        messages: messagesResponse.status
      });

      if (!conversationResponse.ok) {
        let errorMessage = "Failed to load conversation";
        try {
          const errorData = await conversationResponse.json();
          console.error("❌ Conversation API error details:", errorData);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          console.error("❌ Could not parse conversation error response:", e);
        }

        if (conversationResponse.status === 404) {
          setError("Conversation not found");
        } else if (conversationResponse.status === 403) {
          setError("Access denied: You don't have permission to view this conversation");
        } else if (conversationResponse.status === 401) {
          setError("Authentication required - please sign in again");
        } else {
          setError(`Failed to load conversation: ${conversationResponse.status} - ${errorMessage}`);
        }
        return;
      }

      if (!messagesResponse.ok) {
        console.error("❌ Messages API error:", {
          status: messagesResponse.status,
          statusText: messagesResponse.statusText,
          url: messagesResponse.url
        });

        // For messages API errors, show conversation but with no messages
        // This allows users to still access the conversation and send messages
        const conversationData = await conversationResponse.json();
        setConversation(conversationData.conversation || conversationData.data);
        setMessages([]);

        // Set a warning instead of a full error
        if (messagesResponse.status === 403) {
          console.warn("⚠️ Access denied to messages, showing conversation without history");
        } else if (messagesResponse.status === 404) {
          console.warn("⚠️ Messages not found, showing empty conversation");
        } else {
          try {
            const errorData = await messagesResponse.json();
            console.warn("⚠️ Messages API error, showing conversation without history:", errorData);
          } catch {
            console.warn(`⚠️ Messages API error (${messagesResponse.status}), showing conversation without history`);
          }
        }

        // Don't return early - let the rest of the function complete
        setLoading(false);
        return;
      }

      // Handle conversation data
      const conversationData = await conversationResponse.json();
      setConversation(conversationData.conversation || conversationData.data);

      // Handle messages data separately since it might have failed
      const messagesData = await messagesResponse.json();

      if (DEBUG_MESSAGES) console.log("📨 Messages API Response:", messagesData);

      if (messagesData.success && messagesData.data) {
        // API returns { success: true, data: { items: Message[], total, page, limit, ... } }
        const initialMessages = (messagesData.data.items || []).filter((msg: any) => msg && msg.id) as Message[];
        if (DEBUG_MESSAGES) console.log("📨 Initial messages loaded:", initialMessages.length);
        setMessages(deduplicateMessages(initialMessages));
      } else if (messagesData.messages) {
        // Fallback for other response formats
        const initialMessages = (messagesData.messages || []).filter((msg: any) => msg && msg.id) as Message[];
        if (DEBUG_MESSAGES) console.log("📨 Initial messages loaded (fallback):", initialMessages.length);
        setMessages(deduplicateMessages(initialMessages));
      } else {
        if (DEBUG_MESSAGES) console.warn("📨 No messages found or invalid response format:", messagesData);
        setMessages([]);
      }
    } catch (error) {
      console.error("❌ Error fetching conversation data:", error);

      // Provide more specific error message
      if (error instanceof Error) {
        setError(`Failed to load conversation: ${error.message}`);
      } else {
        setError("Failed to load conversation: Unknown error occurred");
      }
    } finally {
      setLoading(false);
    }
  }, [conversationId, isLoaded, isSignedIn]);

  // Handle typing indicators
  const handleTyping = useCallback(() => {
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send typing indicator
    sendTypingIndicator(true);

    // Set timeout to stop typing indicator after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator(false);
    }, 3000);
  }, [sendTypingIndicator]);

  // Handle message input changes with typing indicators
  const handleInputChange = useCallback((value: string) => {
    setMessageInput(value);

    // Only send typing indicators if there's actual content
    if (value.trim()) {
      handleTyping();
    } else {
      // Stop typing indicator if input is empty
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      sendTypingIndicator(false);
    }
  }, [handleTyping, sendTypingIndicator]);

  // Send message with optimistic updates and typing indicators
  const handleSendMessage = async () => {
    if ((!messageInput.trim() && messageAttachments.length === 0) || sending) return;

    const content = messageInput.trim();
    const originalAttachments = [...messageAttachments]; // Store original attachments for error recovery
    const attachmentIds = messageAttachments.map(attachment => attachment.fileId);

    // Clear typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    sendTypingIndicator(false);

    try {
      setSending(true);
      setMessageInput(""); // Clear input immediately for better UX
      setMessageAttachments([]); // Clear attachments immediately for better UX

      // Create optimistic message for immediate UI feedback
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        content,
        conversationId,
        senderId: userId,
        isEdited: false,
        isDeleted: false,
        attachments: attachmentIds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sender: {
          id: userId,
          firstName: "You",
          lastName: "",
          email: "",
          role: userRole,
        },
      };

      // Add optimistic message immediately for better UX
      setMessages(prev => deduplicateMessages([...prev, optimisticMessage] as Message[]));

      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Ensure cookies are sent
        body: JSON.stringify({
          content,
          attachments: attachmentIds,
        }),
      });

      if (!response.ok) {
        // Remove optimistic message on error
        setMessages(prev => deduplicateMessages(prev.filter(msg => msg.id !== optimisticMessage.id) as Message[]));

        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      const result = await response.json();

      // Replace optimistic message with real message (avoid duplicates from SSE)
      setMessages(prev => {
        // Check if the real message already exists (from SSE)
        const realMessageExists = prev.some(msg => msg.id === result.data.id);

        let updatedMessages: Message[];
        if (realMessageExists) {
          // Real message already exists from SSE, just remove optimistic message
          updatedMessages = prev.filter(msg => msg.id !== optimisticMessage.id);
        } else {
          // Replace optimistic message with real message
          updatedMessages = prev.map(msg =>
            msg.id === optimisticMessage.id ? result.data : msg
          );
        }

        // Ensure no duplicates exist as a final safeguard
        return deduplicateMessages(updatedMessages as Message[]);
      });

    } catch (error) {
      console.error('Error sending message:', error);
      // Restore message input and attachments on error
      setMessageInput(content);
      setMessageAttachments(originalAttachments);
      setError(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle dialog actions
  const handleShowParticipants = () => {
    setShowParticipants(true);
  };

  const handleShowAddParticipant = () => {
    setShowAddParticipant(true);
  };

  const handleParticipantAdded = (participant: any) => {
    // Refresh conversation data to show new participant
    fetchConversationData();
  };

  const handleLeaveConversation = async () => {
    if (!confirm('Are you sure you want to leave this conversation? You will no longer receive messages.')) {
      return;
    }

    try {
      const response = await fetch(`/api/conversations/${conversationId}/participants/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to leave conversation');
      }

      // Navigate back to chat list after leaving
      window.location.href = `/${userRole.toLowerCase()}/chat`;
    } catch (error) {
      console.error('Error leaving conversation:', error);
      alert('Failed to leave conversation. Please try again.');
    }
  };


  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Setup data fetching
  useEffect(() => {
    fetchConversationData();
  }, [fetchConversationData]);

  if (loading || !isLoaded) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-6 bg-muted rounded w-48 animate-pulse" />
        </div>
        <Card className="p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-3/4" />
            <div className="space-y-2">
              <div className="h-3 bg-muted rounded" />
              <div className="h-3 bg-muted rounded w-5/6" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link href={`/${userRole.toLowerCase()}/chat`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Chat
            </Button>
          </Link>
        </div>
        <Alert>
          <AlertDescription>
            Please sign in to view this conversation.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link href={`/${userRole.toLowerCase()}/chat`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Chat
            </Button>
          </Link>
        </div>
        <Alert>
          <AlertDescription>
            {error || "Conversation not found"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const getDisplayTitle = () => {
    if (conversation.title) return conversation.title;

    switch (conversation.type) {
      case 'FAMILY_CHAT':
        return conversation.family?.name ? `${conversation.family.name} Chat` : 'Family Chat';
      case 'ANNOUNCEMENT':
        return 'Announcements';
      case 'CARE_UPDATE':
        return 'Care Updates';
      default:
        return `Chat ${conversation.id.slice(-4)}`;
    }
  };

  const canWrite = conversation.participants.find(p => p.userId === userId)?.canWrite ?? false;
  const canManage = userRole === UserRole.ADMIN ||
                   (conversation.participants.find(p => p.userId === userId)?.canManage ?? false);

  return (
    <>
      <div className="flex flex-1 gap-1 min-h-0 h-full">
        {/* Main Chat Area */}
        <div className="flex flex-col flex-1 min-w-0 h-full">
          {/* Simplified Header */}
          <Card className="flex-shrink-0 p-3">
            <CardContent className="py-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link href={`/${userRole.toLowerCase()}/chat`}>
                    <Button variant="ghost" size="sm" className="min-h-[44px]">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  </Link>
                  <div>
                    <h1 className="font-semibold text-lg">{getDisplayTitle()}</h1>
                  </div>
                </div>

                {/* Mobile Sidebar Toggle */}
                <div className="lg:hidden">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSidebar(!showSidebar)}
                    className="min-h-[44px]"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Info
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Notification Area */}
          {error && !loading && (
            <div className="px-4 py-2">
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">
                  {error}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 h-auto p-1 text-red-600 hover:text-red-800"
                    onClick={() => setError(null)}
                  >
                    ✕
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Messages Area - Accounts for sticky input */}
          <div className="flex-1 min-h-0 overflow-hidden pb-2">
            <MessageList
              messages={messagesWithReactions}
              currentUserId={userId}
              conversationId={conversationId}
              userRole={userRole}
              onAddReaction={handleAddReaction}
              onRemoveReaction={handleRemoveReaction}
            />
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input - Sticky at bottom */}
          {canWrite ? (
            <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border flex-shrink-0 z-10">
              <SlackStyleInput
                content={messageInput}
                onChange={handleInputChange}
                onSend={handleSendMessage}
                placeholder="Type your message..."
                disabled={sending}
                sending={sending}
                maxLength={2000}
                attachments={messageAttachments}
                onAttachmentsChange={setMessageAttachments}
              />
            </div>
          ) : (
            <Card className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border flex-shrink-0 z-10 p-3">
              <div className="text-center text-muted-foreground">
                <p className="text-sm">You don't have permission to send messages in this conversation.</p>
              </div>
            </Card>
          )}
        </div>

        {/* Right Sidebar */}
        <div className={`
          lg:w-80 lg:border-l lg:border-border lg:bg-background/50 lg:backdrop-blur-sm lg:block
          fixed lg:static inset-y-0 right-0 z-50 w-80 bg-background border-l border-border
          transform transition-transform duration-300 ease-in-out
          ${showSidebar ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}>
          <div className="flex flex-col h-full">
            {/* Mobile Close Button */}
            <div className="lg:hidden flex justify-between items-center p-4 border-b">
              <h2 className="font-semibold">Conversation Info</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSidebar(false)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>

            {/* Conversation Info */}
            <Card className="flex-shrink-0 border-0 border-b rounded-none">
              <CardContent className="p-4 space-y-3">
                <div>
                  <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Conversation</h2>
                  <h3 className="font-medium">{getDisplayTitle()}</h3>
                  {conversation.family && (
                    <p className="text-sm text-muted-foreground">Family: {conversation.family.name}</p>
                  )}
                </div>

                {/* Connection Status */}
                <div className="flex items-center gap-2 p-2 rounded-md bg-accent/50">
                  {isConnected ? (
                    <>
                      <Wifi className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600 font-medium">Connected</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-4 w-4 text-orange-500" />
                      <span className="text-sm text-orange-500 font-medium">Connecting...</span>
                    </>
                  )}
                </div>

                {/* Typing Indicators */}
                {typingUsers.length > 0 && (
                  <div className="p-2 rounded-md bg-primary/10">
                    <div className="text-sm text-muted-foreground">
                      {typingUsers.length === 1
                        ? `${typingUsers[0].userName} is typing...`
                        : typingUsers.length === 2
                        ? `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing...`
                        : `${typingUsers[0].userName} and ${typingUsers.length - 1} others are typing...`
                      }
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Participants List */}
            <Card className="flex-1 border-0 rounded-none overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Participants ({conversation.participants.length})
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleShowParticipants}
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                </div>

                <ScrollArea className="h-[calc(100%-40px)]">
                  <div className="space-y-3">
                    {conversation.participants.map((participant) => (
                      <div key={participant.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={participant.user.imageUrl} />
                          <AvatarFallback>
                            {participant.user.firstName?.[0] || participant.user.email[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {participant.user.firstName
                              ? `${participant.user.firstName} ${participant.user.lastName || ''}`.trim()
                              : participant.user.email
                            }
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant={participant.user.role === 'ADMIN' ? 'default' : 'secondary'} className="text-xs">
                              {participant.user.role}
                            </Badge>
                            {participant.canManage && (
                              <Badge variant="outline" className="text-xs">Manager</Badge>
                            )}
                            {!participant.canWrite && (
                              <Badge variant="outline" className="text-xs text-muted-foreground">Read-only</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

          </div>
        </div>

        {/* Mobile Sidebar Backdrop */}
        {showSidebar && (
          <div
            className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={() => setShowSidebar(false)}
          />
        )}
      </div>

      {/* Participants Dialog */}
      <Dialog open={showParticipants} onOpenChange={setShowParticipants}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Participants ({conversation?.participants.length})</DialogTitle>
            <DialogDescription>
              Members of this conversation
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3">
            {conversation?.participants.map((participant) => (
              <div key={participant.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={participant.user?.imageUrl} />
                    <AvatarFallback className="text-sm">
                      {participant.user?.firstName?.charAt(0) || participant.user?.email?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {participant.user?.firstName && participant.user?.lastName
                        ? `${participant.user.firstName} ${participant.user.lastName}`
                        : participant.user?.email || 'Unknown User'}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {participant.user?.role || 'MEMBER'}
                      </Badge>
                      {participant.canManage && (
                        <Badge variant="outline" className="text-xs">
                          Manager
                        </Badge>
                      )}
                      {!participant.canWrite && (
                        <Badge variant="secondary" className="text-xs text-muted-foreground">
                          Read only
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                {(participant as any).leftAt && (
                  <Badge variant="secondary" className="text-xs text-muted-foreground">
                    Left
                  </Badge>
                )}
              </div>
            ))}
          </div>

          {/* Dialog Actions */}
          <div className="flex justify-between gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleLeaveConversation}
              className="text-destructive hover:text-destructive"
            >
              Leave Conversation
            </Button>
            <Button
              onClick={handleShowAddParticipant}
            >
              Add Members
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Participant Dialog */}
      <AddParticipantDialog
        open={showAddParticipant}
        onOpenChange={setShowAddParticipant}
        conversationId={conversationId}
        existingParticipants={conversation?.participants || []}
        onParticipantAdded={handleParticipantAdded}
      />

    </>
  );
}