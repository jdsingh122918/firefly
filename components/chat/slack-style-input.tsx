"use client";

import React, { useState, useCallback, useRef } from "react";
import { Plus, Send, Smile, Type, Mic, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useMarkdownEditor } from "@/hooks/use-markdown-editor";
import { useFileUpload, UploadedFile } from "@/hooks/use-file-upload";
import { FormattingToolbar } from "./formatting-toolbar";
import { EmojiPicker } from "./emoji-picker";
import { InputActionsPopover } from "./input-actions-popover";
import { MessageAttachmentPreview } from "./message-attachment-preview";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface SlackStyleInputProps {
  content: string;
  onChange: (content: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  sending?: boolean;
  maxLength?: number;
  className?: string;
  // File attachment props
  attachments?: UploadedFile[];
  onAttachmentsChange?: (attachments: UploadedFile[]) => void;
}

export function SlackStyleInput({
  content,
  onChange,
  onSend,
  placeholder = "Type your message...",
  disabled = false,
  sending = false,
  maxLength = 2000,
  className,
  attachments = [],
  onAttachmentsChange,
}: SlackStyleInputProps) {
  const [showToolbar, setShowToolbar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File upload functionality
  const {
    uploads,
    uploadFiles,
    removeUpload,
    hasActiveUploads
  } = useFileUpload();

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
    handleInput,
    focus,
    updateFormatsFromCursor,
    characterCount,
    isNearLimit,
    isOverLimit,
    insertText,
  } = useMarkdownEditor({
    value: content,
    onChange,
    maxLength,
  });

  // Handle file upload
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !onAttachmentsChange) return;

    try {
      const uploadResults = await uploadFiles(Array.from(files), {
        category: "chat-attachments"
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

  // Handle send
  const handleSendClick = useCallback(() => {
    if (!content.trim() || disabled || sending) return;
    onSend();
  }, [content, disabled, sending, onSend]);

  // Handle Enter key
  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle send on Enter (without Shift)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendClick();
        return;
      }

      // Handle formatting shortcuts
      handleKeyDown(e);
    },
    [handleSendClick, handleKeyDown]
  );

  // Handle emoji selection
  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      // Insert emoji and focus textarea
      insertText(emoji);
      focus();
    },
    [insertText, focus]
  );

  // Handle file upload
  const handleFileClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Calculate if send button should be enabled
  const canSend = (content.trim().length > 0 || attachments.length > 0) &&
    !disabled &&
    !sending &&
    !isOverLimit &&
    !hasActiveUploads;

  return (
    <Card className={cn("border-border/50 overflow-hidden", className)}>
      {/* Formatting Toolbar */}
      <FormattingToolbar
        isVisible={showToolbar}
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

      {/* Main Input Area */}
      <div className="p-3">
        {/* Textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextareaChange}
            onKeyDown={handleTextareaKeyDown}
            onInput={handleInput}
            onFocus={updateFormatsFromCursor}
            onSelect={updateFormatsFromCursor}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "w-full resize-none border-0 bg-transparent p-0 text-sm",
              "placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-0",
              "min-h-[40px] max-h-[200px]",
              "leading-5 scrollbar-thin scrollbar-thumb-muted",
              isOverLimit && "text-destructive"
            )}
            rows={1}
            style={{
              height: "auto",
              minHeight: "40px",
            }}
          />
        </div>

        {/* Character Counter (when near/over limit) */}
        {(isNearLimit || isOverLimit) && (
          <div className="flex justify-end mt-1">
            <span
              className={cn(
                "text-xs",
                isOverLimit ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {characterCount}/{maxLength}
            </span>
          </div>
        )}

        {/* Attachment Preview */}
        <MessageAttachmentPreview
          attachments={attachments}
          uploads={uploads}
          onRemoveAttachment={handleRemoveAttachment}
          onRemoveUpload={handleRemoveUpload}
        />

        {/* Action Bar */}
        <div className="flex items-center justify-between mt-3 gap-2">
          {/* Left Actions */}
          <div className="flex items-center gap-1">
            {/* Plus Button - File Upload */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFileClick}
              disabled={disabled}
              className="h-8 w-8 p-0 hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
            </Button>

            {/* Text Formatting Toggle */}
            <Button
              variant={showToolbar ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowToolbar(!showToolbar)}
              disabled={disabled}
              className="h-8 px-2 text-xs font-medium"
            >
              <Type className="h-3 w-3 mr-1" />
              Aa
            </Button>

            {/* Emoji Picker */}
            <div className="relative">
              <EmojiPicker
                onEmojiSelect={handleEmojiSelect}
                disabled={disabled}
                size="sm"
              />
            </div>

            {/* Microphone Button */}
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              className="h-8 w-8 p-0 hover:bg-muted opacity-50"
              title="Voice message (coming soon)"
            >
              <Mic className="h-4 w-4" />
            </Button>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Send Button */}
            <Button
              size="sm"
              onClick={handleSendClick}
              disabled={!canSend}
              className={cn(
                "h-8 w-8 p-0 transition-all duration-200",
                canSend
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.csv,.zip,.rar,.7z,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.svg,.mp4,.mov,.mp3,.wav"
        className="hidden"
        onChange={handleFileSelect}
      />
    </Card>
  );
}