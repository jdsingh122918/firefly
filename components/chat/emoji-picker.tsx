"use client"

import { useState } from 'react'
import { Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  align?: 'start' | 'center' | 'end'
}

// Common emoji reactions for quick access
const QUICK_REACTIONS = [
  '👍', '👎', '❤️', '😂', '😮', '😢', '😡', '🎉',
  '🔥', '✨', '💯', '🙏', '👏', '🤔', '😊', '😍'
]

const EMOJI_CATEGORIES = [
  {
    name: 'Quick',
    emojis: QUICK_REACTIONS
  },
  {
    name: 'Smileys',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
      '🥲', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍',
      '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝',
      '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩'
    ]
  },
  {
    name: 'Hearts',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
      '💘', '💝', '💟'
    ]
  },
  {
    name: 'Gestures',
    emojis: [
      '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟',
      '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️',
      '👏', '🙌', '👐', '🤲', '🤝', '🙏'
    ]
  }
]

export function EmojiPicker({ onEmojiSelect, disabled = false, size = 'sm', align = 'center' }: EmojiPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState(0)

  const buttonSize = {
    sm: 'h-10 w-10 sm:h-8 sm:w-8',
    md: 'h-12 w-12 sm:h-10 sm:w-10',
    lg: 'h-14 w-14 sm:h-12 sm:w-12'
  }[size]

  const iconSize = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }[size]

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`${buttonSize} p-0 hover:bg-accent`}
          disabled={disabled}
          title="Add reaction"
        >
          <Smile className={iconSize} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 sm:w-80 p-3 chat-emoji-picker"
        align={align}
        side="top"
        sideOffset={12}
        collisionPadding={25}
        avoidCollisions={true}
        sticky="always"
      >
        <div className="space-y-3">
          {/* Category Tabs */}
          <div className="flex space-x-1 border-b">
            {EMOJI_CATEGORIES.map((category, index) => (
              <button
                key={category.name}
                onClick={() => setSelectedCategory(index)}
                className={`px-3 py-1 text-xs font-medium rounded-t-md transition-colors ${
                  selectedCategory === index
                    ? 'bg-accent text-accent-foreground border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Emoji Grid */}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
            {EMOJI_CATEGORIES[selectedCategory].emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onEmojiSelect(emoji)}
                className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center text-lg hover:bg-accent rounded-md transition-colors active:bg-accent/80"
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Quick Access Notice */}
          {selectedCategory === 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Most commonly used reactions
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Quick reaction button for common emojis
interface QuickReactionButtonProps {
  emoji: string
  onReact: (emoji: string) => void
  disabled?: boolean
  className?: string
}

export function QuickReactionButton({
  emoji,
  onReact,
  disabled = false,
  className = ""
}: QuickReactionButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-8 w-8 p-0 text-lg hover:bg-accent ${className}`}
      onClick={() => onReact(emoji)}
      disabled={disabled}
      title={`React with ${emoji}`}
    >
      {emoji}
    </Button>
  )
}

// Quick reactions bar component
interface QuickReactionsProps {
  onReact: (emoji: string) => void
  disabled?: boolean
  className?: string
}

export function QuickReactions({
  onReact,
  disabled = false,
  className = ""
}: QuickReactionsProps) {
  const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🎉']

  return (
    <div className={`flex space-x-1 ${className}`}>
      {quickEmojis.map((emoji) => (
        <QuickReactionButton
          key={emoji}
          emoji={emoji}
          onReact={onReact}
          disabled={disabled}
        />
      ))}
      <EmojiPicker onEmojiSelect={onReact} disabled={disabled} />
    </div>
  )
}