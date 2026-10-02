import React, { useState } from 'react';
import { Trophy, Flame, Eye, ChevronRight } from 'lucide-react';
import { Story } from '../types';

interface RankingSidebarProps {
  stories: Story[];
  onSelectStory: (story: Story) => void;
}

type TabType = 'daily' | 'weekly' | 'monthly' | 'all';

export const RankingSidebar: React.FC<RankingSidebarProps> = ({ stories, onSelectStory }) => {
  const [activeTab, setActiveTab] = useState<TabType>('daily');

  // Sort according to simulated multiplier based on tab
  const sortedStories = [...stories]
    .sort((a, b) => {
      if (activeTab === 'daily') return b.rating.count - a.rating.count;
      if (activeTab === 'weekly') return b.views - a.views;
      if (activeTab === 'monthly') return b.totalChapters - a.totalChapters;
      return b.views - a.views;
    })
    .slice(0, 8);

  const getRankBadge = (index: number) => {
    if (index === 0) {
      return (
        <span className="w-6 h-6 rounded-lg bg-amber-500 text-white font-extrabold text-xs flex items-center justify-center shadow-sm shrink-0">
          1
        </span>
      );
    }
    if (index === 1) {
      return (
        <span className="w-6 h-6 rounded-lg bg-slate-400 text-white font-extrabold text-xs flex items-center justify-center shadow-sm shrink-0">
          2
        </span>
      );
    }
    if (index === 2) {
      return (
        <span className="w-6 h-6 rounded-lg bg-amber-700 text-white font-extrabold text-xs flex items-center justify-center shadow-sm shrink-0">
          3
        </span>
      );
    }
    return (
      <span className="w-6 h-6 rounded-lg bg-stone-100 text-stone-600 font-bold text-xs flex items-center justify-center shrink-0">
        {index + 1}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="font-extrabold text-sm uppercase tracking-wide text-stone-900">
            Bảng Xếp Hạng
          </h3>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between bg-stone-100 p-1 rounded-xl mb-3 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('daily')}
          className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer text-center ${
            activeTab === 'daily'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Ngày
        </button>
        <button
          onClick={() => setActiveTab('weekly')}
          className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer text-center ${
            activeTab === 'weekly'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Tuần
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer text-center ${
            activeTab === 'monthly'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Tháng
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer text-center ${
            activeTab === 'all'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Tất cả
        </button>
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {sortedStories.map((story, index) => (
          <div
            key={story.id}
            onClick={() => onSelectStory(story)}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-stone-50 transition-colors cursor-pointer group"
          >
            {getRankBadge(index)}

            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-xs sm:text-sm text-stone-900 group-hover:text-emerald-700 transition-colors truncate">
                {story.title}
              </h4>
              <div className="flex items-center gap-2 text-[11px] text-stone-400 mt-0.5">
                <span className="truncate">{story.author}</span>
                <span>•</span>
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <Eye className="w-3 h-3" />
                  {(story.views / 1000).toFixed(0)}k
                </span>
              </div>
            </div>

            <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
};
