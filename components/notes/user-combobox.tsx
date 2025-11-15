"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Check, ChevronsUpDown, User, UserCheck } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

interface UserComboboxProps {
  value?: string;
  onValueChange: (value: string | undefined) => void;
  placeholder?: string;
  className?: string;
  familyFilter?: boolean; // VOLUNTEER users only see family members
  excludeCurrentUser?: boolean;
  roleFilter?: UserRole[]; // Filter by specific roles
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

export function UserCombobox({
  value,
  onValueChange,
  placeholder = "Select user...",
  className,
  familyFilter = false,
  excludeCurrentUser = true,
  roleFilter,
}: UserComboboxProps) {
  const { userId: currentUserId, getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Debounced search function
  const searchUsers = useCallback(
    async (query: string) => {
      try {
        setLoading(true);
        const token = await getToken();

        const params = new URLSearchParams();
        if (query.trim()) {
          params.append("query", query.trim());
        }
        if (familyFilter) {
          params.append("familyOnly", "true");
        }
        if (excludeCurrentUser) {
          params.append("excludeSelf", "true");
        }
        if (roleFilter && roleFilter.length > 0) {
          params.append("roles", roleFilter.join(","));
        }
        params.append("limit", "15");

        const response = await fetch(`/api/users/search?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUsers(data.users || []);
        } else {
          console.error("Failed to fetch users:", response.statusText);
          setUsers([]);
        }
      } catch (error) {
        console.error("Error searching users:", error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    },
    [getToken, familyFilter, excludeCurrentUser, roleFilter]
  );

  // Debounce search queries
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, searchUsers]);

  // Load initial users when component opens
  useEffect(() => {
    if (open && users.length === 0 && !searchQuery) {
      searchUsers("");
    }
  }, [open, users.length, searchQuery, searchUsers]);

  // Find and set selected user when value changes
  useEffect(() => {
    if (value && value !== "none") {
      const foundUser = users.find(u => u.id === value);
      if (foundUser) {
        setSelectedUser(foundUser);
      } else {
        // Set placeholder while loading
        setSelectedUser({
          id: value,
          firstName: "Loading...",
          email: "",
          role: UserRole.MEMBER
        });
      }
    } else {
      setSelectedUser(null);
    }
  }, [value, users]);

  const handleSelect = (userId: string) => {
    if (userId === "none") {
      setSelectedUser(null);
      onValueChange(undefined);
    } else {
      const user = users.find(u => u.id === userId);
      if (user) {
        setSelectedUser(user);
        onValueChange(userId);
      }
    }
    setOpen(false);
  };

  const displayValue = selectedUser
    ? getUserDisplay(selectedUser).name
    : value === "none" || !value
    ? "No user selected"
    : "Select user...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between font-normal min-h-[44px]",
            !selectedUser && !value && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-2">
            {selectedUser ? (
              <>
                <Avatar className="h-5 w-5">
                  <AvatarImage src={selectedUser.imageUrl} />
                  <AvatarFallback className="text-xs">
                    {getUserDisplay(selectedUser).initials}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{displayValue}</span>
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4 opacity-50" />
                <span className="truncate">{displayValue}</span>
              </>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
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
              <CommandItem
                value="none"
                onSelect={() => handleSelect("none")}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    (!value || value === "none") ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 opacity-50" />
                  <span>No user selected</span>
                </div>
              </CommandItem>
              {users.map((user) => {
                const { name, initials, subtitle } = getUserDisplay(user);
                return (
                  <CommandItem
                    key={user.id}
                    value={user.id}
                    onSelect={() => handleSelect(user.id)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === user.id ? "opacity-100" : "opacity-0"
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
  );
}