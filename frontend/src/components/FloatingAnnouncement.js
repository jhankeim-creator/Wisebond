import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Megaphone, Bell, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API_BASE } from '@/lib/utils';

const API = API_BASE;

export const FloatingAnnouncement = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState([]);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const response = await axios.get(`${API}/public/announcements`);
      const active = response.data.announcements || [];
      
      // Filter out dismissed announcements from local storage
      const dismissedIds = JSON.parse(localStorage.getItem('dismissed_announcements') || '[]');
      const filtered = active.filter(a => !dismissedIds.includes(a.announcement_id));
      
      setAnnouncements(filtered);
      setDismissed(dismissedIds);
    } catch (error) {
      // Silent fail - announcements are optional
    }
  };

  const dismissAnnouncement = (announcementId) => {
    const newDismissed = [...dismissed, announcementId];
    setDismissed(newDismissed);
    localStorage.setItem('dismissed_announcements', JSON.stringify(newDismissed));
    setAnnouncements(prev => prev.filter(a => a.announcement_id !== announcementId));
  };

  if (announcements.length === 0) return null;

  const current = announcements[currentIndex];
  if (!current) return null;

  const typeStyles = {
    info: 'bg-blue-500',
    warning: 'bg-amber-500',
    success: 'bg-emerald-500',
    promo: 'bg-gradient-to-r from-purple-500 to-pink-500',
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-slide-up">
      <div className={`${typeStyles[current.type] || typeStyles.info} text-white rounded-xl shadow-2xl overflow-hidden`}>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              {current.type === 'promo' ? <Megaphone size={20} /> : <Bell size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm">{current.title}</h4>
              <p className="text-white/90 text-sm mt-1">{current.message}</p>
              {current.link_url && (
                <a 
                  href={current.link_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs font-semibold hover:underline"
                >
                  {current.link_text || 'Aprann plis'} <ExternalLink size={12} />
                </a>
              )}
            </div>
            <button 
              onClick={() => dismissAnnouncement(current.announcement_id)}
              className="text-white/70 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        
        {/* Navigation dots if multiple announcements */}
        {announcements.length > 1 && (
          <div className="flex justify-center gap-1.5 pb-3">
            {announcements.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentIndex ? 'bg-white w-4' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingAnnouncement;
