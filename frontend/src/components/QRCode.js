import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Download, Share2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export function UserQRCode({ clientId, userName, size = 200 }) {
  const { language } = useLanguage();
  const [copied, setCopied] = React.useState(false);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  // QR code contains a URL format for better compatibility and direct navigation
  // Format: https://domain.com/transfer?to=CLIENT_ID
  const qrValue = typeof window !== 'undefined' 
    ? `${window.location.origin}/transfer?to=${clientId}`
    : clientId;

  const copyClientId = () => {
    navigator.clipboard.writeText(clientId);
    setCopied(true);
    toast.success(getText('ID kopye!', 'ID copié!', 'ID copied!'));
    setTimeout(() => setCopied(false), 2000);
  };

  const shareQR = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'KAYICOM - ' + userName,
          text: getText(
            `Voye m lajan sou KAYICOM! ID mwen: ${clientId}`,
            `Envoyez-moi de l'argent sur KAYICOM! Mon ID: ${clientId}`,
            `Send me money on KAYICOM! My ID: ${clientId}`
          ),
          url: window.location.origin + '/transfer?to=' + clientId
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      copyClientId();
    }
  };

  const downloadQR = () => {
    const svg = document.getElementById('user-qr-code');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = size + 40;
      canvas.height = size + 80;
      
      // White background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw QR
      ctx.drawImage(img, 20, 20, size, size);
      
      // Add text
      ctx.fillStyle = '#1c1917';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(clientId, canvas.width / 2, size + 45);
      ctx.font = '12px Arial';
      ctx.fillStyle = '#78716c';
      ctx.fillText('KAYICOM Wallet', canvas.width / 2, size + 65);

      // Download
      const link = document.createElement('a');
      link.download = `kayicom-${clientId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="flex flex-col items-center">
      {/* QR Code */}
      <div className="bg-white p-4 rounded-2xl shadow-lg">
        <QRCodeSVG
          id="user-qr-code"
          value={qrValue}
          size={size}
          level="M"
          includeMargin={false}
          fgColor="#1c1917"
          bgColor="#ffffff"
        />
      </div>

      {/* Client ID */}
      <div className="mt-4 text-center">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {getText('ID Kliyan', 'ID Client', 'Client ID')}
        </p>
        <button
          onClick={copyClientId}
          className="flex items-center gap-2 font-mono font-bold text-lg text-stone-900 dark:text-white hover:text-[#EA580C] transition-colors"
        >
          {clientId}
          {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={downloadQR}
          className="flex items-center gap-2"
        >
          <Download size={16} />
          {getText('Telechaje', 'Télécharger', 'Download')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={shareQR}
          className="flex items-center gap-2"
        >
          <Share2 size={16} />
          {getText('Pataje', 'Partager', 'Share')}
        </Button>
      </div>

      <p className="text-xs text-stone-400 mt-4 text-center max-w-[200px]">
        {getText(
          'Lòt moun ka skane kòd sa pou voye w lajan',
          'Les autres peuvent scanner ce code pour vous envoyer de l\'argent',
          'Others can scan this code to send you money'
        )}
      </p>
    </div>
  );
}

export default UserQRCode;
