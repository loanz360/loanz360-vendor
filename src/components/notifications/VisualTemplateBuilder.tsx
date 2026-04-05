'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  Type, Image as ImageIcon, MousePointerClick, Minus, ArrowUpDown,
  Trash2, ChevronUp, ChevronDown, Save, Eye, Code, AlignLeft, AlignCenter,
  AlignRight, Plus, Heading, Variable, Smartphone, Monitor, Sun, Moon,
  Copy, X, EyeOff
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────

export interface TemplateBlock {
  id: string
  type: 'header' | 'text' | 'button' | 'divider' | 'image' | 'spacer' | 'variable'
  content: string
  settings: {
    level?: 'h1' | 'h2' | 'h3'
    alignment?: 'left' | 'center' | 'right'
    buttonUrl?: string
    buttonColor?: string
    imageUrl?: string
    spacerHeight?: number
    variableName?: string
    bold?: boolean
    italic?: boolean
  }
}

export interface VisualTemplateBuilderProps {
  initialBlocks?: TemplateBlock[]
  onChange?: (blocks: TemplateBlock[], html: string, text: string) => void
  onSave?: (blocks: TemplateBlock[], html: string, text: string) => void
  readOnly?: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────

const TEMPLATE_VARIABLES = [
  { label: 'User Name', value: '{{user.name}}' },
  { label: 'User Email', value: '{{user.email}}' },
  { label: 'User Role', value: '{{user.role}}' },
  { label: 'Today\'s Date', value: '{{date.today}}' },
  { label: 'App Name', value: '{{app.name}}' },
]

type BlockType = TemplateBlock['type']

const BLOCK_PALETTE: { type: BlockType; label: string; icon: typeof Type; desc: string }[] = [
  { type: 'header', label: 'Header', icon: Heading, desc: 'H1, H2, or H3 heading' },
  { type: 'text', label: 'Text', icon: Type, desc: 'Paragraph with formatting' },
  { type: 'button', label: 'Button', icon: MousePointerClick, desc: 'Call-to-action button' },
  { type: 'divider', label: 'Divider', icon: Minus, desc: 'Horizontal rule' },
  { type: 'image', label: 'Image', icon: ImageIcon, desc: 'Image placeholder' },
  { type: 'spacer', label: 'Spacer', icon: ArrowUpDown, desc: 'Adjustable spacing' },
  { type: 'variable', label: 'Variable', icon: Variable, desc: 'Template variable' },
]

// ─── Helpers ────────────────────────────────────────────────────────────

function createBlock(type: BlockType): TemplateBlock {
  const id = crypto.randomUUID()
  switch (type) {
    case 'header':
      return { id, type, content: 'Heading Text', settings: { level: 'h1', alignment: 'left' } }
    case 'text':
      return { id, type, content: 'Enter your text content here.', settings: { alignment: 'left', bold: false, italic: false } }
    case 'button':
      return { id, type, content: 'Click Here', settings: { alignment: 'center', buttonUrl: 'https://', buttonColor: '#FF6700' } }
    case 'divider':
      return { id, type, content: '', settings: { alignment: 'center' } }
    case 'image':
      return { id, type, content: 'Image description', settings: { alignment: 'center', imageUrl: '' } }
    case 'spacer':
      return { id, type, content: '', settings: { spacerHeight: 24 } }
    case 'variable':
      return { id, type, content: '{{user.name}}', settings: { variableName: '{{user.name}}' } }
  }
}

function generateHTML(blocks: TemplateBlock[]): string {
  const renderBlock = (block: TemplateBlock): string => {
    const align = block.settings.alignment || 'left'
    switch (block.type) {
      case 'header': {
        const tag = block.settings.level || 'h1'
        const sizes: Record<string, string> = { h1: '28px', h2: '22px', h3: '18px' }
        return `<${tag} style="margin:0 0 8px;font-size:${sizes[tag]};text-align:${align};font-family:Poppins,Arial,sans-serif;color:inherit;">${block.content}</${tag}>`
      }
      case 'text': {
        const fw = block.settings.bold ? 'font-weight:700;' : ''
        const fs = block.settings.italic ? 'font-style:italic;' : ''
        return `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;text-align:${align};font-family:Poppins,Arial,sans-serif;color:inherit;${fw}${fs}">${block.content.replace(/\n/g, '<br/>')}</p>`
      }
      case 'button': {
        const color = block.settings.buttonColor || '#FF6700'
        const url = block.settings.buttonUrl || '#'
        return `<div style="text-align:${align};margin:16px 0;"><a href="${url}" target="_blank" style="display:inline-block;background-color:${color};color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;font-family:Poppins,Arial,sans-serif;">${block.content}</a></div>`
      }
      case 'divider':
        return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />`
      case 'image': {
        const src = block.settings.imageUrl || 'https://placehold.co/600x200/1f2937/9ca3af?text=Image+Placeholder'
        return `<div style="text-align:${align};margin:12px 0;"><img src="${src}" alt="${block.content}" style="max-width:100%;height:auto;border-radius:6px;" /></div>`
      }
      case 'spacer': {
        const h = block.settings.spacerHeight || 24
        return `<div style="height:${h}px;"></div>`
      }
      case 'variable':
        return `<span style="font-family:Poppins,Arial,sans-serif;color:inherit;">${block.settings.variableName || block.content}</span>`
    }
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>body{margin:0;padding:0;font-family:Poppins,Arial,sans-serif;}</style></head>
<body style="margin:0;padding:24px;">
${blocks.map(renderBlock).join('\n')}
</body></html>`
}

function generatePlainText(blocks: TemplateBlock[]): string {
  return blocks.map(block => {
    switch (block.type) {
      case 'header': {
        const prefix = block.settings.level === 'h1' ? '# ' : block.settings.level === 'h2' ? '## ' : '### '
        return prefix + block.content
      }
      case 'text':
        return block.content
      case 'button':
        return `[${block.content}](${block.settings.buttonUrl || '#'})`
      case 'divider':
        return '---'
      case 'image':
        return `[Image: ${block.content}]${block.settings.imageUrl ? ` (${block.settings.imageUrl})` : ''}`
      case 'spacer':
        return ''
      case 'variable':
        return block.settings.variableName || block.content
    }
  }).filter(Boolean).join('\n\n')
}

// ─── Sub-components ─────────────────────────────────────────────────────

function AlignmentPicker({ value, onChange, disabled }: { value: string; onChange: (v: 'left' | 'center' | 'right') => void; disabled?: boolean }) {
  const options: { val: 'left' | 'center' | 'right'; Icon: typeof AlignLeft }[] = [
    { val: 'left', Icon: AlignLeft },
    { val: 'center', Icon: AlignCenter },
    { val: 'right', Icon: AlignRight },
  ]
  return (
    <div className="flex gap-1">
      {options.map(({ val, Icon }) => (
        <button key={val} onClick={() => onChange(val)} disabled={disabled}
          className={`p-1.5 rounded transition-colors ${value === val ? 'bg-[#FF6700] text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <Icon size={14} />
        </button>
      ))}
    </div>
  )
}

function BlockEditor({
  block,
  onUpdate,
  readOnly,
}: {
  block: TemplateBlock
  onUpdate: (b: TemplateBlock) => void
  readOnly?: boolean
}) {
  const updateContent = (content: string) => onUpdate({ ...block, content })
  const updateSetting = <K extends keyof TemplateBlock['settings']>(key: K, val: TemplateBlock['settings'][K]) =>
    onUpdate({ ...block, settings: { ...block.settings, [key]: val } })

  const [showVarDropdown, setShowVarDropdown] = useState(false)

  switch (block.type) {
    case 'header':
      return (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Heading text</label>
            <input type="text" value={block.content} onChange={e => updateContent(e.target.value)} disabled={readOnly}
              className="w-full bg-gray-800 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[#FF6700] focus:outline-none disabled:opacity-50" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Level</label>
            <div className="flex gap-1">
              {(['h1', 'h2', 'h3'] as const).map(level => (
                <button key={level} onClick={() => updateSetting('level', level)} disabled={readOnly}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${block.settings.level === level ? 'bg-[#FF6700] text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'} ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {level.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Alignment</label>
            <AlignmentPicker value={block.settings.alignment || 'left'} onChange={v => updateSetting('alignment', v)} disabled={readOnly} />
          </div>
        </div>
      )

    case 'text':
      return (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Content</label>
            <textarea value={block.content} onChange={e => updateContent(e.target.value)} rows={4} disabled={readOnly}
              className="w-full bg-gray-800 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[#FF6700] focus:outline-none resize-y disabled:opacity-50" />
          </div>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={block.settings.bold || false} onChange={e => updateSetting('bold', e.target.checked)} disabled={readOnly}
                className="rounded border-gray-600 bg-gray-800 text-[#FF6700] focus:ring-[#FF6700]" />
              <span className="text-xs text-gray-300 font-bold">Bold</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={block.settings.italic || false} onChange={e => updateSetting('italic', e.target.checked)} disabled={readOnly}
                className="rounded border-gray-600 bg-gray-800 text-[#FF6700] focus:ring-[#FF6700]" />
              <span className="text-xs text-gray-300 italic">Italic</span>
            </label>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Alignment</label>
            <AlignmentPicker value={block.settings.alignment || 'left'} onChange={v => updateSetting('alignment', v)} disabled={readOnly} />
          </div>
          <div className="relative">
            <button onClick={() => setShowVarDropdown(!showVarDropdown)} disabled={readOnly}
              className="text-xs text-[#FF6700] hover:text-orange-400 flex items-center gap-1 disabled:opacity-50">
              <Variable size={12} /> Insert variable
            </button>
            {showVarDropdown && (
              <div className="absolute z-20 top-6 left-0 bg-gray-800 border border-white/10 rounded-lg shadow-xl p-1 w-48">
                {TEMPLATE_VARIABLES.map(v => (
                  <button key={v.value} onClick={() => { updateContent(block.content + ' ' + v.value); setShowVarDropdown(false) }}
                    className="block w-full text-left text-xs text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-1.5 rounded transition-colors">
                    <span className="font-mono text-[#FF6700]">{v.value}</span>
                    <span className="text-gray-500 ml-1.5">{v.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )

    case 'button':
      return (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Button text</label>
            <input type="text" value={block.content} onChange={e => updateContent(e.target.value)} disabled={readOnly}
              className="w-full bg-gray-800 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#FF6700] focus:outline-none disabled:opacity-50" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">URL</label>
            <input type="text" value={block.settings.buttonUrl || ''} onChange={e => updateSetting('buttonUrl', e.target.value)} disabled={readOnly}
              className="w-full bg-gray-800 border border-white/10 rounded px-3 py-2 text-sm text-white font-mono focus:border-[#FF6700] focus:outline-none disabled:opacity-50" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Button color</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={block.settings.buttonColor || '#FF6700'} onChange={e => updateSetting('buttonColor', e.target.value)} disabled={readOnly}
                className="w-9 h-9 rounded border border-white/10 cursor-pointer bg-transparent" />
              <input type="text" value={block.settings.buttonColor || '#FF6700'} onChange={e => updateSetting('buttonColor', e.target.value)} disabled={readOnly}
                className="flex-1 bg-gray-800 border border-white/10 rounded px-3 py-2 text-xs text-white font-mono focus:border-[#FF6700] focus:outline-none disabled:opacity-50" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Alignment</label>
            <AlignmentPicker value={block.settings.alignment || 'center'} onChange={v => updateSetting('alignment', v)} disabled={readOnly} />
          </div>
        </div>
      )

    case 'divider':
      return (
        <div className="text-xs text-gray-500 py-2">
          Horizontal divider. No additional settings.
        </div>
      )

    case 'image':
      return (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Image URL</label>
            <input type="text" value={block.settings.imageUrl || ''} onChange={e => updateSetting('imageUrl', e.target.value)} disabled={readOnly}
              placeholder="https://example.com/image.png"
              className="w-full bg-gray-800 border border-white/10 rounded px-3 py-2 text-sm text-white font-mono placeholder-gray-600 focus:border-[#FF6700] focus:outline-none disabled:opacity-50" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Alt text</label>
            <input type="text" value={block.content} onChange={e => updateContent(e.target.value)} disabled={readOnly}
              className="w-full bg-gray-800 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#FF6700] focus:outline-none disabled:opacity-50" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Alignment</label>
            <AlignmentPicker value={block.settings.alignment || 'center'} onChange={v => updateSetting('alignment', v)} disabled={readOnly} />
          </div>
        </div>
      )

    case 'spacer':
      return (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Height (px)</label>
            <input type="range" min={8} max={120} value={block.settings.spacerHeight || 24}
              onChange={e => updateSetting('spacerHeight', Number(e.target.value))} disabled={readOnly}
              className="w-full accent-[#FF6700]" />
            <div className="text-xs text-gray-500 text-right mt-0.5">{block.settings.spacerHeight || 24}px</div>
          </div>
        </div>
      )

    case 'variable':
      return (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Variable</label>
            <select value={block.settings.variableName || '{{user.name}}'} disabled={readOnly}
              onChange={e => { updateSetting('variableName', e.target.value); updateContent(e.target.value) }}
              className="w-full bg-gray-800 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#FF6700] focus:outline-none disabled:opacity-50">
              {TEMPLATE_VARIABLES.map(v => (
                <option key={v.value} value={v.value}>{v.label} - {v.value}</option>
              ))}
            </select>
          </div>
        </div>
      )
  }
}

function BlockPreviewInCanvas({ block, previewTheme }: { block: TemplateBlock; previewTheme: 'light' | 'dark' }) {
  const textColor = previewTheme === 'dark' ? '#e5e7eb' : '#1f2937'
  const mutedColor = previewTheme === 'dark' ? '#9ca3af' : '#6b7280'
  const align = (block.settings.alignment || 'left') as 'left' | 'center' | 'right'

  switch (block.type) {
    case 'header': {
      const sizes: Record<string, number> = { h1: 26, h2: 21, h3: 17 }
      const level = block.settings.level || 'h1'
      return (
        <div style={{ textAlign: align, padding: '8px 16px' }}>
          <div style={{ fontSize: sizes[level], fontWeight: 700, color: textColor, fontFamily: 'Poppins, sans-serif' }}>
            {block.content || 'Heading'}
          </div>
        </div>
      )
    }
    case 'text':
      return (
        <div style={{
          textAlign: align, padding: '8px 16px', fontSize: 15, lineHeight: 1.6,
          color: textColor, fontWeight: block.settings.bold ? 700 : 400,
          fontStyle: block.settings.italic ? 'italic' : 'normal',
          fontFamily: 'Poppins, sans-serif',
        }}>
          {block.content || 'Text content'}
        </div>
      )
    case 'button': {
      const btnColor = block.settings.buttonColor || '#FF6700'
      return (
        <div style={{ textAlign: align, padding: '12px 16px' }}>
          <span style={{
            display: 'inline-block', backgroundColor: btnColor, color: '#fff',
            padding: '10px 24px', borderRadius: 6, fontSize: 14, fontWeight: 600,
            fontFamily: 'Poppins, sans-serif', cursor: 'pointer',
          }}>
            {block.content || 'Button'}
          </span>
        </div>
      )
    }
    case 'divider':
      return (
        <div style={{ padding: '12px 16px' }}>
          <hr style={{ border: 'none', borderTop: `1px solid ${previewTheme === 'dark' ? '#374151' : '#e5e7eb'}`, margin: 0 }} />
        </div>
      )
    case 'image':
      return (
        <div style={{ textAlign: align, padding: '8px 16px' }}>
          {block.settings.imageUrl ? (
            <img src={block.settings.imageUrl} alt={block.content} style={{ maxWidth: '100%', height: 'auto', borderRadius: 6 }} />
          ) : (
            <div style={{
              width: '100%', maxWidth: 400, height: 120, borderRadius: 6,
              backgroundColor: previewTheme === 'dark' ? '#1f2937' : '#f3f4f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: mutedColor, fontSize: 13,
              margin: align === 'center' ? '0 auto' : align === 'right' ? '0 0 0 auto' : undefined,
            }}>
              <ImageIcon size={18} style={{ marginRight: 6, opacity: 0.5 }} />
              Image placeholder
            </div>
          )}
        </div>
      )
    case 'spacer':
      return (
        <div style={{ height: block.settings.spacerHeight || 24, position: 'relative' }}>
          <span style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: mutedColor, opacity: 0.6,
          }}>
            {block.settings.spacerHeight || 24}px
          </span>
        </div>
      )
    case 'variable':
      return (
        <div style={{ padding: '6px 16px' }}>
          <span style={{
            display: 'inline-block', backgroundColor: previewTheme === 'dark' ? '#7c2d12' : '#fff7ed',
            color: '#FF6700', padding: '2px 10px', borderRadius: 4, fontSize: 13,
            fontFamily: 'monospace', border: '1px solid',
            borderColor: previewTheme === 'dark' ? '#9a3412' : '#fdba74',
          }}>
            {block.settings.variableName || block.content}
          </span>
        </div>
      )
  }
}

// ─── Main Component ─────────────────────────────────────────────────────

export default function VisualTemplateBuilder({
  initialBlocks,
  onChange,
  onSave,
  readOnly = false,
}: VisualTemplateBuilderProps) {
  const [blocks, setBlocks] = useState<TemplateBlock[]>(initialBlocks ?? [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'code'>('edit')
  const [previewWidth, setPreviewWidth] = useState<'mobile' | 'desktop'>('desktop')
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const selectedBlock = useMemo(() => blocks.find(b => b.id === selectedId) ?? null, [blocks, selectedId])
  const html = useMemo(() => generateHTML(blocks), [blocks])
  const plainText = useMemo(() => generatePlainText(blocks), [blocks])

  // Notify parent of changes
  useEffect(() => {
    onChange?.(blocks, html, plainText)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks])

  // ── Block operations ──
  const addBlock = useCallback((type: BlockType) => {
    const block = createBlock(type)
    setBlocks(prev => [...prev, block])
    setSelectedId(block.id)
  }, [])

  const updateBlock = useCallback((updated: TemplateBlock) => {
    setBlocks(prev => prev.map(b => b.id === updated.id ? updated : b))
  }, [])

  const removeBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id))
    if (selectedId === id) setSelectedId(null)
    setDeleteConfirmId(null)
  }, [selectedId])

  const duplicateBlock = useCallback((id: string) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id)
      if (idx === -1) return prev
      const original = prev[idx]
      const clone: TemplateBlock = { ...JSON.parse(JSON.stringify(original)), id: crypto.randomUUID() }
      const next = [...prev]
      next.splice(idx + 1, 0, clone)
      return next
    })
  }, [])

  const moveBlock = useCallback((id: string, dir: -1 | 1) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id)
      const target = idx + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }, [])

  // ── Render ──
  return (
    <div className="flex flex-col h-full bg-black text-white rounded-xl border border-white/10 overflow-hidden">
      {/* ── Top toolbar ── */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-gray-950 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FF6700]/20 flex items-center justify-center">
            <Code size={16} className="text-[#FF6700]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Template Builder</h3>
            <p className="text-[10px] text-gray-500">{blocks.length} block{blocks.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex bg-gray-900 rounded-lg border border-white/10 overflow-hidden text-xs">
            {([
              { key: 'edit' as const, label: 'Edit', Icon: Type },
              { key: 'preview' as const, label: 'Preview', Icon: Eye },
              { key: 'code' as const, label: 'HTML', Icon: Code },
            ]).map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setViewMode(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${viewMode === key ? 'bg-[#FF6700] text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>

          {/* Preview controls */}
          {viewMode === 'preview' && (
            <>
              <div className="w-px h-5 bg-white/10 mx-1" />
              <div className="flex bg-gray-900 rounded-lg border border-white/10 overflow-hidden">
                <button onClick={() => setPreviewWidth('mobile')} title="Mobile preview"
                  className={`p-1.5 transition-colors ${previewWidth === 'mobile' ? 'bg-[#FF6700] text-white' : 'text-gray-400 hover:text-white'}`}>
                  <Smartphone size={14} />
                </button>
                <button onClick={() => setPreviewWidth('desktop')} title="Desktop preview"
                  className={`p-1.5 transition-colors ${previewWidth === 'desktop' ? 'bg-[#FF6700] text-white' : 'text-gray-400 hover:text-white'}`}>
                  <Monitor size={14} />
                </button>
              </div>
              <div className="flex bg-gray-900 rounded-lg border border-white/10 overflow-hidden">
                <button onClick={() => setPreviewTheme('light')} title="Light theme"
                  className={`p-1.5 transition-colors ${previewTheme === 'light' ? 'bg-[#FF6700] text-white' : 'text-gray-400 hover:text-white'}`}>
                  <Sun size={14} />
                </button>
                <button onClick={() => setPreviewTheme('dark')} title="Dark theme"
                  className={`p-1.5 transition-colors ${previewTheme === 'dark' ? 'bg-[#FF6700] text-white' : 'text-gray-400 hover:text-white'}`}>
                  <Moon size={14} />
                </button>
              </div>
            </>
          )}

          {/* Save button */}
          {onSave && !readOnly && (
            <>
              <div className="w-px h-5 bg-white/10 mx-1" />
              <button onClick={() => onSave(blocks, html, plainText)}
                className="flex items-center gap-1.5 bg-[#FF6700] hover:bg-[#e55b00] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                <Save size={14} /> Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Main content area ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar: Block palette ── */}
        {viewMode === 'edit' && !readOnly && (
          <div className="w-56 border-r border-white/10 bg-gray-950 overflow-y-auto shrink-0 p-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Content Blocks</p>
            <div className="space-y-1.5">
              {BLOCK_PALETTE.map(({ type, label, icon: Icon, desc }) => (
                <button key={type} onClick={() => addBlock(type)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-white/5 bg-gray-900 hover:border-[#FF6700]/40 hover:bg-gray-800 transition-all group text-left">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 group-hover:bg-[#FF6700]/20 flex items-center justify-center shrink-0 transition-colors">
                    <Icon size={15} className="text-gray-400 group-hover:text-[#FF6700] transition-colors" />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-200 group-hover:text-white transition-colors">{label}</div>
                    <div className="text-[10px] text-gray-500">{desc}</div>
                  </div>
                  <Plus size={14} className="ml-auto text-gray-600 group-hover:text-[#FF6700] transition-colors shrink-0" />
                </button>
              ))}
            </div>

            {/* Variable quick-insert */}
            <div className="mt-5 pt-4 border-t border-white/5">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Variables</p>
              <div className="space-y-1">
                {TEMPLATE_VARIABLES.map(v => (
                  <button key={v.value} onClick={() => addBlock('variable')}
                    className="w-full text-left text-[11px] px-2.5 py-1.5 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-[#FF6700] font-mono transition-colors truncate">
                    {v.value}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Center: Canvas / Preview / Code ── */}
        <div className="flex-1 overflow-y-auto bg-gray-900/40 p-6">
          {viewMode === 'code' ? (
            /* ── HTML code view ── */
            <div className="max-w-3xl mx-auto space-y-4">
              <div>
                <p className="text-xs text-gray-400 mb-2 font-semibold">HTML Output</p>
                <pre className="bg-gray-950 border border-white/10 rounded-xl p-4 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-[400px] overflow-y-auto">
                  {html}
                </pre>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-2 font-semibold">Plain Text Output</p>
                <pre className="bg-gray-950 border border-white/10 rounded-xl p-4 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-[300px] overflow-y-auto">
                  {plainText || '(empty)'}
                </pre>
              </div>
            </div>
          ) : viewMode === 'preview' ? (
            /* ── Live preview ── */
            <div className="flex justify-center">
              <div style={{ width: previewWidth === 'mobile' ? 375 : 640 }}
                className="transition-all duration-300 ease-in-out">
                <div className={`rounded-xl overflow-hidden shadow-2xl border border-white/10 ${previewTheme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
                  {/* Preview device frame */}
                  <div className={`flex items-center gap-1.5 px-4 py-2 border-b ${previewTheme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
                    <span className={`ml-2 text-[10px] ${previewTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                      {previewWidth === 'mobile' ? '375px' : '640px'} - {previewTheme === 'dark' ? 'Dark' : 'Light'}
                    </span>
                  </div>
                  {/* Preview content */}
                  <div className="p-6" style={{ color: previewTheme === 'dark' ? '#e5e7eb' : '#1f2937' }}>
                    {blocks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 opacity-40">
                        <EyeOff size={28} />
                        <p className="text-sm mt-2">No blocks to preview</p>
                      </div>
                    ) : (
                      blocks.map(block => (
                        <BlockPreviewInCanvas key={block.id} block={block} previewTheme={previewTheme} />
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── Edit canvas ── */
            <div className="max-w-[640px] mx-auto">
              {blocks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500 border-2 border-dashed border-white/10 rounded-xl bg-gray-900/50">
                  <Plus size={36} className="mb-3 opacity-30" />
                  <p className="text-sm font-medium">No blocks yet</p>
                  <p className="text-xs text-gray-600 mt-1">Click a block from the sidebar to add it</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {blocks.map((block, idx) => (
                    <div key={block.id}
                      onClick={() => setSelectedId(block.id)}
                      className={`relative group rounded-xl border transition-all cursor-pointer ${
                        selectedId === block.id
                          ? 'border-[#FF6700] bg-gray-900 shadow-lg shadow-[#FF6700]/5'
                          : 'border-white/5 bg-gray-900/80 hover:border-white/15 hover:bg-gray-900'
                      }`}>

                      {/* Block type badge */}
                      <div className="absolute -top-2 left-3 z-10">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                          selectedId === block.id
                            ? 'bg-[#FF6700] text-white'
                            : 'bg-gray-800 text-gray-500 group-hover:text-gray-300'
                        }`}>
                          {block.type}
                        </span>
                      </div>

                      {/* Block controls */}
                      {!readOnly && (
                        <div className="absolute -right-1 top-1/2 -translate-y-1/2 translate-x-full opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-10 pl-2">
                          <button onClick={e => { e.stopPropagation(); moveBlock(block.id, -1) }}
                            disabled={idx === 0}
                            className="p-1 bg-gray-800 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Move up">
                            <ChevronUp size={13} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); moveBlock(block.id, 1) }}
                            disabled={idx === blocks.length - 1}
                            className="p-1 bg-gray-800 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Move down">
                            <ChevronDown size={13} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); duplicateBlock(block.id) }}
                            className="p-1 bg-gray-800 border border-white/10 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-gray-700 transition-colors"
                            title="Duplicate">
                            <Copy size={13} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(block.id) }}
                            className="p-1 bg-gray-800 border border-white/10 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors"
                            title="Delete">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}

                      {/* Block preview */}
                      <div className="pt-3 pb-1">
                        <BlockPreviewInCanvas block={block} previewTheme="dark" />
                      </div>

                      {/* Delete confirmation overlay */}
                      {deleteConfirmId === block.id && (
                        <div className="absolute inset-0 bg-red-950/90 backdrop-blur-sm rounded-xl flex items-center justify-center z-20">
                          <div className="text-center">
                            <p className="text-sm text-white font-medium mb-2">Delete this block?</p>
                            <div className="flex gap-2 justify-center">
                              <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(null) }}
                                className="px-3 py-1.5 text-xs bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">
                                Cancel
                              </button>
                              <button onClick={e => { e.stopPropagation(); removeBlock(block.id) }}
                                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right sidebar: Block editor ── */}
        {viewMode === 'edit' && (
          <div className="w-72 border-l border-white/10 bg-gray-950 overflow-y-auto shrink-0">
            {selectedBlock ? (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#FF6700]/20 flex items-center justify-center">
                      {(() => {
                        const item = BLOCK_PALETTE.find(p => p.type === selectedBlock.type)
                        const Icon = item?.icon || Type
                        return <Icon size={12} className="text-[#FF6700]" />
                      })()}
                    </div>
                    <p className="text-xs font-semibold text-white uppercase tracking-wider">{selectedBlock.type}</p>
                  </div>
                  <button onClick={() => setSelectedId(null)}
                    className="p-1 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800 transition-colors">
                    <X size={14} />
                  </button>
                </div>
                <BlockEditor block={selectedBlock} onUpdate={updateBlock} readOnly={readOnly} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 p-6">
                <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center mb-3">
                  <MousePointerClick size={20} className="opacity-40" />
                </div>
                <p className="text-xs text-center text-gray-500">Select a block to edit its properties</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export type { BlockType }
