"use client"

import React from "react"
import {
  getPostTypeConfig,
  getPostTypesSortedByPriority,
  PostType
} from "@/lib/forum/post-types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface EnhancedPostTypeSelectorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function EnhancedPostTypeSelector({
  value,
  onChange,
  placeholder = "Select post type",
  disabled = false,
  className
}: EnhancedPostTypeSelectorProps) {
  // Custom SelectValue component that shows icon + label
  const CustomSelectValue = () => {
    if (!value) {
      return <span className="text-muted-foreground">{placeholder}</span>
    }

    const config = getPostTypeConfig(value)
    const Icon = config.icon

    return (
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", config.colors.iconColor)} />
        <span className="font-medium">{config.label}</span>
        {config.prominence === "high" && (
          <div className="px-1.5 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded">
            Priority
          </div>
        )}
      </div>
    )
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn("w-full", className)}>
        <CustomSelectValue />
      </SelectTrigger>
      <SelectContent>
        {getPostTypesSortedByPriority().map(([type, config]) => {
          const Icon = config.icon
          return (
            <SelectItem
              key={type}
              value={type}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-3 w-full">
                <Icon className={cn("h-4 w-4 shrink-0", config.colors.iconColor)} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{config.label}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {config.description}
                  </div>
                </div>
                {config.prominence === "high" && (
                  <div className="px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded shrink-0">
                    Priority
                  </div>
                )}
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

// Enhanced Post Type Display Badge for read-only contexts
interface PostTypeDisplayProps {
  type: string
  size?: "sm" | "md" | "lg"
  showDescription?: boolean
  className?: string
}

export function PostTypeDisplay({
  type,
  size = "md",
  showDescription = false,
  className
}: PostTypeDisplayProps) {
  const config = getPostTypeConfig(type)
  const Icon = config.icon

  const sizeClasses = {
    sm: "text-xs gap-1",
    md: "text-sm gap-2",
    lg: "text-base gap-2"
  }

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5"
  }

  return (
    <div className={cn(
      "inline-flex items-center font-medium",
      sizeClasses[size],
      config.colors.text,
      className
    )}>
      <Icon className={cn("shrink-0", iconSizes[size], config.colors.iconColor)} />
      <span>{config.label}</span>
      {config.prominence === "high" && size !== "sm" && (
        <div className="px-1.5 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded ml-1">
          Priority
        </div>
      )}
      {showDescription && (
        <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
          • {config.description}
        </span>
      )}
    </div>
  )
}