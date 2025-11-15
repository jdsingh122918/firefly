"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Check, ChevronsUpDown, StickyNote, FileText } from "lucide-react";
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
import { NoteType } from "@/lib/types";

interface Note {
  id: string;
  title: string;
  content: string;
  type: NoteType;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  creator?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

interface NoteComboboxProps {
  value?: string;
  onValueChange: (value: string | undefined) => void;
  placeholder?: string;
  className?: string;
  excludeArchived?: boolean;
  typeFilter?: NoteType[];
}

function getNoteDisplay(note: Note): { title: string; subtitle?: string; icon: React.ComponentType<any> } {
  const title = note.title.length > 50 ? note.title.substring(0, 50) + "..." : note.title;

  let subtitle = "";
  if (note.creator) {
    const creatorName = note.creator.firstName && note.creator.lastName
      ? `${note.creator.firstName} ${note.creator.lastName}`
      : note.creator.email.split('@')[0];
    subtitle = `${note.type} • ${creatorName}`;
  } else {
    subtitle = note.type;
  }

  const icon = note.type === 'CARE_PLAN' || note.type === 'MEETING' || note.type === 'RESOURCE' ? FileText : StickyNote;

  return { title, subtitle, icon };
}

export function NoteCombobox({
  value,
  onValueChange,
  placeholder = "Search for a note...",
  className,
  excludeArchived = true,
  typeFilter,
}: NoteComboboxProps) {
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  // Debounced search function
  const searchNotes = useCallback(
    async (query: string) => {
      try {
        setLoading(true);
        const token = await getToken();

        const params = new URLSearchParams();
        if (query.trim()) {
          params.append("search", query.trim());
        }
        if (excludeArchived) {
          params.append("isArchived", "false");
        }
        if (typeFilter && typeFilter.length > 0) {
          params.append("type", typeFilter[0]); // API supports single type filter
        }
        params.append("limit", "15");
        params.append("sortBy", "updatedAt");
        params.append("sortOrder", "desc");

        const response = await fetch(`/api/notes?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setNotes(data.notes || []);
        } else {
          console.error("Failed to fetch notes:", response.statusText);
          setNotes([]);
        }
      } catch (error) {
        console.error("Error searching notes:", error);
        setNotes([]);
      } finally {
        setLoading(false);
      }
    },
    [getToken, excludeArchived, typeFilter]
  );

  // Debounce search queries
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchNotes(searchQuery);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, searchNotes]);

  // Load initial notes when component opens
  useEffect(() => {
    if (open && notes.length === 0 && !searchQuery) {
      searchNotes("");
    }
  }, [open, notes.length, searchQuery, searchNotes]);

  // Find and set selected note when value changes
  useEffect(() => {
    if (value && value !== "none") {
      const foundNote = notes.find(n => n.id === value);
      if (foundNote) {
        setSelectedNote(foundNote);
      } else if (value) {
        // Set placeholder while loading
        setSelectedNote({
          id: value,
          title: "Loading...",
          content: "",
          type: NoteType.TEXT,
          isPinned: false,
          isArchived: false,
          createdAt: "",
          updatedAt: "",
        });
      }
    } else {
      setSelectedNote(null);
    }
  }, [value, notes]);

  const handleSelect = (noteId: string) => {
    if (noteId === "none") {
      setSelectedNote(null);
      onValueChange(undefined);
    } else {
      const note = notes.find(n => n.id === noteId);
      if (note) {
        setSelectedNote(note);
        onValueChange(noteId);
      }
    }
    setOpen(false);
  };

  const displayValue = selectedNote
    ? getNoteDisplay(selectedNote).title
    : value === "none" || !value
    ? "No note selected"
    : "Select note...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between font-normal min-h-[44px]",
            !selectedNote && !value && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-2">
            {selectedNote ? (
              <>
                <StickyNote className="h-4 w-4 opacity-75" />
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
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search notes..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Searching..." : "No notes found."}
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
                  <span>No note selected</span>
                </div>
              </CommandItem>
              {notes.map((note) => {
                const { title, subtitle, icon: Icon } = getNoteDisplay(note);
                return (
                  <CommandItem
                    key={note.id}
                    value={note.id}
                    onSelect={() => handleSelect(note.id)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === note.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <Icon className="h-4 w-4 mt-0.5 opacity-75" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {title}
                        </p>
                        {subtitle && (
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-muted-foreground">
                              {subtitle}
                            </p>
                            {note.isPinned && (
                              <Badge variant="secondary" className="text-xs h-4 px-1">
                                Pinned
                              </Badge>
                            )}
                          </div>
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
                    <span>Searching notes...</span>
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