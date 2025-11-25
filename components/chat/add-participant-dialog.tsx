"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Check, ChevronsUpDown, User, UserPlus, X, Loader2 } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserRole } from "@/lib/types";

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: UserRole;
  imageUrl?: string;
  familyId?: string;
  familyName?: string;
}

interface Participant {
  id: string;
  userId: string;
  user: User;
}

interface AddParticipantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  existingParticipants: Participant[];
  onParticipantAdded: (participant: Participant) => void;
}

function getUserDisplay(user: User): { name: string; initials: string; subtitle?: string } {
  const firstName = user.firstName?.trim() || "";
  const lastName = user.lastName?.trim() || "";
  const name = firstName && lastName
    ? `${firstName} ${lastName}`
    : firstName || lastName || user.email.split('@')[0];

  const initials = firstName && lastName
    ? `${firstName[0]}${lastName[0]}`.toUpperCase()
    : name.substring(0, 2).toUpperCase();

  const subtitle = user.familyName ? `${user.role} • ${user.familyName}` : user.role;

  return { name, initials, subtitle };
}

export function AddParticipantDialog({
  open,
  onOpenChange,
  conversationId,
  existingParticipants,
  onParticipantAdded,
}: AddParticipantDialogProps) {
  const { getToken } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get existing participant IDs for filtering
  const existingParticipantIds = existingParticipants.map(p => p.userId);

  // Debounced search function
  const searchUsers = useCallback(
    async (query: string) => {
      try {
        setLoading(true);
        setError(null);
        const token = await getToken();

        const params = new URLSearchParams();
        if (query.trim()) {
          params.append("query", query.trim());
        }
        params.append("excludeSelf", "true");
        params.append("limit", "20");

        const response = await fetch(`/api/users/chat-accessible?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          // Filter out existing participants
          const availableUsers = (data.users || []).filter(
            (user: User) => !existingParticipantIds.includes(user.id)
          );
          setUsers(availableUsers);
        } else {
          console.error("Failed to fetch users:", response.statusText);
          setError("Failed to load users");
          setUsers([]);
        }
      } catch (error) {
        console.error("Error searching users:", error);
        setError("Failed to search users");
        setUsers([]);
      } finally {
        setLoading(false);
      }
    },
    [getToken, existingParticipantIds]
  );

  // Debounce search queries
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchOpen) {
        searchUsers(searchQuery);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, searchUsers, searchOpen]);

  // Load initial users when search opens
  useEffect(() => {
    if (searchOpen && users.length === 0 && !searchQuery) {
      searchUsers("");
    }
  }, [searchOpen, users.length, searchQuery, searchUsers]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedUsers([]);
      setSearchQuery("");
      setUsers([]);
      setError(null);
    }
  }, [open]);

  const handleSelectUser = (user: User) => {
    if (selectedUsers.find(u => u.id === user.id)) {
      // Remove if already selected
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      // Add to selection
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const removeSelectedUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
  };

  const handleAddParticipants = async () => {
    if (selectedUsers.length === 0) return;

    try {
      setAdding(true);
      setError(null);

      // Add participants one by one
      const addPromises = selectedUsers.map(async (user) => {
        const token = await getToken();
        const response = await fetch(`/api/conversations/${conversationId}/participants`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            canWrite: true,
            canManage: false,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to add ${getUserDisplay(user).name}`);
        }

        const result = await response.json();
        return result.data.participant;
      });

      const addedParticipants = await Promise.all(addPromises);

      // Notify parent component about each added participant
      addedParticipants.forEach(participant => {
        onParticipantAdded(participant);
      });

      // Close dialog on success
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding participants:', error);
      setError(error instanceof Error ? error.message : 'Failed to add participants');
    } finally {
      setAdding(false);
    }
  };

  const filteredUsers = users.filter(user =>
    !selectedUsers.find(selected => selected.id === user.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Members</DialogTitle>
          <DialogDescription>
            Add new members to this conversation
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-hidden">
          {/* User Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Users</label>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={searchOpen}
                  className="justify-between font-normal min-h-[44px]"
                >
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 opacity-50" />
                    <span>Search users to add...</span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[320px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Search users..."
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {loading ? "Searching..." : "No users found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {filteredUsers.map((user) => {
                        const { name, initials, subtitle } = getUserDisplay(user);
                        const isSelected = selectedUsers.find(u => u.id === user.id);
                        return (
                          <CommandItem
                            key={user.id}
                            value={user.id}
                            onSelect={() => handleSelectUser(user)}
                            className="cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={user.imageUrl} />
                                <AvatarFallback className="text-xs">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">
                                  {name}
                                </p>
                                {subtitle && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {subtitle}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CommandItem>
                        );
                      })}
                      {loading && (
                        <CommandItem disabled className="cursor-default">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            <span>Searching users...</span>
                          </div>
                        </CommandItem>
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Selected Members ({selectedUsers.length})
              </label>
              <div className="max-h-32 overflow-y-auto space-y-2 border border-border rounded-md p-2">
                {selectedUsers.map((user) => {
                  const { name, initials } = getUserDisplay(user);
                  return (
                    <div key={user.id} className="flex items-center justify-between p-2 rounded-md bg-accent/50">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={user.imageUrl} />
                          <AvatarFallback className="text-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{name}</p>
                          <Badge variant="secondary" className="text-xs">
                            {user.role}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSelectedUser(user.id)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={adding}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddParticipants}
            disabled={selectedUsers.length === 0 || adding}
          >
            {adding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              `Add ${selectedUsers.length === 1 ? '1 Member' : `${selectedUsers.length} Members`}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}