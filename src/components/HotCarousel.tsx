import React, { useState } from 'react';
import { Star, BookOpen, ChevronRight, ChevronLeft, Flame, Sparkles } from 'lucide-react';
import { Story } from '../types';

interface HotCarouselProps {
  stories: Story[];
  onSelectStory: (story: Story) => void;
  onReadFromStart: (story: Story) => void;
}

export const HotCarousel: React.FC<HotCarouselProps> = ({
  stories,
  onSelectStory,
  onReadFromStart,
}) => {
  const hotList = stories.filter((s) => s.isHot || s.isTrending).slice(0, 5);
  const [activeIndex, setActiveIndex] = useState(0);

  if (hotList.length === 0) return null;

  const current = hotList[activeIndex];

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % hotList.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + hotList.length) % hotList.length);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-800 to-emerald-950 text-white shadow-xl my-6">
      {/* Background Ambience */}
      <div
        className="absolute inset-0 opacity-20 bg-cover bg-center blur-md scale-105"
        style={{ backgroundImage: `url(${current.cover})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-950/80 to-transparent" />

      {/* Content */}
      <div className="relative z-10 p-5 sm:p-8 md:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
        {/* Cover with 3D drop shadow */}
        <div
          onClick={() => onSelectStory(current)}
          className="relative w-40 sm:w-48 md:w-56 aspect-[3/4] shrink-0 rounded-2xl overflow-hidden shadow-2xl shadow-black/80 cursor-pointer group"
        >
          <img
            src={current.cover}
            alt={current.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
            <Flame className="w-3 h-3" />
            TOP HOT #1
          </div>
        </div>

        {/* Text Info */}
        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Đề cử biên tập viên
            </span>
            {current.genres.map((g) => (
              <span
                key={g}
                className="bg-white/10 text-stone-300 text-xs px-2.5 py-1 rounded-full"
              >
                {g}
              </span>
            ))}
          </div>

          <h2
            onClick={() => onSelectStory(current)}
            className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight hover:text-emerald-400 transition-colors cursor-pointer"
          >
            {current.title}
          </h2>

          <div className="flex items-center justify-center md:justify-start gap-4 text-xs sm:text-sm text-stone-300 my-2">
            <span>Tác giả: <strong className="text-white">{current.author}</strong></span>
            <span>•</span>
            <span className="flex items-center gap-1 text-amber-400 font-bold">
              <Star className="w-4 h-4 fill-amber-400" />
              {current.rating.score.toFixed(1)} ({current.rating.count} bình chọn)
            </span>
            <span>•</span>
            <span>{current.totalChapters} Chương</span>
          </div>

          <p className="text-stone-300 text-xs sm:text-sm line-clamp-3 my-3 leading-relaxed max-w-2xl">
            {current.description}
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-4">
            <button
              onClick={() => onReadFromStart(current)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-700/30 transition-all cursor-pointer hover:scale-105"
            >
              <BookOpen className="w-4 h-4" />
              <span>Đọc Ngay Chương 1</span>
            </button>
            <button
              onClick={() => onSelectStory(current)}
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              <span>Xem Chi Tiết</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide Navigation Buttons */}
      <button
        onClick={handlePrev}
        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/70 text-white z-20 cursor-pointer backdrop-blur-xs transition-colors"
        title="Truyện trước"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={handleNext}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/70 text-white z-20 cursor-pointer backdrop-blur-xs transition-colors"
        title="Truyện tiếp theo"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Dots Indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
        {hotList.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setActiveIndex(idx)}
            className={`h-1.5 rounded-full transition-all cursor-pointer ${
              idx === activeIndex ? 'w-6 bg-emerald-400' : 'w-2 bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
