/**
 * Editor Migration Utilities
 *
 * Comprehensive utilities for migrating content between formats:
 * - HTML → Editor.js JSON
 * - Draft.js JSON → Editor.js JSON
 * - Batch database migration functions
 * - Validation and error handling
 */

import DOMPurify from 'dompurify'

// =============================================
// Types and Interfaces
// =============================================

export interface EditorJSData {
  blocks: EditorJSBlock[]
  version?: string
}

export interface EditorJSBlock {
  id?: string
  type: string
  data: any
}

export interface DraftJSData {
  blocks: DraftJSBlock[]
  entityMap?: any
}

export interface DraftJSBlock {
  key: string
  text: string
  type: string
  depth: number
  inlineStyleRanges: any[]
  entityRanges: any[]
  data: any
}

export interface MigrationResult {
  success: boolean
  data?: EditorJSData
  error?: string
  originalFormat?: 'html' | 'draftjs' | 'editorjs' | 'unknown'
}

export interface BatchMigrationResult {
  totalProcessed: number
  successful: number
  failed: number
  errors: Array<{
    id: string
    error: string
  }>
}

// =============================================
// HTML to Editor.js Migration
// =============================================

/**
 * Convert HTML content to Editor.js JSON format
 * Handles headers, paragraphs, lists, blockquotes, and links
 */
export function htmlToEditorJS(html: string): MigrationResult {
  try {
    if (!html || html.trim() === '') {
      return {
        success: true,
        data: { blocks: [] },
        originalFormat: 'html'
      }
    }

    // Sanitize HTML first
    const sanitizedHtml = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'blockquote', 'a', 'br', 'strong', 'em', 'u', 'del', 'code'],
      ALLOWED_ATTR: ['href', 'target', 'rel']
    })

    // Parse HTML into DOM
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div>${sanitizedHtml}</div>`, 'text/html')
    const container = doc.querySelector('div')

    if (!container) {
      return {
        success: false,
        error: 'Failed to parse HTML content',
        originalFormat: 'html'
      }
    }

    const blocks: EditorJSBlock[] = []
    const childNodes = Array.from(container.childNodes)

    for (const node of childNodes) {
      const block = convertNodeToBlock(node)
      if (block) {
        blocks.push(block)
      }
    }

    // If no blocks were created, create a single paragraph
    if (blocks.length === 0) {
      const text = container.textContent?.trim()
      if (text) {
        blocks.push({
          type: 'paragraph',
          data: { text }
        })
      }
    }

    return {
      success: true,
      data: { blocks },
      originalFormat: 'html'
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during HTML conversion',
      originalFormat: 'html'
    }
  }
}

/**
 * Convert a DOM node to an Editor.js block
 */
function convertNodeToBlock(node: Node): EditorJSBlock | null {
  // Handle text nodes
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim()
    if (text) {
      return {
        type: 'paragraph',
        data: { text }
      }
    }
    return null
  }

  // Handle element nodes
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element
    const tagName = element.tagName.toLowerCase()

    switch (tagName) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        const level = parseInt(tagName.charAt(1))
        // Editor.js only supports H2 and H3
        const editorLevel = level <= 2 ? 2 : 3
        return {
          type: 'header',
          data: {
            text: element.textContent?.trim() || '',
            level: editorLevel
          }
        }

      case 'p':
        const paragraphText = extractInlineContent(element)
        if (paragraphText.trim()) {
          return {
            type: 'paragraph',
            data: { text: paragraphText }
          }
        }
        return null

      case 'ul':
        const ulItems = extractListItems(element)
        if (ulItems.length > 0) {
          return {
            type: 'list',
            data: {
              style: 'unordered',
              items: ulItems
            }
          }
        }
        return null

      case 'ol':
        const olItems = extractListItems(element)
        if (olItems.length > 0) {
          return {
            type: 'list',
            data: {
              style: 'ordered',
              items: olItems
            }
          }
        }
        return null

      case 'blockquote':
        const quoteText = element.textContent?.trim() || ''
        if (quoteText) {
          return {
            type: 'quote',
            data: { text: quoteText }
          }
        }
        return null

      case 'br':
        return {
          type: 'paragraph',
          data: { text: '' }
        }

      default:
        // For other elements, extract text content as paragraph
        const text = element.textContent?.trim()
        if (text) {
          return {
            type: 'paragraph',
            data: { text }
          }
        }
        return null
    }
  }

  return null
}

/**
 * Extract inline content with formatting (links, bold, italic)
 */
function extractInlineContent(element: Element): string {
  let result = ''

  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || ''
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element
      const tagName = el.tagName.toLowerCase()

      if (tagName === 'a') {
        const href = el.getAttribute('href')
        const text = el.textContent || ''
        // Create a simple text link - Editor.js will handle this via LinkTool
        result += `${text} (${href})`
      } else {
        // For other inline elements, just get the text
        result += el.textContent || ''
      }
    }
  }

  return result
}

/**
 * Extract list items from ul/ol elements
 */
function extractListItems(listElement: Element): string[] {
  const items: string[] = []

  for (const child of Array.from(listElement.children)) {
    if (child.tagName.toLowerCase() === 'li') {
      const text = child.textContent?.trim()
      if (text) {
        items.push(text)
      }
    }
  }

  return items
}

// =============================================
// Draft.js to Editor.js Migration
// =============================================

/**
 * Convert Draft.js JSON to Editor.js JSON format
 */
export function draftJSToEditorJS(draftData: string | DraftJSData): MigrationResult {
  try {
    let parsedData: DraftJSData

    if (typeof draftData === 'string') {
      try {
        parsedData = JSON.parse(draftData)
      } catch {
        // If it's not valid JSON, treat it as plain text
        return htmlToEditorJS(`<p>${draftData}</p>`)
      }
    } else {
      parsedData = draftData
    }

    if (!parsedData.blocks || !Array.isArray(parsedData.blocks)) {
      return {
        success: false,
        error: 'Invalid Draft.js data structure',
        originalFormat: 'draftjs'
      }
    }

    const blocks: EditorJSBlock[] = []

    for (const draftBlock of parsedData.blocks) {
      const block = convertDraftBlockToEditorBlock(draftBlock, parsedData.entityMap || {})
      if (block) {
        blocks.push(block)
      }
    }

    // If no blocks were created, create empty data
    if (blocks.length === 0) {
      return {
        success: true,
        data: { blocks: [] },
        originalFormat: 'draftjs'
      }
    }

    return {
      success: true,
      data: { blocks },
      originalFormat: 'draftjs'
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during Draft.js conversion',
      originalFormat: 'draftjs'
    }
  }
}

/**
 * Convert a Draft.js block to Editor.js block
 */
function convertDraftBlockToEditorBlock(draftBlock: DraftJSBlock, entityMap: any): EditorJSBlock | null {
  const text = draftBlock.text?.trim() || ''

  // Skip empty blocks
  if (!text && draftBlock.type !== 'atomic') {
    return null
  }

  switch (draftBlock.type) {
    case 'header-one':
    case 'header-two':
      return {
        type: 'header',
        data: {
          text,
          level: 2
        }
      }

    case 'header-three':
    case 'header-four':
    case 'header-five':
    case 'header-six':
      return {
        type: 'header',
        data: {
          text,
          level: 3
        }
      }

    case 'unordered-list-item':
      return {
        type: 'list',
        data: {
          style: 'unordered',
          items: [text]
        }
      }

    case 'ordered-list-item':
      return {
        type: 'list',
        data: {
          style: 'ordered',
          items: [text]
        }
      }

    case 'blockquote':
      return {
        type: 'quote',
        data: { text }
      }

    case 'unstyled':
    case 'paragraph':
    default:
      // Handle links and other entities
      const processedText = processDraftEntities(text, draftBlock.entityRanges, entityMap)
      return {
        type: 'paragraph',
        data: { text: processedText }
      }
  }
}

/**
 * Process Draft.js entity ranges (links, etc.)
 */
function processDraftEntities(text: string, entityRanges: any[], entityMap: any): string {
  if (!entityRanges || entityRanges.length === 0) {
    return text
  }

  // For simplicity, just return the text with entity info as plain text
  // Editor.js will handle link creation through its LinkTool
  let result = text

  for (const range of entityRanges) {
    const entity = entityMap[range.key]
    if (entity && entity.type === 'LINK') {
      const url = entity.data?.url || entity.data?.href
      if (url) {
        // Add the URL as text for manual link creation
        const linkText = text.substring(range.offset, range.offset + range.length)
        result = result.replace(linkText, `${linkText} (${url})`)
      }
    }
  }

  return result
}

// =============================================
// Format Detection and Auto-Migration
// =============================================

/**
 * Detect content format and migrate to Editor.js
 */
export function migrateToEditorJS(content: string): MigrationResult {
  if (!content || content.trim() === '') {
    return {
      success: true,
      data: { blocks: [] },
      originalFormat: 'unknown'
    }
  }

  // Try to detect if it's already Editor.js JSON
  try {
    const parsed = JSON.parse(content)
    if (parsed.blocks && Array.isArray(parsed.blocks)) {
      // Check if it looks like Editor.js format
      if (parsed.blocks.length === 0 || parsed.blocks.every((block: any) => block.type && block.data !== undefined)) {
        return {
          success: true,
          data: parsed,
          originalFormat: 'editorjs'
        }
      }

      // Check if it looks like Draft.js format
      if (parsed.blocks.every((block: any) => block.key && block.text !== undefined && block.type !== undefined)) {
        return draftJSToEditorJS(parsed)
      }
    }
  } catch {
    // Not JSON, continue to HTML detection
  }

  // Check if it looks like HTML
  if (content.includes('<') && content.includes('>')) {
    return htmlToEditorJS(content)
  }

  // Treat as plain text
  return {
    success: true,
    data: {
      blocks: [{
        type: 'paragraph',
        data: { text: content.trim() }
      }]
    },
    originalFormat: 'unknown'
  }
}

// =============================================
// Batch Migration Functions
// =============================================

/**
 * Migrate multiple content items
 */
export function batchMigrateContent(contents: Array<{ id: string; content: string }>): BatchMigrationResult {
  const result: BatchMigrationResult = {
    totalProcessed: contents.length,
    successful: 0,
    failed: 0,
    errors: []
  }

  for (const item of contents) {
    const migrationResult = migrateToEditorJS(item.content)

    if (migrationResult.success) {
      result.successful++
    } else {
      result.failed++
      result.errors.push({
        id: item.id,
        error: migrationResult.error || 'Unknown error'
      })
    }
  }

  return result
}

// =============================================
// Validation and Utilities
// =============================================

/**
 * Validate Editor.js data structure
 */
export function validateEditorJSData(data: any): { isValid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'Data must be an object' }
  }

  if (!data.blocks || !Array.isArray(data.blocks)) {
    return { isValid: false, error: 'Data must have a blocks array' }
  }

  for (let i = 0; i < data.blocks.length; i++) {
    const block = data.blocks[i]

    if (!block.type || typeof block.type !== 'string') {
      return { isValid: false, error: `Block ${i}: type is required and must be a string` }
    }

    if (block.data === undefined || typeof block.data !== 'object') {
      return { isValid: false, error: `Block ${i}: data is required and must be an object` }
    }
  }

  return { isValid: true }
}

/**
 * Convert Editor.js data to HTML (enhanced version)
 */
export function editorJSToHTML(data: EditorJSData): string {
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
        const url = block.data.link || ''
        const title = block.data.meta?.title || url
        return `<p><a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a></p>`
      default:
        return `<p>${block.data.text || ''}</p>`
    }
  })

  return htmlParts.join('\n')
}

/**
 * Get character count from Editor.js data
 */
export function getEditorJSCharacterCount(data: EditorJSData): number {
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
}

// =============================================
// Merge List Items (Post-processing)
// =============================================

/**
 * Merge consecutive list items of the same type
 * This fixes the issue where HTML conversion creates separate list blocks for each item
 */
export function mergeConsecutiveListItems(data: EditorJSData): EditorJSData {
  if (!data?.blocks || data.blocks.length === 0) {
    return data
  }

  const mergedBlocks: EditorJSBlock[] = []
  let i = 0

  while (i < data.blocks.length) {
    const currentBlock = data.blocks[i]

    if (currentBlock.type === 'list') {
      // Start collecting consecutive list items of the same style
      const listStyle = currentBlock.data.style
      const allItems: string[] = [...(currentBlock.data.items || [])]

      // Look ahead for more list blocks of the same style
      let j = i + 1
      while (j < data.blocks.length &&
             data.blocks[j].type === 'list' &&
             data.blocks[j].data.style === listStyle) {
        allItems.push(...(data.blocks[j].data.items || []))
        j++
      }

      // Create merged list block
      mergedBlocks.push({
        ...currentBlock,
        data: {
          ...currentBlock.data,
          items: allItems
        }
      })

      // Skip the merged blocks
      i = j
    } else {
      // Non-list block, add as-is
      mergedBlocks.push(currentBlock)
      i++
    }
  }

  return {
    ...data,
    blocks: mergedBlocks
  }
}

/**
 * Enhanced migration function with post-processing
 */
export function migrateToEditorJSEnhanced(content: string): MigrationResult {
  const result = migrateToEditorJS(content)

  if (result.success && result.data) {
    // Apply post-processing to merge consecutive list items
    result.data = mergeConsecutiveListItems(result.data)
  }

  return result
}