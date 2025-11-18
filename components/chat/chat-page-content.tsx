"use client";

import { useState, useEffect, useCallback } from "react";
import { UserRole } from "@prisma/client";
import { Plus, Search, MessageCircle, Users, Send, MoreVertical } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { ConversationList } from "./conversation-list";
import { NewConversationForm } from "./new-conversation-form";

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

interface ConversationsResponse {
  success?: boolean;
  data?: {
    conversations: Conversation[];
    total: number;
    page: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  conversations?: Conversation[]; // Handle direct array response
}

interface ChatPageContentProps {
  userRole: UserRole;
  userId: string;
}

export function ChatPageContent({ userRole, userId }: ChatPageContentProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("all");
  const [showConversationForm, setShowConversationForm] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit: "50",
        ...(selectedType !== "all" && { type: selectedType }),
        ...(searchQuery && { search: searchQuery }),
      });

      const response = await fetch(`/api/conversations?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch conversations");
      }

      const data: ConversationsResponse = await response.json();
      if (data.success && data.data?.conversations) {
        setConversations(data.data.conversations || []);
      } else if (data.conversations) {
        // Handle direct conversations array response (like notifications API)
        setConversations(data.conversations || []);
      } else {
        // Set empty array if no conversations found
        setConversations([]);
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
      setError("Failed to load conversations");
      // Ensure conversations is always an array, even on error
      setConversations(prev => prev || []);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedType]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const filteredConversations = (conversations || []).filter(conversation => {
    if (activeTab === "family" && !conversation.familyId) {
      return false;
    }
    return true;
  });

  const canCreateConversations = userRole === UserRole.ADMIN || userRole === UserRole.VOLUNTEER || userRole === UserRole.MEMBER;

  return (
    <div className="space-y-4">
      {/* New Conversation Form */}
      {showConversationForm && (
        <NewConversationForm
          userRole={userRole}
          userId={userId}
          context={activeTab as 'family' | 'all' | 'unread' | 'recent'}
          onConversationCreated={() => {
            setShowConversationForm(false);
            fetchConversations();
          }}
          onCancel={() => setShowConversationForm(false)}
        />
      )}

      {/* Header */}
      {!showConversationForm && (
        <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl font-semibold">Chat & Messaging</h1>
            <p className="text-sm text-muted-foreground">
              Connect with your care team and family
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canCreateConversations && !showConversationForm && (
            <Button
              size="sm"
              onClick={() => setShowConversationForm(true)}
              className="min-h-[44px]"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 min-h-[44px]"
          />
        </div>
      </Card>
        </>
      )}

      {/* Tabs - Direct rendering following established codebase pattern */}
      <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="all">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all">All Chats</TabsTrigger>
          <TabsTrigger value="family">
            <Users className="h-3 w-3 mr-1" />
            Family
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-4">
          {/* Conversation List */}
          {loading && conversations.length === 0 && (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="animate-pulse space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-muted rounded-full" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {error && (
            <Card className="p-4">
              <div className="text-center text-muted-foreground">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{error}</p>
                <Button variant="outline" onClick={fetchConversations} className="mt-2">
                  Try Again
                </Button>
              </div>
            </Card>
          )}

          {!loading && !error && filteredConversations.length === 0 && (
            <Card className="p-4">
              <div className="text-center text-muted-foreground">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>
                  {searchQuery ? `No conversations found for "${searchQuery}"` :
                   activeTab === "family" ? "No family conversations" :
                   "No conversations yet"}
                </p>
                {canCreateConversations && !searchQuery && (
                  <Button
                    variant="outline"
                    onClick={() => setShowConversationForm(true)}
                    className="mt-2"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Start First Conversation
                  </Button>
                )}
              </div>
            </Card>
          )}

          {!loading && !error && filteredConversations.length > 0 && (
            <ConversationList
              conversations={filteredConversations}
              userRole={userRole}
              currentUserId={userId}
              onConversationUpdate={fetchConversations}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}