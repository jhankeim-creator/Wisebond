import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';

export default function Privacy() {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const getText = (ht, fr, en) => {
    if (language === 'ht') return ht;
    if (language === 'fr') return fr;
    return en;
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900">
      {/* Header */}
      <div className="bg-white dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </Button>
          <Logo />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-700 p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <Shield className="text-emerald-500" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-stone-900 dark:text-white">
                {getText('Politik Konfidansyalite', 'Politique de Confidentialité', 'Privacy Policy')}
              </h1>
              <p className="text-stone-500 text-sm">
                {getText('Dènye mizajou: Desanm 2024', 'Dernière mise à jour: Décembre 2024', 'Last updated: December 2024')}
              </p>
            </div>
          </div>

          <div className="prose prose-stone dark:prose-invert max-w-none space-y-6">
            {/* Section 1 */}
            <section>
              <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
                {getText('1. Enfòmasyon Nou Kolekte', '1. Informations Collectées', '1. Information We Collect')}
              </h2>
              <p className="text-stone-600 dark:text-stone-300 leading-relaxed mb-3">
                {getText(
                  'Nou kolekte enfòmasyon sa yo pou ba ou sèvis nou yo:',
                  'Nous collectons les informations suivantes pour vous fournir nos services:',
                  'We collect the following information to provide our services:'
                )}
              </p>
              <ul className="list-disc list-inside text-stone-600 dark:text-stone-300 space-y-2">
                <li><strong>{getText('Enfòmasyon Pèsonèl:', 'Informations Personnelles:', 'Personal Information:')}</strong> {getText('Non, imèl, telefòn, dat nesans, adrès', 'Nom, email, téléphone, date de naissance, adresse', 'Name, email, phone, date of birth, address')}</li>
                <li><strong>{getText('Dokiman Idantite:', 'Documents d\'Identité:', 'Identity Documents:')}</strong> {getText('Foto pyès idantite, selfie pou verifikasyon KYC', 'Photo de pièce d\'identité, selfie pour vérification KYC', 'ID photo, selfie for KYC verification')}</li>
                <li><strong>{getText('Done Tranzaksyon:', 'Données de Transaction:', 'Transaction Data:')}</strong> {getText('Istorik depo, retrè, transfè', 'Historique des dépôts, retraits, transferts', 'Deposit, withdrawal, transfer history')}</li>
                <li><strong>{getText('Done Teknik:', 'Données Techniques:', 'Technical Data:')}</strong> {getText('Adrès IP, tip aparèy, navigatè', 'Adresse IP, type d\'appareil, navigateur', 'IP address, device type, browser')}</li>
              </ul>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
                {getText('2. Kijan Nou Itilize Enfòmasyon Ou', '2. Utilisation des Informations', '2. How We Use Your Information')}
              </h2>
              <ul className="list-disc list-inside text-stone-600 dark:text-stone-300 space-y-2">
                <li>{getText('Verifye idantite ou (KYC)', 'Vérifier votre identité (KYC)', 'Verify your identity (KYC)')}</li>
                <li>{getText('Trete tranzaksyon ou yo', 'Traiter vos transactions', 'Process your transactions')}</li>
                <li>{getText('Pwoteje kont fwod ak aktivite ilegal', 'Protéger contre la fraude et activités illégales', 'Protect against fraud and illegal activities')}</li>
                <li>{getText('Voye notifikasyon enpòtan', 'Envoyer des notifications importantes', 'Send important notifications')}</li>
                <li>{getText('Amelyore sèvis nou yo', 'Améliorer nos services', 'Improve our services')}</li>
                <li>{getText('Respekte obligasyon legal', 'Respecter les obligations légales', 'Comply with legal obligations')}</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
                {getText('3. Pataj Enfòmasyon', '3. Partage des Informations', '3. Information Sharing')}
              </h2>
              <p className="text-stone-600 dark:text-stone-300 leading-relaxed mb-3">
                {getText(
                  'Nou pa vann enfòmasyon pèsonèl ou. Nou ka pataje enfòmasyon ak:',
                  'Nous ne vendons pas vos informations personnelles. Nous pouvons partager des informations avec:',
                  'We do not sell your personal information. We may share information with:'
                )}
              </p>
              <ul className="list-disc list-inside text-stone-600 dark:text-stone-300 space-y-2">
                <li>{getText('Founisè sèvis peman nou yo (MonCash, NatCash, PayPal, elatriye)', 'Nos fournisseurs de services de paiement (MonCash, NatCash, PayPal, etc.)', 'Our payment service providers (MonCash, NatCash, PayPal, etc.)')}</li>
                <li>{getText('Otorite legal si lalwa mande sa', 'Autorités légales si la loi l\'exige', 'Legal authorities if required by law')}</li>
                <li>{getText('Patnè sekirite pou prevansyon fwod', 'Partenaires de sécurité pour la prévention de la fraude', 'Security partners for fraud prevention')}</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
                {getText('4. Sekirite Done', '4. Sécurité des Données', '4. Data Security')}
              </h2>
              <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
                {getText(
                  'Nou itilize mezi sekirite fò pou pwoteje done ou: chifraj SSL/TLS, otantifikasyon sekirize, siveyans 24/7, sèvè ki sekirize. Done ou stoke nan sèvè ki pwoteje ak aksè limite.',
                  'Nous utilisons des mesures de sécurité robustes pour protéger vos données: cryptage SSL/TLS, authentification sécurisée, surveillance 24/7, serveurs sécurisés. Vos données sont stockées sur des serveurs protégés avec accès limité.',
                  'We use strong security measures to protect your data: SSL/TLS encryption, secure authentication, 24/7 monitoring, secured servers. Your data is stored on protected servers with limited access.'
                )}
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
                {getText('5. Dwa Ou', '5. Vos Droits', '5. Your Rights')}
              </h2>
              <p className="text-stone-600 dark:text-stone-300 leading-relaxed mb-3">
                {getText(
                  'Ou gen dwa:',
                  'Vous avez le droit de:',
                  'You have the right to:'
                )}
              </p>
              <ul className="list-disc list-inside text-stone-600 dark:text-stone-300 space-y-2">
                <li>{getText('Aksede ak enfòmasyon ou', 'Accéder à vos informations', 'Access your information')}</li>
                <li>{getText('Korije done ki pa kòrèk', 'Corriger les données incorrectes', 'Correct inaccurate data')}</li>
                <li>{getText('Mande efase done ou (si lalwa pèmèt)', 'Demander la suppression de vos données (si la loi le permet)', 'Request deletion of your data (if permitted by law)')}</li>
                <li>{getText('Resevwa yon kopi done ou', 'Recevoir une copie de vos données', 'Receive a copy of your data')}</li>
                <li>{getText('Dezabòne nan kominikasyon maketing', 'Vous désabonner des communications marketing', 'Unsubscribe from marketing communications')}</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
                {getText('6. Konsèvasyon Done', '6. Conservation des Données', '6. Data Retention')}
              </h2>
              <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
                {getText(
                  'Nou kenbe done ou pou peryòd ki nesesè pou ba ou sèvis nou yo epi respekte obligasyon legal nou yo. Done finansye yo konsève selon egzijans legal (anjeneral 5-7 ane).',
                  'Nous conservons vos données pendant la période nécessaire pour vous fournir nos services et respecter nos obligations légales. Les données financières sont conservées selon les exigences légales (généralement 5-7 ans).',
                  'We retain your data for the period necessary to provide our services and comply with our legal obligations. Financial data is retained according to legal requirements (typically 5-7 years).'
                )}
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
                {getText('7. Cookies', '7. Cookies', '7. Cookies')}
              </h2>
              <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
                {getText(
                  'Nou itilize cookies pou amelyore eksperyans ou sou sit nou an. Cookies sa yo ede nou memorize preferans ou, kenbe sesyon ou aktif, epi analize kijan sit la fonksyone.',
                  'Nous utilisons des cookies pour améliorer votre expérience sur notre site. Ces cookies nous aident à mémoriser vos préférences, maintenir votre session active, et analyser les performances du site.',
                  'We use cookies to improve your experience on our site. These cookies help us remember your preferences, keep your session active, and analyze site performance.'
                )}
              </p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
                {getText('8. Timoun yo', '8. Enfants', '8. Children')}
              </h2>
              <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
                {getText(
                  'Sèvis nou yo pa pou moun ki gen mwens pase 18 lane. Nou pa kolekte enfòmasyon sou minè ekspre. Si nou dekouvri ke nou te kolekte enfòmasyon sou yon minè, nou ap efase enfòmasyon sa yo.',
                  'Nos services ne sont pas destinés aux personnes de moins de 18 ans. Nous ne collectons pas intentionnellement d\'informations sur les mineurs. Si nous découvrons que nous avons collecté des informations sur un mineur, nous supprimerons ces informations.',
                  'Our services are not intended for persons under 18 years of age. We do not intentionally collect information about minors. If we discover we have collected information about a minor, we will delete that information.'
                )}
              </p>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
                {getText('9. Chanjman nan Politik sa a', '9. Modifications de cette Politique', '9. Changes to this Policy')}
              </h2>
              <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
                {getText(
                  'Nou ka mete politik sa a ajou detanzantan. Nou ap notifye ou sou chanjman enpòtan yo atravè imèl oswa notifikasyon sou sit la.',
                  'Nous pouvons mettre à jour cette politique de temps en temps. Nous vous informerons des changements importants par email ou notification sur le site.',
                  'We may update this policy from time to time. We will notify you of important changes via email or site notification.'
                )}
              </p>
            </section>

            {/* Section 10 */}
            <section>
              <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
                {getText('10. Kontakte Nou', '10. Nous Contacter', '10. Contact Us')}
              </h2>
              <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
                {getText(
                  'Pou nenpòt kesyon oswa enkyetid sou konfidansyalite, oswa pou egzèse dwa ou yo, kontakte sipò kliyan nou an.',
                  'Pour toute question ou préoccupation concernant la confidentialité, ou pour exercer vos droits, contactez notre support client.',
                  'For any questions or concerns about privacy, or to exercise your rights, contact our customer support.'
                )}
              </p>
            </section>
          </div>

          <div className="mt-8 pt-6 border-t border-stone-200 dark:border-stone-700 text-center">
            <Button onClick={() => navigate(-1)} className="bg-[#EA580C] hover:bg-[#EA580C]/90 text-white">
              {getText('Retounen', 'Retour', 'Go Back')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
