"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Tag,
  Plus,
  X,
  Search,
  Hash,
  Loader2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface StructuredTag {
  id: string;
  name: string;
  description?: string;
  color?: string;
  category?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
  usageCount: number;
  isActive: boolean;
  isSystemTag: boolean;
}

interface ForumTagSelectorProps {
  value: string[]; // Array of tag names (string tags)
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function ForumTagSelector({
  value = [],
  onChange,
  placeholder = "Add tags...",
  className,
  disabled = false
}: ForumTagSelectorProps) {
  const { getToken } = useAuth();

  // UI state
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [availableTags, setAvailableTags] = useState<StructuredTag[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Simple tag management
  const [simpleTagInput, setSimpleTagInput] = useState("");

  // Filter available tags based on search and exclude already selected
  const filteredTags = availableTags.filter(tag => {
    const matchesSearch = searchQuery === "" ||
      tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tag.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tag.category?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const notSelected = !value.includes(tag.name);
    const isActive = tag.isActive;

    return matchesSearch && notSelected && isActive;
  });

  // Group tags by category and system/family
  const groupedTags = filteredTags.reduce((groups, tag) => {
    let categoryName = "Uncategorized";

    if (tag.category?.name) {
      categoryName = tag.category.name;
    }

    // Add system indicator for system tags
    if (tag.isSystemTag && categoryName !== "Uncategorized") {
      categoryName = `🏥 ${categoryName}`;
    }

    if (!groups[categoryName]) {
      groups[categoryName] = [];
    }
    groups[categoryName].push(tag);
    return groups;
  }, {} as Record<string, StructuredTag[]>);

  // Sort categories: System tags first, then family/user tags
  const sortedCategories = Object.entries(groupedTags).sort(([a], [b]) => {
    const aIsSystem = a.startsWith("🏥");
    const bIsSystem = b.startsWith("🏥");

    if (aIsSystem && !bIsSystem) return -1;
    if (!aIsSystem && bIsSystem) return 1;
    return a.localeCompare(b);
  });

  // Fetch available tags
  const fetchTags = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const response = await fetch('/api/tags?active=true&limit=100', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch tags: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      setAvailableTags(Array.isArray(data.tags) ? data.tags : []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tags';
      setError(errorMessage);
      console.error('Failed to fetch tags:', err);
      setAvailableTags([]);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  // Load tags when component opens
  useEffect(() => {
    if (open && availableTags.length === 0) {
      fetchTags();
    }
  }, [open, availableTags.length, fetchTags]);

  // Add structured tag
  const handleAddStructuredTag = useCallback((tagName: string) => {
    if (!value.includes(tagName)) {
      onChange([...value, tagName]);
    }
    setSearchQuery("");
  }, [value, onChange]);

  // Add simple tag
  const handleAddSimpleTag = useCallback(() => {
    const tag = simpleTagInput.trim();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
      setSimpleTagInput("");
    }
  }, [simpleTagInput, value, onChange]);

  // Remove tag
  const handleRemoveTag = useCallback((tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  }, [value, onChange]);

  // Handle simple tag input key press
  const handleSimpleTagKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddSimpleTag();
    }
  }, [handleAddSimpleTag]);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Selected tags display */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((tag, index) => (
            <Badge
              key={index}
              variant="outline"
              className="flex items-center gap-1 px-2 py-1 text-sm"
            >
              <Hash className="h-3 w-3" />
              {tag}
              {!disabled && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemoveTag(tag)}
                  className="h-4 w-4 p-0 ml-1 hover:bg-red-100 hover:text-red-600"
                >
                  <X className="h-2 w-2" />
                  <span className="sr-only">Remove tag</span>
                </Button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Tag input with structured tag selector */}
      {!disabled && (
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder={placeholder}
              value={simpleTagInput}
              onChange={(e) => setSimpleTagInput(e.target.value)}
              onKeyDown={handleSimpleTagKeyPress}
              className="text-sm"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddSimpleTag}
            disabled={!simpleTagInput.trim()}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="px-2"
              >
                <Tag className="h-3 w-3 mr-1" />
                Browse
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <Command>
                <CommandInput
                  placeholder="Search system tags..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                />
                <CommandList className="max-h-60">
                  <CommandEmpty>
                    {loading ? "Loading tags..." : "No tags found."}
                  </CommandEmpty>

                  {sortedCategories.map(([category, tags]) => (
                    <CommandGroup key={category} heading={category}>
                      {tags.map((tag) => (
                        <CommandItem
                          key={tag.id}
                          value={tag.id}
                          onSelect={() => {
                            handleAddStructuredTag(tag.name);
                            setOpen(false);
                          }}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2 flex-1">
                            {tag.isSystemTag ? (
                              <div className="h-3 w-3 rounded-full bg-blue-500 opacity-75" />
                            ) : (
                              <Hash className="h-3 w-3 opacity-50" />
                            )}
                            <span className={cn(
                              "font-medium",
                              tag.isSystemTag && "text-blue-700"
                            )}>
                              {tag.name}
                            </span>
                            <div className="flex items-center gap-1 ml-auto">
                              {tag.isSystemTag && (
                                <Badge variant="outline" className="text-xs px-1 bg-blue-50 text-blue-600 border-blue-200">
                                  System
                                </Badge>
                              )}
                              {tag.usageCount > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {tag.usageCount}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Helper text */}
      {!disabled && (
        <p className="text-xs text-muted-foreground">
          Type tags and press Enter or comma to add. Use "Browse" to select from healthcare system tags.
        </p>
      )}

      {/* Error alert */}
      {error && (
        <Alert variant="destructive" className="text-sm">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}