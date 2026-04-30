'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useConfirmationDialog, ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { fetchWithErrorHandling, showSuccessToast } from '@/lib/errors/client-errors'

export function BulkOperations({ admins, onComplete }: { admins: unknown[]; onComplete: () => void }) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [action, setAction] = React.useState('')
  const { isOpen, config, openDialog, closeDialog } = useConfirmationDialog()

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(admins.map(a => a.id)))
  const clearAll = () => setSelected(new Set())

  const executeBulkAction = async () => {
    const ids = Array.from(selected)

    openDialog({
      action: 'custom',
      title: `Bulk ${action}`,
      description: `This will affect ${ids.length} admin(s)`,
      confirmText: 'Confirm',
      onConfirm: async () => {
        const result = await fetchWithErrorHandling('/api/admin-management/bulk', {
          method: 'POST',
          body: JSON.stringify({ action, adminIds: ids })
        })

        if (result.success) {
          showSuccessToast(`Bulk ${action} completed`)
          clearAll()
          onComplete()
        }
        closeDialog()
      }
    })
  }

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        <Button variant="outline" size="sm" onClick={selected.size > 0 ? clearAll : selectAll}>
          {selected.size > 0 ? 'Clear All' : 'Select All'}
        </Button>

        {selected.size > 0 && (
          <>
            <span className="text-sm text-gray-600">{selected.size} selected</span>

            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Bulk Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enable">Enable</SelectItem>
                <SelectItem value="disable">Disable</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="reset_password">Reset Password</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={executeBulkAction} disabled={!action}>
              Execute
            </Button>
          </>
        )}
      </div>

      {admins.map(admin => (
        <div key={admin.id} className="flex items-center gap-2">
          <Checkbox checked={selected.has(admin.id)} onCheckedChange={() => toggleSelect(admin.id)} />
          <span>{admin.full_name}</span>
        </div>
      ))}

      <ConfirmationDialog open={isOpen} onOpenChange={closeDialog} onConfirm={config.onConfirm || (() => {})} {...config} />
    </>
  )
}
