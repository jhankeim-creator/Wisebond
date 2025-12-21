import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Lock, User, Phone, ArrowRight, Gift, CreditCard, Shield } from 'lucide-react';

export default function Register() {
  const { t, language } = useLanguage();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    phone: '',
    language: language
  });
  const [loading, setLoading] = useState(false);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error(getText('Modpas yo pa matche', 'Les mots de passe ne correspondent pas', 'Passwords do not match'));
      return;
    }
    
    if (formData.password.length < 8) {
      toast.error(getText('Modpas la dwe gen omwen 8 karaktè', 'Le mot de passe doit contenir au moins 8 caractères', 'Password must be at least 8 characters'));
      return;
    }
    
    setLoading(true);
    
    try {
      const userData = {
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        phone: formData.phone,
        language: formData.language
      };
      
      await register(userData);
      toast.success(t('success'));
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9] flex">
      {/* Left Panel - Image */}
      <div className="hidden lg:block lg:w-1/2 relative bg-gradient-to-br from-amber-500 to-amber-600">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.1),transparent_50%)]" />
        </div>
        
        <div className="relative z-10 flex flex-col justify-center items-center h-full p-12 text-white">
          <div className="max-w-md text-center">
            <h2 className="text-4xl font-bold mb-4">
              {language === 'fr' ? 'Rejoignez KAYICOM' : 'Join KAYICOM'}
            </h2>
            <p className="text-xl text-amber-100 mb-8">
              {language === 'fr' 
                ? 'Créez votre compte et commencez à gérer vos finances dès aujourd\'hui'
                : 'Create your account and start managing your finances today'}
            </p>
            
            <div className="space-y-4 text-left">
              <div className="flex items-center gap-3 bg-white/10 rounded-xl p-4">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Shield size={20} />
                </div>
                <div>
                  <p className="font-semibold">{language === 'fr' ? 'Sécurité maximale' : 'Maximum security'}</p>
                  <p className="text-sm text-amber-100">{language === 'fr' ? 'Vos fonds sont protégés' : 'Your funds are protected'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-white/10 rounded-xl p-4">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <CreditCard size={20} />
                </div>
                <div>
                  <p className="font-semibold">{language === 'fr' ? 'Carte virtuelle' : 'Virtual card'}</p>
                  <p className="text-sm text-amber-100">{language === 'fr' ? 'Payez partout' : 'Pay anywhere'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-white/10 rounded-xl p-4">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Gift size={20} />
                </div>
                <div>
                  <p className="font-semibold">{language === 'fr' ? 'Programme d\'affiliation' : 'Affiliate program'}</p>
                  <p className="text-sm text-amber-100">G 2,000 / 5 {language === 'fr' ? 'cartes' : 'cards'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-20 overflow-y-auto">
        <div className="max-w-md w-full mx-auto">
          {/* Logo */}
          <Link to="/" className="block mb-8">
            <Logo />
          </Link>
          
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-stone-900">{t('register')}</h1>
              <p className="text-stone-600 mt-1">
                {language === 'fr' ? 'Créez votre compte gratuit' : 'Create your free account'}
              </p>
            </div>
            <LanguageSwitcher />
          </div>
          
          {refCode && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-3">
              <Gift className="text-amber-600" size={20} />
              <div>
                <p className="text-amber-800 text-sm font-medium">
                  {language === 'fr' ? 'Code de parrainage:' : 'Referral code:'}
                </p>
                <p className="font-mono font-bold text-amber-700">{refCode}</p>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="full_name">{t('fullName')}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                <Input
                  id="full_name"
                  type="text"
                  placeholder="Jean Pierre"
                  className="pl-10 h-12 border-stone-200 focus:border-[#EA580C] focus:ring-[#EA580C]/20"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  data-testid="register-fullname"
                />
              </div>
            </div>
            
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
                  data-testid="register-email"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">{t('phone')}</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+509 0000 0000"
                  className="pl-10 h-12 border-stone-200 focus:border-[#EA580C] focus:ring-[#EA580C]/20"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  data-testid="register-phone"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t('password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10 h-12 border-stone-200 focus:border-[#EA580C] focus:ring-[#EA580C]/20"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={8}
                    data-testid="register-password"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10 h-12 border-stone-200 focus:border-[#EA580C] focus:ring-[#EA580C]/20"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    data-testid="register-confirm-password"
                  />
                </div>
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="btn-primary w-full h-12"
              disabled={loading}
              data-testid="register-submit"
            >
              {loading ? t('loading') : t('register')}
              {!loading && <ArrowRight className="ml-2" size={20} />}
            </Button>
          </form>
          
          <p className="text-center text-stone-600 mt-8">
            {t('alreadyHaveAccount')}{' '}
            <Link to="/login" className="text-[#EA580C] font-semibold hover:underline">
              {t('login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
