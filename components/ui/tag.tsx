import React from "react";
import { cn } from "@/lib/utils";
import type { Tag as TagType } from "@/lib/types/index";
import { X, Hash } from "lucide-react";

// Tag size variants
type TagSize = "sm" | "md" | "lg";

// Tag color variants
type TagVariant = "default" | "secondary" | "outline" | "destructive";

interface TagProps extends React.HTMLAttributes<HTMLDivElement> {
  tag?: TagType;
  children?: React.ReactNode;
  size?: TagSize;
  variant?: TagVariant;
  color?: string; // Custom color override
  removable?: boolean;
  onRemove?: () => void;
  interactive?: boolean;
  disabled?: boolean;
}

const sizeClasses: Record<TagSize, string> = {
  sm: "h-5 px-2 text-xs",
  md: "h-6 px-2.5 text-sm",
  lg: "h-8 px-3 text-sm",
};

const variantClasses: Record<TagVariant, string> = {
  default:
    "bg-primary text-primary-foreground border-transparent hover:bg-primary/90",
  secondary:
    "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80",
  outline: "text-foreground border-border hover:bg-accent hover:text-accent-foreground",
  destructive:
    "bg-destructive text-destructive-foreground border-transparent hover:bg-destructive/90",
};

export function Tag({
  tag,
  children,
  size = "md",
  variant = "default",
  color,
  removable = false,
  onRemove,
  interactive = false,
  disabled = false,
  className,
  onClick,
  ...props
}: TagProps) {
  const displayText = tag?.name || children;
  const customColor = color || tag?.color;

  // Generate custom styles for color
  const customColorStyles = customColor
    ? {
        backgroundColor: `${customColor}20`, // 20% opacity background
        borderColor: customColor,
        color: customColor,
      }
    : {};

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    onClick?.(e);
  };

  const handleRemove = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (disabled) return;
    onRemove?.();
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        sizeClasses[size],
        customColor ? "border-current" : variantClasses[variant],
        interactive && !disabled && "cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
      style={customColor ? customColorStyles : undefined}
      onClick={handleClick}
      {...props}
    >
      {!customColor && <Hash className="h-3 w-3" />}
      <span className="truncate">{displayText}</span>
      {removable && (
        <button
          type="button"
          onClick={handleRemove}
          disabled={disabled}
          className={cn(
            "inline-flex items-center justify-center rounded-full hover:bg-black/10 transition-colors",
            size === "sm" && "h-3 w-3",
            size === "md" && "h-4 w-4",
            size === "lg" && "h-5 w-5",
            disabled && "cursor-not-allowed",
          )}
        >
          <X className="h-3 w-3" />
          <span className="sr-only">Remove tag</span>
        </button>
      )}
    </div>
  );
}

// Tag list component for displaying multiple tags
interface TagListProps {
  tags: TagType[];
  size?: TagSize;
  variant?: TagVariant;
  removable?: boolean;
  onRemove?: (tag: TagType) => void;
  onTagClick?: (tag: TagType) => void;
  maxDisplayed?: number;
  className?: string;
  disabled?: boolean;
}

export function TagList({
  tags,
  size = "md",
  variant = "default",
  removable = false,
  onRemove,
  onTagClick,
  maxDisplayed,
  className,
  disabled = false,
}: TagListProps) {
  const displayedTags = maxDisplayed ? tags.slice(0, maxDisplayed) : tags;
  const remainingCount = maxDisplayed && tags.length > maxDisplayed
    ? tags.length - maxDisplayed
    : 0;

  if (tags.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        No tags
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {displayedTags.map((tag) => (
        <Tag
          key={tag.id}
          tag={tag}
          size={size}
          variant={variant}
          removable={removable}
          onRemove={() => onRemove?.(tag)}
          onClick={() => onTagClick?.(tag)}
          interactive={!!onTagClick}
          disabled={disabled}
        />
      ))}
      {remainingCount > 0 && (
        <Tag size={size} variant="secondary">
          +{remainingCount} more
        </Tag>
      )}
    </div>
  );
}

// Category badge component
interface CategoryBadgeProps {
  category: {
    name: string;
    color?: string;
    icon?: string;
  };
  size?: TagSize;
  className?: string;
}

export function CategoryBadge({
  category,
  size = "md",
  className
}: CategoryBadgeProps) {
  const customColorStyles = category.color
    ? {
        backgroundColor: `${category.color}15`, // 15% opacity background
        borderColor: category.color,
        color: category.color,
      }
    : {};

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium",
        sizeClasses[size],
        category.color ? "border-current" : "border-border bg-muted text-muted-foreground",
        className,
      )}
      style={category.color ? customColorStyles : undefined}
    >
      {category.icon && (
        <span className="text-xs">{category.icon}</span>
      )}
      <span className="truncate">{category.name}</span>
    </div>
  );
}