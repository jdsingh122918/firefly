"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Check, ChevronsUpDown, FileText, Link, Video, Headphones, Image, Wrench, Users, Building2, File } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { ResourceType } from "@prisma/client";

interface Resource {
  id: string;
  title: string;
  description?: string;
  body?: string;
  resourceType: ResourceType;
  url?: string;
  isVerified: boolean;
  status?: string;
  rating?: number;
  ratingCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  creator?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  submitter?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

interface ResourceComboboxProps {
  value?: string;
  onValueChange: (value: string | undefined) => void;
  placeholder?: string;
  className?: string;
  typeFilter?: ResourceType[];
  sourceFilter?: ("system" | "user" | "public")[];
}

function getResourceIcon(resourceType: ResourceType): React.ComponentType<any> {
  switch (resourceType) {
    case 'DOCUMENT': return FileText;
    case 'LINK': return Link;
    case 'VIDEO': return Video;
    case 'AUDIO': return Headphones;
    case 'IMAGE': return Image;
    case 'TOOL': return Wrench;
    case 'CONTACT': return Users;
    case 'SERVICE': return Building2;
    default: return File;
  }
}

function getResourceDisplay(resource: Resource): {
  title: string;
  subtitle: string;
  icon: React.ComponentType<any>;
  sourceType: "system" | "user" | "public";
} {
  const title = resource.title.length > 50 ? resource.title.substring(0, 50) + "..." : resource.title;

  // Determine source type
  let sourceType: "system" | "user" | "public" = "user";
  if (resource.status === 'FEATURED' || resource.isVerified) {
    sourceType = "public";
  } else if (resource.creator?.email?.includes('@system') || resource.creator?.email?.includes('@admin')) {
    sourceType = "system";
  }

  // Build subtitle with resource type and source info
  const creatorName = resource.creator
    ? (resource.creator.firstName && resource.creator.lastName
        ? `${resource.creator.firstName} ${resource.creator.lastName}`
        : resource.creator.email.split('@')[0])
    : "Unknown";

  const sourceLabel = sourceType === "public" ? "Public" :
                     sourceType === "system" ? "System" :
                     `by ${creatorName}`;

  let subtitle = `${resource.resourceType} • ${sourceLabel}`;

  if (resource.rating && resource.ratingCount > 0) {
    const rating = `⭐ ${resource.rating.toFixed(1)} (${resource.ratingCount})`;
    subtitle += ` • ${rating}`;
  }

  const icon = getResourceIcon(resource.resourceType);

  return { title, subtitle, icon, sourceType };
}

export function ResourceCombobox({
  value,
  onValueChange,
  placeholder = "Search for a resource...",
  className,
  typeFilter,
  sourceFilter,
}: ResourceComboboxProps) {
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  // Debounced search function
  const searchResources = useCallback(
    async (query: string) => {
      try {
        setLoading(true);
        const token = await getToken();

        const params = new URLSearchParams();
        // No type filter needed - all items are resources

        if (query.trim()) {
          params.append("search", query.trim());
        }

        if (typeFilter && typeFilter.length > 0) {
          params.append("resourceType", typeFilter.join(","));
        }

        // Add source filtering if specified
        if (sourceFilter && sourceFilter.length > 0) {
          if (sourceFilter.includes("public")) {
            params.append("featured", "true");
          }
          // Note: More complex source filtering may require additional API parameters
        }

        params.append("limit", "15");
        params.append("sortBy", "updatedAt");
        params.append("sortOrder", "desc");
        params.append("includeCreator", "true");

        const response = await fetch(`/api/resources?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const resourceData = data.resources || [];
          setResources(resourceData);
        } else {
          console.error("Failed to fetch resources:", response.statusText);
          setResources([]);
        }
      } catch (error) {
        console.error("Error searching resources:", error);
        setResources([]);
      } finally {
        setLoading(false);
      }
    },
    [getToken, typeFilter, sourceFilter]
  );

  // Debounce search queries
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchResources(searchQuery);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, searchResources]);

  // Load initial resources when component opens
  useEffect(() => {
    if (open && resources.length === 0 && !searchQuery) {
      searchResources("");
    }
  }, [open, resources.length, searchQuery, searchResources]);

  // Find and set selected resource when value changes
  useEffect(() => {
    if (value && value !== "none") {
      const foundResource = resources.find(r => r.id === value);
      if (foundResource) {
        setSelectedResource(foundResource);
      } else if (value) {
        // Set placeholder while loading
        setSelectedResource({
          id: value,
          title: "Loading...",
          resourceType: ResourceType.DOCUMENT,
          isVerified: false,
          ratingCount: 0,
          viewCount: 0,
          createdAt: "",
          updatedAt: "",
        });
      }
    } else {
      setSelectedResource(null);
    }
  }, [value, resources]);

  const handleSelect = (resourceId: string) => {
    if (resourceId === "none") {
      setSelectedResource(null);
      onValueChange(undefined);
    } else {
      const resource = resources.find(r => r.id === resourceId);
      if (resource) {
        setSelectedResource(resource);
        onValueChange(resourceId);
      }
    }
    setOpen(false);
  };

  const displayValue = selectedResource
    ? getResourceDisplay(selectedResource).title
    : value === "none" || !value
    ? "No resource selected"
    : "Select resource...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between font-normal min-h-[44px]",
            !selectedResource && !value && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-2">
            {selectedResource ? (
              <>
                {React.createElement(getResourceIcon(selectedResource.resourceType), {
                  className: "h-4 w-4 opacity-75"
                })}
                <span className="truncate">{displayValue}</span>
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 opacity-50" />
                <span className="truncate">{displayValue}</span>
              </>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search resources..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Searching..." : "No resources found."}
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
                  <FileText className="h-4 w-4 opacity-50" />
                  <span>No resource selected</span>
                </div>
              </CommandItem>
              {resources.map((resource) => {
                const { title, subtitle, icon: Icon, sourceType } = getResourceDisplay(resource);
                return (
                  <CommandItem
                    key={resource.id}
                    value={resource.id}
                    onSelect={() => handleSelect(resource.id)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === resource.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <Icon className="h-4 w-4 mt-0.5 opacity-75" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-muted-foreground truncate">
                            {subtitle}
                          </p>
                          {resource.isVerified && (
                            <Badge variant="secondary" className="text-xs h-4 px-1">
                              Verified
                            </Badge>
                          )}
                          {sourceType === "public" && (
                            <Badge variant="outline" className="text-xs h-4 px-1">
                              Public
                            </Badge>
                          )}
                          {sourceType === "system" && (
                            <Badge variant="default" className="text-xs h-4 px-1">
                              System
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
              {loading && (
                <CommandItem disabled className="cursor-default">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>Searching resources...</span>
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