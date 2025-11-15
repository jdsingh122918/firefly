"use client";

import { useState, useEffect } from "react";
import { UserRole } from "@prisma/client";
import { Plus, Users, MessageSquare, Megaphone, Heart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole: UserRole;
  onConversationCreated: () => void;
}

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  imageUrl?: string;
}

interface Family {
  id: string;
  name: string;
  memberCount?: number;
}

const CONVERSATION_TYPES = [
  {
    value: "DIRECT",
    label: "Direct Message",
    description: "One-on-one conversation",
    icon: MessageSquare,
  },
  {
    value: "FAMILY_CHAT",
    label: "Family Chat",
    description: "Chat with family members",
    icon: Users,
  },
  {
    value: "ANNOUNCEMENT",
    label: "Announcement",
    description: "Broadcast important information",
    icon: Megaphone,
  },
  {
    value: "CARE_UPDATE",
    label: "Care Update",
    description: "Share care coordination updates",
    icon: Heart,
  },
];

export function NewConversationDialog({
  open,
  onOpenChange,
  userRole,
  onConversationCreated,
}: NewConversationDialogProps) {
  const [formData, setFormData] = useState({
    title: "",
    type: "DIRECT" as const,
    familyId: "",
    participantIds: [] as string[],
  });

  const [users, setUsers] = useState<User[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch users and families when dialog opens
  useEffect(() => {
    if (open) {
      fetchUsersAndFamilies();
    }
  }, [open]);

  const fetchUsersAndFamilies = async () => {
    try {
      const [usersResponse, familiesResponse] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/families'),
      ]);

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData.users || []);
      }

      if (familiesResponse.ok) {
        const familiesData = await familiesResponse.json();
        setFamilies(familiesData.families || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleParticipantToggle = (userId: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        participantIds: [...prev.participantIds, userId]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        participantIds: prev.participantIds.filter(id => id !== userId)
      }));
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate required fields
      if (!formData.type) {
        setError("Conversation type is required");
        return;
      }

      if (formData.participantIds.length === 0) {
        setError("At least one participant is required");
        return;
      }

      const payload = {
        title: formData.title || undefined,
        type: formData.type,
        familyId: formData.familyId || undefined,
        participantIds: formData.participantIds,
      };

      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create conversation');
      }

      // Reset form and close dialog
      setFormData({
        title: "",
        type: "DIRECT",
        familyId: "",
        participantIds: [],
      });
      setSearchQuery("");
      onOpenChange(false);
      onConversationCreated();
    } catch (error) {
      console.error('Error creating conversation:', error);
      setError(error instanceof Error ? error.message : 'Failed to create conversation');
    } finally {
      setLoading(false);
    }
  };

  const selectedType = CONVERSATION_TYPES.find(type => type.value === formData.type);
  const filteredUsers = users.filter(user =>
    !searchQuery ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getUserDisplayName = (user: User) => {
    if (user.firstName) {
      return `${user.firstName} ${user.lastName || ''}`.trim();
    }
    return user.email;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start New Conversation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}

          {/* Conversation Type */}
          <div className="space-y-2">
            <Label>Conversation Type</Label>
            <Select value={formData.type} onValueChange={(value: any) => handleInputChange('type', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONVERSATION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title (optional) */}
          <div className="space-y-2">
            <Label>Title (optional)</Label>
            <Input
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder={selectedType ? `${selectedType.label} title` : "Conversation title"}
              className="min-h-[44px]"
            />
          </div>

          {/* Family Selection (for family chats) */}
          {(formData.type as string) === "FAMILY_CHAT" && families.length > 0 && (
            <div className="space-y-2">
              <Label>Family</Label>
              <Select value={formData.familyId} onValueChange={(value) => handleInputChange('familyId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select family" />
                </SelectTrigger>
                <SelectContent>
                  {families.map((family) => (
                    <SelectItem key={family.id} value={family.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{family.name}</span>
                        {family.memberCount && (
                          <Badge variant="outline" className="ml-2">
                            {family.memberCount} members
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Participants */}
          <div className="space-y-2">
            <Label>Participants</Label>

            {/* Search */}
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="min-h-[44px]"
            />

            {/* Selected Participants */}
            {formData.participantIds.length > 0 && (
              <div className="flex flex-wrap gap-1 p-2 border rounded-md">
                {formData.participantIds.map(userId => {
                  const user = users.find(u => u.id === userId);
                  if (!user) return null;
                  return (
                    <Badge key={userId} variant="secondary">
                      {getUserDisplayName(user)}
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* User List */}
            <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2">
              {filteredUsers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No users found
                </p>
              )}
              {filteredUsers.map((user) => (
                <div key={user.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded-sm">
                  <Checkbox
                    checked={formData.participantIds.includes(user.id)}
                    onCheckedChange={(checked) => handleParticipantToggle(user.id, !!checked)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {getUserDisplayName(user)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user.role} • {user.email}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || formData.participantIds.length === 0}
              className="min-h-[44px]"
            >
              {loading ? "Creating..." : "Create Conversation"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}