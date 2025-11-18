"use client";

import { markdownToHtml } from "@/utils/markdown-formatter";

interface EditorJSData {
  blocks: Array<{
    id?: string;
    type: string;
    data: any;
  }>;
  version?: string;
}

interface MessageContentRendererProps {
  content: string;
  className?: string;
}

// Convert Editor.js JSON to HTML for display
const convertEditorJSToHTML = (data: EditorJSData): string => {
  if (!data?.blocks || data.blocks.length === 0) {
    return '';
  }

  const htmlParts = data.blocks.map(block => {
    switch (block.type) {
      case 'paragraph':
        return `<p class="mb-2 last:mb-0">${block.data.text || ''}</p>`;
      case 'header':
        const level = block.data.level || 2;
        return `<h${level} class="font-semibold mb-2 last:mb-0">${block.data.text || ''}</h${level}>`;
      case 'list':
        const tag = block.data.style === 'ordered' ? 'ol' : 'ul';
        const items = block.data.items?.map((item: string) => `<li>${item}</li>`).join('') || '';
        const listClass = tag === 'ol' ? 'list-decimal list-inside' : 'list-disc list-inside';
        return `<${tag} class="${listClass} mb-2 last:mb-0">${items}</${tag}>`;
      case 'quote':
        return `<blockquote class="border-l-4 border-gray-300 pl-4 italic mb-2 last:mb-0">${block.data.text || ''}</blockquote>`;
      case 'linkTool':
        const url = block.data.link || '';
        const title = block.data.meta?.title || block.data.link || '';
        return `<div class="mb-2 last:mb-0"><a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">${title}</a></div>`;
      default:
        // Fallback to paragraph
        const text = block.data.text || JSON.stringify(block.data);
        return `<p class="mb-2 last:mb-0">${text}</p>`;
    }
  });

  return htmlParts.join('');
};

// Helper function to detect if content is EditorJS JSON or plain text
const isEditorJSContent = (content: string): boolean => {
  if (!content || typeof content !== 'string') return false;

  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' && Array.isArray(parsed.blocks);
  } catch {
    return false;
  }
};

// Helper function to detect if content contains markdown syntax
const hasMarkdownSyntax = (content: string): boolean => {
  if (!content || typeof content !== 'string') return false;

  // Check for common markdown patterns
  const markdownPatterns = [
    /\*\*[^*]+\*\*/,        // Bold **text**
    /__[^_]+__/,            // Bold __text__
    /\*[^*]+\*/,            // Italic *text*
    /_[^_]+_/,              // Italic _text_
    /~~[^~]+~~/,            // Strikethrough ~~text~~
    /`[^`]+`/,              // Inline code `code`
    /```[\s\S]*?```/,       // Code blocks ```code```
    /\[[^\]]+\]\([^)]+\)/,  // Links [text](url)
    /^[-*+] /m,             // Bullet lists
    /^\d+\. /m,             // Numbered lists
    /^> /m,                 // Blockquotes
  ];

  return markdownPatterns.some(pattern => pattern.test(content));
};

export function MessageContentRenderer({ content, className = '' }: MessageContentRendererProps) {
  if (!content) {
    return <div className={`text-muted-foreground italic ${className}`}>No content</div>;
  }

  // Check if content is EditorJS JSON
  if (isEditorJSContent(content)) {
    try {
      const editorData = JSON.parse(content) as EditorJSData;
      const htmlContent = convertEditorJSToHTML(editorData);

      if (!htmlContent.trim()) {
        return <div className={`text-muted-foreground italic ${className}`}>Empty message</div>;
      }

      return (
        <div
          className={`prose prose-sm dark:prose-invert max-w-none text-foreground ${className}`}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      );
    } catch (error) {
      console.error('Error parsing EditorJS content:', error);
      // Fallback to displaying as plain text
      return (
        <div className={`text-sm whitespace-pre-wrap break-words text-foreground ${className}`}>
          {content}
        </div>
      );
    }
  }

  // Check if content contains markdown syntax
  if (hasMarkdownSyntax(content)) {
    try {
      const htmlContent = markdownToHtml(content, { sanitize: true });

      if (!htmlContent.trim()) {
        return <div className={`text-muted-foreground italic ${className}`}>Empty message</div>;
      }

      return (
        <div
          className={`prose prose-sm dark:prose-invert max-w-none text-foreground ${className}`}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      );
    } catch (error) {
      console.error('Error parsing markdown content:', error);
      // Fallback to plain text display
    }
  }

  // Handle plain text content (no markdown syntax detected)
  return (
    <div className={`text-sm whitespace-pre-wrap break-words text-foreground ${className}`}>
      {content}
    </div>
  );
}