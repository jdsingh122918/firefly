/**
 * Rich Text Editor - Editor.js Implementation
 *
 * This file serves as the main export point for the rich text editor components.
 * Migration from Draft.js to Editor.js for better reliability and user experience.
 */

import React from 'react'
import { EditorJSEditor } from './editorjs-editor'

// Re-export all components and utilities from the Editor.js implementation
export {
  EditorJSEditor as RichTextEditor,
  sanitizeHtml,
  htmlToPlainText,
  countHtmlCharacters
} from './editorjs-editor'

export { ContentRenderer } from './content-renderer'

// Convenience components for different configurations
export const ChatEditor = React.forwardRef<any, React.ComponentProps<typeof EditorJSEditor>>((props, ref) => (
  <EditorJSEditor {...props} preset="chat" ref={ref} />
))
ChatEditor.displayName = 'ChatEditor'

export const MinimalEditor = React.forwardRef<any, React.ComponentProps<typeof EditorJSEditor>>((props, ref) => (
  <EditorJSEditor {...props} preset="minimal" ref={ref} />
))
MinimalEditor.displayName = 'MinimalEditor'

export const ReplyEditor = React.forwardRef<any, React.ComponentProps<typeof EditorJSEditor>>((props, ref) => (
  <EditorJSEditor {...props} preset="reply" ref={ref} />
))
ReplyEditor.displayName = 'ReplyEditor'

export const FullEditor = React.forwardRef<any, React.ComponentProps<typeof EditorJSEditor>>((props, ref) => (
  <EditorJSEditor {...props} preset="full" ref={ref} />
))
FullEditor.displayName = 'FullEditor'

// Default export for backward compatibility (full configuration)
export { EditorJSEditor as default } from './editorjs-editor'