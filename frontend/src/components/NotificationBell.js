import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Bell, Check, X, Clock, DollarSign, CreditCard, UserCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { API_BASE } from '@/lib/utils';

const API = API_BASE;

export const NotificationBell = () => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${API}/notifications`);
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      // Silent fail
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.patch(`${API}/notifications/${notificationId}/read`);
      setNotifications(prev => 
        prev.map(n => n.notification_id === notificationId ? {...n, read: true} : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      // Silent fail
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.patch(`${API}/notifications/read-all`);
      setNotifications(prev => prev.map(n => ({...n, read: true})));
      setUnreadCount(0);
    } catch (error) {
      // Silent fail
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'deposit_approved':
      case 'deposit_rejected':
        return <DollarSign size={16} />;
      case 'withdrawal_approved':
      case 'withdrawal_rejected':
        return <DollarSign size={16} />;
      case 'card_approved':
      case 'card_rejected':
        return <CreditCard size={16} />;
      case 'kyc_approved':
      case 'kyc_rejected':
        return <UserCheck size={16} />;
      default:
        return <AlertCircle size={16} />;
    }
  };

  const getIconBg = (type) => {
    if (type.includes('approved')) return 'bg-emerald-100 text-emerald-600';
    if (type.includes('rejected')) return 'bg-red-100 text-red-600';
    return 'bg-blue-100 text-blue-600';
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl hover:bg-orange-50 dark:hover:bg-stone-800 transition-colors"
      >
        <Bell size={20} className="text-stone-600 dark:text-stone-300" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 min-w-[18px] h-[18px] bg-[#EA580C] text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-stone-900 rounded-xl shadow-2xl border border-stone-200 dark:border-stone-700 overflow-hidden z-50">
          <div className="p-3 border-b border-stone-200 dark:border-stone-700 flex items-center justify-between">
            <h3 className="font-semibold text-stone-900 dark:text-white">Notifikasyon</h3>
            {unreadCount > 0 && (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={markAllAsRead}
                className="text-xs text-[#EA580C] hover:text-[#C2410C]"
              >
                <Check size={14} className="mr-1" />
                Tout li
              </Button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-stone-500 dark:text-stone-400">
                <Bell size={32} className="mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                <p>Pa gen notifikasyon</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {notifications.slice(0, 10).map((notif) => (
                  <div 
                    key={notif.notification_id}
                    onClick={() => !notif.read && markAsRead(notif.notification_id)}
                    className={`p-3 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer transition-colors ${
                      !notif.read ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getIconBg(notif.type)}`}>
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!notif.read ? 'font-semibold text-stone-900 dark:text-white' : 'text-stone-700 dark:text-stone-300'}`}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-xs text-stone-400 dark:text-stone-500 mt-1 flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(notif.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {!notif.read && (
                        <div className="w-2 h-2 bg-[#EA580C] rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
