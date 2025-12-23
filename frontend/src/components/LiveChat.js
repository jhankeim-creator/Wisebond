import React, { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

export const LiveChat = () => {
  const [settings, setSettings] = useState(null);
  const [crispLoaded, setCrispLoaded] = useState(false);
  const crispActive = !!(settings?.crisp_enabled && settings?.crisp_website_id);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get(`${API}/public/chat-settings`);
        setSettings(response.data);
      } catch (error) {
        console.log('Chat settings not available');
      }
    };

    fetchSettings();
  }, []);

  // Load Crisp if enabled
  useEffect(() => {
    if (crispActive && !crispLoaded) {
      window.$crisp = [];
      window.CRISP_WEBSITE_ID = settings.crisp_website_id;
      
      const script = document.createElement('script');
      script.src = 'https://client.crisp.chat/l.js';
      script.async = true;
      script.onload = () => {
        setCrispLoaded(true);
        console.log('Crisp loaded successfully');
      };
      document.head.appendChild(script);

      return () => {
        // Cleanup Crisp on unmount
        if (window.$crisp) {
          delete window.$crisp;
          delete window.CRISP_WEBSITE_ID;
        }
      };
    }
  }, [crispActive, settings, crispLoaded]);

  // Show WhatsApp button if enabled and Crisp is not enabled
  if (settings?.whatsapp_enabled && settings?.whatsapp_number && !crispActive) {
    const whatsappLink = `https://wa.me/${settings.whatsapp_number.replace(/[^0-9]/g, '')}`;
    
    return (
      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-emerald-500 hover:bg-emerald-600 text-white p-4 rounded-full shadow-lg transition-all hover:scale-110"
        title="Chat on WhatsApp"
      >
        <MessageCircle size={28} />
      </a>
    );
  }

  // If Crisp is enabled, it will render its own widget
  return null;
};

export default LiveChat;
