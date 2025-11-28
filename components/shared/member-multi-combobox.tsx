"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Check, ChevronsUpDown, User, X, Users } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { AssignableMember } from "@/lib/types";

interface MemberMultiComboboxProps {
  resourceId: string;
  value?: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  maxSelections?: number;
  showSelectedCount?: boolean;
  disabled?: boolean;
}

export function MemberMultiCombobox({
  resourceId,
  value = [],
  onValueChange,
  placeholder = "Search members...",
  className,
  maxSelections,
  showSelectedCount = true,
  disabled = false,
}: MemberMultiComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<AssignableMember[]>([]);

  // Debounced search function
  const searchMembers = useCallback(
    async (query: string) => {
      if (!resourceId) return;

      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.append("resourceId", resourceId);
        if (query.trim()) {
          params.append("query", query.trim());
        }

        const response = await fetch(
          `/api/template-assignments/assignable-members?${params.toString()}`
        );
        if (response.ok) {
          const data = await response.json();
          setMembers(data.members || []);
        } else {
          console.error("Failed to fetch members:", response.statusText);
          setMembers([]);
        }
      } catch (error) {
        console.error("Error searching members:", error);
        setMembers([]);
      } finally {
        setLoading(false);
      }
    },
    [resourceId]
  );

  // Debounce search queries
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchMembers(searchQuery);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, searchMembers]);

  // Load initial members when component opens
  useEffect(() => {
    if (open && members.length === 0 && !searchQuery) {
      searchMembers("");
    }
  }, [open, members.length, searchQuery, searchMembers]);

  // Update selected members when value changes
  useEffect(() => {
    const selected = members.filter((member) => value.includes(member.id));
    setSelectedMembers(selected);

    // If we have selected IDs but no corresponding members loaded yet,
    // show placeholder names
    const missingMembers = value.filter(
      (id) => !members.some((m) => m.id === id)
    );
    if (missingMembers.length > 0) {
      const placeholders = missingMembers.map((id) => ({
        id,
        firstName: "Loading",
        lastName: "...",
        email: "",
        familyId: null,
        alreadyAssigned: false,
      }));
      setSelectedMembers((prev) => [...selected, ...placeholders]);
    }
  }, [value, members]);

  const handleSelect = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    // Don't allow selecting already assigned members
    if (member.alreadyAssigned) return;

    const isSelected = value.includes(memberId);
    let newValue: string[];

    if (isSelected) {
      // Remove member from selection
      newValue = value.filter((id) => id !== memberId);
    } else {
      // Add member to selection (check max limit)
      if (maxSelections && value.length >= maxSelections) {
        return; // Don't add if at max limit
      }
      newValue = [...value, memberId];
    }

    onValueChange(newValue);
  };

  const handleRemoveMember = (memberId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const newValue = value.filter((id) => id !== memberId);
    onValueChange(newValue);
  };

  const clearAll = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onValueChange([]);
  };

  const getMemberDisplayName = (member: AssignableMember) => {
    const name = `${member.firstName || ""} ${member.lastName || ""}`.trim();
    return name || member.email;
  };

  const getDisplayText = () => {
    if (value.length === 0) {
      return "No members selected";
    }

    if (showSelectedCount) {
      return `${value.length} ${value.length === 1 ? "member" : "members"} selected`;
    }

    if (value.length === 1 && selectedMembers.length > 0) {
      return getMemberDisplayName(selectedMembers[0]);
    }

    return `${value.length} members selected`;
  };

  const isAtMaxLimit = maxSelections && value.length >= maxSelections;

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "justify-between font-normal min-h-[44px] w-full hover:bg-accent/5",
              value.length === 0 && "text-muted-foreground",
              className
            )}
          >
            <div className="flex items-center gap-2 flex-1 text-left">
              <Users className="h-4 w-4 opacity-50 flex-shrink-0" />
              <span className="truncate text-sm">{getDisplayText()}</span>
            </div>
            <div className="flex items-center gap-2 ml-2">
              {value.length > 0 && (
                <span
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  className="h-6 w-6 p-0 flex items-center justify-center hover:bg-destructive/10 hover:text-destructive rounded-full transition-colors cursor-pointer"
                  onClick={clearAll}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      clearAll(e as unknown as React.MouseEvent);
                    }
                  }}
                  aria-label="Clear all selections"
                  aria-disabled={disabled}
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command className="rounded-lg border-none">
            <CommandInput
              placeholder={placeholder}
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="h-9"
            />
            <CommandList className="max-h-[280px]">
              <CommandEmpty className="py-4 text-sm text-muted-foreground">
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>Searching...</span>
                  </div>
                ) : (
                  "No members found."
                )}
              </CommandEmpty>
              <CommandGroup className="p-2">
                {members.map((member) => {
                  const isSelected = value.includes(member.id);
                  const canSelect =
                    !member.alreadyAssigned &&
                    (!isAtMaxLimit || isSelected);
                  const displayName = getMemberDisplayName(member);

                  return (
                    <CommandItem
                      key={member.id}
                      value={member.id}
                      onSelect={() => canSelect && handleSelect(member.id)}
                      className={cn(
                        "cursor-pointer rounded-md px-2 py-2 mb-0.5",
                        "transition-colors duration-150",
                        isSelected && "bg-accent/50",
                        member.alreadyAssigned && "opacity-50 cursor-not-allowed",
                        !canSelect && !isSelected && "opacity-50 cursor-not-allowed"
                      )}
                      disabled={member.alreadyAssigned || (!canSelect && !isSelected)}
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border transition-colors",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/30"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                        <span className="truncate text-sm font-medium">
                          {displayName}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {member.email}
                          {member.familyName && ` • ${member.familyName}`}
                        </span>
                      </div>
                      {member.alreadyAssigned && (
                        <Badge
                          variant="outline"
                          className="ml-2 text-[10px] h-5 px-1.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                        >
                          Assigned
                        </Badge>
                      )}
                    </CommandItem>
                  );
                })}
                {loading && members.length === 0 && (
                  <CommandItem disabled className="cursor-default justify-center py-2">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>Loading members...</span>
                    </div>
                  </CommandItem>
                )}
              </CommandGroup>
              {isAtMaxLimit && (
                <div className="border-t px-3 py-2 text-center text-xs text-muted-foreground bg-muted/30">
                  Maximum {maxSelections} members can be selected
                </div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected members display - compact chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedMembers.map((member) => (
            <div
              key={member.id}
              className="group inline-flex items-center gap-1.5 rounded-md border bg-secondary/30 px-2.5 py-1 text-xs transition-colors hover:bg-secondary/50"
            >
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="truncate max-w-[140px] font-medium">
                {getMemberDisplayName(member)}
              </span>
              {!disabled && (
                <button
                  onClick={(e) => handleRemoveMember(member.id, e)}
                  className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full hover:bg-destructive/90 hover:text-destructive-foreground transition-all opacity-70 group-hover:opacity-100"
                  aria-label={`Remove ${getMemberDisplayName(member)}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
