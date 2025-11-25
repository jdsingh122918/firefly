"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Check, ChevronsUpDown, Users } from "lucide-react";

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

interface Family {
  id: string;
  name: string;
}

interface FamilyComboboxProps {
  value?: string;
  onValueChange: (value: string | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function FamilyCombobox({
  value,
  onValueChange,
  placeholder = "Search families...",
  className,
}: FamilyComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);

  // Debounced search function
  const searchFamilies = useCallback(
    async (query: string) => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (query.trim()) {
          params.append("query", query.trim());
        }
        params.append("limit", "10");

        const response = await fetch(`/api/families/search?${params.toString()}`);
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

  // Find and set selected family when value changes
  useEffect(() => {
    if (value && value !== "none") {
      // Find family in current families list
      const foundFamily = families.find(f => f.id === value);
      if (foundFamily) {
        setSelectedFamily(foundFamily);
      } else {
        // If not found in current list, fetch it specifically
        // For now, just set a placeholder
        setSelectedFamily({ id: value, name: "Loading..." });
      }
    } else {
      setSelectedFamily(null);
    }
  }, [value, families]);

  const handleSelect = (familyId: string) => {
    if (familyId === "none") {
      setSelectedFamily(null);
      onValueChange(undefined);
    } else {
      const family = families.find(f => f.id === familyId);
      if (family) {
        setSelectedFamily(family);
        onValueChange(familyId);
      }
    }
    setOpen(false);
  };

  const displayValue = selectedFamily
    ? selectedFamily.name
    : value === "none" || !value
    ? "No family assigned"
    : "Select family...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between font-normal min-h-[44px]",
            !selectedFamily && !value && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 opacity-50" />
            <span className="truncate">{displayValue}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[300px] p-0" align="start">
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
                  <Users className="h-4 w-4 opacity-50" />
                  <span>No family assigned</span>
                </div>
              </CommandItem>
              {families.map((family) => (
                <CommandItem
                  key={family.id}
                  value={family.id}
                  onSelect={() => handleSelect(family.id)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === family.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 opacity-50" />
                    <span className="truncate">{family.name}</span>
                  </div>
                </CommandItem>
              ))}
              {loading && (
                <CommandItem disabled className="cursor-default">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>Searching families...</span>
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