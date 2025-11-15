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
  AlertCircle,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  familyId?: string;
  createdAt: string;
  createdByUser: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

interface NoteTag {
  id: string;
  tagId: string;
  addedAt: string;
  addedBy: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  tag: StructuredTag;
}

interface StructuredTagSelectorProps {
  noteId: string;
  currentTags: NoteTag[];
  simpleTags?: string[]; // Existing simple string tags
  onTagsChange?: (structuredTags: NoteTag[], simpleTags: string[]) => void;
  readOnly?: boolean;
  className?: string;
}

export function StructuredTagSelector({
  noteId,
  currentTags,
  simpleTags = [],
  onTagsChange,
  readOnly = false,
  className
}: StructuredTagSelectorProps) {
  const { getToken } = useAuth();

  // UI state
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [removingTagId, setRemovingTagId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [availableTags, setAvailableTags] = useState<StructuredTag[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Simple tag management
  const [simpleTagInput, setSimpleTagInput] = useState("");
  const [localSimpleTags, setLocalSimpleTags] = useState<string[]>(simpleTags);

  // Filter available tags based on search and exclude already selected
  const currentTagIds = currentTags.map(nt => nt.tagId);
  const filteredTags = availableTags.filter(tag => {
    const matchesSearch = searchQuery === "" ||
      tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tag.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tag.category?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const notSelected = !currentTagIds.includes(tag.id);
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

  // Add structured tag to note
  const handleAddStructuredTag = useCallback(async (tagId: string) => {
    setAddingTag(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const response = await fetch(`/api/notes/${noteId}/tags`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tagId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add tag');
      }

      const result = await response.json();
      if (result.structuredTags) {
        onTagsChange?.(result.structuredTags, localSimpleTags);
      }

    } catch (err) {
      console.error('Failed to add structured tag:', err);
      setError(err instanceof Error ? err.message : 'Failed to add tag');
    } finally {
      setAddingTag(false);
    }
  }, [getToken, noteId, onTagsChange, localSimpleTags]);

  // Remove structured tag from note
  const handleRemoveStructuredTag = useCallback(async (noteTagId: string) => {
    setRemovingTagId(noteTagId);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      // Find the tag to remove
      const noteTag = currentTags.find(nt => nt.id === noteTagId);
      if (!noteTag) return;

      const response = await fetch(`/api/notes/${noteId}/tags`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tagId: noteTag.tagId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove tag');
      }

      const result = await response.json();
      if (result.structuredTags) {
        onTagsChange?.(result.structuredTags, localSimpleTags);
      }

    } catch (err) {
      console.error('Failed to remove structured tag:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove tag');
    } finally {
      setRemovingTagId(null);
    }
  }, [getToken, noteId, currentTags, onTagsChange, localSimpleTags]);

  // Add simple tag
  const handleAddSimpleTag = useCallback(() => {
    const tag = simpleTagInput.trim();
    if (tag && !localSimpleTags.includes(tag)) {
      const newSimpleTags = [...localSimpleTags, tag];
      setLocalSimpleTags(newSimpleTags);
      onTagsChange?.(currentTags, newSimpleTags);
      setSimpleTagInput("");
    }
  }, [simpleTagInput, localSimpleTags, currentTags, onTagsChange]);

  // Remove simple tag
  const handleRemoveSimpleTag = useCallback((tagToRemove: string) => {
    const newSimpleTags = localSimpleTags.filter(tag => tag !== tagToRemove);
    setLocalSimpleTags(newSimpleTags);
    onTagsChange?.(currentTags, newSimpleTags);
  }, [localSimpleTags, currentTags, onTagsChange]);

  // Handle simple tag input key press
  const handleSimpleTagKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddSimpleTag();
    }
  }, [handleAddSimpleTag]);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Tags
          {(currentTags.length + localSimpleTags.length) > 0 && (
            <Badge variant="secondary" className="text-xs">
              {currentTags.length + localSimpleTags.length}
            </Badge>
          )}
        </h3>

        {!readOnly && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2"
              >
                <Plus className="h-3 w-3" />
                <span className="sr-only">Add tags</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <Command>
                <CommandInput
                  placeholder="Search tags..."
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
                            handleAddStructuredTag(tag.id);
                            setSearchQuery("");
                          }}
                          className="cursor-pointer"
                          disabled={addingTag}
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

                  {sortedCategories.length > 0 && (
                    <CommandSeparator />
                  )}

                  {/* Simple tag input */}
                  <CommandGroup heading="Quick Tags">
                    <div className="px-2 py-2">
                      <div className="flex gap-1">
                        <Input
                          placeholder="Add simple tag..."
                          value={simpleTagInput}
                          onChange={(e) => setSimpleTagInput(e.target.value)}
                          onKeyDown={handleSimpleTagKeyPress}
                          className="h-8 text-xs"
                        />
                        <Button
                          size="sm"
                          onClick={handleAddSimpleTag}
                          disabled={!simpleTagInput.trim()}
                          className="h-8 px-2"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Error alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Current tags display */}
      {currentTags.length === 0 && localSimpleTags.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-center">
            <Tag className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">No tags</p>
            <p className="text-xs text-muted-foreground mt-1">
              {readOnly
                ? "This note doesn't have any tags."
                : "Add tags to organize and categorize this note."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Structured tags */}
          {currentTags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Structured Tags
              </p>
              <div className="flex flex-wrap gap-1">
                {currentTags.map((noteTag) => (
                  <Badge
                    key={noteTag.id}
                    variant="outline"
                    className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 border-blue-200"
                  >
                    {noteTag.tag.isSystemTag ? (
                      <div className="h-3 w-3 rounded-full bg-blue-500" />
                    ) : (
                      <Hash className="h-3 w-3" />
                    )}
                    {noteTag.tag.name}
                    {noteTag.tag.category?.name && (
                      <span className="text-xs opacity-75">
                        • {noteTag.tag.category.name}
                      </span>
                    )}
                    {noteTag.tag.isSystemTag && (
                      <span className="text-xs opacity-75">• System</span>
                    )}
                    {!readOnly && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveStructuredTag(noteTag.id)}
                        disabled={removingTagId === noteTag.id}
                        className="h-4 w-4 p-0 ml-1 hover:bg-red-100 hover:text-red-600"
                      >
                        {removingTagId === noteTag.id ? (
                          <Loader2 className="h-2 w-2 animate-spin" />
                        ) : (
                          <X className="h-2 w-2" />
                        )}
                        <span className="sr-only">Remove tag</span>
                      </Button>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Simple tags */}
          {localSimpleTags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Simple Tags
              </p>
              <div className="flex flex-wrap gap-1">
                {localSimpleTags.map((tag, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="flex items-center gap-1 px-2 py-1 bg-gray-50 text-gray-700 border-gray-200"
                  >
                    {tag}
                    {!readOnly && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveSimpleTag(tag)}
                        className="h-4 w-4 p-0 ml-1 hover:bg-red-100 hover:text-red-600"
                      >
                        <X className="h-2 w-2" />
                        <span className="sr-only">Remove tag</span>
                      </Button>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Simple tag input (always visible when not readonly) */}
      {!readOnly && (
        <div>
          <div className="flex gap-2">
            <Input
              placeholder="Add tags separated by commas..."
              value={simpleTagInput}
              onChange={(e) => setSimpleTagInput(e.target.value)}
              onKeyDown={handleSimpleTagKeyPress}
              className="h-9 text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddSimpleTag}
              disabled={!simpleTagInput.trim()}
              className="h-9 px-3"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Press Enter or comma to add tags. Use the + button for structured tags.
          </p>
        </div>
      )}
    </div>
  );
}