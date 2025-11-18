"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { UserRole } from "@prisma/client";
import { useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  Send,
  MoreVertical,
  Users,
  Settings,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDistanceToNow } from "date-fns";
import { MessageList } from "./message-list";
import { useChatRealtime } from "@/hooks/use-chat-realtime";
import { useMessageReactions } from "@/components/chat/message-reactions";
import { MessageMetadata } from "@/lib/types/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
      role: string;
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
    role: string;
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
  const [showSettings, setShowSettings] = useState(false);
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

  // API functions for reactions
  const handleAddReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to add reaction:', errorData.error);
        return;
      }

      // Optimistically update local state (real-time will also update via SSE)
      const userName = 'You'; // Simple fallback since this is the current user's action

      addReaction(messageId, emoji, userId, userName);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  }, [conversationId, userId, addReaction]);

  const handleRemoveReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to remove reaction:', errorData.error);
        return;
      }

      // Optimistically update local state (real-time will also update via SSE)
      const userName = 'You'; // Simple fallback since this is the current user's action

      removeReaction(messageId, emoji, userId, userName);
    } catch (error) {
      console.error('Error removing reaction:', error);
    }
  }, [conversationId, userId, removeReaction]);

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

  // Memoize messages with reactions to prevent infinite render loops
  const messagesWithReactions = useMemo(() => {
    return messages.map(msg => ({
      ...msg,
      metadata: {
        ...msg.metadata,
        reactions: getMessageReactions(msg.id)
      }
    }));
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

  // Handle dropdown menu actions
  const handleShowParticipants = () => {
    setShowParticipants(true);
  };

  const handleShowSettings = () => {
    setShowSettings(true);
  };

  const handleArchiveConversation = async () => {
    if (!confirm('Are you sure you want to archive this conversation? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/conversations/${conversationId}/archive`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to archive conversation');
      }

      // Navigate back to chat list
      window.location.href = `/${userRole.toLowerCase()}/chat`;
    } catch (error) {
      console.error('Error archiving conversation:', error);
      alert('Failed to archive conversation. Please try again.');
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
      <div className="flex flex-1 gap-1 min-h-0">
        {/* Main Chat Area */}
        <div className="flex flex-col flex-1 min-w-0">
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

          {/* Messages Area */}
          <div className="flex-1 min-h-0">
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

          {/* Message Input */}
          {canWrite ? (
            <div className="flex-shrink-0">
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
            <Card className="flex-shrink-0 p-3">
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

            {/* Actions */}
            {canManage && (
              <Card className="flex-shrink-0 border-0 border-t rounded-none">
                <CardContent className="p-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <Settings className="h-4 w-4 mr-2" />
                        Manage Conversation
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={handleShowSettings}>
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleShowParticipants}>
                        <Users className="h-4 w-4 mr-2" />
                        Manage Participants
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleArchiveConversation} className="text-destructive">
                        Archive Conversation
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            )}
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
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Participants ({conversation?.participants.length})</DialogTitle>
            <DialogDescription>
              Members of this conversation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {conversation?.participants.map((participant) => (
              <div key={participant.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
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
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conversation Settings</DialogTitle>
            <DialogDescription>
              Configure this conversation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <p className="text-sm text-muted-foreground">
                {conversation?.title || getDisplayTitle()}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Badge variant="outline">
                {conversation?.type?.replace('_', ' ') || 'DIRECT'}
              </Badge>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Created</label>
              <p className="text-sm text-muted-foreground">
                {conversation?.createdAt ? formatDistanceToNow(new Date(conversation.createdAt), { addSuffix: true }) : 'Unknown'}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Badge variant={conversation?.isActive ? "default" : "secondary"}>
                {conversation?.isActive ? "Active" : "Archived"}
              </Badge>
            </div>
            {conversation?.family && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Family</label>
                <p className="text-sm text-muted-foreground">
                  {conversation.family.name}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}