'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  Search,
  Filter,
  X,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Code,
  Table,
  Presentation,
  File,
  Calendar,
  HardDrive,
  User,
  Tag,
  ChevronDown,
  ChevronUp,
  Folder,
  Download,
  Eye,
  Share2,
  Clock,
  SlidersHorizontal,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface SearchResult {
  id: string
  name: string
  originalName: string
  fileType: string
  fileCategory: string
  mimeType: string
  fileSizeBytes: number
  workspaceId: string
  workspaceName?: string
  folderId?: string
  s3Key: string
  thumbnailS3Key?: string
  createdBy: string
  createdByName?: string
  createdByAvatar?: string
  createdAt: string
  updatedAt: string
  tags: string[]
  versionNumber: number
}

interface AvailableFilters {
  fileTypes: string[]
  categories: string[]
  workspaces: { id: string; name: string; type: string }[]
  owners: { id: string; name: string }[]
  tags: string[]
  sizeRanges: { label: string; min: number; max?: number }[]
}

interface SearchFilters {
  query: string
  fileTypes: string[]
  fileCategories: string[]
  dateFrom?: Date
  dateTo?: Date
  sizeRange?: { min: number; max?: number }
  owner?: string
  workspaceId?: string
  hasComments?: boolean
  isShared?: boolean
  tags: string[]
  sortBy: 'name' | 'size' | 'date' | 'type'
  sortOrder: 'asc' | 'desc'
}

interface AdvancedSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFileSelect?: (file: SearchResult) => void
}

const categoryIcons: Record<string, React.ReactNode> = {
  document: <FileText className="h-4 w-4" />,
  image: <Image className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  audio: <Music className="h-4 w-4" />,
  archive: <Archive className="h-4 w-4" />,
  code: <Code className="h-4 w-4" />,
  spreadsheet: <Table className="h-4 w-4" />,
  presentation: <Presentation className="h-4 w-4" />,
  other: <File className="h-4 w-4" />,
}

const defaultFilters: SearchFilters = {
  query: '',
  fileTypes: [],
  fileCategories: [],
  tags: [],
  sortBy: 'date',
  sortOrder: 'desc',
}

export function AdvancedSearch({
  open,
  onOpenChange,
  onFileSelect,
}: AdvancedSearchProps) {
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters)
  const [availableFilters, setAvailableFilters] = useState<AvailableFilters | null>(null)
  const [showFilters, setShowFilters] = useState(true)
  const [activeFilterCount, setActiveFilterCount] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const countActiveFilters = useCallback(() => {
    let count = 0
    if (filters.fileTypes.length > 0) count++
    if (filters.fileCategories.length > 0) count++
    if (filters.dateFrom || filters.dateTo) count++
    if (filters.sizeRange) count++
    if (filters.owner) count++
    if (filters.workspaceId) count++
    if (filters.hasComments !== undefined) count++
    if (filters.isShared !== undefined) count++
    if (filters.tags.length > 0) count++
    return count
  }, [filters])

  useEffect(() => {
    setActiveFilterCount(countActiveFilters())
  }, [countActiveFilters])

  const search = useCallback(async (searchFilters: SearchFilters, pageNum = 1) => {
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const params = new URLSearchParams()

      if (searchFilters.query) params.set('query', searchFilters.query)
      if (searchFilters.fileTypes.length > 0) params.set('fileTypes', searchFilters.fileTypes.join(','))
      if (searchFilters.fileCategories.length > 0) params.set('fileCategories', searchFilters.fileCategories.join(','))
      if (searchFilters.dateFrom) params.set('dateFrom', searchFilters.dateFrom.toISOString())
      if (searchFilters.dateTo) params.set('dateTo', searchFilters.dateTo.toISOString())
      if (searchFilters.sizeRange) {
        params.set('sizeMin', searchFilters.sizeRange.min.toString())
        if (searchFilters.sizeRange.max) params.set('sizeMax', searchFilters.sizeRange.max.toString())
      }
      if (searchFilters.owner) params.set('owner', searchFilters.owner)
      if (searchFilters.workspaceId) params.set('workspaceId', searchFilters.workspaceId)
      if (searchFilters.hasComments !== undefined) params.set('hasComments', searchFilters.hasComments.toString())
      if (searchFilters.isShared !== undefined) params.set('isShared', searchFilters.isShared.toString())
      if (searchFilters.tags.length > 0) params.set('tags', searchFilters.tags.join(','))
      params.set('sortBy', searchFilters.sortBy)
      params.set('sortOrder', searchFilters.sortOrder)
      params.set('page', pageNum.toString())
      params.set('limit', '20')

      const response = await fetch(`/api/workdrive/search?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) throw new Error('Search failed')

      const data = await response.json()

      if (pageNum === 1) {
        setResults(data.results || [])
      } else {
        setResults((prev) => [...prev, ...(data.results || [])])
      }

      setTotal(data.total || 0)
      setHasMore(data.hasMore || false)
      setPage(pageNum)

      if (!availableFilters && data.filters) {
        setAvailableFilters(data.filters)
      }
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, availableFilters])

  useEffect(() => {
    if (open) {
      // Initial search to load available filters
      search(filters)
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [open])

  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, query: value }))

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      search({ ...filters, query: value })
    }, 300)
  }

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    search(newFilters)
  }

  const handleClearFilters = () => {
    setFilters(defaultFilters)
    search(defaultFilters)
  }

  const loadMore = () => {
    search(filters, page + 1)
  }

  const getFileIcon = (category: string) => {
    return categoryIcons[category] || <File className="h-4 w-4" />
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-500" />
            Advanced Search
          </DialogTitle>
        </DialogHeader>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search files by name, type, or content..."
            className="pl-10 pr-10"
            value={filters.query}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {filters.query && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => handleSearch('')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-1 gap-4 min-h-0">
          {/* Filters Sidebar */}
          <Collapsible
            open={showFilters}
            onOpenChange={setShowFilters}
            className="w-64 shrink-0"
          >
            <div className="flex items-center justify-between mb-2">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0 h-auto">
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {activeFilterCount}
                    </Badge>
                  )}
                  {showFilters ? (
                    <ChevronUp className="h-4 w-4 ml-2" />
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-2" />
                  )}
                </Button>
              </CollapsibleTrigger>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={handleClearFilters}
                >
                  Clear all
                </Button>
              )}
            </div>

            <CollapsibleContent>
              <ScrollArea className="h-[calc(60vh-100px)] pr-4">
                <div className="space-y-4">
                  {/* File Categories */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">File Type</Label>
                    <div className="space-y-2">
                      {availableFilters?.categories.map((category) => (
                        <div key={category} className="flex items-center gap-2">
                          <Checkbox
                            id={`cat-${category}`}
                            checked={filters.fileCategories.includes(category)}
                            onCheckedChange={(checked) => {
                              const newCategories = checked
                                ? [...filters.fileCategories, category]
                                : filters.fileCategories.filter((c) => c !== category)
                              handleFilterChange('fileCategories', newCategories)
                            }}
                          />
                          <label
                            htmlFor={`cat-${category}`}
                            className="flex items-center gap-2 text-sm cursor-pointer"
                          >
                            {getFileIcon(category)}
                            <span className="capitalize">{category}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Date Range */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Date Range</Label>
                    <div className="space-y-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <Calendar className="h-4 w-4 mr-2" />
                            {filters.dateFrom
                              ? filters.dateFrom.toLocaleDateString()
                              : 'From date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={filters.dateFrom}
                            onSelect={(date) => handleFilterChange('dateFrom', date)}
                          />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <Calendar className="h-4 w-4 mr-2" />
                            {filters.dateTo
                              ? filters.dateTo.toLocaleDateString()
                              : 'To date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={filters.dateTo}
                            onSelect={(date) => handleFilterChange('dateTo', date)}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <Separator />

                  {/* File Size */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">File Size</Label>
                    <Select
                      value={
                        filters.sizeRange
                          ? `${filters.sizeRange.min}-${filters.sizeRange.max || ''}`
                          : ''
                      }
                      onValueChange={(value) => {
                        if (value === '') {
                          handleFilterChange('sizeRange', undefined)
                        } else {
                          const range = availableFilters?.sizeRanges.find(
                            (r) => `${r.min}-${r.max || ''}` === value
                          )
                          if (range) {
                            handleFilterChange('sizeRange', { min: range.min, max: range.max })
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <HardDrive className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Any size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any size</SelectItem>
                        {availableFilters?.sizeRanges.map((range) => (
                          <SelectItem
                            key={`${range.min}-${range.max}`}
                            value={`${range.min}-${range.max || ''}`}
                          >
                            {range.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Workspace */}
                  {availableFilters && availableFilters.workspaces.length > 0 && (
                    <>
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Workspace</Label>
                        <Select
                          value={filters.workspaceId || ''}
                          onValueChange={(value) => handleFilterChange('workspaceId', value || undefined)}
                        >
                          <SelectTrigger className="w-full">
                            <Folder className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="All workspaces" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">All workspaces</SelectItem>
                            {availableFilters.workspaces.map((ws) => (
                              <SelectItem key={ws.id} value={ws.id}>
                                {ws.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Owner */}
                  {availableFilters && availableFilters.owners.length > 0 && (
                    <>
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Owner</Label>
                        <Select
                          value={filters.owner || ''}
                          onValueChange={(value) => handleFilterChange('owner', value || undefined)}
                        >
                          <SelectTrigger className="w-full">
                            <User className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Any owner" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Any owner</SelectItem>
                            {availableFilters.owners.map((owner) => (
                              <SelectItem key={owner.id} value={owner.id}>
                                {owner.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Tags */}
                  {availableFilters && availableFilters.tags.length > 0 && (
                    <>
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Tags</Label>
                        <div className="flex flex-wrap gap-1">
                          {availableFilters.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant={filters.tags.includes(tag) ? 'default' : 'outline'}
                              className="cursor-pointer"
                              onClick={() => {
                                const newTags = filters.tags.includes(tag)
                                  ? filters.tags.filter((t) => t !== tag)
                                  : [...filters.tags, tag]
                                handleFilterChange('tags', newTags)
                              }}
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Additional Filters */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Additional</Label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="has-comments"
                          checked={filters.hasComments === true}
                          onCheckedChange={(checked) =>
                            handleFilterChange('hasComments', checked ? true : undefined)
                          }
                        />
                        <label htmlFor="has-comments" className="text-sm cursor-pointer">
                          Has comments
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="is-shared"
                          checked={filters.isShared === true}
                          onCheckedChange={(checked) =>
                            handleFilterChange('isShared', checked ? true : undefined)
                          }
                        />
                        <label htmlFor="is-shared" className="text-sm cursor-pointer">
                          Shared files
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>

          {/* Results */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Sort Controls */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                {total} result{total !== 1 ? 's' : ''} found
              </span>
              <div className="flex items-center gap-2">
                <Select
                  value={filters.sortBy}
                  onValueChange={(value: any) => handleFilterChange('sortBy', value)}
                >
                  <SelectTrigger className="w-28 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="size">Size</SelectItem>
                    <SelectItem value="type">Type</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    handleFilterChange('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')
                  }
                >
                  {filters.sortOrder === 'asc' ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Results List */}
            <ScrollArea className="flex-1">
              {loading && results.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : results.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Search className="h-12 w-12 mb-2 opacity-50" />
                  <p>No files found</p>
                  <p className="text-sm">Try adjusting your search or filters</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {results.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => onFileSelect?.(file)}
                    >
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
                        {getFileIcon(file.fileCategory)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <HardDrive className="h-3 w-3" />
                            {formatFileSize(file.fileSizeBytes)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(file.createdAt)}
                          </span>
                          {file.workspaceName && (
                            <span className="flex items-center gap-1">
                              <Folder className="h-3 w-3" />
                              {file.workspaceName}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {file.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}

                  {hasMore && (
                    <Button
                      variant="outline"
                      className="w-full mt-4"
                      onClick={loadMore}
                      disabled={loading}
                    >
                      {loading ? 'Loading...' : 'Load more'}
                    </Button>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AdvancedSearch
