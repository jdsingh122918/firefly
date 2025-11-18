"use client";

import React from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Code2,
  Link,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MarkdownFormats } from "@/hooks/use-markdown-editor";

export interface FormattingToolbarProps {
  isVisible: boolean;
  formats: MarkdownFormats;
  onToggleBold: () => void;
  onToggleItalic: () => void;
  onToggleUnderline: () => void;
  onToggleStrikethrough: () => void;
  onToggleInlineCode: () => void;
  onInsertCodeBlock: () => void;
  onInsertLink: () => void;
  onInsertBulletList: () => void;
  onInsertNumberedList: () => void;
  onInsertQuote: () => void;
  className?: string;
}

interface ToolbarButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
  shortcut?: string;
  isActive?: boolean;
  onClick: () => void;
}

const ToolbarButton = ({ icon: Icon, tooltip, shortcut, isActive, onClick }: ToolbarButtonProps) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isActive ? "secondary" : "ghost"}
          size="sm"
          onClick={onClick}
          onMouseDown={(e) => e.preventDefault()} // Prevent button from stealing focus from textarea
          className={cn(
            "h-7 w-7 p-0 hover:bg-muted",
            isActive && "bg-muted text-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <div className="text-center">
          <div>{tooltip}</div>
          {shortcut && <div className="text-muted-foreground">{shortcut}</div>}
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export function FormattingToolbar({
  isVisible,
  formats,
  onToggleBold,
  onToggleItalic,
  onToggleUnderline,
  onToggleStrikethrough,
  onToggleInlineCode,
  onInsertCodeBlock,
  onInsertLink,
  onInsertBulletList,
  onInsertNumberedList,
  onInsertQuote,
  className,
}: FormattingToolbarProps) {
  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-3 py-2 border-b bg-background/50 transition-all duration-200",
        "border-border/50",
        className
      )}
    >
      {/* Text Formatting Group */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          icon={Bold}
          tooltip="Bold"
          shortcut="⌘B"
          isActive={formats.bold}
          onClick={onToggleBold}
        />
        <ToolbarButton
          icon={Italic}
          tooltip="Italic"
          shortcut="⌘I"
          isActive={formats.italic}
          onClick={onToggleItalic}
        />
        <ToolbarButton
          icon={Underline}
          tooltip="Underline"
          shortcut="⌘U"
          isActive={formats.underline}
          onClick={onToggleUnderline}
        />
        <ToolbarButton
          icon={Strikethrough}
          tooltip="Strikethrough"
          shortcut="⌘⇧X"
          isActive={formats.strikethrough}
          onClick={onToggleStrikethrough}
        />
      </div>

      <Separator orientation="vertical" className="h-5" />

      {/* Code Group */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          icon={Code}
          tooltip="Inline Code"
          shortcut="⌘`"
          isActive={formats.code}
          onClick={onToggleInlineCode}
        />
        <ToolbarButton
          icon={Code2}
          tooltip="Code Block"
          shortcut="⌘⇧`"
          onClick={onInsertCodeBlock}
        />
      </div>

      <Separator orientation="vertical" className="h-5" />

      {/* Structure Group */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          icon={Link}
          tooltip="Insert Link"
          shortcut="⌘K"
          onClick={onInsertLink}
        />
        <ToolbarButton
          icon={List}
          tooltip="Bullet List"
          onClick={onInsertBulletList}
        />
        <ToolbarButton
          icon={ListOrdered}
          tooltip="Numbered List"
          onClick={onInsertNumberedList}
        />
        <ToolbarButton
          icon={Quote}
          tooltip="Quote"
          onClick={onInsertQuote}
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Help Text */}
      <div className="text-xs text-muted-foreground hidden sm:block">
        Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">⌘</kbd> + key for shortcuts
      </div>
    </div>
  );
}