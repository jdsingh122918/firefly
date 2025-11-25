"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Check, ChevronsUpDown, Users, X } from "lucide-react";

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

interface Family {
  id: string;
  name: string;
}

interface FamilyMultiComboboxProps {
  value?: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  maxSelections?: number;
  showSelectedCount?: boolean;
  disabled?: boolean;
}

export function FamilyMultiCombobox({
  value = [],
  onValueChange,
  placeholder = "Search families...",
  className,
  maxSelections,
  showSelectedCount = true,
  disabled = false,
}: FamilyMultiComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFamilies, setSelectedFamilies] = useState<Family[]>([]);

  // Debounced search function
  const searchFamilies = useCallback(
    async (query: string) => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (query.trim()) {
          params.append("search", query.trim());
        }

        const response = await fetch(`/api/families?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setFamilies(data.families || []);
        } else {
          console.error("Failed to fetch families:", response.statusText);
          setFamilies([]);
        }
      } catch (error) {
        console.error("Error searching families:", error);
        setFamilies([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Debounce search queries
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchFamilies(searchQuery);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, searchFamilies]);

  // Load initial families when component opens
  useEffect(() => {
    if (open && families.length === 0 && !searchQuery) {
      searchFamilies("");
    }
  }, [open, families.length, searchQuery, searchFamilies]);

  // Update selected families when value changes
  useEffect(() => {
    const selected = families.filter(family => value.includes(family.id));
    setSelectedFamilies(selected);

    // If we have selected IDs but no corresponding families loaded yet,
    // we might need to fetch them or show placeholder names
    const missingFamilies = value.filter(id => !families.some(f => f.id === id));
    if (missingFamilies.length > 0) {
      const placeholders = missingFamilies.map(id => ({ id, name: "Loading..." }));
      setSelectedFamilies(prev => [...selected, ...placeholders]);
    }
  }, [value, families]);

  const handleSelect = (familyId: string) => {
    const isSelected = value.includes(familyId);
    let newValue: string[];

    if (isSelected) {
      // Remove family from selection
      newValue = value.filter(id => id !== familyId);
    } else {
      // Add family to selection (check max limit)
      if (maxSelections && value.length >= maxSelections) {
        return; // Don't add if at max limit
      }
      newValue = [...value, familyId];
    }

    onValueChange(newValue);
  };

  const handleRemoveFamily = (familyId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const newValue = value.filter(id => id !== familyId);
    onValueChange(newValue);
  };

  const clearAll = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onValueChange([]);
  };

  const getDisplayText = () => {
    if (value.length === 0) {
      return "No families assigned";
    }

    if (showSelectedCount) {
      return `${value.length} ${value.length === 1 ? 'family' : 'families'} selected`;
    }

    if (value.length === 1 && selectedFamilies.length > 0) {
      return selectedFamilies[0].name;
    }

    return `${value.length} families selected`;
  };

  const isAtMaxLimit = maxSelections && value.length >= maxSelections;

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "justify-between font-normal min-h-[44px]",
              value.length === 0 && "text-muted-foreground",
              className
            )}
          >
            <div className="flex items-center gap-2 flex-1 text-left">
              <Users className="h-4 w-4 opacity-50 flex-shrink-0" />
              <span className="truncate">{getDisplayText()}</span>
            </div>
            <div className="flex items-center gap-1 ml-2">
              {value.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 hover:bg-destructive hover:text-destructive-foreground rounded-full"
                  onClick={clearAll}
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search families..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>
                {loading ? "Searching..." : "No families found."}
              </CommandEmpty>
              <CommandGroup>
                {families.map((family) => {
                  const isSelected = value.includes(family.id);
                  const canSelect = !isSelected && (!isAtMaxLimit || isSelected);

                  return (
                    <CommandItem
                      key={family.id}
                      value={family.id}
                      onSelect={() => canSelect && handleSelect(family.id)}
                      className={cn(
                        "cursor-pointer",
                        !canSelect && !isSelected && "opacity-50 cursor-not-allowed"
                      )}
                      disabled={!canSelect && !isSelected}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <Users className="h-4 w-4 opacity-50" />
                        <span className="truncate">{family.name}</span>
                      </div>
                      {isSelected && (
                        <Badge variant="secondary" className="ml-2">
                          Selected
                        </Badge>
                      )}
                    </CommandItem>
                  );
                })}
                {loading && (
                  <CommandItem disabled className="cursor-default">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>Searching families...</span>
                    </div>
                  </CommandItem>
                )}
                {isAtMaxLimit && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Maximum {maxSelections} families can be selected
                  </div>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected families display */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedFamilies.map((family) => (
            <Badge
              key={family.id}
              variant="secondary"
              className="flex items-center gap-1"
            >
              <Users className="h-3 w-3" />
              <span className="truncate max-w-[150px]">{family.name}</span>
              {!disabled && (
                <button
                  onClick={(e) => handleRemoveFamily(family.id, e)}
                  className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5 transition-colors"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}