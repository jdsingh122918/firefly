"use client";

import { UserRole } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";

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

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  conversationId: string;
  userRole: UserRole;
}

const getSenderDisplayName = (sender: Message['sender']) => {
  if (sender.firstName) {
    return `${sender.firstName} ${sender.lastName || ''}`.trim();
  }
  return sender.email;
};

const getRoleColor = (role: string) => {
  switch (role) {
    case 'ADMIN':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'VOLUNTEER':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'MEMBER':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatMessageTime = (dateString: string) => {
  const date = new Date(dateString);

  if (isToday(date)) {
    return format(date, 'h:mm a');
  } else if (isYesterday(date)) {
    return `Yesterday ${format(date, 'h:mm a')}`;
  } else {
    return format(date, 'MMM d, h:mm a');
  }
};

const shouldShowSenderInfo = (message: Message, previousMessage?: Message) => {
  if (!previousMessage) return true;

  // Show sender info if it's a different sender
  if (message.senderId !== previousMessage.senderId) return true;

  // Show sender info if there's a significant time gap (>5 minutes)
  const currentTime = new Date(message.createdAt).getTime();
  const previousTime = new Date(previousMessage.createdAt).getTime();
  const timeDiff = currentTime - previousTime;

  return timeDiff > 5 * 60 * 1000; // 5 minutes
};

export function MessageList({
  messages,
  currentUserId,
  conversationId,
  userRole,
}: MessageListProps) {

  if (messages.length === 0) {
    return (
      <ScrollArea className="h-full p-4">
        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
          <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No messages yet</h3>
          <p className="text-sm">Start the conversation by sending the first message!</p>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {messages.map((message, index) => {
          const previousMessage = index > 0 ? messages[index - 1] : undefined;
          const showSenderInfo = shouldShowSenderInfo(message, previousMessage);
          const isOwnMessage = message.senderId === currentUserId;

          if (message.isDeleted) {
            return (
              <div key={message.id} className="flex items-center justify-center">
                <div className="text-sm text-muted-foreground italic bg-muted/50 px-3 py-1 rounded">
                  Message deleted
                </div>
              </div>
            );
          }

          return (
            <div key={message.id} className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
              {/* Avatar - only show when sender info is shown */}
              {showSenderInfo && (
                <div className="flex-shrink-0">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={message.sender.imageUrl} />
                    <AvatarFallback className="text-xs">
                      {getSenderDisplayName(message.sender).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}

              {/* Spacer when not showing avatar */}
              {!showSenderInfo && <div className="w-8 flex-shrink-0" />}

              {/* Message Content */}
              <div className={`flex-1 min-w-0 ${isOwnMessage ? 'text-right' : ''}`}>
                {/* Sender Info */}
                {showSenderInfo && (
                  <div className={`flex items-center gap-2 mb-1 ${isOwnMessage ? 'justify-end' : ''}`}>
                    <span className="text-sm font-medium">
                      {isOwnMessage ? 'You' : getSenderDisplayName(message.sender)}
                    </span>
                    <Badge variant="secondary" className={`text-xs ${getRoleColor(message.sender.role)}`}>
                      {message.sender.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatMessageTime(message.createdAt)}
                    </span>
                  </div>
                )}

                {/* Message Bubble */}
                <div className={`group relative ${isOwnMessage ? 'flex justify-end' : ''}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    isOwnMessage
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 border border-border/50'
                  }`}>
                    {/* Reply Context */}
                    {message.replyTo && (
                      <div className="mb-2 p-2 rounded border-l-2 border-border bg-background/50">
                        <div className="text-xs text-muted-foreground mb-1">
                          Replying to {getSenderDisplayName(message.replyTo.sender)}
                        </div>
                        <div className="text-xs opacity-75 line-clamp-2">
                          {message.replyTo.content}
                        </div>
                      </div>
                    )}

                    {/* Message Content */}
                    <div className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </div>

                    {/* Edited Indicator */}
                    {message.isEdited && (
                      <div className="text-xs mt-1 opacity-75">
                        edited {formatDistanceToNow(new Date(message.editedAt!), { addSuffix: true })}
                      </div>
                    )}

                    {/* Attachments */}
                    {message.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {message.attachments.map((attachment, index) => (
                          <div key={`${message.id}-attachment-${index}`} className="text-xs opacity-75">
                            📎 {attachment}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

                {/* Time stamp for messages without sender info */}
                {!showSenderInfo && (
                  <div className={`text-xs text-muted-foreground mt-1 ${isOwnMessage ? 'text-right' : ''}`}>
                    {formatMessageTime(message.createdAt)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}