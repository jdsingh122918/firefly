/**
 * Utility functions for converting markdown to HTML for chat messages
 * Focuses on inline formatting that matches Slack-style syntax
 */

export interface MarkdownToHtmlOptions {
  sanitize?: boolean;
  allowedTags?: string[];
}

/**
 * Convert markdown text to HTML for message storage/display
 */
export function markdownToHtml(markdown: string, options: MarkdownToHtmlOptions = {}): string {
  if (!markdown) return "";

  let html = markdown;

  // Escape HTML to prevent XSS
  if (options.sanitize !== false) {
    html = escapeHtml(html);
  }

  // Convert markdown patterns to HTML
  // Order matters - do more specific patterns first to avoid conflicts

  // Code blocks (triple backticks)
  html = html.replace(/```([^`]*)```/g, '<pre><code>$1</code></pre>');

  // Inline code (single backticks)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold (double asterisks or underscores)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Italic (single asterisks)
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Strikethrough (double tildes)
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Auto-links (simple URLs)
  html = html.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Bullet lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Line breaks (convert \n to <br> for display)
  html = html.replace(/\n/g, '<br>');

  return html.trim();
}

/**
 * Convert HTML back to markdown (for editing)
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return "";

  let markdown = html;

  // Remove HTML tags and convert to markdown
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
  markdown = markdown.replace(/<\/p>/gi, '\n\n');
  markdown = markdown.replace(/<p[^>]*>/gi, '');

  // Code blocks
  markdown = markdown.replace(/<pre><code>([^<]*)<\/code><\/pre>/gi, '```$1```');

  // Inline code
  markdown = markdown.replace(/<code>([^<]*)<\/code>/gi, '`$1`');

  // Bold
  markdown = markdown.replace(/<strong>([^<]*)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b>([^<]*)<\/b>/gi, '**$1**');

  // Italic
  markdown = markdown.replace(/<em>([^<]*)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i>([^<]*)<\/i>/gi, '*$1*');

  // Strikethrough
  markdown = markdown.replace(/<del>([^<]*)<\/del>/gi, '~~$1~~');
  markdown = markdown.replace(/<s>([^<]*)<\/s>/gi, '~~$1~~');

  // Links
  markdown = markdown.replace(/<a[^>]+href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '[$2]($1)');

  // Lists
  markdown = markdown.replace(/<ul><li>([^<]*)<\/li><\/ul>/gi, '- $1');
  markdown = markdown.replace(/<ol><li>([^<]*)<\/li><\/ol>/gi, '1. $1');

  // Blockquotes
  markdown = markdown.replace(/<blockquote>([^<]*)<\/blockquote>/gi, '> $1');

  // Clean up extra whitespace
  markdown = markdown.replace(/\n\n+/g, '\n\n').trim();

  return markdown;
}

/**
 * Escape HTML characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Strip all HTML tags and return plain text
 */
export function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Get plain text preview of markdown (for notifications, etc.)
 */
export function getMarkdownPreview(markdown: string, maxLength: number = 100): string {
  if (!markdown) return "";

  // Remove markdown syntax
  let preview = markdown;

  // Remove code blocks
  preview = preview.replace(/```[^`]*```/g, '[code]');

  // Remove inline code
  preview = preview.replace(/`[^`]+`/g, '[code]');

  // Remove formatting but keep text
  preview = preview.replace(/\*\*([^*]+)\*\*/g, '$1');
  preview = preview.replace(/__([^_]+)__/g, '$1');
  preview = preview.replace(/\*([^*]+)\*/g, '$1');
  preview = preview.replace(/_([^_]+)_/g, '$1');
  preview = preview.replace(/~~([^~]+)~~/g, '$1');

  // Remove links but keep text
  preview = preview.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove list markers
  preview = preview.replace(/^[-*+] /gm, '');
  preview = preview.replace(/^\d+\. /gm, '');

  // Remove blockquote markers
  preview = preview.replace(/^> /gm, '');

  // Clean up whitespace
  preview = preview.replace(/\s+/g, ' ').trim();

  // Truncate if needed
  if (preview.length > maxLength) {
    preview = preview.slice(0, maxLength) + '...';
  }

  return preview;
}

/**
 * Validate if text contains valid markdown syntax
 */
export function isValidMarkdown(text: string): boolean {
  if (!text) return true;

  // Check for unclosed markdown syntax
  const boldCount = (text.match(/\*\*/g) || []).length;
  const italicCount = (text.match(/(?<!\*)\*(?!\*)/g) || []).length;
  const codeCount = (text.match(/`/g) || []).length;
  const strikeCount = (text.match(/~~/g) || []).length;

  // Check if markdown syntax is properly paired
  return (
    boldCount % 2 === 0 &&
    italicCount % 2 === 0 &&
    codeCount % 2 === 0 &&
    strikeCount % 2 === 0
  );
}