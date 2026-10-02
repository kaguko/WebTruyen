import React, { useState } from 'react';
import { LogOut, Trash2, User, X } from 'lucide-react';
import { api, AccountUser } from '../services/api';

interface AccountModalProps {
  user: AccountUser | null;
  onAuthenticated: (user: AccountUser) => Promise<void>;
  onLogout: () => Promise<void>;
  onDeleted: () => Promise<void>;
  onClose: () => void;
}

const field =
  'w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

export const AccountModal: React.FC<AccountModalProps> = ({ user, onAuthenticated, onLogout, onDeleted, onClose }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { user: u } =
        mode === 'login'
          ? await api.auth.login({ email, password })
          : await api.auth.register({ email, password, name: name || undefined });
      await onAuthenticated(u);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4 text-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-extrabold">
            <User className="w-5 h-5 text-emerald-700" />
            <span>{user ? 'Tài khoản' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</span>
          </div>
          <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {user ? (
          <div className="space-y-4">
            <div className="text-sm">
              <div className="font-bold">{user.name}</div>
              <div className="text-stone-500">{user.email}</div>
            </div>
            <p className="text-xs text-stone-500">
              Lịch sử đọc, tủ truyện, ghi chú và cài đặt đọc được đồng bộ giữa các thiết bị. Truyện tải offline chỉ lưu trên máy này.
            </p>
            <button
              onClick={() => void run(onLogout)}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-sm font-bold cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Đăng xuất
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-red-600 hover:underline cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Xóa tài khoản
              </button>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await api.auth.deleteAccount(password);
                    await onDeleted();
                  });
                }}
                className="space-y-2 border border-red-200 bg-red-50 rounded-xl p-3"
              >
                <p className="text-xs text-red-700">Xóa vĩnh viễn tài khoản và dữ liệu đồng bộ. Nhập mật khẩu để xác nhận.</p>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu" className={field} />
                <button disabled={busy} className="w-full py-2 rounded-xl bg-red-600 text-white text-sm font-bold cursor-pointer">
                  Xóa tài khoản
                </button>
              </form>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {mode === 'register' && (
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên hiển thị (tùy chọn)" maxLength={40} className={field} />
            )}
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className={field}
            />
            <input
              type="password"
              required
              minLength={mode === 'register' ? 8 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Mật khẩu (từ 8 ký tự)' : 'Mật khẩu'}
              className={field}
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-bold cursor-pointer"
            >
              {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
            </button>
            <p className="text-xs text-stone-500 text-center">
              {mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError('');
                }}
                className="font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                {mode === 'login' ? 'Đăng ký' : 'Đăng nhập'}
              </button>
            </p>
            <p className="text-[11px] text-stone-400 text-center">
              Dữ liệu đọc hiện có trên máy này sẽ được gộp vào tài khoản.
            </p>
          </form>
        )}
        {user && error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
};
