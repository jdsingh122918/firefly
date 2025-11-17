"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

type EditorConfigPreset = 'full' | 'minimal' | 'reply' | 'chat'

interface EditorJSEditorProps {
  content?: string
  onChange?: (content: string) => void
  placeholder?: string
  maxLength?: number
  className?: string
  disabled?: boolean
  preset?: EditorConfigPreset
}

interface EditorJSData {
  blocks: Array<{
    id?: string
    type: string
    data: any
  }>
  version?: string
}

// Configuration presets for different use cases
const getEditorConfig = (preset: EditorConfigPreset = 'full') => {
  const baseConfig = {
    paragraph: {
      class: null, // Will be set during import
      inlineToolbar: true
    }
  }

  switch (preset) {
    case 'minimal':
      return {
        ...baseConfig,
        // Only paragraph and link tools for chat
        linkTool: {
          class: null // Will be set during import
        }
      }

    case 'chat':
      return {
        ...baseConfig,
        // Ultra-compact chat preset - paragraph only, no inline toolbar
        // Remove linkTool to reduce functionality and size
      }

    case 'reply':
      return {
        ...baseConfig,
        // Reply forms: paragraph, lists, links, H3 only
        header: {
          class: null, // Will be set during import
          config: {
            levels: [3],
            defaultLevel: 3
          }
        },
        list: {
          class: null, // Will be set during import
          inlineToolbar: true
        },
        linkTool: {
          class: null // Will be set during import
        }
      }

    case 'full':
    default:
      return {
        ...baseConfig,
        // Full configuration: all tools
        header: {
          class: null, // Will be set during import
          config: {
            levels: [2, 3],
            defaultLevel: 2
          }
        },
        list: {
          class: null, // Will be set during import
          inlineToolbar: true
        },
        linkTool: {
          class: null // Will be set during import
        },
        quote: {
          class: null, // Will be set during import
          inlineToolbar: true
        }
      }
  }
}

export function EditorJSEditor({
  content = '',
  onChange,
  placeholder = 'Start writing...',
  maxLength = 50000,
  className,
  disabled = false,
  preset = 'full'
}: EditorJSEditorProps) {
  const editorRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const [editor, setEditor] = useState<any>(null)
  const [characterCount, setCharacterCount] = useState(0)
  const [isReady, setIsReady] = useState(false)
  const [isClientReady, setIsClientReady] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)

  // Get appropriate min-height based on preset
  const getMinHeight = useCallback(() => {
    switch (preset) {
      case 'chat':
        return 'min-h-[32px] max-h-[40px]' // Ultra-compact for inline chat input
      case 'minimal':
        return 'min-h-[44px]' // Very compact height for chat input - just enough for one line
      case 'reply':
        return 'min-h-[80px]' // Medium height for reply forms
      default:
        return 'min-h-[200px]' // Full height for rich content
    }
  }, [preset])

  // Update onChange ref when it changes
  onChangeRef.current = onChange

  // Track client-side hydration
  useEffect(() => {
    setIsClientReady(true)
  }, [])

  // Convert Editor.js JSON to HTML
  const convertToHTML = useCallback((data: EditorJSData): string => {
    if (!data?.blocks || data.blocks.length === 0) {
      return ''
    }

    const htmlParts = data.blocks.map(block => {
      switch (block.type) {
        case 'paragraph':
          return `<p>${block.data.text || ''}</p>`
        case 'header':
          const level = block.data.level || 2
          return `<h${level}>${block.data.text || ''}</h${level}>`
        case 'list':
          const tag = block.data.style === 'ordered' ? 'ol' : 'ul'
          const items = block.data.items?.map((item: string) => `<li>${item}</li>`).join('') || ''
          return `<${tag}>${items}</${tag}>`
        case 'quote':
          return `<blockquote>${block.data.text || ''}</blockquote>`
        case 'linkTool':
          return `<p><a href="${block.data.link || ''}" target="_blank" rel="noopener noreferrer">${block.data.meta?.title || block.data.link || ''}</a></p>`
        default:
          return `<p>${block.data.text || ''}</p>`
      }
    })

    return htmlParts.join('\n')
  }, [])

  // Convert HTML to Editor.js JSON with proper link parsing
  const convertFromHTML = useCallback((html: string): EditorJSData => {
    if (!html || html.trim() === '') {
      return { blocks: [] }
    }

    const blocks: any[] = []

    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html

    // Get all direct children (block elements)
    const children = Array.from(tempDiv.children)

    if (children.length === 0) {
      // No block elements, treat as single paragraph
      const text = html.replace(/<[^>]+>/g, '').trim()
      if (text) {
        blocks.push({
          type: 'paragraph',
          data: { text }
        })
      }
    } else {
      children.forEach((element) => {
        const tagName = element.tagName.toLowerCase()

        switch (tagName) {
          case 'p': {
            // Check if paragraph contains a single link
            const links = element.querySelectorAll('a')
            const textContent = element.textContent?.trim() || ''

            if (links.length === 1 && textContent === (links[0].textContent?.trim() || '')) {
              // Single link that makes up the whole paragraph - convert to linkTool
              const link = links[0] as HTMLAnchorElement
              const url = link.href || link.getAttribute('href') || ''
              const title = link.textContent?.trim() || url

              if (url) {
                blocks.push({
                  type: 'linkTool',
                  data: {
                    link: url,
                    meta: {
                      title: title,
                      description: '',
                      image: {
                        url: ''
                      }
                    }
                  }
                })
                break
              }
            }

            // Regular paragraph (may contain inline links)
            const innerHTML = element.innerHTML
            blocks.push({
              type: 'paragraph',
              data: { text: innerHTML }
            })
            break
          }

          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6': {
            const level = parseInt(tagName.charAt(1))
            blocks.push({
              type: 'header',
              data: {
                text: element.textContent?.trim() || '',
                level: level <= 3 ? level : 3 // Limit to h3 for supported levels
              }
            })
            break
          }

          case 'blockquote': {
            blocks.push({
              type: 'quote',
              data: { text: element.textContent?.trim() || '' }
            })
            break
          }

          case 'ul':
          case 'ol': {
            const items = Array.from(element.querySelectorAll('li')).map(li =>
              li.textContent?.trim() || ''
            )
            blocks.push({
              type: 'list',
              data: {
                style: tagName === 'ul' ? 'unordered' : 'ordered',
                items
              }
            })
            break
          }

          default: {
            // Fallback to paragraph
            const text = element.textContent?.trim() || ''
            if (text) {
              blocks.push({
                type: 'paragraph',
                data: { text }
              })
            }
          }
        }
      })
    }

    return { blocks: blocks.length > 0 ? blocks : [] }
  }, [])

  // Sanitize EditorJS data to ensure valid block structures
  const sanitizeEditorData = useCallback((data: EditorJSData): EditorJSData => {
    if (!data?.blocks) {
      return { blocks: [] }
    }

    const sanitizedBlocks = data.blocks.filter(block => {
      if (!block.type || !block.data) {
        return false
      }

      // Validate linkTool blocks specifically
      if (block.type === 'linkTool') {
        const { data: blockData } = block

        // Ensure required fields exist
        if (!blockData.link || typeof blockData.link !== 'string') {
          return false
        }

        // Ensure meta structure is valid
        if (!blockData.meta || typeof blockData.meta !== 'object') {
          // Fix missing or invalid meta
          block.data.meta = {
            title: blockData.link,
            description: '',
            image: {
              url: ''
            }
          }
        } else {
          // Ensure required meta fields
          if (!blockData.meta.title) {
            blockData.meta.title = blockData.link
          }
          if (!blockData.meta.description) {
            blockData.meta.description = ''
          }
          if (!blockData.meta.image || typeof blockData.meta.image !== 'object') {
            blockData.meta.image = { url: '' }
          }
        }
      }

      // Validate other block types
      switch (block.type) {
        case 'paragraph':
          return typeof block.data.text === 'string'
        case 'header':
          return typeof block.data.text === 'string' && typeof block.data.level === 'number'
        case 'list':
          return Array.isArray(block.data.items) && typeof block.data.style === 'string'
        case 'quote':
          return typeof block.data.text === 'string'
        default:
          return true // Allow other blocks to pass through
      }
    })

    return { blocks: sanitizedBlocks }
  }, [])

  // Calculate character count from Editor.js data
  const getCharacterCount = useCallback((data: EditorJSData): number => {
    if (!data?.blocks) return 0

    return data.blocks.reduce((count, block) => {
      let blockText = ''
      switch (block.type) {
        case 'paragraph':
        case 'header':
        case 'quote':
          blockText = block.data.text || ''
          break
        case 'list':
          blockText = block.data.items?.join(' ') || ''
          break
        case 'linkTool':
          blockText = block.data.meta?.title || block.data.link || ''
          break
        default:
          blockText = block.data.text || ''
      }
      // Remove HTML tags and count characters
      return count + blockText.replace(/<[^>]+>/g, '').length
    }, 0)
  }, [])

  // Initialize Editor.js
  useEffect(() => {
    if (!containerRef.current || editor || !isClientReady) {
      return
    }

    const initEditor = async () => {
      try {
        setInitError(null) // Clear any previous errors
        // Dynamic imports for Editor.js modules
        const [
          { default: EditorJSClass },
          { default: HeaderClass },
          { default: ListClass },
          { default: ParagraphClass },
          { default: LinkToolClass },
          { default: QuoteClass }
        ] = await Promise.all([
          import('@editorjs/editorjs'),
          import('@editorjs/header'),
          import('@editorjs/list'),
          import('@editorjs/paragraph'),
          import('@editorjs/link'),
          import('@editorjs/quote')
        ])

        const rawInitialData = content ? convertFromHTML(content) : { blocks: [] }
        const initialData = sanitizeEditorData(rawInitialData)

        // Get configuration for the preset
        const configTemplate = getEditorConfig(preset)

        // Build tools object with actual imported classes
        const tools: any = {}

        if (configTemplate.paragraph) {
          tools.paragraph = {
            class: ParagraphClass,
            inlineToolbar: configTemplate.paragraph.inlineToolbar
          }
        }

        if (configTemplate.header) {
          tools.header = {
            class: HeaderClass,
            config: configTemplate.header.config
          }
        }

        if (configTemplate.list) {
          tools.list = {
            class: ListClass,
            inlineToolbar: configTemplate.list.inlineToolbar
          }
        }

        if (configTemplate.linkTool) {
          tools.linkTool = {
            class: LinkToolClass
          }
        }

        if (configTemplate.quote) {
          tools.quote = {
            class: QuoteClass,
            inlineToolbar: configTemplate.quote.inlineToolbar
          }
        }

        const editorInstance = new EditorJSClass({
          holder: containerRef.current!,
          placeholder,
          data: initialData,
          readOnly: disabled,
          tools,
          onChange: async () => {
            if (!onChangeRef.current) return

            try {
              const data = await editorInstance.save()
              const html = convertToHTML(data)
              const charCount = getCharacterCount(data)

              setCharacterCount(charCount)
              onChangeRef.current(html)
            } catch (error) {
              console.error('Error saving editor content:', error)
            }
          }
        })

        // Wait for editor to be ready with timeout
        try {
          await Promise.race([
            editorInstance.isReady,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Editor initialization timeout')), 10000)
            )
          ])
        } catch (timeoutError) {
          console.warn('⚠️ Editor initialization timeout, proceeding anyway:', timeoutError)
          // Continue with initialization even if timeout occurs
        }

        editorRef.current = editorInstance
        setEditor(editorInstance)
        setIsReady(true)

        // Set initial character count
        const charCount = getCharacterCount(initialData)
        setCharacterCount(charCount)

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        console.error('❌ Error initializing Editor.js:', error)
        console.error('Error details:', {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          containerRef: !!containerRef.current,
          isClientReady,
          preset,
          placeholder,
          disabled
        })

        setInitError(errorMessage)
        setIsReady(true) // Prevent infinite loading
      }
    }

    initEditor()

    // Cleanup
    return () => {
      if (editorRef.current && editorRef.current.destroy) {
        editorRef.current.destroy()
        editorRef.current = null
        setEditor(null)
        setIsReady(false)
      }
    }
  }, [placeholder, disabled, preset, isClientReady])

  // Character limit warnings
  const isNearLimit = characterCount > maxLength * 0.8 && characterCount <= maxLength * 0.9
  const isCloseToLimit = characterCount > maxLength * 0.9 && characterCount <= maxLength * 0.95
  const isVeryCloseToLimit = characterCount > maxLength * 0.95 && characterCount <= maxLength
  const isOverLimit = characterCount > maxLength

  const getCharacterCountColor = () => {
    if (isOverLimit) return 'text-destructive'
    if (isVeryCloseToLimit) return 'text-red-600'
    if (isCloseToLimit) return 'text-orange-600'
    if (isNearLimit) return 'text-yellow-600'
    return 'text-muted-foreground'
  }

  // Handle hydration by ensuring consistent initial render
  if (typeof window === 'undefined' || !isClientReady) {
    return (
      <div className={cn("border rounded-md bg-background", className)}>
        {/* Character Counter - only for non-chat presets */}
        {preset !== 'chat' && (
          <div className="flex justify-end items-center px-3 py-2 border-b text-xs">
            <span className="text-muted-foreground">
              0/{maxLength.toLocaleString()} characters
            </span>
          </div>
        )}

        {/* Editor Container - adjusted styling for chat preset */}
        <div
          className={`${preset === 'chat' ? 'p-0' : 'p-2'} ${getMinHeight()} ${preset === 'chat' ? 'max-w-none' : 'prose prose-sm max-w-none'} flex items-center justify-center`}
          style={{
            fontSize: '14px',
            lineHeight: preset === 'chat' ? '1.2' : '1.6'
          }}
        >
          <span className={`text-muted-foreground ${preset === 'chat' ? 'text-xs' : ''}`}>
            {preset === 'chat' ? '...' : 'Loading editor...'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Inject CSS for chat preset to override Editor.js styles */}
      {preset === 'chat' && (
        <style dangerouslySetInnerHTML={{
          __html: `
            .chat-editor-container {
              max-height: 44px !important;
              overflow: hidden !important;
              border: none !important;
              box-shadow: none !important;
              background: transparent !important;
            }
            .chat-editor-container .ce-block {
              margin: 0 !important;
              padding: 0 !important;
              max-height: 32px !important;
              overflow: hidden !important;
            }
            .chat-editor-container .ce-paragraph {
              margin: 0 !important;
              padding: 2px 4px !important;
              min-height: 28px !important;
              max-height: 32px !important;
              line-height: 1.2 !important;
              font-size: 14px !important;
              overflow: hidden !important;
              white-space: nowrap !important;
              text-overflow: ellipsis !important;
            }
            .chat-editor-container .ce-toolbar {
              display: none !important;
              height: 0 !important;
              visibility: hidden !important;
            }
            .chat-editor-container .ce-block__content {
              margin: 0 !important;
              padding: 0 !important;
              max-height: 32px !important;
              overflow: hidden !important;
            }
            .chat-editor-container .ce-paragraph[contenteditable="true"] {
              min-height: 28px !important;
              max-height: 32px !important;
              padding: 2px 4px !important;
              line-height: 1.2 !important;
              white-space: nowrap !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
            }
            .chat-editor-container .ce-paragraph[data-placeholder] {
              min-height: 28px !important;
              max-height: 32px !important;
            }
            .chat-editor-container div[contenteditable] {
              max-height: 32px !important;
              overflow: hidden !important;
              white-space: nowrap !important;
              text-overflow: ellipsis !important;
            }
            .chat-editor-container .codex-editor {
              max-height: 40px !important;
              overflow: hidden !important;
            }
            .chat-editor-container .codex-editor__redactor {
              max-height: 32px !important;
              overflow: hidden !important;
              padding: 0 !important;
            }
          `
        }} />
      )}

      <div className={cn("border rounded-md bg-background", className, preset === 'chat' ? 'chat-editor-container' : '')}>
        {/* Character Counter - only for non-chat presets */}
        {preset !== 'chat' && (
          <div className="flex justify-end items-center px-3 py-2 border-b text-xs">
            <span className={getCharacterCountColor()}>
              {characterCount}/{maxLength.toLocaleString()} characters
            </span>
          </div>
        )}

        {/* Editor Container - Always render container with ref, optimized for chat */}
        <div
          ref={containerRef}
          className={`${preset === 'chat' ? 'p-0' : 'p-2'} ${getMinHeight()} ${preset === 'chat' ? 'max-w-none' : 'prose prose-sm max-w-none'} ${preset === 'chat' ? 'focus-within:ring-0' : 'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'}`}
          style={{
            fontSize: '14px',
            lineHeight: preset === 'chat' ? '1.2' : '1.6'
          }}
        >
        {!isReady && !initError && (
          <div className="flex items-center justify-center h-full">
            <span className="text-muted-foreground">Loading editor...</span>
          </div>
        )}
        {initError && (
          <div className="flex flex-col items-center justify-center h-full space-y-3 p-4">
            <div className="text-center">
              <div className="text-destructive font-medium mb-1">Editor failed to load</div>
              <div className="text-sm text-muted-foreground mb-3">{initError}</div>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                Reload page
              </button>
            </div>
          </div>
        )}
        {/* Editor content will be injected here by Editor.js */}
      </div>

        {/* Character limit warnings */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          role="status"
        >
          {isOverLimit && `Warning: Character limit exceeded by ${characterCount - maxLength} characters`}
          {isVeryCloseToLimit && `Warning: Approaching character limit, ${maxLength - characterCount} characters remaining`}
          {isCloseToLimit && `Notice: ${maxLength - characterCount} characters remaining`}
        </div>
      </div>
    </>
  )
}

// Export utility functions
export const sanitizeHtml = (html: string): string => {
  // Basic HTML sanitization - you might want to use DOMPurify here
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
}

export const htmlToPlainText = (html: string): string => {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export const countHtmlCharacters = (html: string): number => {
  return htmlToPlainText(html).length
}