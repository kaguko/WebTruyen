import React, { useState } from 'react';
import { Lock, X } from 'lucide-react';

const SESSION_KEY = 'tf_admin_unlocked';
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined;

interface AdminGateProps {
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Client-side password gate for the admin portal.
 * NOTE: this only keeps casual visitors out. Real protection requires a backend.
 */
export const AdminGate: React.FC<AdminGateProps> = ({ onClose, children }) => {
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (unlocked) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ADMIN_PASSWORD && password === ADMIN_PASSWORD) {
      try {
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch {
        /* ignore */
      }
      setUnlocked(true);
    } else {
      setError('Mật khẩu không đúng.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-md flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4 text-stone-900"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-extrabold">
            <Lock className="w-5 h-5 text-emerald-700" />
            <span>Đăng nhập quản trị</span>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        {!ADMIN_PASSWORD && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
            Chưa cấu hình VITE_ADMIN_PASSWORD nên không thể đăng nhập. Xem README.
          </p>
        )}
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
          className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold cursor-pointer"
        >
          Đăng nhập
        </button>
      </form>
    </div>
  );
};
