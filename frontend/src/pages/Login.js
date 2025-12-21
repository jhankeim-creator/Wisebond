import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Wallet, Mail, Lock, ArrowRight } from 'lucide-react';

export default function Login() {
  const { t } = useLanguage();
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login(formData.email, formData.password);
      toast.success(t('success'));
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || t('invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-20">
        <div className="max-w-md w-full mx-auto">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-[#0047AB] rounded-xl flex items-center justify-center">
              <Wallet className="text-white" size={24} />
            </div>
            <span className="text-xl font-bold text-slate-900">KAYICOM</span>
          </Link>
          
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{t('login')}</h1>
              <p className="text-slate-600 mt-1">Bienvenue! Connectez-vous à votre compte.</p>
            </div>
            <LanguageSwitcher />
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemple.com"
                  className="pl-10 h-12"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  data-testid="login-email"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">{t('password')}</Label>
                <Link to="/forgot-password" className="text-sm text-[#0047AB] hover:underline">
                  {t('forgotPassword')}
                </Link>
              </div>
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
                  data-testid="login-password"
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="btn-primary w-full h-12"
              disabled={loading}
              data-testid="login-submit"
            >
              {loading ? t('loading') : t('login')}
              {!loading && <ArrowRight className="ml-2" size={20} />}
            </Button>
          </form>
          
          <p className="text-center text-slate-600 mt-8">
            {t('dontHaveAccount')}{' '}
            <Link to="/register" className="text-[#0047AB] font-medium hover:underline">
              {t('register')}
            </Link>
          </p>
        </div>
      </div>
      
      {/* Right Panel - Image */}
      <div className="hidden lg:block lg:w-1/2 relative bg-[#0047AB]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0047AB] to-[#003380]">
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />
        </div>
        
        <div className="relative z-10 flex flex-col justify-center items-center h-full p-12 text-white">
          <div className="max-w-md text-center">
            <h2 className="text-4xl font-bold mb-4">Gérez vos finances</h2>
            <p className="text-xl text-blue-200 mb-8">
              HTG & USD dans un seul portefeuille sécurisé
            </p>
            
            <div className="wallet-card text-left">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-blue-200 text-sm">Balance totale</p>
                  <p className="text-2xl font-bold">$5,432.00</p>
                </div>
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Wallet size={20} />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1 bg-white/10 rounded-lg p-3">
                  <p className="text-xs text-blue-200">HTG</p>
                  <p className="font-semibold">125,450</p>
                </div>
                <div className="flex-1 bg-white/10 rounded-lg p-3">
                  <p className="text-xs text-blue-200">USD</p>
                  <p className="font-semibold">3,245.00</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
