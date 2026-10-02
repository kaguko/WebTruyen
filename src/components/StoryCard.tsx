import { formatTime } from '../services/format';
import React from 'react';
import { Star, Eye, BookOpen, Sparkles } from 'lucide-react';
import { Story } from '../types';

interface StoryCardProps {
  story: Story;
  onClick: () => void;
  variant?: 'grid' | 'compact' | 'list';
}

export const StoryCard: React.FC<StoryCardProps> = ({ story, onClick, variant = 'grid' }) => {
  if (variant === 'list') {
    return (
      <div
        onClick={onClick}
        className="flex items-center justify-between p-3 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer group border-b border-stone-100 last:border-0"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-1.5 h-8 bg-emerald-600/40 rounded-full group-hover:bg-emerald-600 transition-colors"></div>
          <div className="min-w-0">
            <h4 className="font-semibold text-xs sm:text-sm text-stone-900 group-hover:text-emerald-700 transition-colors truncate">
              {story.title}
            </h4>
            <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-0.5">
              <span>{story.author}</span>
              <span>•</span>
              <span className="text-stone-400">{story.genres[0]}</span>
            </div>
          </div>
        </div>

        <div className="text-right shrink-0 ml-3">
          <div className="text-xs font-semibold text-emerald-700">
            Chương {story.totalChapters}
          </div>
          <div className="text-[10px] text-stone-400">{formatTime(story.lastUpdated)}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col bg-white rounded-2xl border border-stone-200/80 overflow-hidden hover:shadow-lg hover:border-emerald-300 transition-all duration-300 cursor-pointer"
    >
      {/* Cover Image Container */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-stone-100">
        <img
          src={story.cover}
          alt={story.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Badges Overlay */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {story.isHot && (
            <span className="bg-red-500 text-white font-extrabold text-[10px] uppercase px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
              🔥 HOT
            </span>
          )}
          {story.status === 'COMPLETED' && (
            <span className="bg-emerald-600 text-white font-bold text-[10px] uppercase px-2 py-0.5 rounded-full shadow-sm">
              FULL
            </span>
          )}
        </div>

        {/* Rating overlay at bottom of cover */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950/80 via-stone-950/40 to-transparent p-2.5 flex items-end justify-between text-white text-xs">
          <span className="flex items-center gap-1 font-bold text-amber-300">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            {story.rating.score.toFixed(1)}
          </span>
          <span className="text-[11px] text-stone-300 flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            {story.totalChapters} c
          </span>
        </div>
      </div>

      {/* Info Container */}
      <div className="p-3 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-xs sm:text-sm text-stone-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
            {story.title}
          </h3>
          <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">{story.author}</p>
        </div>

        <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
          <span className="truncate max-w-[90px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded text-[10px]">
            {story.genres[0]}
          </span>
          <span className="text-emerald-600 font-medium text-[10px]">
            {formatTime(story.lastUpdated)}
          </span>
        </div>
      </div>
    </div>
  );
};
