import React from 'react';

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Unhandled UI error:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-stone-50 text-stone-900">
        <h1 className="text-xl font-extrabold">Đã có lỗi xảy ra</h1>
        <p className="text-sm text-stone-600">Vui lòng tải lại trang. Dữ liệu đọc của bạn vẫn được giữ nguyên.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-sm font-bold cursor-pointer"
        >
          Tải lại trang
        </button>
      </div>
    );
  }
}
