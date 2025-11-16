"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  const [sending, setSending] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        const updatedMessages = [...prev, newMessage];
        return deduplicateMessages(updatedMessages);
      });
    },
    onMessageUpdated: (updatedMessage) => {
      setMessages(prev => {
        const updatedMessages = prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg);
        return deduplicateMessages(updatedMessages);
      });
    },
    onMessageDeleted: (messageId) => {
      setMessages(prev => {
        const updatedMessages = prev.map(msg =>
          msg.id === messageId
            ? { ...msg, isDeleted: true, content: "[This message was deleted]" }
            : msg
        );
        return deduplicateMessages(updatedMessages);
      });
    },
    onConnectionChange: (connected) => {
      // Connection status change handled by component state
    },
  });

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
        const initialMessages = messagesData.data.items || [];
        if (DEBUG_MESSAGES) console.log("📨 Initial messages loaded:", initialMessages.length);
        setMessages(deduplicateMessages(initialMessages));
      } else if (messagesData.messages) {
        // Fallback for other response formats
        const initialMessages = messagesData.messages || [];
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
    if (!messageInput.trim() || sending) return;

    const content = messageInput.trim();

    // Clear typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    sendTypingIndicator(false);

    try {
      setSending(true);
      setMessageInput(""); // Clear input immediately for better UX

      // Create optimistic message for immediate UI feedback
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        content,
        conversationId,
        senderId: userId,
        isEdited: false,
        isDeleted: false,
        attachments: [],
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
      setMessages(prev => deduplicateMessages([...prev, optimisticMessage]));

      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Ensure cookies are sent
        body: JSON.stringify({
          content,
          attachments: [],
        }),
      });

      if (!response.ok) {
        // Remove optimistic message on error
        setMessages(prev => deduplicateMessages(prev.filter(msg => msg.id !== optimisticMessage.id)));

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
        return deduplicateMessages(updatedMessages);
      });

    } catch (error) {
      console.error('Error sending message:', error);
      // Restore message input on error
      setMessageInput(content);
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
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Header */}
      <Card className="flex-shrink-0 p-3">
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href={`/${userRole.toLowerCase()}/chat`}>
                <Button variant="ghost" size="sm" className="min-h-[44px]">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="font-semibold">{getDisplayTitle()}</h1>
                <p className="text-sm text-muted-foreground">
                  {conversation.participants.length} participants
                  {!isConnected && " • Disconnected"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                onClick={handleShowParticipants}
              >
                <Users className="h-4 w-4 mr-2" />
                Participants
              </Button>

              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="min-h-[44px]">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
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
              )}
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-orange-500" />
                  <span className="text-sm text-orange-500">Connecting...</span>
                </>
              )}
            </div>

            {/* Typing Indicators */}
            {typingUsers.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {typingUsers.length === 1
                  ? `${typingUsers[0].userName} is typing...`
                  : typingUsers.length === 2
                  ? `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing...`
                  : `${typingUsers[0].userName} and ${typingUsers.length - 1} others are typing...`
                }
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Messages Area */}
      <div className="flex-1 min-h-0">
        <MessageList
          messages={messages}
          currentUserId={userId}
          conversationId={conversationId}
          userRole={userRole}
        />
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      {canWrite ? (
        <Card className="flex-shrink-0 p-3">
          <div className="flex items-center gap-2">
            <Input
              value={messageInput}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 min-h-[44px]"
              disabled={sending}
            />
            <Button
              size="sm"
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || sending}
              className="min-h-[44px]"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="flex-shrink-0 p-3">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">You don't have permission to send messages in this conversation.</p>
          </div>
        </Card>
      )}

      {/* Participants Dialog */}
      <Dialog open={showParticipants} onOpenChange={setShowParticipants}>
        <DialogContent className="max-w-md">
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
                {participant.leftAt && (
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
        <DialogContent className="max-w-md">
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
    </div>
  );
}