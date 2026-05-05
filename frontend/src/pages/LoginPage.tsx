import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  React.useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'trade_auditor') navigate('/my-devices');
      else if (user.role === 'back_office') navigate('/closure-queue');
      else navigate('/dashboard');
    }
  }, [isAuthenticated, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) { toast.error('Enter username and password'); return; }
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zamtel-green via-zamtel-green-dark to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-zamtel-green px-8 pt-10 pb-8 text-center relative">
            <div className="w-20 h-20 bg-white rounded-full mx-auto flex items-center justify-center shadow-lg mb-4">
              <span className="text-4xl font-black text-zamtel-green leading-none">Z</span>
            </div>
            <h1 className="text-white text-2xl font-bold">Zamtel</h1>
            <p className="text-white/70 text-sm font-medium mt-1">Trade Auditor Device Tracker</p>
            <div className="mt-3 inline-block bg-zamtel-pink/20 rounded-full px-4 py-1">
              <span className="text-zamtel-pink text-xs font-semibold tracking-wider uppercase">Create Your World</span>
            </div>
            {/* Pink accent bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-zamtel-pink" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-zamtel-green transition-colors"
                placeholder="Enter your username"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm pr-12 focus:outline-none focus:border-zamtel-green transition-colors"
                  placeholder="Enter your password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-zamtel-green hover:bg-zamtel-green-dark text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60 text-base"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="px-8 pb-6 text-center text-xs text-gray-400">
            Zamtel Trade Audit System &copy; {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
}
