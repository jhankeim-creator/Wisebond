import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Wallet, Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPassword() {
  const { t } = useLanguage();
  const { forgotPassword } = useAuth();
  
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await forgotPassword(email);
      setSent(true);
      toast.success('Email envoyé avec succès');
    } catch (error) {
      toast.error(error.response?.data?.detail || t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-[#0047AB] rounded-xl flex items-center justify-center">
              <Wallet className="text-white" size={24} />
            </div>
            <span className="text-xl font-bold text-slate-900">KAYICOM</span>
          </Link>
          
          <LanguageSwitcher className="mx-auto mb-6" />
          
          {sent ? (
            <>
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-emerald-600" size={32} />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Email envoyé!</h1>
              <p className="text-slate-600">
                Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">{t('forgotPassword')}</h1>
              <p className="text-slate-600">
                Entrez votre email pour recevoir un lien de réinitialisation.
              </p>
            </>
          )}
        </div>
        
        {!sent && (
          <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-xl border border-slate-200">
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemple.com"
                  className="pl-10 h-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="forgot-email"
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="btn-primary w-full h-12"
              disabled={loading}
              data-testid="forgot-submit"
            >
              {loading ? t('loading') : 'Envoyer le lien'}
            </Button>
          </form>
        )}
        
        <Link 
          to="/login" 
          className="flex items-center justify-center gap-2 text-slate-600 hover:text-[#0047AB] mt-6 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Retour à la connexion</span>
        </Link>
      </div>
    </div>
  );
}
