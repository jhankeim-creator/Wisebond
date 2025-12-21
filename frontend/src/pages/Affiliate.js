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
  Gift
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Affiliate() {
  const { t } = useLanguage();
  const { user } = useAuth();
  
  const [affiliateData, setAffiliateData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

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
    toast.success(t('linkCopied'));
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: 'KAYICOM Wallet',
        text: 'Rejoignez KAYICOM Wallet et gérez vos finances en HTG et USD!',
        url: affiliateData?.affiliate_link
      });
    } else {
      copyLink();
    }
  };

  return (
    <DashboardLayout title={t('affiliate')}>
      <div className="space-y-6" data-testid="affiliate-page">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-purple-500 to-purple-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-200 text-sm">{t('totalEarnings')}</p>
                  <p className="text-3xl font-bold mt-1">
                    ${affiliateData?.earnings?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                  <DollarSign size={28} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">{t('totalReferrals')}</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    {affiliateData?.referrals?.length || 0}
                  </p>
                </div>
                <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Users size={28} className="text-[#0047AB]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Affiliate Link */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 size={20} />
              {t('yourAffiliateLink')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-4">
              <code className="flex-1 text-sm text-slate-700 break-all">
                {affiliateData?.affiliate_link || 'Chargement...'}
              </code>
              <Button 
                onClick={copyLink} 
                variant="outline"
                className="shrink-0"
                data-testid="copy-affiliate-link"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                <span className="ml-2">{copied ? 'Copié!' : t('copyLink')}</span>
              </Button>
            </div>
            
            <div className="flex gap-3 mt-4">
              <Button onClick={shareLink} className="btn-primary flex-1">
                <Share2 size={18} className="mr-2" />
                Partager
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Program Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift size={20} />
              {t('affiliateRules')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-emerald-50 rounded-xl">
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                  $1
                </div>
                <div>
                  <p className="font-medium text-slate-900">{t('affiliateRule1')}</p>
                  <p className="text-sm text-slate-600 mt-1">
                    Chaque fois qu'un de vos filleuls effectue un retrait de $300 ou plus, vous recevez automatiquement $1 de commission.
                  </p>
                </div>
              </div>
              
              <div className="bg-slate-50 rounded-xl p-4">
                <h4 className="font-medium text-slate-900 mb-2">Comment ça marche?</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
                  <li>Partagez votre lien d'affiliation avec vos amis et famille</li>
                  <li>Ils s'inscrivent via votre lien</li>
                  <li>Quand ils font des retraits USD, vous gagnez des commissions</li>
                  <li>Les commissions sont automatiquement ajoutées à votre wallet USD</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referrals List */}
        <Card>
          <CardHeader>
            <CardTitle>Vos filleuls</CardTitle>
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
              <div className="divide-y divide-slate-100">
                {affiliateData.referrals.map((ref, index) => (
                  <div key={index} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                        <Users size={18} className="text-slate-500" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{ref.full_name}</p>
                        <p className="text-sm text-slate-500 font-mono">{ref.client_id}</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500">
                      {new Date(ref.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Users className="mx-auto mb-3 text-slate-400" size={48} />
                <p>Vous n'avez pas encore de filleuls</p>
                <p className="text-sm mt-1">Partagez votre lien pour commencer à gagner!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
