import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Copy, 
  Check, 
  Users,
  DollarSign,
  Share2,
  Gift,
  CreditCard,
  TrendingUp,
  ArrowRight
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Affiliate() {
  const { language } = useLanguage();
  const { user, refreshUser } = useAuth();
  
  const [affiliateData, setAffiliateData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  useEffect(() => {
    fetchAffiliateInfo();
  }, []);

  const fetchAffiliateInfo = async () => {
    try {
      const response = await axios.get(`${API}/affiliate/info`);
      setAffiliateData(response.data);
    } catch (error) {
      console.error('Error fetching affiliate info:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(affiliateData?.affiliate_link);
    setCopied(true);
    toast.success(getText('Lyen kopye!', 'Lien copié!', 'Link copied!'));
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: 'KAYICOM Wallet',
        text: getText(
          'Antre nan KAYICOM Wallet epi jere finans ou an HTG ak USD!',
          'Rejoignez KAYICOM Wallet et gérez vos finances en HTG et USD!',
          'Join KAYICOM Wallet and manage your finances in HTG and USD!'
        ),
        url: affiliateData?.affiliate_link
      });
    } else {
      copyLink();
    }
  };

  const withdrawEarnings = async () => {
    if (user?.affiliate_earnings < 2000) {
      toast.error(getText('Minimòm pou transfere: G 2,000', 'Minimum de retrait: G 2,000', 'Minimum withdrawal: G 2,000'));
      return;
    }

    setWithdrawing(true);
    try {
      await axios.post(`${API}/affiliate/withdraw`);
      toast.success(getText('Lajan transfere nan wallet ou!', 'Gains transférés vers votre wallet!', 'Earnings transferred to your wallet!'));
      refreshUser();
      fetchAffiliateInfo();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error');
    } finally {
      setWithdrawing(false);
    }
  };

  // Calculate progress to next reward
  const referralsWithCards = affiliateData?.referrals_with_cards || 0;
  const progressToNext = referralsWithCards % 5;
  const completedSets = Math.floor(referralsWithCards / 5);

  return (
    <DashboardLayout title={getText('Pwogram Afilyasyon', 'Programme d\'Affiliation', 'Affiliate Program')}>
      <div className="space-y-6" data-testid="affiliate-page">
        {/* Main Stats */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Earnings Card */}
          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white md:col-span-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-sm uppercase tracking-wide">
                    {getText('Lajan disponib', 'Gains disponibles', 'Available earnings')}
                  </p>
                  <p className="text-4xl font-bold mt-2">
                    G {(user?.affiliate_earnings || 0).toLocaleString()}
                  </p>
                  <p className="text-amber-100 text-sm mt-1">
                    ≈ ${((user?.affiliate_earnings || 0) * 0.0075).toFixed(2)} USD
                  </p>
                </div>
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Gift size={32} />
                </div>
              </div>
              
              <Button 
                onClick={withdrawEarnings}
                disabled={withdrawing || (user?.affiliate_earnings || 0) < 2000}
                className="mt-6 bg-white text-amber-600 hover:bg-amber-50 font-bold"
              >
                {withdrawing 
                  ? getText('Transfè...', 'Transfert...', 'Transferring...') 
                  : getText('Transfere nan wallet', 'Transférer vers wallet', 'Transfer to wallet')}
                <ArrowRight className="ml-2" size={18} />
              </Button>
              {(user?.affiliate_earnings || 0) < 2000 && (
                <p className="text-amber-100 text-xs mt-2">
                  {getText('Minimòm: G 2,000', 'Minimum: G 2,000', 'Minimum: G 2,000')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Referrals Count */}
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Users className="text-[#EA580C]" size={32} />
                </div>
                <p className="text-stone-500 text-sm">{getText('Total moun refere', 'Total filleuls', 'Total referrals')}</p>
                <p className="text-4xl font-bold text-stone-900 mt-1">
                  {affiliateData?.referrals?.length || 0}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress to Next Reward */}
        <Card className="bg-gradient-to-r from-stone-900 to-stone-800 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-stone-300 text-sm">{getText('Pwogrè pou pwochen rekonpans', 'Progression vers la prochaine récompense', 'Progress to next reward')}</p>
                <p className="text-2xl font-bold mt-1">
                  {progressToNext}/5 {getText('kat komande', 'cartes commandées', 'cards ordered')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-stone-300 text-sm">{getText('Rekonpans', 'Récompense', 'Reward')}</p>
                <p className="text-2xl font-bold text-amber-400">G 2,000</p>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-stone-700 rounded-full h-4 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#EA580C] to-[#F59E0B] rounded-full transition-all duration-500"
                style={{ width: `${(progressToNext / 5) * 100}%` }}
              />
            </div>
            
            <div className="flex justify-between mt-2 text-xs text-stone-400">
              <span>0</span>
              <span>5 {getText('kat', 'cartes', 'cards')} = G 2,000</span>
            </div>
            
            {completedSets > 0 && (
              <p className="text-emerald-400 text-sm mt-4">
                {getText(
                  `Ou deja touche ${completedSets * 2000} HTG sou ${completedSets} seri konplete!`,
                  `Vous avez déjà gagné ${completedSets * 2000} HTG de ${completedSets} séries complétées!`,
                  `You've already earned ${completedSets * 2000} HTG from ${completedSets} completed sets!`
                )}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Affiliate Link */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 size={20} />
              {getText('Lyen afilyasyon ou', 'Votre lien d\'affiliation', 'Your affiliate link')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-stone-50 rounded-xl p-4 flex items-center gap-4">
              <code className="flex-1 text-sm text-stone-700 break-all font-mono">
                {affiliateData?.affiliate_link || 'Loading...'}
              </code>
              <Button 
                onClick={copyLink} 
                variant="outline"
                className="shrink-0 border-[#EA580C] text-[#EA580C] hover:bg-orange-50"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                <span className="ml-2">{copied ? getText('Kopye!', 'Copié!', 'Copied!') : getText('Kopye', 'Copier', 'Copy')}</span>
              </Button>
            </div>
            
            <div className="flex gap-3 mt-4">
              <Button onClick={shareLink} className="btn-primary flex-1">
                <Share2 size={18} className="mr-2" />
                {getText('Pataje', 'Partager', 'Share')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard size={20} />
              {getText('Kijan li mache?', 'Comment ça marche?', 'How does it work?')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { 
                  step: '1', 
                  icon: Share2,
                  title: getText('Pataje lyen ou', 'Partagez votre lien', 'Share your link'),
                  desc: getText('Voye lyen inik ou bay zanmi ak fanmi ou', 'Envoyez votre lien unique à vos amis et famille', 'Send your unique link to friends and family')
                },
                { 
                  step: '2', 
                  icon: CreditCard,
                  title: getText('Yo komande yon kat', 'Ils commandent une carte', 'They order a card'),
                  desc: getText('Moun ou refere yo enskri epi komande yon kat vityèl', 'Vos filleuls s\'inscrivent et commandent une carte virtuelle', 'Your referrals sign up and order a virtual card')
                },
                { 
                  step: '3', 
                  icon: Gift,
                  title: getText('Ou touche!', 'Vous gagnez!', 'You earn!'),
                  desc: getText('Resevwa G 2,000 pou chak 5 kat ki komande', 'Recevez G 2,000 pour chaque 5 cartes commandées', 'Receive G 2,000 for every 5 cards ordered')
                }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.step} className="text-center">
                    <div className="relative inline-block">
                      <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
                        <Icon className="text-[#EA580C]" size={28} />
                      </div>
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-[#EA580C] to-[#F59E0B] rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {item.step}
                      </div>
                    </div>
                    <h3 className="font-bold text-stone-900 mt-4 mb-2">{item.title}</h3>
                    <p className="text-stone-500 text-sm">{item.desc}</p>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-200 text-center">
              <p className="text-amber-800 font-semibold">
                {language === 'fr' 
                  ? '5 cartes commandées par vos filleuls = G 2,000 pour vous!'
                  : '5 cards ordered by your referrals = G 2,000 for you!'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Referrals List */}
        <Card>
          <CardHeader>
            <CardTitle>{language === 'fr' ? 'Vos filleuls' : 'Your referrals'}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <div className="skeleton w-10 h-10 rounded-full" />
                    <div className="skeleton w-32 h-4" />
                  </div>
                ))}
              </div>
            ) : affiliateData?.referrals?.length > 0 ? (
              <div className="divide-y divide-stone-100">
                {affiliateData.referrals.map((ref, index) => (
                  <div key={index} className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-amber-100 rounded-full flex items-center justify-center">
                        <span className="text-[#EA580C] font-bold">
                          {ref.full_name?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-stone-900">{ref.full_name}</p>
                        <p className="text-sm text-stone-500 font-mono">{ref.client_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {ref.has_card && (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold flex items-center gap-1">
                          <CreditCard size={12} />
                          {language === 'fr' ? 'Carte' : 'Card'}
                        </span>
                      )}
                      <span className="text-sm text-stone-400">
                        {new Date(ref.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-stone-500">
                <Users className="mx-auto mb-3 text-stone-400" size={48} />
                <p>{language === 'fr' ? 'Vous n\'avez pas encore de filleuls' : 'You have no referrals yet'}</p>
                <p className="text-sm mt-1">{language === 'fr' ? 'Partagez votre lien pour commencer!' : 'Share your link to get started!'}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
