'use client'

import { useState, useCallback, useMemo } from 'react'
import { useWorkDriveKeyboard, KeyboardAction } from '@/hooks/useWorkDriveKeyboard'
import { useWorkDriveDragDrop } from '@/hooks/useWorkDriveDragDrop'
import {
  Folder,
  File,
  FileText,
  Image,
  Table,
  Presentation,
  Archive,
  MoreVertical,
  Download,
  Trash2,
  Edit3,
  Share2,
  Star,
  StarOff,
  Eye,
  Grid,
  List,
  ChevronRight,
  Upload,
  FolderPlus,
  RefreshCw,
  RotateCcw,
  ArrowUpDown,
} from 'lucide-react'
import { WorkDriveFile, WorkDriveFolder, BreadcrumbItem, FileCategory } from '@/types/workdrive'
import { formatFileSize } from '@/lib/workdrive/workdrive-utils'

interface FileExplorerProps {
  files: WorkDriveFile[]
  folders: WorkDriveFolder[]
  breadcrumbs: BreadcrumbItem[]
  currentView?: 'my-drive' | 'shared' | 'recent' | 'favorites' | 'trash'
  isLoading?: boolean
  viewMode?: 'grid' | 'list'
  sortBy?: 'name' | 'date' | 'size'
  sortOrder?: 'asc' | 'desc'
  onViewModeChange?: (mode: 'grid' | 'list') => void
  onSortChange?: (sortBy: 'name' | 'date' | 'size') => void
  onFileClick?: (file: WorkDriveFile) => void
  onFolderClick?: (folder: WorkDriveFolder) => void
  onBreadcrumbClick?: (index: number) => void
  onDownload?: (file: WorkDriveFile) => void
  onDelete?: (item: WorkDriveFile | WorkDriveFolder) => void
  onRename?: (item: WorkDriveFile | WorkDriveFolder, type: 'file' | 'folder') => void
  onShare?: (file: WorkDriveFile | WorkDriveFolder) => void
  onToggleFavorite?: (file: WorkDriveFile) => void
  onUpload?: () => void
  onNewFolder?: () => void
  onRefresh?: () => void
  onRestore?: (file: WorkDriveFile) => void
  onEmptyTrash?: () => void
  selectedItems?: string[]
  onSelectionChange?: (ids: string[]) => void
  // Keyboard shortcuts
  enableKeyboardShortcuts?: boolean
  onSearch?: () => void
  onCopy?: () => void
  onCut?: () => void
  onPaste?: () => void
  // Drag and drop
  enableDragDrop?: boolean
  onMove?: (items: { id: string; type: 'file' | 'folder' }[], targetFolderId: string) => void
  onFileDrop?: (files: FileList, targetFolderId?: string) => void
}

const FILE_ICONS: Record<FileCategory, typeof File> = {
  document: FileText,
  image: Image,
  spreadsheet: Table,
  presentation: Presentation,
  archive: Archive,
  other: File,
}

export default function FileExplorer({
  files,
  folders,
  breadcrumbs = [],
  currentView = 'my-drive',
  isLoading = false,
  viewMode = 'grid',
  sortBy = 'name',
  sortOrder = 'asc',
  onViewModeChange,
  onSortChange,
  onFileClick,
  onFolderClick,
  onBreadcrumbClick,
  onDownload,
  onDelete,
  onRename,
  onShare,
  onToggleFavorite,
  onUpload,
  onNewFolder,
  onRefresh,
  onRestore,
  onEmptyTrash,
  selectedItems = [],
  onSelectionChange,
  // Keyboard shortcuts
  enableKeyboardShortcuts = true,
  onSearch,
  onCopy,
  onCut,
  onPaste,
  // Drag and drop
  enableDragDrop = true,
  onMove,
  onFileDrop,
}: FileExplorerProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    item: WorkDriveFile | WorkDriveFolder
    type: 'file' | 'folder'
  } | null>(null)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)

  // All items (folders first, then files)
  const allItems = useMemo(() => {
    const folderItems = folders.map((f) => ({ ...f, itemType: 'folder' as const }))
    const fileItems = files.map((f) => ({ ...f, itemType: 'file' as const }))
    return [...folderItems, ...fileItems]
  }, [folders, files])

  // Get first selected item for single-selection actions
  const firstSelectedItem = useMemo(() => {
    if (selectedItems.length === 0) return null
    return allItems.find((item) => selectedItems.includes(item.id)) || null
  }, [selectedItems, allItems])

  // Keyboard action handler
  const handleKeyboardAction = useCallback(
    (action: KeyboardAction) => {
      switch (action) {
        case 'upload':
          onUpload?.()
          break
        case 'newFolder':
          onNewFolder?.()
          break
        case 'delete':
          if (firstSelectedItem) {
            onDelete?.(firstSelectedItem)
          }
          break
        case 'rename':
          if (firstSelectedItem) {
            onRename?.(firstSelectedItem, firstSelectedItem.itemType)
          }
          break
        case 'copy':
          onCopy?.()
          break
        case 'cut':
          onCut?.()
          break
        case 'paste':
          onPaste?.()
          break
        case 'selectAll':
          onSelectionChange?.(allItems.map((item) => item.id))
          break
        case 'deselectAll':
        case 'escape':
          onSelectionChange?.([])
          setContextMenu(null)
          break
        case 'search':
          onSearch?.()
          break
        case 'refresh':
          onRefresh?.()
          break
        case 'download':
          if (firstSelectedItem && firstSelectedItem.itemType === 'file') {
            onDownload?.(firstSelectedItem as WorkDriveFile)
          }
          break
        case 'share':
          if (firstSelectedItem) {
            onShare?.(firstSelectedItem)
          }
          break
        case 'enter':
          if (firstSelectedItem) {
            if (firstSelectedItem.itemType === 'folder') {
              onFolderClick?.(firstSelectedItem as WorkDriveFolder)
            } else {
              onFileClick?.(firstSelectedItem as WorkDriveFile)
            }
          }
          break
        case 'moveUp':
        case 'moveDown':
        case 'moveLeft':
        case 'moveRight': {
          const currentIndex = focusedIndex >= 0 ? focusedIndex : 0
          let newIndex = currentIndex
          const cols = viewMode === 'list' ? 1 : 6 // Approximate columns in grid

          if (action === 'moveUp') {
            newIndex = Math.max(0, currentIndex - cols)
          } else if (action === 'moveDown') {
            newIndex = Math.min(allItems.length - 1, currentIndex + cols)
          } else if (action === 'moveLeft') {
            newIndex = Math.max(0, currentIndex - 1)
          } else if (action === 'moveRight') {
            newIndex = Math.min(allItems.length - 1, currentIndex + 1)
          }

          if (newIndex !== currentIndex && allItems[newIndex]) {
            setFocusedIndex(newIndex)
            onSelectionChange?.([allItems[newIndex].id])
          }
          break
        }
        case 'toggleSelection':
          if (focusedIndex >= 0 && allItems[focusedIndex]) {
            const itemId = allItems[focusedIndex].id
            if (selectedItems.includes(itemId)) {
              onSelectionChange?.(selectedItems.filter((id) => id !== itemId))
            } else {
              onSelectionChange?.([...selectedItems, itemId])
            }
          }
          break
        case 'navigateUp':
          onBreadcrumbClick?.(-1)
          break
        case 'navigateBack':
          // Go back in breadcrumb
          if (breadcrumbs.length > 0) {
            onBreadcrumbClick?.(breadcrumbs.length - 2)
          }
          break
      }
    },
    [
      onUpload,
      onNewFolder,
      onDelete,
      onRename,
      onCopy,
      onCut,
      onPaste,
      onSearch,
      onRefresh,
      onDownload,
      onShare,
      onFileClick,
      onFolderClick,
      onBreadcrumbClick,
      onSelectionChange,
      firstSelectedItem,
      allItems,
      selectedItems,
      focusedIndex,
      viewMode,
      breadcrumbs,
    ]
  )

  // Enable keyboard shortcuts
  useWorkDriveKeyboard({
    onAction: handleKeyboardAction,
    enabled: enableKeyboardShortcuts,
  })

  // Drag and drop
  const { isDraggingOver, getFileDropZoneProps, getDragSourceProps, getDropTargetProps } =
    useWorkDriveDragDrop({
      enabled: enableDragDrop,
      onDrop: (items, target) => {
        if (target.type === 'folder' && onMove) {
          onMove(
            items.map((item) => ({ id: item.id, type: item.type })),
            target.id
          )
        }
      },
      onFileDrop: (fileList, target) => {
        if (onFileDrop) {
          onFileDrop(fileList, target?.id)
        } else if (onUpload) {
          onUpload()
        }
      },
    })

  const handleContextMenu = (
    e: React.MouseEvent,
    item: WorkDriveFile | WorkDriveFolder,
    type: 'file' | 'folder'
  ) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item,
      type,
    })
  }

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return 'Today'
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const getFileIcon = (category: FileCategory) => {
    return FILE_ICONS[category] || File
  }

  const isEmpty = files.length === 0 && folders.length === 0

  return (
    <div
      className={`flex-1 flex flex-col ${isDraggingOver ? 'ring-2 ring-orange-500 ring-inset' : ''}`}
      onClick={closeContextMenu}
      {...getFileDropZoneProps()}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm">
          <button
            onClick={() => onBreadcrumbClick?.(-1)}
            className={`px-2 py-1 rounded hover:bg-white/10 transition-colors ${
              breadcrumbs.length === 0
                ? 'text-white font-medium'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {currentView === 'my-drive' ? 'My Drive' :
             currentView === 'shared' ? 'Shared with me' :
             currentView === 'recent' ? 'Recent' :
             currentView === 'favorites' ? 'Favorites' :
             currentView === 'trash' ? 'Trash' : 'Files'}
          </button>
          {breadcrumbs.map((item, index) => (
            <div key={item.id} className="flex items-center">
              <ChevronRight className="w-4 h-4 text-gray-500 mx-1" />
              <button
                onClick={() => onBreadcrumbClick?.(index)}
                className={`px-2 py-1 rounded hover:bg-white/10 transition-colors ${
                  index === breadcrumbs.length - 1
                    ? 'text-white font-medium'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {item.name}
              </button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
          {onNewFolder && currentView !== 'trash' && (
            <button
              onClick={onNewFolder}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="New Folder"
            >
              <FolderPlus className="w-5 h-5" />
            </button>
          )}
          {onUpload && currentView !== 'trash' && (
            <button
              onClick={onUpload}
              className="flex items-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
          )}
          {currentView === 'trash' && onEmptyTrash && (files.length > 0 || folders.length > 0) && (
            <button
              onClick={onEmptyTrash}
              className="flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Empty Trash
            </button>
          )}
          <div className="flex items-center border border-white/20 rounded-lg">
            <button
              onClick={() => onViewModeChange?.('grid')}
              className={`p-2 transition-colors ${
                viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => onViewModeChange?.('list')}
              className={`p-2 transition-colors ${
                viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Folder className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">This folder is empty</p>
            <p className="text-sm">Upload files or create folders to get started</p>
            {onUpload && (
              <button
                onClick={onUpload}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload Files
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {/* Folders */}
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="group relative bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-4 cursor-pointer transition-colors"
                onClick={() => onFolderClick?.(folder)}
                onContextMenu={(e) => handleContextMenu(e, folder, 'folder')}
              >
                <div className="flex flex-col items-center">
                  <Folder
                    className="w-12 h-12 mb-2"
                    style={{ color: folder.color || '#6B7280' }}
                  />
                  <p className="text-sm text-white text-center truncate w-full">
                    {folder.name}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleContextMenu(e, folder, 'folder')
                  }}
                  className="absolute top-2 right-2 p-1 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* Files */}
            {files.map((file) => {
              const FileIcon = getFileIcon(file.file_category)
              return (
                <div
                  key={file.id}
                  className="group relative bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-4 cursor-pointer transition-colors"
                  onClick={() => onFileClick?.(file)}
                  onContextMenu={(e) => handleContextMenu(e, file, 'file')}
                >
                  <div className="flex flex-col items-center">
                    {file.thumbnail_s3_key && file.file_category === 'image' ? (
                      <div className="w-12 h-12 mb-2 bg-gray-700 rounded flex items-center justify-center overflow-hidden">
                        <Image className="w-8 h-8 text-gray-400" />
                      </div>
                    ) : (
                      <FileIcon className="w-12 h-12 mb-2 text-blue-400" />
                    )}
                    <p className="text-sm text-white text-center truncate w-full">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.file_size_bytes)}
                    </p>
                  </div>
                  {file.is_favorite && (
                    <Star className="absolute top-2 left-2 w-4 h-4 text-yellow-500 fill-yellow-500" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleContextMenu(e, file, 'file')
                    }}
                    className="absolute top-2 right-2 p-1 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          /* List View */
          <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-white/5 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Modified</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Size</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Owner</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {/* Folders */}
                {folders.map((folder) => (
                  <tr
                    key={folder.id}
                    className="hover:bg-white/5 cursor-pointer"
                    onClick={() => onFolderClick?.(folder)}
                    onContextMenu={(e) => handleContextMenu(e, folder, 'folder')}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Folder
                          className="w-5 h-5"
                          style={{ color: folder.color || '#6B7280' }}
                        />
                        <span className="text-white text-sm">{folder.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {formatDate(folder.updated_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">-</td>
                    <td className="px-4 py-3 text-sm text-gray-400">-</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleContextMenu(e, folder, 'folder')
                        }}
                        className="p-1 text-gray-400 hover:text-white"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Files */}
                {files.map((file) => {
                  const FileIcon = getFileIcon(file.file_category)
                  return (
                    <tr
                      key={file.id}
                      className="hover:bg-white/5 cursor-pointer"
                      onClick={() => onFileClick?.(file)}
                      onContextMenu={(e) => handleContextMenu(e, file, 'file')}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {file.is_favorite && (
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          )}
                          <FileIcon className="w-5 h-5 text-blue-400" />
                          <span className="text-white text-sm">{file.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {formatDate(file.updated_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {formatFileSize(file.file_size_bytes)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {file.created_by_name || 'Unknown'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleContextMenu(e, file, 'file')
                          }}
                          className="p-1 text-gray-400 hover:text-white"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-gray-800 border border-white/20 rounded-lg shadow-xl py-2 z-50 min-w-48"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'file' && (
            <>
              <button
                onClick={() => {
                  onFileClick?.(contextMenu.item as WorkDriveFile)
                  closeContextMenu()
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
              <button
                onClick={() => {
                  onDownload?.(contextMenu.item as WorkDriveFile)
                  closeContextMenu()
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={() => {
                  onShare?.(contextMenu.item as WorkDriveFile)
                  closeContextMenu()
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
              <button
                onClick={() => {
                  onToggleFavorite?.(contextMenu.item as WorkDriveFile)
                  closeContextMenu()
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white"
              >
                {(contextMenu.item as WorkDriveFile).is_favorite ? (
                  <>
                    <StarOff className="w-4 h-4" />
                    Remove from Favorites
                  </>
                ) : (
                  <>
                    <Star className="w-4 h-4" />
                    Add to Favorites
                  </>
                )}
              </button>
              <div className="border-t border-white/10 my-1" />
            </>
          )}
          {currentView === 'trash' ? (
            <>
              {contextMenu.type === 'file' && onRestore && (
                <button
                  onClick={() => {
                    onRestore(contextMenu.item as WorkDriveFile)
                    closeContextMenu()
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-green-400 hover:bg-green-500/20 hover:text-green-300"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restore
                </button>
              )}
              <button
                onClick={() => {
                  onDelete?.(contextMenu.item)
                  closeContextMenu()
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
                Delete Permanently
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  onRename?.(contextMenu.item, contextMenu.type)
                  closeContextMenu()
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white"
              >
                <Edit3 className="w-4 h-4" />
                Rename
              </button>
              <button
                onClick={() => {
                  onDelete?.(contextMenu.item)
                  closeContextMenu()
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
