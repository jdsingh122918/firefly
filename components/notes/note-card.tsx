"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import {
  Calendar,
  Eye,
  Pin,
  Tag,
  ArrowRight,
  Archive,
  Users,
  Lock,
  Globe,
  Share
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatTimeAgo, getAuthorDisplay, truncateText } from "@/components/shared/format-utils"
import { getNoteTypeConfig } from "./note-type-selector"
import { InlineAttachmentIndicator } from "./file-attachment-preview"
import { NoteType, NoteVisibility } from "@/lib/types"

interface Note {
  id: string
  title: string
  content: string
  type: NoteType
  visibility: NoteVisibility
  isPinned: boolean
  isArchived: boolean
  tags: string[]
  attachments: string[]
  viewCount: number
  createdAt: string
  updatedAt: string
  creator: {
    id: string
    name: string
    firstName?: string
    lastName?: string
    imageUrl?: string
  }
  sharedWith?: string[]
  lastEditedBy?: string
  lastEditedAt?: string
}

interface NoteCardProps {
  note: Note
  onNoteClick?: (note: Note) => void
  showContent?: boolean
  className?: string
}

const noteVisibilityConfig = {
  PRIVATE: {
    icon: Lock,
    label: "Private",
    color: "text-gray-600",
    bgColor: "bg-gray-100"
  },
  FAMILY: {
    icon: Users,
    label: "Family",
    color: "text-blue-600",
    bgColor: "bg-blue-100"
  },
  SHARED: {
    icon: Share,
    label: "Shared",
    color: "text-green-600",
    bgColor: "bg-green-100"
  },
  PUBLIC: {
    icon: Globe,
    label: "Public",
    color: "text-purple-600",
    bgColor: "bg-purple-100"
  }
}

export function NoteCard({
  note,
  onNoteClick,
  showContent = true,
  className
}: NoteCardProps) {
  const router = useRouter()
  const { sessionClaims } = useAuth()

  const handleClick = () => {
    if (onNoteClick) {
      onNoteClick(note)
    } else {
      // Get user role for dynamic routing
      const userRole = (sessionClaims?.metadata as { role?: string })?.role || 'member'
      const rolePrefix = userRole.toLowerCase()
      // For MVP, we'll edit the note in a dialog (same as create)
      // Future: navigate to `/notes/${note.id}` for detail view
      router.push(`/${rolePrefix}/notes`)
    }
  }

  const typeConfig = getNoteTypeConfig(note.type)
  const TypeIcon = typeConfig?.icon || Pin
  const visibilityConfig = noteVisibilityConfig[note.visibility]
  const VisibilityIcon = visibilityConfig.icon
  const { name: authorName, initials } = getAuthorDisplay(note.creator)

  // Determine if note was recently edited
  const isEdited = note.lastEditedAt &&
    new Date(note.lastEditedAt).getTime() > new Date(note.createdAt).getTime()

  const displayDate = isEdited ? note.lastEditedAt! : note.createdAt
  const dateLabel = isEdited ? "edited" : "created"

  return (
    <Card
      className={cn(
        "transition-all duration-200 hover:shadow-md hover:bg-muted/50 cursor-pointer",
        note.isPinned && "border-l-4 border-l-orange-500",
        note.isArchived && "opacity-60",
        className
      )}
      onClick={handleClick}
    >
      <CardContent className="p-4 md:p-6">
        <div className="space-y-3">
          {/* Header with badges */}
          <div className="flex flex-wrap items-center gap-2">
            {note.isPinned && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Pin className="h-3 w-3" />
                Pinned
              </Badge>
            )}
            {note.isArchived && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Archive className="h-3 w-3" />
                Archived
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn(
                "text-xs flex items-center gap-1",
                typeConfig?.color || "text-gray-600"
              )}
            >
              <TypeIcon className="h-3 w-3" />
              {typeConfig?.label || note.type}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "text-xs flex items-center gap-1",
                visibilityConfig.color
              )}
            >
              <VisibilityIcon className="h-3 w-3" />
              {visibilityConfig.label}
            </Badge>
          </div>

          {/* Title */}
          <h3 className="font-semibold text-lg line-clamp-2 hover:text-primary transition-colors">
            {note.title}
          </h3>

          {/* Content preview */}
          {showContent && note.content && (
            <p className="text-muted-foreground text-sm line-clamp-3">
              {truncateText(note.content, 200)}
            </p>
          )}

          {/* Tags */}
          {note.tags && note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {note.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  <Tag className="h-2 w-2 mr-1" />
                  {tag}
                </Badge>
              ))}
              {note.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{note.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-3 md:gap-4 text-sm text-muted-foreground">
            {/* Author */}
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={note.creator.imageUrl} />
                <AvatarFallback className="text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">
                {authorName}
              </span>
            </div>

            {/* Date */}
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>
                {dateLabel} {formatTimeAgo(displayDate)}
              </span>
            </div>

            {/* View count */}
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              <span>{note.viewCount || 0} views</span>
            </div>

            {/* Attachments */}
            <InlineAttachmentIndicator count={note.attachments?.length || 0} />

            {/* Shared count */}
            {note.sharedWith && note.sharedWith.length > 0 && (
              <div className="flex items-center gap-1">
                <Share className="h-3 w-3" />
                <span>{note.sharedWith.length} shared</span>
              </div>
            )}
          </div>

          {/* Edit indicator for recently edited notes */}
          {isEdited && note.lastEditedBy && (
            <div className="pt-2 border-t text-xs text-muted-foreground">
              Last edited {formatTimeAgo(note.lastEditedAt!)}
              {note.lastEditedBy !== note.creator.id && (
                <span> by someone else</span>
              )}
            </div>
          )}
        </div>

        {/* Arrow */}
        <ArrowRight className="absolute top-4 right-4 h-5 w-5 text-muted-foreground hidden sm:block" />
      </CardContent>
    </Card>
  )
}