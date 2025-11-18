"use client";

import React from "react";
import {
  Image,
  Paperclip,
  Link,
  Smile,
  FileText,
  Video,
  Music,
  Calendar,
  Code,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface InputActionsPopoverProps {
  trigger: React.ReactNode;
  onFileUpload: () => void;
  onImageUpload: () => void;
  onInsertLink: () => void;
  onShowEmojiPicker: () => void;
  onInsertCodeBlock: () => void;
  disabled?: boolean;
  className?: string;
}

interface ActionItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}

const ActionItem = ({ icon: Icon, label, description, onClick, disabled }: ActionItemProps) => (
  <Button
    variant="ghost"
    onClick={onClick}
    disabled={disabled}
    className="w-full justify-start h-auto p-3 hover:bg-muted"
  >
    <div className="flex items-start gap-3 w-full">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
      <div className="text-left">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </div>
  </Button>
);

export function InputActionsPopover({
  trigger,
  onFileUpload,
  onImageUpload,
  onInsertLink,
  onShowEmojiPicker,
  onInsertCodeBlock,
  disabled = false,
  className,
}: InputActionsPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild disabled={disabled}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className={cn("w-80 p-1", className)}
        sideOffset={8}
      >
        {/* File Upload Section */}
        <div className="space-y-1">
          <ActionItem
            icon={Image}
            label="Upload Image"
            description="Share photos, screenshots, or graphics"
            onClick={onImageUpload}
          />
          <ActionItem
            icon={Paperclip}
            label="Attach File"
            description="Upload documents, PDFs, or any file type"
            onClick={onFileUpload}
          />
          <ActionItem
            icon={Video}
            label="Upload Video"
            description="Share video files or recordings"
            onClick={onFileUpload}
            disabled
          />
        </div>

        <Separator className="my-2" />

        {/* Content Insertion Section */}
        <div className="space-y-1">
          <ActionItem
            icon={Link}
            label="Insert Link"
            description="Add a hyperlink to your message"
            onClick={onInsertLink}
          />
          <ActionItem
            icon={Code}
            label="Code Block"
            description="Share formatted code or text"
            onClick={onInsertCodeBlock}
          />
          <ActionItem
            icon={Smile}
            label="Add Emoji"
            description="Express yourself with emojis"
            onClick={onShowEmojiPicker}
          />
        </div>

        <Separator className="my-2" />

        {/* Future Features Section */}
        <div className="space-y-1 opacity-60">
          <ActionItem
            icon={Calendar}
            label="Schedule Message"
            description="Send this message at a specific time"
            onClick={() => {}}
            disabled
          />
          <ActionItem
            icon={Music}
            label="Voice Message"
            description="Record and send an audio message"
            onClick={() => {}}
            disabled
          />
        </div>

        {/* Footer */}
        <div className="px-3 py-2 mt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Use keyboard shortcuts for quick formatting
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}