"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Save, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { UploadedFile } from "@/hooks/use-file-upload";
import { toast } from "sonner";
import { EnhancedTextarea } from "@/components/shared/enhanced-textarea";

export interface ContentStyleEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
  // File attachment props
  attachments?: UploadedFile[];
  onAttachmentsChange?: (attachments: UploadedFile[]) => void;
  // Auto-save props
  autoSave?: boolean;
  onAutoSave?: (content: string) => Promise<void>;
  autoSaveDelay?: number; // Delay in ms before auto-saving
}

export function ContentStyleEditor({
  content,
  onChange,
  placeholder = "Write your content here... (supports rich text formatting)",
  disabled = false,
  maxLength = 50000,
  className,
  attachments = [],
  onAttachmentsChange,
  autoSave = false,
  onAutoSave,
  autoSaveDelay = 2000,
}: ContentStyleEditorProps) {
  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedContent, setLastSavedContent] = useState(content);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-save functionality
  const triggerAutoSave = useCallback(async (contentToSave: string) => {
    if (!autoSave || !onAutoSave || contentToSave === lastSavedContent || disabled) {
      return;
    }

    try {
      setAutoSaveStatus('saving');
      await onAutoSave(contentToSave);
      setAutoSaveStatus('saved');
      setLastSavedContent(contentToSave);

      // Reset to idle after showing saved state for 2 seconds
      setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Auto-save failed:', error);
      setAutoSaveStatus('error');
      toast.error('Auto-save failed. Your changes are not saved.');

      // Reset to pending after showing error for 3 seconds
      setTimeout(() => {
        setAutoSaveStatus('pending');
      }, 3000);
    }
  }, [autoSave, onAutoSave, lastSavedContent, disabled]);

  // Auto-save effect
  useEffect(() => {
    if (!autoSave || !onAutoSave || disabled) {
      return;
    }

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set pending status if content has changed
    if (content !== lastSavedContent && content.trim()) {
      setAutoSaveStatus('pending');

      // Set up auto-save timeout
      autoSaveTimeoutRef.current = setTimeout(() => {
        triggerAutoSave(content);
      }, autoSaveDelay);
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [content, autoSave, onAutoSave, lastSavedContent, autoSaveDelay, triggerAutoSave, disabled]);

  // Update lastSavedContent when content prop changes externally
  useEffect(() => {
    if (content !== lastSavedContent && autoSaveStatus === 'idle') {
      setLastSavedContent(content);
    }
  }, [content, lastSavedContent, autoSaveStatus]);

  // Auto-save indicator component
  const AutoSaveIndicator = () => {
    if (!autoSave) return null;

    return (
      <div className="flex items-center gap-2 text-sm">
        {autoSaveStatus === 'idle' && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <CheckCircle2 className="h-3 w-3" />
            <span className="hidden sm:inline">All changes saved</span>
          </div>
        )}
        {autoSaveStatus === 'pending' && (
          <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
            <Clock className="h-3 w-3" />
            <span className="hidden sm:inline">Unsaved changes</span>
          </div>
        )}
        {autoSaveStatus === 'saving' && (
          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
            <Save className="h-3 w-3 animate-spin" />
            <span className="hidden sm:inline">Saving...</span>
          </div>
        )}
        {autoSaveStatus === 'saved' && (
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            <span className="hidden sm:inline">Saved</span>
          </div>
        )}
        {autoSaveStatus === 'error' && (
          <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-3 w-3" />
            <span className="hidden sm:inline">Save failed</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Auto-save indicator */}
      {autoSave && (
        <div className="flex justify-end">
          <AutoSaveIndicator />
        </div>
      )}

      {/* Enhanced Textarea with full features */}
      <EnhancedTextarea
        value={content}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        minHeight={300}
        maxHeight={600}
        showToolbar={true}
        enableEmojis={true}
        enableAttachments={true}
        enablePreview={true}
        attachments={attachments}
        onAttachmentsChange={onAttachmentsChange}
        autoResize={true}
        label="Content"
        description="Create rich content with formatting, emojis, and file attachments. Use the Format button to access text formatting options."
        showCharacterCount="near-limit"
      />
    </div>
  );
}