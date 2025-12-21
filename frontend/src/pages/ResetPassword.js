import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Wallet, Lock, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ResetPassword() {
  const { t } = useLanguage();
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    
    if (formData.password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }
    
    setLoading(true);
    
    try {
      await resetPassword(token, formData.password);
      setSuccess(true);
      toast.success('Mot de passe réinitialisé avec succès');
      setTimeout(() => navigate('/login'), 3000);
    } catch (error) {
      toast.error(error.response?.data?.detail || t('error'));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Lien invalide</h1>
          <p className="text-slate-600 mb-6">Ce lien de réinitialisation est invalide ou a expiré.</p>
          <Link to="/forgot-password">
            <Button className="btn-primary">Demander un nouveau lien</Button>
          </Link>
        </div>
      </div>
    );
  }

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
          
          {success ? (
            <>
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-emerald-600" size={32} />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Mot de passe réinitialisé!</h1>
              <p className="text-slate-600">
                Vous allez être redirigé vers la page de connexion...
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">{t('resetPassword')}</h1>
              <p className="text-slate-600">
                Choisissez un nouveau mot de passe sécurisé.
              </p>
            </>
          )}
        </div>
        
        {!success && (
          <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-xl border border-slate-200">
            <div className="space-y-2">
              <Label htmlFor="password">{t('newPassword')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 h-12"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={8}
                  data-testid="reset-password"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 h-12"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  data-testid="reset-confirm-password"
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="btn-primary w-full h-12"
              disabled={loading}
              data-testid="reset-submit"
            >
              {loading ? t('loading') : t('resetPassword')}
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
