import React from 'react';
import { BookOpen, Shield, Heart, ShoppingBag, Sparkles, Smartphone, WifiOff } from 'lucide-react';
import { Genre } from '../types';

interface FooterProps {
  onSelectGenre: (genre: Genre) => void;
  onOpenAdmin: () => void;
}

const ALL_GENRES: Genre[] = [
  'Tiên Hiệp',
  'Kiếm Hiệp',
  'Huyền Huyễn',
  'Ngôn Tình',
  'Đô Thị',
  'Khoa Huyễn',
  'Võng Du',
  'Dị Năng',
  'Linh Dị',
  'Trọng Sinh',
  'Xuyên Không',
  'Hệ Thống',
];

export const Footer: React.FC<FooterProps> = ({ onSelectGenre, onOpenAdmin }) => {
  return (
    <footer className="bg-stone-900 text-stone-300 pt-12 pb-8 border-t border-stone-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-stone-800">
          {/* Brand Info */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xl text-white tracking-tight">
                TruyenFull <span className="text-emerald-500 font-bold text-sm">Live</span>
              </span>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed">
              Trang web đọc truyện chữ online hàng đầu Việt Nam. Hỗ trợ đọc offline không cần mạng, ghi chú trích dẫn tâm đắc, tự động cập nhật chương mới bằng crawler tốc độ cao.
            </p>
            <div className="flex items-center gap-3 pt-1 text-xs text-stone-400">
              <span className="flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                Mobile Friendly
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <WifiOff className="w-3.5 h-3.5 text-emerald-400" />
                Offline Ready
              </span>
            </div>
          </div>

          {/* Quick Genres Links */}
          <div className="md:col-span-2">
            <h4 className="font-bold text-sm text-white uppercase tracking-wider mb-3">
              Thể Loại Truyện Thịnh Hành
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {ALL_GENRES.map((genre) => (
                <button
                  key={genre}
                  onClick={() => onSelectGenre(genre)}
                  className="text-left text-stone-400 hover:text-emerald-400 hover:underline transition-colors cursor-pointer py-1"
                >
                  Truyện {genre}
                </button>
              ))}
            </div>
          </div>

          {/* Shopee & System Admin Info */}
          <div className="space-y-3 text-xs">
            <h4 className="font-bold text-sm text-white uppercase tracking-wider mb-1">
              Liên Kết & Quản Trị
            </h4>
            <p className="text-stone-400 leading-relaxed">
              Website tích hợp tiếp thị liên kết Shopee Affiliate cho các sản phẩm sách, máy đọc sách Kindle, đèn đọc sách ban đêm không làm phiền mắt độc giả.
            </p>
            <div className="pt-2">
              <button
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold cursor-pointer border border-stone-700"
              >
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cổng Quản Trị Viên (Admin)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-3">
          <div>
            © {new Date().getFullYear()} TruyenFull Live. Mọi nội dung được sưu tầm và tổng hợp tự động.
          </div>
          <div className="flex items-center gap-1 text-stone-400">
            <span>Thiết kế tối ưu trải nghiệm người đọc</span>
            <Heart className="w-3 h-3 text-red-500 fill-red-500" />
          </div>
        </div>
      </div>
    </footer>
  );
};
