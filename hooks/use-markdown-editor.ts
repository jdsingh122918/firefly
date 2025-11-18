"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface MarkdownFormats {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  code: boolean;
}

export interface UseMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

export function useMarkdownEditor({ value, onChange, maxLength = 2000 }: UseMarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [formats, setFormats] = useState<MarkdownFormats>({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    code: false,
  });

  // Get current selection
  const getSelection = useCallback(() => {
    if (!textareaRef.current) return { start: 0, end: 0, text: "" };

    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = value.slice(start, end);

    return { start, end, text };
  }, [value]);

  // Set selection
  const setSelection = useCallback((start: number, end: number) => {
    if (!textareaRef.current) return;

    textareaRef.current.setSelectionRange(start, end);
    textareaRef.current.focus();
  }, []);

  // Insert text at cursor or replace selection
  const insertText = useCallback((text: string, selectAfter = false) => {
    const { start, end } = getSelection();
    const newValue = value.slice(0, start) + text + value.slice(end);

    if (newValue.length <= maxLength) {
      onChange(newValue);

      // Set cursor position after insertion (use requestAnimationFrame for better timing)
      requestAnimationFrame(() => {
        const newPos = selectAfter ? start + text.length : start;
        setSelection(newPos, newPos);
      });
    }
  }, [value, onChange, maxLength, getSelection, setSelection]);

  // Wrap selected text with markdown syntax
  const wrapText = useCallback((prefix: string, suffix = prefix) => {
    const { start, end, text } = getSelection();

    if (text) {
      // Check if text is already wrapped
      const beforePrefix = value.slice(start - prefix.length, start);
      const afterSuffix = value.slice(end, end + suffix.length);

      if (beforePrefix === prefix && afterSuffix === suffix) {
        // Remove formatting
        const newValue =
          value.slice(0, start - prefix.length) +
          text +
          value.slice(end + suffix.length);
        onChange(newValue);
        setTimeout(() => {
          setSelection(start - prefix.length, start - prefix.length + text.length);
        }, 0);
      } else {
        // Add formatting
        const wrappedText = prefix + text + suffix;
        const newValue = value.slice(0, start) + wrappedText + value.slice(end);
        if (newValue.length <= maxLength) {
          onChange(newValue);
          setTimeout(() => {
            setSelection(start + prefix.length, start + prefix.length + text.length);
          }, 0);
        }
      }
    } else {
      // Insert markers and place cursor between them
      const markers = prefix + suffix;
      insertText(markers);
      setTimeout(() => {
        setSelection(start + prefix.length, start + prefix.length);
      }, 0);
    }
  }, [value, onChange, maxLength, getSelection, setSelection, insertText]);

  // Formatting functions
  const toggleBold = useCallback(() => wrapText("**"), [wrapText]);
  const toggleItalic = useCallback(() => wrapText("*"), [wrapText]);
  const toggleUnderline = useCallback(() => wrapText("__"), [wrapText]);
  const toggleStrikethrough = useCallback(() => wrapText("~~"), [wrapText]);
  const toggleInlineCode = useCallback(() => wrapText("`"), [wrapText]);

  const insertCodeBlock = useCallback(() => {
    const { start } = getSelection();
    const isStartOfLine = start === 0 || value[start - 1] === '\n';
    const prefix = isStartOfLine ? '' : '\n';
    const codeBlock = `${prefix}\`\`\`\n\n\`\`\`\n`;
    insertText(codeBlock);
    setTimeout(() => {
      const cursorPos = start + prefix.length + 4; // Position after ```\n
      setSelection(cursorPos, cursorPos);
    }, 0);
  }, [value, getSelection, insertText]);

  const insertLink = useCallback(() => {
    const { text } = getSelection();
    if (text) {
      wrapText(`[`, `](url)`);
    } else {
      insertText(`[link text](url)`);
      setTimeout(() => {
        const { start } = getSelection();
        setSelection(start + 1, start + 10); // Select "link text"
      }, 0);
    }
  }, [wrapText, insertText, getSelection, setSelection]);

  const insertBulletList = useCallback(() => {
    const { start } = getSelection();
    const isStartOfLine = start === 0 || value[start - 1] === '\n';
    const prefix = isStartOfLine ? '' : '\n';
    insertText(`${prefix}- `);
  }, [value, getSelection, insertText]);

  const insertNumberedList = useCallback(() => {
    const { start } = getSelection();
    const isStartOfLine = start === 0 || value[start - 1] === '\n';
    const prefix = isStartOfLine ? '' : '\n';
    insertText(`${prefix}1. `);
  }, [value, getSelection, insertText]);

  const insertQuote = useCallback(() => {
    const { start } = getSelection();
    const isStartOfLine = start === 0 || value[start - 1] === '\n';
    const prefix = isStartOfLine ? '' : '\n';
    insertText(`${prefix}> `);
  }, [value, getSelection, insertText]);

  // Update format state based on cursor position
  const updateFormatsFromCursor = useCallback(() => {
    const { start, end } = getSelection();
    if (start === end) {
      // Check if cursor is inside formatted text
      const beforeCursor = value.slice(0, start);
      const afterCursor = value.slice(start);

      setFormats({
        bold: /\*\*[^*]*$/.test(beforeCursor) && /^[^*]*\*\*/.test(afterCursor),
        italic: /\*[^*]*$/.test(beforeCursor) && /^[^*]*\*/.test(afterCursor),
        underline: /__[^_]*$/.test(beforeCursor) && /^[^_]*__/.test(afterCursor),
        strikethrough: /~~[^~]*$/.test(beforeCursor) && /^[^~]*~~/.test(afterCursor),
        code: /`[^`]*$/.test(beforeCursor) && /^[^`]*`/.test(afterCursor),
      });
    } else {
      // Reset formats when text is selected
      setFormats({
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        code: false,
      });
    }
  }, [value, getSelection]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

    if (ctrlKey && !e.altKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          toggleBold();
          break;
        case 'i':
          e.preventDefault();
          toggleItalic();
          break;
        case 'u':
          e.preventDefault();
          toggleUnderline();
          break;
        case '`':
          e.preventDefault();
          if (e.shiftKey) {
            insertCodeBlock();
          } else {
            toggleInlineCode();
          }
          break;
        case 'k':
          e.preventDefault();
          insertLink();
          break;
      }
    }

    // Handle strikethrough (Cmd+Shift+X)
    if (ctrlKey && e.shiftKey && e.key.toLowerCase() === 'x') {
      e.preventDefault();
      toggleStrikethrough();
    }
  }, [toggleBold, toggleItalic, toggleUnderline, toggleStrikethrough, toggleInlineCode, insertCodeBlock, insertLink]);

  // Auto-resize textarea
  const handleInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const textarea = e.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }, []);

  // Focus textarea
  const focus = useCallback(() => {
    textareaRef.current?.focus();
  }, []);

  return {
    textareaRef,
    formats,
    getSelection,
    setSelection,
    insertText,

    // Formatting functions
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

    // Event handlers
    handleKeyDown,
    handleInput,

    // Utilities
    focus,
    updateFormatsFromCursor,

    // Stats
    characterCount: value.length,
    isNearLimit: value.length > maxLength * 0.9,
    isOverLimit: value.length > maxLength,
  };
}