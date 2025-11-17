"use client"

import { cn } from '@/lib/utils'
import DOMPurify from 'dompurify'
import { useEffect, useState } from 'react'

// Note: Draft.js support removed - all content migrated to Editor.js format

// Editor.js utilities
import {
  editorJSToHTML,
  getEditorJSCharacterCount,
  validateEditorJSData,
  type EditorJSData
} from '@/lib/utils/editor-migration'

interface ContentRendererProps {
  content: string
  contentFormat?: 'html' | 'editorjs' | 'auto' // Auto-detect by default (Draft.js support removed)
  className?: string
  preview?: boolean // For card previews - strip formatting
  maxLength?: number // For previews
}

// Note: Draft.js detection function removed - all content migrated to Editor.js format

// Helper function to detect if string is Editor.js JSON
const isEditorJSContent = (content: string): boolean => {
  if (!content || typeof content !== 'string') return false
  try {
    const parsed = JSON.parse(content)
    // Editor.js has blocks array and optional version, but no entityMap
    if (parsed && typeof parsed === 'object' && 'blocks' in parsed && Array.isArray(parsed.blocks)) {
      // Check if it's NOT Draft.js (which also has blocks but with different structure)
      if ('entityMap' in parsed) return false // This is Draft.js

      // Validate it's proper Editor.js format
      const validation = validateEditorJSData(parsed)
      return validation.isValid
    }
    return false
  } catch {
    return false
  }
}

// Note: Draft.js conversion functions removed - all content migrated to Editor.js format

// Helper function to convert Editor.js content to HTML
const convertEditorJSToHTML = (editorJSContent: string): string => {
  try {
    const parsed = JSON.parse(editorJSContent) as EditorJSData
    return editorJSToHTML(parsed)
  } catch (error) {
    console.warn('Error converting Editor.js to HTML:', error)
    return ''
  }
}

// Helper function to get plain text from Editor.js content
const getEditorJSPlainText = (editorJSContent: string): string => {
  try {
    const parsed = JSON.parse(editorJSContent) as EditorJSData

    if (!parsed?.blocks) return ''

    // Extract text from all blocks
    const plainText = parsed.blocks
      .map(block => {
        switch (block.type) {
          case 'paragraph':
          case 'header':
          case 'quote':
            return block.data.text || ''
          case 'list':
            return block.data.items?.join(' ') || ''
          case 'linkTool':
            return block.data.meta?.title || block.data.link || ''
          default:
            return block.data.text || ''
        }
      })
      .filter(text => text.trim()) // Remove empty strings
      .join(' ')
      .replace(/<[^>]+>/g, '') // Remove any HTML tags from text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()

    return plainText
  } catch (error) {
    console.warn('Error getting plain text from Editor.js:', error)
    return ''
  }
}

// Helper function to get plain text from HTML
const getHTMLPlainText = (htmlContent: string): string => {
  if (typeof window === 'undefined') {
    // SSR fallback - proper HTML tag removal like in getContentPreview
    const result = htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return result
  }

  const temp = document.createElement('div')
  temp.innerHTML = htmlContent
  const result = temp.textContent || temp.innerText || ''

  return result
}

export function ContentRenderer({
  content,
  contentFormat = 'auto',
  className,
  preview = false,
  maxLength
}: ContentRendererProps) {
  const [processedContent, setProcessedContent] = useState('')
  const [isClient, setIsClient] = useState(false)
  const [detectedFormat, setDetectedFormat] = useState<'html' | 'editorjs'>('html')

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!content || !isClient) {
      setProcessedContent('')
      return
    }

    // Auto-detect format if not specified
    let format = contentFormat
    if (format === 'auto') {
      if (isEditorJSContent(content)) {
        format = 'editorjs'
      } else {
        format = 'html'
      }
    }
    setDetectedFormat(format as 'html' | 'editorjs')

    let htmlContent: string
    let plainText: string

    // Convert to HTML and get plain text based on format
    if (format === 'editorjs') {
      htmlContent = convertEditorJSToHTML(content)
      plainText = getEditorJSPlainText(content)
    } else {
      htmlContent = content
      plainText = getHTMLPlainText(content)
    }

    // Process content based on preview mode
    if (preview) {
      // For previews, use plain text and truncate if needed
      let previewText = plainText
      if (maxLength && previewText.length > maxLength) {
        // Find the last complete word before the limit
        const truncated = previewText.substring(0, maxLength)
        const lastSpaceIndex = truncated.lastIndexOf(' ')

        if (lastSpaceIndex > maxLength * 0.8) {
          previewText = truncated.substring(0, lastSpaceIndex) + '...'
        } else {
          previewText = truncated + '...'
        }
      }
      setProcessedContent(previewText)
    } else {
      // For full display, sanitize HTML
      const sanitized = DOMPurify.sanitize(htmlContent, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote', 'a'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
        ADD_ATTR: ['target'], // Allow target="_blank" for external links
      })
      setProcessedContent(sanitized)
    }
  }, [content, contentFormat, isClient, preview, maxLength])

  // Handle server-side rendering
  if (!isClient) {
    return (
      <div className={cn("animate-pulse bg-muted rounded h-4", className)} />
    )
  }

  // For preview mode, render as plain text
  if (preview) {
    return (
      <div className={cn("text-muted-foreground", className)}>
        {processedContent}
      </div>
    )
  }

  // For full display, render HTML
  return (
    <div
      className={cn(
        // Base prose styles
        "prose prose-sm max-w-none",

        // Paragraph styles
        "prose-p:my-2 prose-p:leading-relaxed prose-p:text-foreground",

        // Heading styles
        "prose-headings:text-foreground prose-headings:font-semibold",
        "prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-4",
        "prose-h3:text-lg prose-h3:mt-4 prose-h3:mb-3",

        // List styles
        "prose-ul:my-3 prose-ol:my-3 prose-li:my-1",
        "prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground",

        // Quote styles
        "prose-blockquote:border-l-4 prose-blockquote:border-border",
        "prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground",
        "prose-blockquote:my-4",

        // Link styles
        "prose-a:text-primary prose-a:underline prose-a:underline-offset-2",
        "hover:prose-a:text-primary/80 prose-a:transition-colors",

        // Strong and emphasis
        "prose-strong:text-foreground prose-strong:font-semibold",
        "prose-em:text-foreground",

        className
      )}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  )
}

// Utility function to extract plain text preview from any content format
export function getContentPreview(content: string, contentFormat: 'html' | 'draftjs' | 'editorjs' | 'auto' = 'auto', maxLength: number = 150): string {
  if (!content) return ''

  let format = contentFormat
  if (format === 'auto') {
    if (isEditorJSContent(content)) {
      format = 'editorjs'
    } else if (isDraftJSContent(content)) {
      format = 'draftjs'
    } else {
      format = 'html'
    }
  }

  let plainText: string
  if (format === 'draftjs') {
    plainText = getDraftJSPlainText(content)
  } else if (format === 'editorjs') {
    plainText = getEditorJSPlainText(content)
  } else {
    if (typeof window === 'undefined') {
      // SSR fallback - simple HTML tag removal
      plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    } else {
      plainText = getHTMLPlainText(content)
    }
  }

  // Truncate and add ellipsis if needed
  if (plainText.length <= maxLength) {
    return plainText
  }

  // Find the last complete word before the limit
  const truncated = plainText.substring(0, maxLength)
  const lastSpaceIndex = truncated.lastIndexOf(' ')

  if (lastSpaceIndex > maxLength * 0.8) {
    return truncated.substring(0, lastSpaceIndex) + '...'
  } else {
    return truncated + '...'
  }
}

// Utility function to check if content contains only plain text
export function isPlainTextContent(content: string, contentFormat: 'html' | 'draftjs' | 'editorjs' | 'auto' = 'auto'): boolean {
  if (!content) return true

  let format = contentFormat
  if (format === 'auto') {
    if (isEditorJSContent(content)) {
      format = 'editorjs'
    } else if (isDraftJSContent(content)) {
      format = 'draftjs'
    } else {
      format = 'html'
    }
  }

  if (format === 'draftjs') {
    try {
      const rawContent = JSON.parse(content)
      const contentState = convertFromRaw(rawContent)
      const blocks = contentState.getBlocksAsArray()

      // Check if all blocks are unstyled and have no entities
      return blocks.every(block =>
        block.getType() === 'unstyled' &&
        block.getCharacterList().every(char =>
          char.getStyle().size === 0 && !char.getEntity()
        )
      )
    } catch {
      return true
    }
  } else if (format === 'editorjs') {
    try {
      const parsed = JSON.parse(content) as EditorJSData

      // Check if all blocks are simple paragraph blocks with no special formatting
      return parsed.blocks.every(block =>
        block.type === 'paragraph' &&
        typeof block.data.text === 'string' &&
        !block.data.text.includes('<') // No HTML tags in text
      )
    } catch {
      return true
    }
  } else {
    // For HTML content, use the same logic as the original
    const withoutBasicTags = content.replace(/<\/?p>/g, '').trim()
    const hasHtmlTags = /<[^>]+>/.test(withoutBasicTags)
    return !hasHtmlTags
  }
}

// Utility function to auto-detect content format
export function detectContentFormat(content: string): 'html' | 'draftjs' | 'editorjs' {
  if (isEditorJSContent(content)) {
    return 'editorjs'
  } else if (isDraftJSContent(content)) {
    return 'draftjs'
  } else {
    return 'html'
  }
}

// Utility function to convert content to HTML regardless of format
export function convertContentToHTML(content: string, contentFormat: 'html' | 'draftjs' | 'editorjs' | 'auto' = 'auto'): string {
  if (!content) return ''

  let format = contentFormat
  if (format === 'auto') {
    if (isEditorJSContent(content)) {
      format = 'editorjs'
    } else if (isDraftJSContent(content)) {
      format = 'draftjs'
    } else {
      format = 'html'
    }
  }

  if (format === 'draftjs') {
    return convertDraftJSToHTML(content)
  } else if (format === 'editorjs') {
    return convertEditorJSToHTML(content)
  } else {
    return content
  }
}

// Utility function to get plain text from content regardless of format
export function getPlainTextFromContent(content: string, contentFormat: 'html' | 'draftjs' | 'editorjs' | 'auto' = 'auto'): string {
  if (!content) {
    return ''
  }

  let format = contentFormat
  if (format === 'auto') {
    if (isEditorJSContent(content)) {
      format = 'editorjs'
    } else if (isDraftJSContent(content)) {
      format = 'draftjs'
    } else {
      format = 'html'
    }
  }

  let result: string
  if (format === 'draftjs') {
    result = getDraftJSPlainText(content)
  } else if (format === 'editorjs') {
    result = getEditorJSPlainText(content)
  } else {
    result = getHTMLPlainText(content)
  }

  return result
}