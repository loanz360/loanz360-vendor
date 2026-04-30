'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, Search, Filter, HardDrive, FileText, FolderOpen,
  ChevronRight, ChevronDown, Eye, Download, Trash2, RefreshCw,
  Loader2, AlertTriangle, User, Building2, MoreVertical, X
} from 'lucide-react'

interface EmployeeFile {
  id: string
  name: string
  type: 'file' | 'folder'
  size: number
  mimeType?: string
  createdAt: string
  modifiedAt: string
  path: string
}

interface Employee {
  id: string
  name: string
  email: string
  department: string
  role: string
  avatar?: string
  storageUsed: number
  storageLimit: number
  fileCount: number
  lastActivity: string
  isEnabled: boolean
}

interface AdminEmployeeExplorerProps {
  onFetchEmployees: (filters: { search?: string; department?: string }) => Promise<Employee[]>
  onFetchEmployeeFiles: (employeeId: string, path?: string) => Promise<EmployeeFile[]>
  onPreviewFile: (fileId: string) => void
  onDownloadFile: (fileId: string) => Promise<void>
  onDeleteFile: (fileId: string) => Promise<void>
  onUpdateQuota: (employeeId: string, newLimitGB: number) => Promise<void>
}

export default function AdminEmployeeExplorer({
  onFetchEmployees,
  onFetchEmployeeFiles,
  onPreviewFile,
  onDownloadFile,
  onDeleteFile,
  onUpdateQuota,
}: AdminEmployeeExplorerProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [employeeFiles, setEmployeeFiles] = useState<EmployeeFile[]>([])
  const [currentPath, setCurrentPath] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'storage' | 'files'>('storage')
  const [showQuotaModal, setShowQuotaModal] = useState(false)
  const [newQuotaGB, setNewQuotaGB] = useState(10)

  const departments = [...new Set(employees.map(e => e.department))].filter(Boolean)

  const loadEmployees = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await onFetchEmployees({
        search: searchQuery || undefined,
        department: departmentFilter || undefined,
      })
      setEmployees(data)
    } catch (error) {
      console.error('Failed to load employees:', error)
    } finally {
      setIsLoading(false)
    }
  }, [onFetchEmployees, searchQuery, departmentFilter])

  const loadEmployeeFiles = useCallback(async (employeeId: string, path?: string) => {
    setIsLoadingFiles(true)
    try {
      const files = await onFetchEmployeeFiles(employeeId, path)
      setEmployeeFiles(files)
    } catch (error) {
      console.error('Failed to load files:', error)
      setEmployeeFiles([])
    } finally {
      setIsLoadingFiles(false)
    }
  }, [onFetchEmployeeFiles])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  useEffect(() => {
    if (selectedEmployee) {
      loadEmployeeFiles(selectedEmployee.id, currentPath.join('/'))
    }
  }, [selectedEmployee, currentPath, loadEmployeeFiles])

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getUsagePercent = (used: number, limit: number): number => {
    if (limit <= 0) return 0
    return Math.min(100, (used / limit) * 100)
  }

  const getUsageColor = (percent: number): string => {
    if (percent >= 90) return 'bg-red-500'
    if (percent >= 75) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const handleSelectEmployee = (employee: Employee) => {
    setSelectedEmployee(employee)
    setCurrentPath([])
  }

  const handleNavigateFolder = (folderName: string) => {
    setCurrentPath([...currentPath, folderName])
  }

  const handleNavigateUp = () => {
    setCurrentPath(currentPath.slice(0, -1))
  }

  const handleBreadcrumbClick = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1))
  }

  const handleUpdateQuota = async () => {
    if (!selectedEmployee) return
    try {
      await onUpdateQuota(selectedEmployee.id, newQuotaGB)
      setShowQuotaModal(false)
      await loadEmployees()
    } catch (error) {
      console.error('Failed to update quota:', error)
    }
  }

  const sortedEmployees = [...employees].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'storage':
        return b.storageUsed - a.storageUsed
      case 'files':
        return b.fileCount - a.fileCount
      default:
        return 0
    }
  })

  const getFileIcon = (file: EmployeeFile) => {
    if (file.type === 'folder') return <FolderOpen className="w-5 h-5 text-yellow-400" />
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return '🖼️'
    if (['pdf'].includes(ext || '')) return '📄'
    if (['doc', 'docx'].includes(ext || '')) return '📝'
    if (['xls', 'xlsx'].includes(ext || '')) return '📊'
    if (['ppt', 'pptx'].includes(ext || '')) return '📽️'
    if (['zip', 'rar', '7z'].includes(ext || '')) return '📦'
    return '📁'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-7 h-7 text-orange-500" />
            Employee Storage Explorer
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Browse and manage employee files as Super Admin
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee List */}
        <div className="lg:col-span-1 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl overflow-hidden">
          {/* Search and Filter */}
          <div className="p-4 border-b border-white/10 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500/50"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as unknown)}
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500/50"
              >
                <option value="storage">By Storage</option>
                <option value="name">By Name</option>
                <option value="files">By Files</option>
              </select>
            </div>
          </div>

          {/* Employee List */}
          <div className="max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
              </div>
            ) : sortedEmployees.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No employees found</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {sortedEmployees.map((employee) => {
                  const usagePercent = getUsagePercent(employee.storageUsed, employee.storageLimit)
                  return (
                    <div
                      key={employee.id}
                      onClick={() => handleSelectEmployee(employee)}
                      className={`p-4 cursor-pointer transition-colors ${
                        selectedEmployee?.id === employee.id
                          ? 'bg-orange-500/20'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/30 to-orange-600/20 flex items-center justify-center">
                          <User className="w-5 h-5 text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{employee.name}</p>
                          <p className="text-xs text-gray-500 truncate">{employee.email}</p>
                        </div>
                        {usagePercent >= 90 && (
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">{formatBytes(employee.storageUsed)}</span>
                          <span className="text-gray-500">{formatBytes(employee.storageLimit)}</span>
                        </div>
                        <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getUsageColor(usagePercent)} transition-all`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {employee.department || 'No Department'}
                        </span>
                        <span>{employee.fileCount} files</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* File Browser */}
        <div className="lg:col-span-2 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-white/10 rounded-xl overflow-hidden">
          {!selectedEmployee ? (
            <div className="flex items-center justify-center h-full py-24 text-gray-500">
              <div className="text-center">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select an employee to view their files</p>
                <p className="text-sm mt-1">Click on any employee from the list</p>
              </div>
            </div>
          ) : (
            <>
              {/* Employee Info Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/30 to-orange-600/20 flex items-center justify-center">
                    <User className="w-6 h-6 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">{selectedEmployee.name}</p>
                    <p className="text-sm text-gray-400">{selectedEmployee.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Storage</p>
                    <p className="text-white font-medium">
                      {formatBytes(selectedEmployee.storageUsed)} / {formatBytes(selectedEmployee.storageLimit)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setNewQuotaGB(Math.round(selectedEmployee.storageLimit / (1024 * 1024 * 1024)))
                      setShowQuotaModal(true)
                    }}
                    className="px-3 py-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-colors text-sm"
                  >
                    Edit Quota
                  </button>
                </div>
              </div>

              {/* Breadcrumbs */}
              <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2 text-sm">
                <button
                  onClick={() => setCurrentPath([])}
                  className="text-orange-400 hover:underline"
                >
                  Root
                </button>
                {currentPath.map((folder, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                    <button
                      onClick={() => handleBreadcrumbClick(idx)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {folder}
                    </button>
                  </div>
                ))}
              </div>

              {/* Files */}
              <div className="max-h-[500px] overflow-y-auto">
                {isLoadingFiles ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                  </div>
                ) : employeeFiles.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No files in this location</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {currentPath.length > 0 && (
                      <div
                        onClick={handleNavigateUp}
                        className="p-4 flex items-center gap-4 hover:bg-white/5 cursor-pointer"
                      >
                        <FolderOpen className="w-5 h-5 text-gray-400" />
                        <span className="text-gray-400">..</span>
                      </div>
                    )}
                    {employeeFiles.map((file) => (
                      <div
                        key={file.id}
                        className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors group"
                      >
                        {file.type === 'folder' ? (
                          <div
                            onClick={() => handleNavigateFolder(file.name)}
                            className="flex items-center gap-4 flex-1 cursor-pointer"
                          >
                            {getFileIcon(file)}
                            <div className="flex-1 min-w-0">
                              <p className="text-white truncate">{file.name}</p>
                              <p className="text-xs text-gray-500">Folder</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-4 flex-1">
                            <span className="text-xl">{getFileIcon(file)}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-white truncate">{file.name}</p>
                              <p className="text-xs text-gray-500">
                                {formatBytes(file.size)} • {new Date(file.modifiedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        )}
                        {file.type === 'file' && (
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => onPreviewFile(file.id)}
                              className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
                              title="Preview"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDownloadFile(file.id)}
                              className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDeleteFile(file.id)}
                              className="p-2 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quota Modal */}
      {showQuotaModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Update Storage Quota</h3>
              <button
                onClick={() => setShowQuotaModal(false)}
                className="p-1 hover:bg-white/10 rounded-lg text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-400 mb-4">
              Set new storage limit for {selectedEmployee.name}
            </p>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Storage Limit (GB)</label>
              <input
                type="number"
                value={newQuotaGB}
                onChange={(e) => setNewQuotaGB(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-500/50"
                min="1"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowQuotaModal(false)}
                className="px-4 py-2 border border-white/20 rounded-lg text-gray-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateQuota}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg"
              >
                Update Quota
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
