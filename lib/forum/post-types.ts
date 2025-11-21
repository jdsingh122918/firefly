import {
  MessageSquare,
  HelpCircle,
  Megaphone,
  FileText,
  BarChart3,
  LucideIcon
} from "lucide-react"

export type PostType = "DISCUSSION" | "QUESTION" | "ANNOUNCEMENT" | "RESOURCE" | "POLL"

// Valid post types array for form validation
export const VALID_POST_TYPES = ["DISCUSSION", "QUESTION", "ANNOUNCEMENT", "RESOURCE", "POLL"] as const

export interface PostTypeConfig {
  label: string
  description: string
  icon: LucideIcon
  priority: number // Higher priority = more prominent display
  colors: {
    // Base colors for badges and indicators
    background: string
    text: string
    border: string
    // Enhanced colors for cards and highlights
    cardBackground: string
    cardBorder: string
    cardHover: string
    // Icon colors
    iconColor: string
  }
  // Visual hierarchy settings
  prominence: "high" | "medium" | "low"
}

export const POST_TYPE_CONFIGS: Record<PostType, PostTypeConfig> = {
  ANNOUNCEMENT: {
    label: "Announcement",
    description: "Important news, updates, or official communications",
    icon: Megaphone,
    priority: 5, // Highest priority - most prominent
    prominence: "high",
    colors: {
      background: "bg-red-50 dark:bg-red-950/20",
      text: "text-red-700 dark:text-red-400",
      border: "border-red-200 dark:border-red-800",
      cardBackground: "bg-red-50/80 dark:bg-red-950/30",
      cardBorder: "border-l-red-500",
      cardHover: "hover:bg-red-100/80 dark:hover:bg-red-950/40",
      iconColor: "text-red-600 dark:text-red-400"
    }
  },
  QUESTION: {
    label: "Question",
    description: "Ask for help, advice, or information from the community",
    icon: HelpCircle,
    priority: 4,
    prominence: "high",
    colors: {
      background: "bg-blue-50 dark:bg-blue-950/20",
      text: "text-blue-700 dark:text-blue-400",
      border: "border-blue-200 dark:border-blue-800",
      cardBackground: "bg-blue-50/80 dark:bg-blue-950/30",
      cardBorder: "border-l-blue-500",
      cardHover: "hover:bg-blue-100/80 dark:hover:bg-blue-950/40",
      iconColor: "text-blue-600 dark:text-blue-400"
    }
  },
  RESOURCE: {
    label: "Resource",
    description: "Share helpful resources, guides, or valuable information",
    icon: FileText,
    priority: 3,
    prominence: "medium",
    colors: {
      background: "bg-green-50 dark:bg-green-950/20",
      text: "text-green-700 dark:text-green-400",
      border: "border-green-200 dark:border-green-800",
      cardBackground: "bg-green-50/80 dark:bg-green-950/30",
      cardBorder: "border-l-green-500",
      cardHover: "hover:bg-green-100/80 dark:hover:bg-green-950/40",
      iconColor: "text-green-600 dark:text-green-400"
    }
  },
  POLL: {
    label: "Poll",
    description: "Gather community opinions through voting and surveys",
    icon: BarChart3,
    priority: 3,
    prominence: "medium",
    colors: {
      background: "bg-purple-50 dark:bg-purple-950/20",
      text: "text-purple-700 dark:text-purple-400",
      border: "border-purple-200 dark:border-purple-800",
      cardBackground: "bg-purple-50/80 dark:bg-purple-950/30",
      cardBorder: "border-l-purple-500",
      cardHover: "hover:bg-purple-100/80 dark:hover:bg-purple-950/40",
      iconColor: "text-purple-600 dark:text-purple-400"
    }
  },
  DISCUSSION: {
    label: "Discussion",
    description: "General conversation and community discussion topics",
    icon: MessageSquare,
    priority: 2, // Lowest priority - least prominent (default/casual)
    prominence: "low",
    colors: {
      background: "bg-gray-50 dark:bg-gray-950/20",
      text: "text-gray-700 dark:text-gray-400",
      border: "border-gray-200 dark:border-gray-800",
      cardBackground: "bg-gray-50/80 dark:bg-gray-950/30",
      cardBorder: "border-l-gray-400",
      cardHover: "hover:bg-gray-100/80 dark:hover:bg-gray-950/40",
      iconColor: "text-gray-600 dark:text-gray-400"
    }
  }
}

// Helper functions for working with post types
export const getPostTypeConfig = (type: string): PostTypeConfig => {
  const upperType = type.toUpperCase() as PostType
  return POST_TYPE_CONFIGS[upperType] || POST_TYPE_CONFIGS.DISCUSSION
}

export const getPostTypeIcon = (type: string) => {
  const config = getPostTypeConfig(type)
  return config.icon
}

export const getPostTypeColors = (type: string) => {
  const config = getPostTypeConfig(type)
  return config.colors
}

export const getPostTypePriority = (type: string): number => {
  const config = getPostTypeConfig(type)
  return config.priority
}

// Get post types sorted by priority (highest first)
export const getPostTypesSortedByPriority = (): [PostType, PostTypeConfig][] => {
  return Object.entries(POST_TYPE_CONFIGS)
    .sort(([, a], [, b]) => b.priority - a.priority) as [PostType, PostTypeConfig][]
}

// Badge styling helpers
export const getPostTypeBadgeClasses = (type: string, size: "sm" | "md" | "lg" = "md") => {
  const config = getPostTypeConfig(type)
  const baseClasses = `inline-flex items-center gap-1 font-medium rounded-md border transition-colors ${config.colors.background} ${config.colors.text} ${config.colors.border}`

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base"
  }

  return `${baseClasses} ${sizeClasses[size]}`
}

// Card styling helpers
export const getPostTypeCardClasses = (type: string) => {
  const config = getPostTypeConfig(type)
  return {
    background: config.colors.cardBackground,
    border: config.colors.cardBorder,
    hover: config.colors.cardHover
  }
}

// Legacy compatibility - maps to existing healthcare colors when appropriate
export const getLegacyPostTypeColors = (type: string) => {
  const config = getPostTypeConfig(type)

  // Map to healthcare categories where it makes sense
  switch (type.toUpperCase()) {
    case 'QUESTION':
      return {
        border: 'border-l-[var(--healthcare-mental)]',
        background: 'bg-blue-50 dark:bg-blue-950/20',
        hover: 'hover:bg-blue-100 dark:hover:bg-blue-950/30'
      }
    case 'RESOURCE':
      return {
        border: 'border-l-[var(--healthcare-education)]',
        background: 'bg-green-50 dark:bg-green-950/20',
        hover: 'hover:bg-green-100 dark:hover:bg-green-950/30'
      }
    case 'ANNOUNCEMENT':
      return {
        border: 'border-l-[var(--healthcare-basic)]',
        background: 'bg-red-50 dark:bg-red-950/20',
        hover: 'hover:bg-red-100 dark:hover:bg-red-950/30'
      }
    case 'DISCUSSION':
      return {
        border: 'border-l-[var(--healthcare-home)]',
        background: 'bg-gray-50 dark:bg-gray-950/20',
        hover: 'hover:bg-gray-100 dark:hover:bg-gray-950/30'
      }
    default:
      return getPostTypeCardClasses(type)
  }
}