'use client'

import React from 'react'
import { Keyboard, Command, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

interface KeyboardShortcutsHelpProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ShortcutGroup {
  title: string
  shortcuts: {
    keys: string[]
    description: string
  }[]
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['↑', '↓', '←', '→'], description: 'Navigate between items' },
      { keys: ['Enter'], description: 'Open file or folder' },
      { keys: ['Alt', '←'], description: 'Go back' },
      { keys: ['Alt', '→'], description: 'Go forward' },
      { keys: ['Alt', 'Backspace'], description: 'Go to parent folder' },
    ],
  },
  {
    title: 'Selection',
    shortcuts: [
      { keys: ['Space'], description: 'Toggle item selection' },
      { keys: ['Ctrl', 'A'], description: 'Select all items' },
      { keys: ['Escape'], description: 'Deselect all / Cancel' },
      { keys: ['Shift', 'Click'], description: 'Select range' },
      { keys: ['Ctrl', 'Click'], description: 'Add to selection' },
    ],
  },
  {
    title: 'File Operations',
    shortcuts: [
      { keys: ['Ctrl', 'U'], description: 'Upload files' },
      { keys: ['Ctrl', 'Shift', 'N'], description: 'New folder' },
      { keys: ['Delete'], description: 'Delete selected items' },
      { keys: ['F2'], description: 'Rename selected item' },
      { keys: ['Ctrl', 'D'], description: 'Download selected' },
    ],
  },
  {
    title: 'Clipboard',
    shortcuts: [
      { keys: ['Ctrl', 'C'], description: 'Copy' },
      { keys: ['Ctrl', 'X'], description: 'Cut' },
      { keys: ['Ctrl', 'V'], description: 'Paste' },
    ],
  },
  {
    title: 'Other',
    shortcuts: [
      { keys: ['Ctrl', 'F'], description: 'Search' },
      { keys: ['/'], description: 'Quick search' },
      { keys: ['Ctrl', 'R'], description: 'Refresh' },
      { keys: ['F5'], description: 'Refresh' },
      { keys: ['Ctrl', 'Shift', 'S'], description: 'Share' },
      { keys: ['Ctrl', 'I'], description: 'Properties' },
      { keys: ['Shift', '?'], description: 'Show this help' },
    ],
  },
]

const KeyBadge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-medium bg-muted border rounded shadow-sm">
    {children}
  </kbd>
)

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  const renderKey = (key: string) => {
    switch (key) {
      case 'Ctrl':
        return <Command className="h-3 w-3" />
      case '↑':
        return <ArrowUp className="h-3 w-3" />
      case '↓':
        return <ArrowDown className="h-3 w-3" />
      case '←':
        return <ArrowLeft className="h-3 w-3" />
      case '→':
        return <ArrowRight className="h-3 w-3" />
      default:
        return key
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate and manage files efficiently
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {shortcutGroups.map((group, groupIndex) => (
              <div key={group.title}>
                {groupIndex > 0 && <Separator className="mb-4" />}
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  {group.title}
                </h3>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            {keyIndex > 0 && (
                              <span className="text-muted-foreground text-xs mx-0.5">+</span>
                            )}
                            <KeyBadge>{renderKey(key)}</KeyBadge>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          Press <KeyBadge>Shift</KeyBadge> + <KeyBadge>?</KeyBadge> to toggle this help
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default KeyboardShortcutsHelp
