"use client";

import { UserRole } from "@prisma/client";
import { MoreVertical, Archive, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

interface Participant {
  userId: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
  };
}

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
  participants?: Participant[];
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

const getConversationTypeBadge = (type: string) => {
  switch (type) {
    case 'FAMILY_CHAT':
      return { label: 'Family', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' };
    case 'ANNOUNCEMENT':
      return { label: 'Announce', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' };
    case 'CARE_UPDATE':
      return { label: 'Care', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
    case 'DIRECT':
      return { label: 'Direct', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400' };
    default:
      return { label: type, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400' };
  }
};

const getParticipantName = (participant: Participant) => {
  if (participant.user.firstName) {
    return `${participant.user.firstName} ${participant.user.lastName || ''}`.trim();
  }
  return participant.user.email.split('@')[0];
};

const getParticipantInitials = (participant: Participant) => {
  if (participant.user.firstName) {
    const first = participant.user.firstName.charAt(0);
    const last = participant.user.lastName?.charAt(0) || '';
    return `${first}${last}`.toUpperCase();
  }
  return participant.user.email.charAt(0).toUpperCase();
};

const getDisplayTitle = (conversation: Conversation, currentUserId: string) => {
  // For direct messages, show the other person's name
  if (conversation.type === 'DIRECT' && conversation.participants) {
    const otherParticipants = conversation.participants.filter(
      p => p.userId !== currentUserId
    );
    if (otherParticipants.length > 0) {
      return otherParticipants.map(p => getParticipantName(p)).join(', ');
    }
  }

  if (conversation.title) return conversation.title;

  switch (conversation.type) {
    case 'FAMILY_CHAT':
      return conversation.family?.name ? `${conversation.family.name} Chat` : 'Family Chat';
    case 'ANNOUNCEMENT':
      return 'Announcements';
    case 'CARE_UPDATE':
      return 'Care Updates';
    default:
      return `Chat`;
  }
};

const getParticipantNames = (conversation: Conversation, currentUserId: string) => {
  if (!conversation.participants || conversation.participants.length === 0) {
    return '';
  }

  // Filter out current user and get names
  const otherParticipants = conversation.participants.filter(
    p => p.userId !== currentUserId
  );

  if (otherParticipants.length === 0) {
    return 'Just you';
  }

  const names = otherParticipants.slice(0, 3).map(p => getParticipantName(p));
  const remaining = otherParticipants.length - 3;

  if (remaining > 0) {
    return `${names.join(', ')} +${remaining}`;
  }

  return names.join(', ');
};

export function ConversationList({
  conversations,
  userRole,
  currentUserId,
  onConversationUpdate,
}: ConversationListProps) {
  const [archivingConversation, setArchivingConversation] = useState<string | null>(null);

  const handleArchiveConversation = async (conversationId: string) => {
    if (!confirm('Are you sure you want to archive this conversation?')) {
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

      onConversationUpdate();
    } catch (error) {
      console.error('Error archiving conversation:', error);
      alert(error instanceof Error ? error.message : 'Failed to archive conversation');
    } finally {
      setArchivingConversation(null);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {conversations.map((conversation) => {
        const typeBadge = getConversationTypeBadge(conversation.type);
        const displayTitle = getDisplayTitle(conversation, currentUserId);
        const participantNames = getParticipantNames(conversation, currentUserId);
        const isUnread = conversation.unreadCount > 0;
        const chatUrl = `/${userRole.toLowerCase()}/chat/${conversation.id}`;

        // Get participants for avatar stack (excluding current user)
        const otherParticipants = (conversation.participants || []).filter(
          p => p.userId !== currentUserId
        );

        return (
          <Link
            key={conversation.id}
            href={chatUrl}
            className="block group"
          >
            <div
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-accent min-h-[64px] ${
                isUnread ? 'bg-primary/5 border-primary/20' : 'border-transparent hover:border-border'
              }`}
            >
              {/* Unread indicator */}
              <div className="w-2 shrink-0">
                {isUnread && (
                  <div className="w-2 h-2 rounded-full bg-destructive" />
                )}
              </div>

              {/* Avatar stack */}
              <div className="flex -space-x-2 shrink-0">
                {otherParticipants.length > 0 ? (
                  <>
                    {otherParticipants.slice(0, 3).map((participant, idx) => (
                      <Avatar
                        key={participant.userId}
                        className="h-8 w-8 border-2 border-background"
                        style={{ zIndex: 3 - idx }}
                      >
                        <AvatarFallback className="text-xs bg-muted">
                          {getParticipantInitials(participant)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {otherParticipants.length > 3 && (
                      <div
                        className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium"
                        style={{ zIndex: 0 }}
                      >
                        +{otherParticipants.length - 3}
                      </div>
                    )}
                  </>
                ) : (
                  <Avatar className="h-8 w-8 border-2 border-background">
                    <AvatarFallback className="text-xs bg-muted">
                      <Users className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-medium truncate ${isUnread ? 'text-foreground' : 'text-foreground'}`}>
                    {displayTitle}
                  </span>
                  <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 shrink-0 ${typeBadge.color}`}>
                    {typeBadge.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">
                    {conversation.lastMessage
                      ? formatDistanceToNow(new Date(conversation.lastMessage.createdAt), { addSuffix: false })
                      : formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: false })}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {participantNames && conversation.type !== 'DIRECT' && (
                    <span className="text-xs text-muted-foreground truncate">
                      {participantNames}
                    </span>
                  )}
                  {conversation.lastMessage && (
                    <p className="text-sm text-muted-foreground truncate flex-1">
                      {conversation.type === 'DIRECT' ? '' : '· '}
                      {conversation.lastMessage.content}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.preventDefault()}
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">More options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      handleArchiveConversation(conversation.id);
                    }}
                    disabled={archivingConversation === conversation.id}
                    className="text-destructive focus:text-destructive"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    {archivingConversation === conversation.id ? 'Archiving...' : 'Archive'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
