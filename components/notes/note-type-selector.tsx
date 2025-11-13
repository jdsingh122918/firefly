"use client"

import React from "react"
import { FileText, CheckSquare, Calendar, BookOpen, Heart, Bookmark } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NoteType } from "@/lib/types"

// Note type configuration with icons and descriptions
const NOTE_TYPE_CONFIG = {
  TEXT: {
    label: "Text Note",
    icon: FileText,
    description: "General notes and documentation",
    color: "text-blue-600",
  },
  CHECKLIST: {
    label: "Checklist",
    icon: CheckSquare,
    description: "Task lists and action items",
    color: "text-green-600",
  },
  JOURNAL: {
    label: "Journal Entry",
    icon: BookOpen,
    description: "Personal reflections and thoughts",
    color: "text-indigo-600",
  },
  MEETING: {
    label: "Meeting Notes",
    icon: Calendar,
    description: "Meeting minutes and agendas",
    color: "text-purple-600",
  },
  CARE_PLAN: {
    label: "Care Plan",
    icon: Heart,
    description: "Care planning and medical notes",
    color: "text-red-600",
  },
  RESOURCE: {
    label: "Resource",
    icon: Bookmark,
    description: "Helpful resources and references",
    color: "text-orange-600",
  },
} as const

interface NoteTypeSelectorProps {
  value: NoteType
  onChange: (value: NoteType) => void
  className?: string
  disabled?: boolean
}

export function NoteTypeSelector({
  value,
  onChange,
  className,
  disabled = false
}: NoteTypeSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={`min-h-[44px] ${className || ''}`}>
        <SelectValue placeholder="Select note type" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(NOTE_TYPE_CONFIG).map(([key, config]) => {
          const Icon = config.icon
          return (
            <SelectItem key={key} value={key}>
              <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${config.color}`} />
                <div>
                  <div className="font-medium">{config.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {config.description}
                  </div>
                </div>
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

// Helper function to get type configuration
export function getNoteTypeConfig(type: NoteType) {
  return NOTE_TYPE_CONFIG[type]
}

// Helper function to get type icon
export function getNoteTypeIcon(type: NoteType) {
  return NOTE_TYPE_CONFIG[type]?.icon || FileText
}

// Helper function to get type color
export function getNoteTypeColor(type: NoteType) {
  return NOTE_TYPE_CONFIG[type]?.color || "text-gray-600"
}