"use client";

import { UserRole } from "@prisma/client";
import { MessageCircle, Users, Archive, Bell } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

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
  participantCount: number;
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    sender: {
      id: string;
      firstName?: string;
      lastName?: string;
      email: string;
      imageUrl?: string;
    };
    createdAt: string;
  };
  unreadCount: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  userRole: UserRole;
  currentUserId: string;
  onConversationUpdate: () => void;
}

const getConversationTypeIcon = (type: string) => {
  switch (type) {
    case 'FAMILY_CHAT':
      return Users;
    case 'ANNOUNCEMENT':
      return MessageCircle;
    case 'CARE_UPDATE':
      return MessageCircle;
    default:
      return MessageCircle;
  }
};

const getConversationTypeBadge = (type: string) => {
  switch (type) {
    case 'FAMILY_CHAT':
      return { label: 'Family', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    case 'ANNOUNCEMENT':
      return { label: 'Announcement', color: 'bg-purple-100 text-purple-800 border-purple-200' };
    case 'CARE_UPDATE':
      return { label: 'Care Update', color: 'bg-green-100 text-green-800 border-green-200' };
    case 'DIRECT':
      return { label: 'Direct', color: 'bg-gray-100 text-gray-800 border-gray-200' };
    default:
      return { label: type, color: 'bg-gray-100 text-gray-800 border-gray-200' };
  }
};

const getDisplayTitle = (conversation: Conversation) => {
  if (conversation.title) return conversation.title;

  // Generate title based on type and context
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

const getSenderName = (sender: NonNullable<Conversation['lastMessage']>['sender']) => {
  if (sender.firstName) {
    return `${sender.firstName} ${sender.lastName || ''}`.trim();
  }
  return sender.email;
};

export function ConversationList({
  conversations,
  userRole,
  currentUserId,
  onConversationUpdate,
}: ConversationListProps) {
  const [archivingConversation, setArchivingConversation] = useState<string | null>(null);

  const handleArchiveConversation = async (conversationId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!confirm('Are you sure you want to archive this conversation? This action cannot be undone.')) {
      return;
    }

    setArchivingConversation(conversationId);

    try {
      const response = await fetch(`/api/conversations/${conversationId}?action=delete`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to archive conversation');
      }

      // Refresh the conversation list
      onConversationUpdate();
    } catch (error) {
      console.error('Error archiving conversation:', error);
      alert(error instanceof Error ? error.message : 'Failed to archive conversation');
    } finally {
      setArchivingConversation(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {conversations.map((conversation) => {
        const TypeIcon = getConversationTypeIcon(conversation.type);
        const typeBadge = getConversationTypeBadge(conversation.type);
        const displayTitle = getDisplayTitle(conversation);
        const isUnread = conversation.unreadCount > 0;

        return (
          <Card
            key={conversation.id}
            className={`relative overflow-hidden hover:shadow-md transition-shadow ${isUnread ? 'border-primary/20 bg-primary/5' : ''}`}
          >
            <CardContent className="space-y-2 p-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <TypeIcon className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm line-clamp-1">
                      {displayTitle}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isUnread && (
                    <Bell className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>

              {/* Type and Family badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className={typeBadge.color}>
                  {typeBadge.label}
                </Badge>
                {conversation.family && (
                  <Badge variant="outline" className="text-xs">
                    {conversation.family.name}
                  </Badge>
                )}
                <div className="flex items-center gap-2">
                  <Link href={`/${userRole.toLowerCase()}/chat/${conversation.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs"
                    >
                      <MessageCircle className="h-3 w-3 mr-1" />
                      Open Chat
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleArchiveConversation(conversation.id, e)}
                    disabled={archivingConversation === conversation.id}
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <Archive className="h-3 w-3 mr-1" />
                    {archivingConversation === conversation.id ? 'Archiving...' : 'Archive'}
                  </Button>
                </div>
              </div>

              {/* Last Message */}
              {conversation.lastMessage && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={conversation.lastMessage.sender.imageUrl} />
                      <AvatarFallback className="text-xs">
                        {getSenderName(conversation.lastMessage.sender).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-muted-foreground truncate">
                      {getSenderName(conversation.lastMessage.sender)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDistanceToNow(new Date(conversation.lastMessage.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1 pl-7">
                    {conversation.lastMessage.content}
                  </p>
                </div>
              )}

            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}