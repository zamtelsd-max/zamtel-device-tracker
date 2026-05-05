import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { User, UserRole } from '../types';

const ROLES: UserRole[] = ['trade_auditor', 'back_office', 'project_manager', 'head_of_sales', 'project_lead'];

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  const [form, setForm] = useState({ username: '', name: '', role: 'trade_auditor' as UserRole, password: '' });
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.name || !form.password) { toast.error('All fields required'); return; }
    setSaving(true);
    try {
      await api.post('/users', form);
      toast.success('User created!');
      setShowAddForm(false);
      setForm({ username: '', name: '', role: 'trade_auditor', password: '' });
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    } finally { setSaving(false); }
  };

  const handleToggleActive = async (u: User) => {
    try {
      await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
      toast.success(`User ${u.isActive ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch { toast.error('Update failed'); }
  };

  const handleChangeRole = async (u: User, role: UserRole) => {
    try {
      await api.patch(`/users/${u.id}`, { role });
      toast.success('Role updated');
      fetchUsers();
    } catch { toast.error('Update failed'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Admin — User Management</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-zamtel-green text-white rounded-lg text-sm font-medium hover:bg-zamtel-green-dark"
        >
          + Add User
        </button>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border-2 border-zamtel-green p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">New User</h2>
          <form onSubmit={handleAdd} className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Username"
              value={form.username}
              onChange={e => setForm(f => ({...f, username: e.target.value}))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
            />
            <input
              type="text"
              placeholder="Full Name"
              value={form.name}
              onChange={e => setForm(f => ({...f, name: e.target.value}))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
            />
            <select
              value={form.role}
              onChange={e => setForm(f => ({...f, role: e.target.value as UserRole}))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
            >
              {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={e => setForm(f => ({...f, password: e.target.value}))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
            />
            <div className="col-span-2 md:col-span-4 flex gap-3">
              <button type="submit" disabled={saving}
                className="px-5 py-2 bg-zamtel-green text-white rounded-lg text-sm font-medium hover:bg-zamtel-green-dark disabled:opacity-50">
                {saving ? 'Creating...' : 'Create User'}
              </button>
              <button type="button" onClick={() => setShowAddForm(false)}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-zamtel-green" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Username</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Created</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{u.name}</td>
                  <td className="py-3 px-4 font-mono text-gray-600">{u.username}</td>
                  <td className="py-3 px-4">
                    <select
                      value={u.role}
                      onChange={e => handleChangeRole(u, e.target.value as UserRole)}
                      className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-zamtel-green"
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-xs">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleToggleActive(u)}
                      className={`px-3 py-1 text-xs font-medium rounded-lg ${u.isActive ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                    >
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
