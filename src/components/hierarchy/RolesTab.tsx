'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Search, UserCog, Briefcase } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Role {
  id: string;
  role_name: string;
  role_code: string;
  description?: string;
  level: number;
  department_id: string | null;
  department?: {
    id: string;
    name: string;
    code: string;
  };
  parent_role_id: string | null;
  parent_role?: {
    id: string;
    role_name: string;
    role_code: string;
  };
  responsibilities?: string[];
  duties_tasks?: string[];
  can_approve_leaves: boolean;
  can_approve_attendance: boolean;
  max_reportees: number | null;
  is_active: boolean;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

export default function RolesTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    role_name: '',
    role_code: '',
    description: '',
    department_id: '',
    parent_role_id: '',
    level: '1',
    can_approve_leaves: false,
    can_approve_attendance: false,
    max_reportees: '',
  });

  useEffect(() => {
    fetchRoles();
    fetchDepartments();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/hierarchy/roles');
      const data = await response.json();

      if (data.success) {
        setRoles(data.data);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch roles',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/hierarchy/departments');
      const data = await response.json();

      if (data.success) {
        setDepartments(data.data);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = editingRole
        ? `/api/hierarchy/roles/${editingRole.id}`
        : '/api/hierarchy/roles';

      const method = editingRole ? 'PUT' : 'POST';

      const payload: Record<string, unknown> = {
        role_name: formData.role_name,
        role_code: formData.role_code,
        description: formData.description || undefined,
        department_id: formData.department_id || null,
        parent_role_id: formData.parent_role_id || null,
        level: parseInt(formData.level),
        can_approve_leaves: formData.can_approve_leaves,
        can_approve_attendance: formData.can_approve_attendance,
        max_reportees: formData.max_reportees ? parseInt(formData.max_reportees) : null,
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: `Role ${editingRole ? 'updated' : 'created'} successfully`,
        });
        setIsDialogOpen(false);
        resetForm();
        fetchRoles();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to save role',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving role:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      role_name: role.role_name,
      role_code: role.role_code,
      description: role.description || '',
      department_id: role.department_id || '',
      parent_role_id: role.parent_role_id || '',
      level: role.level.toString(),
      can_approve_leaves: role.can_approve_leaves,
      can_approve_attendance: role.can_approve_attendance,
      max_reportees: role.max_reportees?.toString() || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/hierarchy/roles/${roleId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Role deleted successfully',
        });
        fetchRoles();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete role',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting role:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      role_name: '',
      role_code: '',
      description: '',
      department_id: '',
      parent_role_id: '',
      level: '1',
      can_approve_leaves: false,
      can_approve_attendance: false,
      max_reportees: '',
    });
    setEditingRole(null);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const filteredRoles = roles.filter(
    (role) =>
      role.role_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.role_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.department?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getLevelLabel = (level: number) => {
    const labels: Record<number, string> = {
      1: 'Junior',
      2: 'Mid-Level',
      3: 'Senior',
      4: 'Lead',
      5: 'Manager',
      6: 'Senior Manager',
      7: 'Director',
      8: 'VP',
      9: 'C-Level',
      10: 'Executive',
    };
    return labels[level] || `Level ${level}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="h-6 w-6" />
            Organizational Roles
          </h2>
          <p className="text-muted-foreground">
            Manage roles, positions, and reporting structures
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Role
          </Button>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingRole ? 'Edit Role' : 'Create New Role'}
                </DialogTitle>
                <DialogDescription>
                  {editingRole
                    ? 'Update role details and reporting structure'
                    : 'Add a new organizational role or position'}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {/* Role Name */}
                <div className="grid gap-2">
                  <Label htmlFor="role_name">
                    Role Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="role_name"
                    value={formData.role_name}
                    onChange={(e) =>
                      setFormData({ ...formData, role_name: e.target.value })
                    }
                    placeholder="e.g., Senior Sales Manager"
                    required
                  />
                </div>

                {/* Role Code */}
                <div className="grid gap-2">
                  <Label htmlFor="role_code">
                    Role Code <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="role_code"
                    value={formData.role_code}
                    onChange={(e) =>
                      setFormData({ ...formData, role_code: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g., SR_SALES_MGR"
                    required
                  />
                </div>

                {/* Department */}
                <div className="grid gap-2">
                  <Label htmlFor="department_id">Department (Optional)</Label>
                  <Select
                    value={formData.department_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, department_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name} ({dept.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Parent Role */}
                <div className="grid gap-2">
                  <Label htmlFor="parent_role_id">Reports To (Parent Role)</Label>
                  <Select
                    value={formData.parent_role_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, parent_role_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent role (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None (Top Level)</SelectItem>
                      {roles
                        .filter((r) => r.id !== editingRole?.id)
                        .map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.role_name} {role.department ? `(${role.department.name})` : ''}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Level & Max Reportees */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="level">
                      Seniority Level <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.level}
                      onValueChange={(value) =>
                        setFormData({ ...formData, level: value })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                          <SelectItem key={level} value={level.toString()}>
                            {level} - {getLevelLabel(level)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="max_reportees">Max Reportees</Label>
                    <Input
                      id="max_reportees"
                      type="number"
                      min="0"
                      value={formData.max_reportees}
                      onChange={(e) =>
                        setFormData({ ...formData, max_reportees: e.target.value })
                      }
                      placeholder="e.g., 10"
                    />
                  </div>
                </div>

                {/* Permissions */}
                <div className="space-y-2">
                  <Label>Approval Permissions</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="can_approve_leaves"
                        checked={formData.can_approve_leaves}
                        onChange={(e) =>
                          setFormData({ ...formData, can_approve_leaves: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="can_approve_leaves" className="cursor-pointer">
                        Can approve leave requests
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="can_approve_attendance"
                        checked={formData.can_approve_attendance}
                        onChange={(e) =>
                          setFormData({ ...formData, can_approve_attendance: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="can_approve_attendance" className="cursor-pointer">
                        Can approve attendance corrections
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Role responsibilities and requirements"
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDialogClose}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading
                    ? 'Saving...'
                    : editingRole
                    ? 'Update Role'
                    : 'Create Role'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search roles by name, code, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            All Roles ({filteredRoles.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading roles...
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No roles match your search' : 'No roles found'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Reports To</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Max Team</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">
                        {role.role_name}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {role.role_code}
                        </code>
                      </TableCell>
                      <TableCell>{role.department?.name || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {role.parent_role?.role_name || 'None'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          L{role.level} - {getLevelLabel(role.level)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {role.max_reportees || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {role.can_approve_leaves && (
                            <Badge variant="secondary" className="text-xs">
                              Leaves
                            </Badge>
                          )}
                          {role.can_approve_attendance && (
                            <Badge variant="secondary" className="text-xs">
                              Attendance
                            </Badge>
                          )}
                          {!role.can_approve_leaves && !role.can_approve_attendance && '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {role.is_active ? (
                          <Badge variant="default" className="bg-green-600">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(role)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(role.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
