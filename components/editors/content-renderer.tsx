"use client"

import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

interface ContentRendererProps {
  content: string
  className?: string
  preview?: boolean // For card previews - strip formatting
  maxLength?: number // For previews
}

export function ContentRenderer({
  content,
  className,
  preview = false,
  maxLength
}: ContentRendererProps) {
  const [processedContent, setProcessedContent] = useState('')

  useEffect(() => {
    if (!content) {
      setProcessedContent('')
      return
    }

    // Convert all content to plain text
    let plainText = content

    // If it looks like HTML, strip tags
    if (content.includes('<')) {
      if (typeof window !== 'undefined') {
        const temp = document.createElement('div')
        temp.innerHTML = content
        plainText = temp.textContent || temp.innerText || ''
      } else {
        // SSR fallback - simple HTML tag removal
        plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      }
    }

    // If it looks like JSON (EditorJS), extract text from blocks
    if (content.trim().startsWith('{') && content.includes('"blocks"')) {
      try {
        const parsed = JSON.parse(content)
        if (parsed?.blocks && Array.isArray(parsed.blocks)) {
          plainText = parsed.blocks
            .map((block: any) => {
              if (block.data?.text) return block.data.text
              if (block.data?.items) return block.data.items.join(' ')
              if (block.data?.link) return block.data.link
              return ''
            })
            .filter((text: string) => text.trim())
            .join(' ')
            .replace(/<[^>]+>/g, '') // Remove any HTML tags
            .replace(/\s+/g, ' ')
            .trim()
        }
      } catch {
        // If JSON parsing fails, use as-is
      }
    }

    // Apply truncation for preview mode
    if (preview && maxLength && plainText.length > maxLength) {
      const truncated = plainText.substring(0, maxLength)
      const lastSpaceIndex = truncated.lastIndexOf(' ')

      if (lastSpaceIndex > maxLength * 0.8) {
        plainText = truncated.substring(0, lastSpaceIndex) + '...'
      } else {
        plainText = truncated + '...'
      }
    }

    setProcessedContent(plainText)
  }, [content, preview, maxLength])

  // For preview mode, render as muted text
  if (preview) {
    return (
      <div className={cn("text-muted-foreground", className)}>
        {processedContent}
      </div>
    )
  }

  // For full display, render as preformatted text with line breaks preserved
  return (
    <div className={cn(
      "whitespace-pre-wrap leading-relaxed text-foreground",
      className
    )}>
      {processedContent}
    </div>
  )
}

// Utility function to extract plain text preview from any content format
export function getContentPreview(content: string, maxLength: number = 150): string {
  if (!content) return ''

  let plainText = content

  // If it looks like HTML, strip tags
  if (content.includes('<')) {
    if (typeof window !== 'undefined') {
      const temp = document.createElement('div')
      temp.innerHTML = content
      plainText = temp.textContent || temp.innerText || ''
    } else {
      // SSR fallback - simple HTML tag removal
      plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }
  }

  // If it looks like JSON (EditorJS), extract text from blocks
  if (content.trim().startsWith('{') && content.includes('"blocks"')) {
    try {
      const parsed = JSON.parse(content)
      if (parsed?.blocks && Array.isArray(parsed.blocks)) {
        plainText = parsed.blocks
          .map((block: any) => {
            if (block.data?.text) return block.data.text
            if (block.data?.items) return block.data.items.join(' ')
            if (block.data?.link) return block.data.link
            return ''
          })
          .filter((text: string) => text.trim())
          .join(' ')
          .replace(/<[^>]+>/g, '') // Remove any HTML tags
          .replace(/\s+/g, ' ')
          .trim()
      }
    } catch {
      // If JSON parsing fails, use as-is
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

// Utility function to get plain text from content regardless of format
export function getPlainTextFromContent(content: string): string {
  if (!content) {
    return ''
  }

  let plainText = content

  // If it looks like HTML, strip tags
  if (content.includes('<')) {
    if (typeof window !== 'undefined') {
      const temp = document.createElement('div')
      temp.innerHTML = content
      plainText = temp.textContent || temp.innerText || ''
    } else {
      // SSR fallback - simple HTML tag removal
      plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }
  }

  // If it looks like JSON (EditorJS), extract text from blocks
  if (content.trim().startsWith('{') && content.includes('"blocks"')) {
    try {
      const parsed = JSON.parse(content)
      if (parsed?.blocks && Array.isArray(parsed.blocks)) {
        plainText = parsed.blocks
          .map((block: any) => {
            if (block.data?.text) return block.data.text
            if (block.data?.items) return block.data.items.join(' ')
            if (block.data?.link) return block.data.link
            return ''
          })
          .filter((text: string) => text.trim())
          .join(' ')
          .replace(/<[^>]+>/g, '') // Remove any HTML tags
          .replace(/\s+/g, ' ')
          .trim()
      }
    } catch {
      // If JSON parsing fails, use as-is
    }
  }

  return plainText
}