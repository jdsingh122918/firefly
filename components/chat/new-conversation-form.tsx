"use client";

import { useState, useEffect } from "react";
import { UserRole } from "@prisma/client";
import { Plus, Users, MessageSquare, Megaphone, Heart, X, Send, ArrowLeft } from "lucide-react";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

interface NewConversationFormProps {
  userRole: UserRole;
  userId: string;
  onConversationCreated: () => void;
  onCancel: () => void;
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
];

export function NewConversationForm({
  userRole,
  userId,
  onConversationCreated,
  onCancel,
}: NewConversationFormProps) {
  const [formData, setFormData] = useState({
    title: "",
    type: "DIRECT",
    familyId: "",
    participantIds: [] as string[],
  });

  const [users, setUsers] = useState<User[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'type' | 'details' | 'participants'>('type');

  // Fetch users and families when component mounts
  useEffect(() => {
    fetchUsersAndFamilies();
  }, []);

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

      // For Direct Messages, ensure exactly 2 participants (current user + 1 selected)
      let finalParticipantIds = formData.participantIds;
      if (formData.type === "DIRECT") {
        if (formData.participantIds.length !== 1) {
          setError("Direct conversations require exactly 1 other participant");
          return;
        }
        // Include current user + selected participant
        finalParticipantIds = [userId, ...formData.participantIds];

        console.log("💬 Direct Message Debug - Form submission:", {
          originalParticipants: formData.participantIds,
          currentUserId: userId,
          finalParticipants: finalParticipantIds,
          participantCount: finalParticipantIds.length
        });
      }

      const payload = {
        title: formData.title || undefined,
        type: formData.type,
        familyId: formData.familyId || undefined,
        participantIds: finalParticipantIds,
      };

      console.log("💬 Conversation Creation Debug - Payload:", {
        type: formData.type,
        participantCount: finalParticipantIds.length,
        payload
      });

      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log("💬 API Response Debug:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("💬 Conversation Creation Error:", {
          status: response.status,
          error: errorData
        });
        throw new Error(errorData.error || 'Failed to create conversation');
      }

      const result = await response.json();
      console.log("💬 Conversation Created Successfully:", {
        conversationId: result.data?.id,
        participants: result.data?.participants?.length,
        result
      });

      // Reset form
      setFormData({
        title: "",
        type: "DIRECT",
        familyId: "",
        participantIds: [],
      });
      setSearchQuery("");
      setStep('type');
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

  const canProceed = () => {
    if (step === 'type') return !!formData.type;
    if (step === 'details') {
      if (formData.type === 'FAMILY_CHAT') {
        return !!formData.familyId;
      }
      return true;
    }
    if (step === 'participants') {
      if (formData.type === 'DIRECT') {
        return formData.participantIds.length === 1; // Exactly 1 other participant for Direct Messages
      }
      return formData.participantIds.length > 0;
    }
    return false;
  };

  const getNextStep = () => {
    if (step === 'type') return 'details';
    if (step === 'details') return 'participants';
    return 'participants';
  };

  const handleNext = () => {
    if (step === 'participants') {
      handleSubmit();
    } else {
      setStep(getNextStep());
    }
  };

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step !== 'type' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(step === 'details' ? 'type' : 'details')}
                className="p-1 h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h2 className="text-lg font-semibold">Start New Conversation</h2>
              <p className="text-sm text-muted-foreground">
                {step === 'type' && "Choose conversation type"}
                {step === 'details' && "Add conversation details"}
                {step === 'participants' && "Select participants"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel} className="p-1 h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress indicator */}
        <div className="flex gap-1 pt-2">
          {['type', 'details', 'participants'].map((stepName, index) => (
            <div
              key={stepName}
              className={`flex-1 h-1 rounded-full transition-colors ${
                stepName === step ? 'bg-primary' :
                ['type', 'details', 'participants'].indexOf(step) > index ? 'bg-primary/50' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="text-sm text-destructive p-3 bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {/* Step 1: Conversation Type */}
        {step === 'type' && (
          <div className="space-y-3">
            <Label>Choose conversation type</Label>
            <div className="grid gap-3">
              {CONVERSATION_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <Card
                    key={type.value}
                    className={`cursor-pointer transition-all hover:bg-muted/50 ${
                      formData.type === type.value ? 'ring-2 ring-primary bg-primary/5' : ''
                    }`}
                    onClick={() => handleInputChange('type', type.value)}
                  >
                    <CardContent className="flex items-center gap-3 p-3">
                      <Icon className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 'details' && (
          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label>Conversation title (optional)</Label>
              <Input
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder={selectedType ? `${selectedType.label} title` : "Enter title..."}
                className="min-h-[44px]"
              />
            </div>

            {/* Family Selection (for family chats) */}
            {formData.type === "FAMILY_CHAT" && families.length > 0 && (
              <div className="space-y-2">
                <Label>Select family <span className="text-destructive">*</span></Label>
                <Select value={formData.familyId} onValueChange={(value) => handleInputChange('familyId', value)}>
                  <SelectTrigger className="min-h-[44px]">
                    <SelectValue placeholder="Choose family..." />
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
          </div>
        )}

        {/* Step 3: Participants */}
        {step === 'participants' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Add participants <span className="text-destructive">*</span></Label>

              {/* Help text for Direct Messages */}
              {formData.type === 'DIRECT' && (
                <p className="text-sm text-muted-foreground">
                  Select exactly 1 person to start a direct conversation with.
                </p>
              )}

              {/* Search */}
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users by name or email..."
                className="min-h-[44px]"
              />

              {/* Selected Participants */}
              {formData.participantIds.length > 0 && (
                <div className="p-3 border rounded-md bg-muted/30">
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    {formData.type === 'DIRECT'
                      ? `Selected (${formData.participantIds.length} of 1)`
                      : `Selected (${formData.participantIds.length})`
                    }
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {formData.participantIds.map(userId => {
                      const user = users.find(u => u.id === userId);
                      if (!user) return null;
                      return (
                        <Badge key={userId} variant="secondary" className="text-xs">
                          {getUserDisplayName(user)}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* User List */}
              <div className="max-h-64 overflow-y-auto space-y-1 border rounded-md">
                {filteredUsers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No users found
                  </p>
                )}
                {filteredUsers.map((user) => (
                  <div key={user.id} className="flex items-center space-x-2 p-3 hover:bg-muted/30 transition-colors">
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
          </div>
        )}

        {/* Actions */}
        <Separator />
        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onCancel} className="min-h-[44px]">
            Cancel
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canProceed() || loading}
            className="min-h-[44px]"
          >
            {loading ? "Creating..." :
             step === 'participants' ? (
              <>
                <Send className="h-4 w-4 mr-2" />
                Create Conversation
              </>
             ) : (
              <>
                Continue
                <Plus className="h-4 w-4 ml-2" />
              </>
             )
            }
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}