import React, { useEffect, useState } from 'react';
import { Lock, X } from 'lucide-react';
import { api } from '../services/api';

interface AdminGateProps {
  onClose: () => void;
  children: React.ReactNode;
}

/** Login gate for the admin portal. Authentication is verified by the server (HttpOnly session cookie). */
export const AdminGate: React.FC<AdminGateProps> = ({ onClose, children }) => {
  const [status, setStatus] = useState<'checking' | 'locked' | 'unlocked'>('checking');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.admin
      .me()
      .then((r) => setStatus(r.admin ? 'unlocked' : 'locked'))
      .catch(() => setStatus('locked'));
  }, []);

  if (status === 'unlocked') return <>{children}</>;
  if (status === 'checking') return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.admin.login(password);
      setStatus('unlocked');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-md flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4 text-stone-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-extrabold">
            <Lock className="w-5 h-5 text-emerald-700" />
            <span>Đăng nhập quản trị</span>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
          placeholder="Mật khẩu"
          className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-bold cursor-pointer"
        >
          Đăng nhập
        </button>
      </form>
    </div>
  );
};
