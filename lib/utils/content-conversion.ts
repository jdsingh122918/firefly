/**
 * Unified Content Conversion Utility
 *
 * Consolidates all content format conversions across the application:
 * - Editor.js JSON ↔ HTML
 * - Markdown ↔ HTML
 * - Any format → Plain text
 * - Format detection and validation
 * - Content sanitization
 */

// Core types
export interface EditorJSData {
  blocks: Array<{
    id?: string
    type: string
    data: any
  }>
  version?: string
}

export interface EditorJSBlock {
  id?: string
  type: string
  data: any
}

export type ContentFormat = 'editorjs' | 'html' | 'markdown' | 'plaintext'

export interface ConversionOptions {
  sanitize?: boolean
  allowedTags?: string[]
  maxLength?: number
  preserveFormatting?: boolean
}

export interface ContentInfo {
  format: ContentFormat
  characterCount: number
  wordCount: number
  isValid: boolean
  preview: string
}

// Format Detection
class ContentDetector {
  static detectFormat(content: string): ContentFormat {
    if (!content || content.trim() === '') {
      return 'plaintext'
    }

    // Try to parse as Editor.js JSON
    try {
      const parsed = JSON.parse(content)
      if (parsed?.blocks && Array.isArray(parsed.blocks)) {
        return 'editorjs'
      }
    } catch {
      // Not valid JSON, continue checking
    }

    // Check for HTML tags
    if (/<[^>]+>/g.test(content)) {
      return 'html'
    }

    // Check for common markdown patterns
    const markdownPatterns = [
      /^\s*#+ /, // Headers
      /\*\*.*\*\*/, // Bold
      /\*.*\*/, // Italic
      /`.*`/, // Code
      /^\s*[-*+] /, // Lists
      /^\s*\d+\. /, // Numbered lists
      /^\s*> /, // Blockquotes
      /\[.*\]\(.*\)/, // Links
    ]

    if (markdownPatterns.some(pattern => pattern.test(content))) {
      return 'markdown'
    }

    return 'plaintext'
  }

  static isEditorJSContent(content: string): boolean {
    try {
      const parsed = JSON.parse(content)
      return parsed?.blocks && Array.isArray(parsed.blocks)
    } catch {
      return false
    }
  }

  static isValidMarkdown(content: string): boolean {
    if (!content) return true

    // Check for unclosed markdown syntax
    const boldCount = (content.match(/\*\*/g) || []).length
    const italicCount = (content.match(/(?<!\*)\*(?!\*)/g) || []).length
    const codeCount = (content.match(/`/g) || []).length
    const strikeCount = (content.match(/~~/g) || []).length

    return (
      boldCount % 2 === 0 &&
      italicCount % 2 === 0 &&
      codeCount % 2 === 0 &&
      strikeCount % 2 === 0
    )
  }
}

// HTML Sanitization
class HtmlSanitizer {
  static sanitize(html: string, options: ConversionOptions = {}): string {
    if (!html) return ''

    let sanitized = html

    // Remove script tags
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

    // Remove potentially dangerous attributes
    sanitized = sanitized.replace(/(on\w+|javascript:)[^>]*/gi, '')

    // If allowed tags are specified, remove others
    if (options.allowedTags) {
      const allowedPattern = options.allowedTags.join('|')
      const tagRegex = new RegExp(`<(?!\/?(?:${allowedPattern})(?:\s|>))[^>]*>`, 'gi')
      sanitized = sanitized.replace(tagRegex, '')
    }

    return sanitized.trim()
  }

  static stripHtml(html: string): string {
    if (!html) return ''
    return html.replace(/<[^>]*>/g, '').trim()
  }

  static escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return text.replace(/[&<>"']/g, (m) => map[m])
  }
}

// Editor.js Converters
class EditorJSConverter {
  static toHTML(data: EditorJSData, options: ConversionOptions = {}): string {
    if (!data?.blocks || data.blocks.length === 0) {
      return ''
    }

    const htmlParts = data.blocks.map(block => {
      switch (block.type) {
        case 'paragraph':
          return `<p>${block.data.text || ''}</p>`

        case 'header':
          const level = Math.min(Math.max(block.data.level || 2, 1), 6)
          return `<h${level}>${block.data.text || ''}</h${level}>`

        case 'list':
          const tag = block.data.style === 'ordered' ? 'ol' : 'ul'
          const items = block.data.items?.map((item: string) => `<li>${item}</li>`).join('') || ''
          return `<${tag}>${items}</${tag}>`

        case 'quote':
          return `<blockquote>${block.data.text || ''}</blockquote>`

        case 'linkTool':
          const url = block.data.link || ''
          const title = block.data.meta?.title || block.data.link || ''
          const description = block.data.meta?.description || ''
          return `<div class="link-preview">
            <a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a>
            ${description ? `<p>${description}</p>` : ''}
          </div>`

        case 'checklist':
          const checkItems = block.data.items?.map((item: any) =>
            `<li><input type="checkbox" ${item.checked ? 'checked' : ''} disabled> ${item.text}</li>`
          ).join('') || ''
          return `<ul class="checklist">${checkItems}</ul>`

        case 'table':
          const content = block.data.content || []
          const withHeadings = block.data.withHeadings
          const rows = content.map((row: string[], index: number) => {
            const tag = withHeadings && index === 0 ? 'th' : 'td'
            const cells = row.map(cell => `<${tag}>${cell}</${tag}>`).join('')
            return `<tr>${cells}</tr>`
          }).join('')
          return `<table>${rows}</table>`

        case 'image':
          const imageUrl = block.data.file?.url || ''
          const caption = block.data.caption || ''
          return `<figure>
            <img src="${imageUrl}" alt="${caption}" />
            ${caption ? `<figcaption>${caption}</figcaption>` : ''}
          </figure>`

        case 'delimiter':
          return '<hr />'

        case 'warning':
          const warningTitle = block.data.title || 'Warning'
          const message = block.data.message || ''
          return `<div class="warning">
            <strong>${warningTitle}</strong>
            ${message ? `<p>${message}</p>` : ''}
          </div>`

        default:
          // Fallback for unknown blocks
          const text = block.data.text || JSON.stringify(block.data)
          return `<p>${text}</p>`
      }
    })

    const html = htmlParts.join('\n')
    return options.sanitize !== false ? HtmlSanitizer.sanitize(html, options) : html
  }

  static fromHTML(html: string, options: ConversionOptions = {}): EditorJSData {
    if (!html || html.trim() === '') {
      return { blocks: [] }
    }

    // Simple HTML to blocks conversion
    // This is a basic implementation - could be enhanced with proper HTML parsing
    const blocks: EditorJSBlock[] = []
    const lines = html.split(/\n+/).filter(line => line.trim())

    lines.forEach((line, index) => {
      const trimmed = line.trim()

      // Headers
      const headerMatch = trimmed.match(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/i)
      if (headerMatch) {
        blocks.push({
          id: `block_${index}`,
          type: 'header',
          data: {
            level: parseInt(headerMatch[1]),
            text: HtmlSanitizer.stripHtml(headerMatch[2])
          }
        })
        return
      }

      // Lists
      if (trimmed.match(/<[ou]l[^>]*>/i)) {
        const items = trimmed.match(/<li[^>]*>(.*?)<\/li>/gi)?.map(item =>
          HtmlSanitizer.stripHtml(item.replace(/<\/?li[^>]*>/gi, ''))
        ) || []

        blocks.push({
          id: `block_${index}`,
          type: 'list',
          data: {
            style: trimmed.includes('<ol') ? 'ordered' : 'unordered',
            items
          }
        })
        return
      }

      // Blockquotes
      const quoteMatch = trimmed.match(/<blockquote[^>]*>(.*?)<\/blockquote>/i)
      if (quoteMatch) {
        blocks.push({
          id: `block_${index}`,
          type: 'quote',
          data: {
            text: HtmlSanitizer.stripHtml(quoteMatch[1])
          }
        })
        return
      }

      // Paragraphs or text
      if (trimmed && !trimmed.match(/^<[^>]+>$/)) {
        blocks.push({
          id: `block_${index}`,
          type: 'paragraph',
          data: {
            text: HtmlSanitizer.stripHtml(trimmed)
          }
        })
      }
    })

    return { blocks }
  }
}

// Markdown Converters
class MarkdownConverter {
  static toHTML(markdown: string, options: ConversionOptions = {}): string {
    if (!markdown) return ''

    let html = markdown

    // Escape HTML to prevent XSS
    if (options.sanitize !== false) {
      html = HtmlSanitizer.escapeHtml(html)
    }

    // Convert markdown patterns to HTML
    // Code blocks (triple backticks)
    html = html.replace(/```([^`]*)```/g, '<pre><code>$1</code></pre>')

    // Inline code (single backticks)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

    // Bold (double asterisks or underscores)
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>')

    // Italic (single asterisks)
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>')

    // Strikethrough (double tildes)
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>')

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

    // Auto-links (simple URLs)
    html = html.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    )

    // Bullet lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')

    // Numbered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ol>$1</ol>')

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')

    // Line breaks
    html = html.replace(/\n/g, '<br>')

    return html.trim()
  }

  static fromHTML(html: string, options: ConversionOptions = {}): string {
    if (!html) return ''

    let markdown = html

    // Convert HTML tags back to markdown
    markdown = markdown.replace(/<br\s*\/?>/gi, '\n')
    markdown = markdown.replace(/<\/p>/gi, '\n\n')
    markdown = markdown.replace(/<p[^>]*>/gi, '')

    // Code blocks
    markdown = markdown.replace(/<pre><code>([^<]*)<\/code><\/pre>/gi, '```$1```')

    // Inline code
    markdown = markdown.replace(/<code>([^<]*)<\/code>/gi, '`$1`')

    // Bold
    markdown = markdown.replace(/<strong>([^<]*)<\/strong>/gi, '**$1**')
    markdown = markdown.replace(/<b>([^<]*)<\/b>/gi, '**$1**')

    // Italic
    markdown = markdown.replace(/<em>([^<]*)<\/em>/gi, '*$1*')
    markdown = markdown.replace(/<i>([^<]*)<\/i>/gi, '*$1*')

    // Strikethrough
    markdown = markdown.replace(/<del>([^<]*)<\/del>/gi, '~~$1~~')
    markdown = markdown.replace(/<s>([^<]*)<\/s>/gi, '~~$1~~')

    // Links
    markdown = markdown.replace(/<a[^>]+href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '[$2]($1)')

    // Lists
    markdown = markdown.replace(/<ul><li>([^<]*)<\/li><\/ul>/gi, '- $1')
    markdown = markdown.replace(/<ol><li>([^<]*)<\/li><\/ol>/gi, '1. $1')

    // Blockquotes
    markdown = markdown.replace(/<blockquote>([^<]*)<\/blockquote>/gi, '> $1')

    // Clean up extra whitespace
    markdown = markdown.replace(/\n\n+/g, '\n\n').trim()

    return markdown
  }
}

// Universal Content Converter
class ContentConverter {
  static convert(
    content: string,
    fromFormat: ContentFormat,
    toFormat: ContentFormat,
    options: ConversionOptions = {}
  ): string {
    if (!content || fromFormat === toFormat) return content

    // Convert to HTML as intermediate format if needed
    let html: string

    switch (fromFormat) {
      case 'editorjs':
        try {
          const data = JSON.parse(content)
          html = EditorJSConverter.toHTML(data, options)
        } catch {
          return content // Return original if parsing fails
        }
        break

      case 'markdown':
        html = MarkdownConverter.toHTML(content, options)
        break

      case 'html':
        html = content
        break

      case 'plaintext':
        html = HtmlSanitizer.escapeHtml(content).replace(/\n/g, '<br>')
        break

      default:
        return content
    }

    // Convert from HTML to target format
    switch (toFormat) {
      case 'html':
        return options.sanitize !== false ? HtmlSanitizer.sanitize(html, options) : html

      case 'markdown':
        return MarkdownConverter.fromHTML(html, options)

      case 'editorjs':
        const data = EditorJSConverter.fromHTML(html, options)
        return JSON.stringify(data)

      case 'plaintext':
        return HtmlSanitizer.stripHtml(html)

      default:
        return html
    }
  }

  static autoConvert(content: string, toFormat: ContentFormat, options: ConversionOptions = {}): string {
    const fromFormat = ContentDetector.detectFormat(content)
    return this.convert(content, fromFormat, toFormat, options)
  }

  static getInfo(content: string): ContentInfo {
    const format = ContentDetector.detectFormat(content)
    const plainText = this.autoConvert(content, 'plaintext')

    return {
      format,
      characterCount: plainText.length,
      wordCount: plainText.split(/\s+/).filter(Boolean).length,
      isValid: format === 'markdown' ? ContentDetector.isValidMarkdown(content) : true,
      preview: this.getPreview(content, format)
    }
  }

  static getPreview(content: string, format?: ContentFormat, maxLength: number = 100): string {
    const actualFormat = format || ContentDetector.detectFormat(content)
    const plainText = this.autoConvert(content, 'plaintext')

    if (plainText.length <= maxLength) return plainText
    return plainText.slice(0, maxLength) + '...'
  }
}

// Export all utilities
export {
  ContentDetector,
  HtmlSanitizer,
  EditorJSConverter,
  MarkdownConverter,
  ContentConverter
}

// Legacy compatibility exports
export const sanitizeHtml = HtmlSanitizer.sanitize
export const htmlToPlainText = HtmlSanitizer.stripHtml
export const countHtmlCharacters = (html: string) => HtmlSanitizer.stripHtml(html).length
export const markdownToHtml = MarkdownConverter.toHTML
export const htmlToMarkdown = MarkdownConverter.fromHTML
export const stripHtml = HtmlSanitizer.stripHtml