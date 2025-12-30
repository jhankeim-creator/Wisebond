import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Camera, X, FlipHorizontal } from 'lucide-react';

export function QRScanner({ onScan, onClose }) {
  const { language } = useLanguage();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    setError(null);
    setIsScanning(true);

    try {
      html5QrCodeRef.current = new Html5Qrcode("qr-reader");
      
      await html5QrCodeRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1
        },
        (decodedText) => {
          // Successfully scanned
          stopScanner();
          onScan(decodedText);
        },
        (errorMessage) => {
          // Ignore scan errors (continuous scanning)
        }
      );
    } catch (err) {
      setIsScanning(false);
      if (err.toString().includes('NotAllowedError')) {
        setError(getText(
          'Tanpri pèmèt aksè nan kamera a',
          'Veuillez autoriser l\'accès à la caméra',
          'Please allow camera access'
        ));
      } else {
        setError(getText(
          'Pa ka louvri kamera a',
          'Impossible d\'ouvrir la caméra',
          'Cannot open camera'
        ));
      }
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.log('Error stopping scanner:', err);
      }
    }
    setIsScanning(false);
  };

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
        <h2 className="text-white font-semibold">
          {getText('Skane QR Code', 'Scanner QR Code', 'Scan QR Code')}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          className="text-white hover:bg-white/20"
        >
          <X size={24} />
        </Button>
      </div>

      {/* Scanner Area */}
      <div className="h-full flex flex-col items-center justify-center p-4">
        {!isScanning && !error && (
          <div className="text-center">
            <div className="w-24 h-24 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Camera size={48} className="text-white" />
            </div>
            <p className="text-white/80 mb-6 max-w-xs">
              {getText(
                'Skane QR code lòt kliyan an pou voye li lajan',
                'Scannez le QR code d\'un autre client pour lui envoyer de l\'argent',
                'Scan another client\'s QR code to send them money'
              )}
            </p>
            <Button
              onClick={startScanner}
              className="bg-[#EA580C] hover:bg-[#C2410C] text-white px-8 py-6 h-auto rounded-full"
            >
              <Camera size={20} className="mr-2" />
              {getText('Louvri Kamera', 'Ouvrir Caméra', 'Open Camera')}
            </Button>
          </div>
        )}

        {error && (
          <div className="text-center">
            <div className="w-24 h-24 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <X size={48} className="text-red-500" />
            </div>
            <p className="text-red-400 mb-6">{error}</p>
            <Button
              onClick={startScanner}
              variant="outline"
              className="text-white border-white/30 hover:bg-white/10"
            >
              {getText('Eseye ankò', 'Réessayer', 'Try again')}
            </Button>
          </div>
        )}

        {/* QR Reader Container */}
        <div
          id="qr-reader"
          ref={scannerRef}
          className={`w-full max-w-sm ${isScanning ? 'block' : 'hidden'}`}
          style={{ borderRadius: '16px', overflow: 'hidden' }}
        />

        {isScanning && (
          <div className="mt-6 text-center">
            <p className="text-white/60 text-sm">
              {getText(
                'Vize QR code la nan kad la',
                'Visez le QR code dans le cadre',
                'Point the QR code in the frame'
              )}
            </p>
          </div>
        )}
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-white/40 text-xs">
          {getText(
            'QR code dwe genyen Client ID KAYICOM',
            'Le QR code doit contenir un ID Client KAYICOM',
            'QR code must contain a KAYICOM Client ID'
          )}
        </p>
      </div>
    </div>
  );
}

export default QRScanner;
