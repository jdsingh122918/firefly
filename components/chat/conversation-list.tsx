"use client";

import { UserRole } from "@prisma/client";
import { MessageCircle, Users, Clock, MoreVertical, Pin } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  const handleMarkAsRead = async (conversationId: string) => {
    try {
      // TODO: Implement mark as read API
      console.log("Mark as read:", conversationId);
      onConversationUpdate();
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const handleArchive = async (conversationId: string) => {
    try {
      // TODO: Implement archive API
      console.log("Archive conversation:", conversationId);
      onConversationUpdate();
    } catch (error) {
      console.error("Failed to archive conversation:", error);
    }
  };

  return (
    <div className="space-y-3">
      {conversations.map((conversation) => {
        const TypeIcon = getConversationTypeIcon(conversation.type);
        const typeBadge = getConversationTypeBadge(conversation.type);
        const displayTitle = getDisplayTitle(conversation);
        const isUnread = conversation.unreadCount > 0;
        const canManage = userRole === UserRole.ADMIN;

        return (
          <Card
            key={conversation.id}
            className={`p-3 hover:shadow-md transition-shadow ${isUnread ? 'border-primary/20 bg-primary/5' : ''}`}
          >
            <CardContent className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <TypeIcon className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/${userRole.toLowerCase()}/chat/${conversation.id}`}
                      className="font-medium text-sm hover:text-primary transition-colors line-clamp-1"
                    >
                      {displayTitle}
                    </Link>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isUnread && (
                    <Badge variant="destructive" className="h-5 w-5 p-0 text-xs">
                      {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                    </Badge>
                  )}

                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {isUnread && (
                          <DropdownMenuItem onClick={() => handleMarkAsRead(conversation.id)}>
                            Mark as Read
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild>
                          <Link href={`/${userRole.toLowerCase()}/chat/${conversation.id}`}>
                            View Conversation
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleArchive(conversation.id)}
                          className="text-destructive"
                        >
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{conversation.participantCount} participants</span>
                </div>
              </div>

              {/* Last Message */}
              {conversation.lastMessage && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={conversation.lastMessage.sender.imageUrl} />
                      <AvatarFallback className="text-xs">
                        {getSenderName(conversation.lastMessage.sender).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-muted-foreground">
                      {getSenderName(conversation.lastMessage.sender)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conversation.lastMessage.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 pl-8">
                    {conversation.lastMessage.content}
                  </p>
                </div>
              )}

              {/* No Messages State */}
              {!conversation.lastMessage && (
                <div className="text-center py-2">
                  <p className="text-xs text-muted-foreground">No messages yet</p>
                  <p className="text-xs text-muted-foreground">
                    Created {formatDistanceToNow(new Date(conversation.createdAt), { addSuffix: true })}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    Updated {formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}
                  </span>
                </div>

                <Link href={`/${userRole.toLowerCase()}/chat/${conversation.id}`}>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                    Open Chat
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}