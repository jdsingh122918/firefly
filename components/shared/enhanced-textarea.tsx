"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Type, Smile, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useMarkdownEditor } from "@/hooks/use-markdown-editor";
import { useFileUpload, UploadedFile } from "@/hooks/use-file-upload";
import { FormattingToolbar } from "@/components/chat/formatting-toolbar";
import { EmojiPicker } from "@/components/chat/emoji-picker";
import { MessageAttachmentPreview } from "@/components/chat/message-attachment-preview";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface EnhancedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
  // Feature toggles
  showToolbar?: boolean;
  enableEmojis?: boolean;
  enableAttachments?: boolean;
  // File attachment props
  attachments?: UploadedFile[];
  onAttachmentsChange?: (attachments: UploadedFile[]) => void;
  // Additional props for different contexts
  autoResize?: boolean;
  label?: string;
  description?: string;
  // Character counter behavior
  showCharacterCount?: 'always' | 'near-limit' | 'never';
}

export function EnhancedTextarea({
  value,
  onChange,
  placeholder = "Write your content...",
  disabled = false,
  maxLength = 50000,
  minHeight = 120,
  maxHeight = 500,
  className,
  showToolbar = true,
  enableEmojis = true,
  enableAttachments = true,
  attachments = [],
  onAttachmentsChange,
  autoResize = true,
  label,
  description,
  showCharacterCount = 'near-limit',
}: EnhancedTextareaProps) {
  const [isToolbarVisible, setIsToolbarVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File upload functionality
  const {
    uploads,
    uploadFiles,
    removeUpload,
    hasActiveUploads,
    fetchConfig,
    config,
  } = useFileUpload();

  // Fetch upload config on mount
  useEffect(() => {
    if (enableAttachments && !config) {
      fetchConfig();
    }
  }, [enableAttachments, config, fetchConfig]);

  const {
    textareaRef,
    formats,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    toggleStrikethrough,
    toggleInlineCode,
    insertCodeBlock,
    insertLink,
    insertBulletList,
    insertNumberedList,
    insertQuote,
    handleKeyDown,
    handleInput: markdownHandleInput,
    focus,
    updateFormatsFromCursor,
    characterCount,
    isNearLimit,
    isOverLimit,
    insertText,
  } = useMarkdownEditor({
    value,
    onChange,
    maxLength,
  });

  // Handle file upload
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !onAttachmentsChange) return;

    try {
      const uploadResults = await uploadFiles(Array.from(files), {
        category: "documents"
      });

      if (uploadResults.successful.length > 0) {
        const newAttachments = [...attachments, ...uploadResults.successful];
        onAttachmentsChange(newAttachments);
        toast.success(`${uploadResults.successful.length} file(s) uploaded successfully`);
      }

      if (uploadResults.failed.length > 0) {
        console.error('Some files failed to upload:', uploadResults.failed);
        toast.error(`${uploadResults.failed.length} file(s) failed to upload`);
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast.error('Failed to upload files. Please try again.');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [attachments, onAttachmentsChange, uploadFiles]);

  // Remove attachment
  const handleRemoveAttachment = useCallback((fileId: string) => {
    if (!onAttachmentsChange) return;
    const newAttachments = attachments.filter(attachment => attachment.fileId !== fileId);
    onAttachmentsChange(newAttachments);
  }, [attachments, onAttachmentsChange]);

  // Remove upload (for files currently uploading)
  const handleRemoveUpload = useCallback((file: File) => {
    removeUpload(file);
  }, [removeUpload]);

  // Handle textarea changes
  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  // Handle content editor specific key events
  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle formatting shortcuts
      handleKeyDown(e);
    },
    [handleKeyDown]
  );

  // Custom input handler for auto-resize
  const handleInput = useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      if (autoResize) {
        markdownHandleInput(e);
      }
    },
    [autoResize, markdownHandleInput]
  );

  // Handle emoji selection
  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      insertText(emoji);
      focus();
    },
    [insertText, focus]
  );

  // Handle file upload click
  const handleFileClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Determine character counter visibility
  const shouldShowCharacterCount =
    showCharacterCount === 'always' ||
    (showCharacterCount === 'near-limit' && (isNearLimit || isOverLimit));

  // Calculate textarea height for non-auto-resize mode
  const textareaStyle = autoResize
    ? {
        height: "auto",
        minHeight: `${minHeight}px`,
        maxHeight: `${maxHeight}px`,
      }
    : {
        height: `${minHeight}px`,
        minHeight: `${minHeight}px`,
        maxHeight: `${maxHeight}px`,
      };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Label and description */}
      {(label || description) && (
        <div>
          {label && (
            <label className="text-sm font-medium text-foreground mb-1 block">
              {label}
            </label>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}

      {/* Editor Container */}
      <Card className="border-border/50 overflow-hidden">
        {/* Formatting Toolbar */}
        {showToolbar && (
          <FormattingToolbar
            isVisible={isToolbarVisible}
            formats={formats}
            onToggleBold={toggleBold}
            onToggleItalic={toggleItalic}
            onToggleUnderline={toggleUnderline}
            onToggleStrikethrough={toggleStrikethrough}
            onToggleInlineCode={toggleInlineCode}
            onInsertCodeBlock={insertCodeBlock}
            onInsertLink={insertLink}
            onInsertBulletList={insertBulletList}
            onInsertNumberedList={insertNumberedList}
            onInsertQuote={insertQuote}
          />
        )}

        {/* Main Content Area */}
        <div className="p-4">

          {/* Content Area */}
          <div className="space-y-3">
            {/* Textarea */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={handleTextareaChange}
                onKeyDown={handleTextareaKeyDown}
                onInput={handleInput}
                onFocus={updateFormatsFromCursor}
                onSelect={updateFormatsFromCursor}
                placeholder={placeholder}
                disabled={disabled}
                className={cn(
                  "w-full resize-y border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-3 text-sm",
                  "placeholder:text-gray-500 dark:placeholder:text-gray-400",
                  "focus:outline-none focus:ring-0 focus:border-blue-500 dark:focus:border-blue-400",
                  "leading-relaxed scrollbar-thin scrollbar-thumb-muted",
                  "font-medium text-gray-900 dark:text-gray-100 rounded-md",
                  "enhanced-markdown-editor",
                  isOverLimit && "text-red-500",
                  !autoResize && "resize-y"
                )}
                style={textareaStyle}
              />
            </div>

            {/* Character Counter */}
            {shouldShowCharacterCount && (
              <div className="flex justify-end">
                <span
                  className={cn(
                    "text-xs",
                    isOverLimit ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {characterCount.toLocaleString()}/{maxLength.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Attachment Preview (always visible when attachments exist) */}
          {enableAttachments && (
            <MessageAttachmentPreview
              attachments={attachments}
              uploads={uploads}
              onRemoveAttachment={handleRemoveAttachment}
              onRemoveUpload={handleRemoveUpload}
            />
          )}

          {/* Action Bar */}
          {(showToolbar || enableEmojis || enableAttachments) && (
            <div className="flex items-center justify-between mt-3 gap-2">
              {/* Left Actions */}
              <div className="flex items-center gap-1">
                {/* File Upload */}
                {enableAttachments && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleFileClick}
                    disabled={disabled || !config}
                    className="h-8 w-8 p-0 hover:bg-muted"
                    title={!config ? "Loading upload configuration..." : "Attach files"}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                )}

                {/* Text Formatting Toggle */}
                {showToolbar && (
                  <Button
                    variant={isToolbarVisible ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setIsToolbarVisible(!isToolbarVisible)}
                    disabled={disabled}
                    className="h-8 px-2 text-xs font-medium"
                  >
                    <Type className="h-3 w-3 mr-1" />
                    Format
                  </Button>
                )}

                {/* Emoji Picker */}
                {enableEmojis && (
                  <div className="relative">
                    <EmojiPicker
                      onEmojiSelect={handleEmojiSelect}
                      disabled={disabled}
                      size="sm"
                    />
                  </div>
                )}
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-2">
                {/* Upload Status */}
                {hasActiveUploads && (
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    Uploading...
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Hidden File Input */}
      {enableAttachments && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={config?.allowedMimeTypes.join(',') || '*/*'}
          className="hidden"
          onChange={handleFileSelect}
        />
      )}
    </div>
  );
}