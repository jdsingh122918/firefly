"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface ResourceFiltersProps {
  selectedCategory: string;
  selectedType: string;
  selectedContentFilter: string;
  sortBy: string;
  sortOrder: string;
  onChange: (filters: Record<string, any>) => void;
}

const RESOURCE_TYPES = [
  { value: "DOCUMENT", label: "Documents" },
  { value: "LINK", label: "Links" },
  { value: "VIDEO", label: "Videos" },
  { value: "AUDIO", label: "Audio" },
  { value: "IMAGE", label: "Images" },
  { value: "TOOL", label: "Tools" },
  { value: "CONTACT", label: "Contacts" },
  { value: "SERVICE", label: "Services" },
];

const CONTENT_FILTERS = [
  { value: "all", label: "All Content" },
  { value: "templates", label: "Advance Directive Templates" },
  { value: "resources", label: "Regular Resources" },
];

const SORT_OPTIONS = [
  { value: "createdAt-desc", label: "Newest First" },
  { value: "createdAt-asc", label: "Oldest First" },
  { value: "title-asc", label: "Title A-Z" },
  { value: "title-desc", label: "Title Z-A" },
  { value: "averageRating-desc", label: "Highest Rated" },
  { value: "totalViews-desc", label: "Most Viewed" },
];

export function ResourceFilters({
  selectedCategory,
  selectedType,
  selectedContentFilter,
  sortBy,
  sortOrder,
  onChange,
}: ResourceFiltersProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories || []);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = {
      category: selectedCategory,
      type: selectedType,
      contentFilter: selectedContentFilter,
      sortBy,
      sortOrder,
      [key]: value,
    };

    // Handle sort option special format
    if (key === 'sort') {
      const [newSortBy, newSortOrder] = value.split('-');
      newFilters.sortBy = newSortBy;
      newFilters.sortOrder = newSortOrder;
    }

    onChange(newFilters);
  };

  const clearFilters = () => {
    onChange({
      category: "all",
      contentFilter: "all",
      type: "all",
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  };

  const hasActiveFilters =
    selectedCategory !== "all" ||
    selectedType !== "all" ||
    selectedContentFilter !== "all" ||
    sortBy !== "createdAt" ||
    sortOrder !== "desc";

  return (
    <Card className="p-3">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">Filters</h3>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Content Filter */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Content
            </label>
            <Select
              value={selectedContentFilter}
              onValueChange={(value) => handleFilterChange("contentFilter", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Content" />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_FILTERS.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category Filter */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Category
            </label>
            <Select
              value={selectedCategory}
              onValueChange={(value) => handleFilterChange("category", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {!loading && categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type Filter */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Type
            </label>
            <Select
              value={selectedType}
              onValueChange={(value) => handleFilterChange("type", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {RESOURCE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort Filter */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Sort By
            </label>
            <Select
              value={`${sortBy}-${sortOrder}`}
              onValueChange={(value) => handleFilterChange("sort", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Active:</span>
            {selectedCategory !== "all" && (
              <Badge variant="secondary" className="text-xs">
                Category: {categories.find(c => c.id === selectedCategory)?.name || selectedCategory}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                  onClick={() => handleFilterChange("category", "all")}
                >
                  <X className="h-2 w-2" />
                </Button>
              </Badge>
            )}
            {selectedType !== "all" && (
              <Badge variant="secondary" className="text-xs">
                Type: {RESOURCE_TYPES.find(t => t.value === selectedType)?.label || selectedType}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                  onClick={() => handleFilterChange("type", "all")}
                >
                  <X className="h-2 w-2" />
                </Button>
              </Badge>
            )}
            {(sortBy !== "createdAt" || sortOrder !== "desc") && (
              <Badge variant="secondary" className="text-xs">
                Sort: {SORT_OPTIONS.find(s => s.value === `${sortBy}-${sortOrder}`)?.label}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                  onClick={() => handleFilterChange("sort", "createdAt-desc")}
                >
                  <X className="h-2 w-2" />
                </Button>
              </Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}