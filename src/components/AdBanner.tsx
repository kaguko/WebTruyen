import React, { useEffect, useState } from 'react';
import { ExternalLink, ShoppingBag, X, Sparkles } from 'lucide-react';
import { AdSlot, AdPlacement } from '../types';
import { trackAdClick, trackAdView } from '../services/storage';

interface AdBannerProps {
  placement: AdPlacement;
  ads: AdSlot[];
  className?: string;
}

export const AdBanner: React.FC<AdBannerProps> = ({ placement, ads, className = '' }) => {
  const [dismissed, setDismissed] = useState(false);

  // Several ads can share a placement: pick one at random per page view so each gets shown.
  const eligible = ads.filter((a) => a.placement === placement && a.isEnabled);
  const [roll] = useState(() => Math.random());
  const activeAd = eligible.length ? eligible[Math.floor(roll * eligible.length) % eligible.length] : undefined;

  // POPUP: shown once per browser session, a moment after the reader lands on a story page.
  const [popupOpen, setPopupOpen] = useState(false);
  const popupKey = 'popup-ad-shown';
  useEffect(() => {
    if (placement !== 'POPUP' || !activeAd) return;
    try {
      if (sessionStorage.getItem(popupKey)) return;
    } catch {}
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(popupKey, '1');
      } catch {}
      setPopupOpen(true);
      trackAdView(activeAd.id);
    }, 2500);
    return () => clearTimeout(t);
  }, [placement, activeAd?.id]);

  useEffect(() => {
    if (placement !== 'POPUP' && activeAd) trackAdView(activeAd.id);
  }, [placement, activeAd?.id]);

  if (!activeAd || dismissed) {
    return null;
  }

  const handleClick = () => {
    trackAdClick(activeAd.id);
  };

  if (placement === 'POPUP') {
    if (!popupOpen) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDismissed(true)}>
        <div
          className="relative bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-3 right-3 p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
          <p className="text-[11px] text-stone-400 mb-2">Tài trợ · Ủng hộ web miễn phí này</p>
          {activeAd.imageUrl && (
            <img src={activeAd.imageUrl} alt={activeAd.title} className="w-40 h-40 object-cover rounded-2xl mx-auto mb-3" />
          )}
          {activeAd.tag && (
            <span className="inline-block bg-amber-100 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2">
              {activeAd.tag}
            </span>
          )}
          <h4 className="font-bold text-sm text-stone-900">{activeAd.title}</h4>
          {activeAd.description && <p className="text-xs text-stone-600 mt-1">{activeAd.description}</p>}
          <a
            href={activeAd.targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              handleClick();
              setDismissed(true);
            }}
            className="mt-4 inline-flex items-center justify-center gap-1.5 w-full bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors"
          >
            <span>Xem Ngay</span>
            <ExternalLink className="w-4 h-4" />
          </a>
          <button onClick={() => setDismissed(true)} className="mt-2 text-xs text-stone-500 hover:text-stone-700 cursor-pointer">
            Để sau
          </button>
        </div>
      </div>
    );
  }

  if (placement === 'HEADER_BANNER') {
    return (
      <div className={`relative bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-emerald-500/10 border border-amber-200/80 rounded-2xl p-3 sm:p-4 my-4 overflow-hidden transition-all ${className}`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {activeAd.imageUrl && (
              <img
                src={activeAd.imageUrl}
                alt={activeAd.title}
                className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl shadow-xs shrink-0"
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {activeAd.isShopee && (
                  <span className="inline-flex items-center gap-1 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                    <ShoppingBag className="w-3 h-3" />
                    Shopee Aff
                  </span>
                )}
                {activeAd.tag && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    {activeAd.tag}
                  </span>
                )}
                <span className="text-[10px] text-stone-400">Tài trợ</span>
              </div>
              <h4 className="font-bold text-xs sm:text-sm text-stone-900 line-clamp-1">
                {activeAd.title}
              </h4>
              {activeAd.description && (
                <p className="text-[11px] sm:text-xs text-stone-600 line-clamp-1 mt-0.5">
                  {activeAd.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <a
              href={activeAd.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleClick}
              className="inline-flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs transition-colors"
            >
              <span>Xem Ngay</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-200/50 cursor-pointer"
              title="Ẩn quảng cáo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (placement === 'IN_READER') {
    return (
      <div className={`my-8 p-4 bg-stone-100/90 rounded-2xl border border-stone-200/90 text-center max-w-xl mx-auto shadow-xs ${className}`}>
        <div className="flex items-center justify-between text-[11px] text-stone-400 mb-2">
          <span className="flex items-center gap-1 text-orange-600 font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            {activeAd.isShopee ? 'Gợi Ý Mọt Sách Từ Shopee' : 'Thông Điệp Hữu Ích'}
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-4 text-left">
          {activeAd.imageUrl && (
            <img
              src={activeAd.imageUrl}
              alt={activeAd.title}
              className="w-20 h-20 object-cover rounded-xl shrink-0 shadow-xs"
            />
          )}
          <div className="flex-1">
            <div className="font-bold text-xs sm:text-sm text-stone-900">
              {activeAd.title}
            </div>
            <div className="text-[11px] text-stone-600 mt-1 line-clamp-2">
              {activeAd.description}
            </div>
            <a
              href={activeAd.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleClick}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 hover:underline"
            >
              <span>Xem ưu đãi Shopee</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (placement === 'SIDEBAR') {
    return (
      <div className={`bg-stone-50 border border-stone-200 rounded-2xl p-4 shadow-xs ${className}`}>
        <div className="flex items-center justify-between text-[11px] font-semibold text-stone-400 mb-2.5">
          <span className="flex items-center gap-1 text-orange-600 font-bold">
            <ShoppingBag className="w-3.5 h-3.5" />
            Shopee Deals
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="text-stone-400 hover:text-stone-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeAd.imageUrl && (
          <img
            src={activeAd.imageUrl}
            alt={activeAd.title}
            className="w-full h-36 object-cover rounded-xl mb-3 shadow-xs"
          />
        )}

        <h5 className="font-bold text-xs text-stone-900 line-clamp-2">
          {activeAd.title}
        </h5>
        {activeAd.description && (
          <p className="text-[11px] text-stone-500 mt-1 line-clamp-2">
            {activeAd.description}
          </p>
        )}

        <a
          href={activeAd.targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className="mt-3 flex items-center justify-center gap-1.5 w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs py-2 rounded-xl transition-colors shadow-xs"
        >
          <span>Mua Trên Shopee</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    );
  }

  // Float bottom
  return (
    <div className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-30 max-w-sm bg-white/95 backdrop-blur-md border border-stone-200 shadow-2xl rounded-2xl p-3 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-start gap-3">
        {activeAd.imageUrl && (
          <img
            src={activeAd.imageUrl}
            alt={activeAd.title}
            className="w-12 h-12 object-cover rounded-lg shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-bold uppercase text-orange-600 tracking-wide">
              {activeAd.tag || 'Tài trợ'}
            </span>
            <button
              onClick={() => setDismissed(true)}
              className="text-stone-400 hover:text-stone-600 cursor-pointer p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="text-xs font-semibold text-stone-900 truncate mt-0.5">
            {activeAd.title}
          </div>
          <a
            href={activeAd.targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            className="mt-1 text-[11px] text-emerald-700 hover:underline flex items-center gap-1 font-medium"
          >
            <span>Khám phá ngay</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
