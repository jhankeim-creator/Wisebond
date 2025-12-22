import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock, ArrowRight, Wallet, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { t, language } = useLanguage();
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

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
    <div className="min-h-screen bg-[#FAFAF9] flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-20">
        <div className="max-w-md w-full mx-auto">
          {/* Logo */}
          <Link to="/" className="block mb-8">
            <Logo />
          </Link>
          
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-stone-900">{t('login')}</h1>
              <p className="text-stone-600 mt-1">
                {getText('Byenveni! Konekte sou kont ou.', 'Bienvenue! Connectez-vous à votre compte.', 'Welcome! Sign in to your account.')}
              </p>
            </div>
            <LanguageSwitcher />
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemple.com"
                  className="pl-10 h-12 border-stone-200 focus:border-[#EA580C] focus:ring-[#EA580C]/20"
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
                <Link to="/forgot-password" className="text-sm text-[#EA580C] hover:underline">
                  {t('forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-10 pr-12 h-12 border-stone-200 focus:border-[#EA580C] focus:ring-[#EA580C]/20"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  data-testid="login-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
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
          
          <p className="text-center text-stone-600 mt-8">
            {t('dontHaveAccount')}{' '}
            <Link to="/register" className="text-[#EA580C] font-semibold hover:underline">
              {t('register')}
            </Link>
          </p>
        </div>
      </div>
      
      {/* Right Panel - Image */}
      <div className="hidden lg:block lg:w-1/2 relative bg-gradient-to-br from-[#EA580C] to-[#C2410C]">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,rgba(255,255,255,0.1),transparent_50%)]" />
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />
        </div>
        
        <div className="relative z-10 flex flex-col justify-center items-center h-full p-12 text-white">
          <div className="max-w-md text-center">
            <h2 className="text-4xl font-bold mb-4">
              {getText('Jere finans ou', 'Gérez vos finances', 'Manage your finances')}
            </h2>
            <p className="text-xl text-orange-100 mb-8">
              HTG & USD {getText('nan yon sèl pòtfèy sekirize', 'dans un seul portefeuille sécurisé', 'in one secure wallet')}
            </p>
            
            <div className="wallet-card-htg text-left glow-orange">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-orange-200 text-sm">{getText('Balans total', 'Balance totale', 'Total balance')}</p>
                  <p className="text-2xl font-bold">G 125,450</p>
                  <p className="text-orange-200 text-sm">≈ $940.60 USD</p>
                </div>
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Wallet size={20} />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1 bg-white/10 rounded-lg p-3">
                  <p className="text-xs text-orange-200">HTG</p>
                  <p className="font-semibold">G 125,450</p>
                </div>
                <div className="flex-1 bg-white/10 rounded-lg p-3">
                  <p className="text-xs text-orange-200">USD</p>
                  <p className="font-semibold">$3,245.00</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
