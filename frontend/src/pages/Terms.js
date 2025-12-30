import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';

export default function Terms() {
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
            <div className="w-12 h-12 bg-[#EA580C]/10 rounded-xl flex items-center justify-center">
              <FileText className="text-[#EA580C]" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-stone-900 dark:text-white">
                {getText('Kondisyon Sèvis', 'Conditions d\'Utilisation', 'Terms of Service')}
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
                {getText('1. Akseptasyon Kondisyon yo', '1. Acceptation des Conditions', '1. Acceptance of Terms')}
              </h2>
              <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
                {getText(
                  'Lè ou itilize KAYICOM WALLET, ou aksepte tout kondisyon ki nan dokiman sa a. Si ou pa dakò ak nenpòt ki kondisyon, tanpri pa itilize sèvis nou yo.',
                  'En utilisant KAYICOM WALLET, vous acceptez toutes les conditions de ce document. Si vous n\'êtes pas d\'accord avec une condition, veuillez ne pas utiliser nos services.',
                  'By using KAYICOM WALLET, you accept all terms in this document. If you disagree with any term, please do not use our services.'
                )}
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
                {getText('2. Sèvis Nou Ofri', '2. Services Offerts', '2. Services Offered')}
              </h2>
              <ul className="list-disc list-inside text-stone-600 dark:text-stone-300 space-y-2">
                <li>{getText('Pòtfèy dijital pou HTG ak USD', 'Portefeuille numérique pour HTG et USD', 'Digital wallet for HTG and USD')}</li>
                <li>{getText('Transfè lajan ant itilizatè yo', 'Transfert d\'argent entre utilisateurs', 'Money transfers between users')}</li>
                <li>{getText('Depo ak retrè atravè plizyè metòd', 'Dépôts et retraits via plusieurs méthodes', 'Deposits and withdrawals via multiple methods')}</li>
                <li>{getText('Kat vityèl pou acha an liy', 'Carte virtuelle pour achats en ligne', 'Virtual card for online purchases')}</li>
                <li>{getText('Pwogram afilyasyon', 'Programme d\'affiliation', 'Affiliate program')}</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
                {getText('3. Verifikasyon Idantite (KYC)', '3. Vérification d\'Identité (KYC)', '3. Identity Verification (KYC)')}
              </h2>
              <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
                {getText(
                  'Pou itilize sèvis nou yo, ou dwe konplete verifikasyon KYC. Nou mande: non konplè, dat nesans, adrès, yon pyès idantite valid, ak yon foto selfie. Enfòmasyon sa yo pwoteje selon règleman konfidansyalite nou.',
                  'Pour utiliser nos services, vous devez compléter la vérification KYC. Nous demandons: nom complet, date de naissance, adresse, une pièce d\'identité valide, et une photo selfie. Ces informations sont protégées selon notre politique de confidentialité.',
                  'To use our services, you must complete KYC verification. We require: full name, date of birth, address, a valid ID document, and a selfie photo. This information is protected according to our privacy policy.'
                )}
              </p>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
                {getText('4. Frè ak Limit', '4. Frais et Limites', '4. Fees and Limits')}
              </h2>
              <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
                {getText(
                  'Depo yo gratis. Retrè yo gen frè ki varye selon metòd la ak montan an. Frè yo afiche klèman anvan ou konfime tranzaksyon an. Limit minimòm ak maksimòm aplike pou chak metòd.',
                  'Les dépôts sont gratuits. Les retraits ont des frais qui varient selon la méthode et le montant. Les frais sont affichés clairement avant confirmation. Des limites minimum et maximum s\'appliquent pour chaque méthode.',
                  'Deposits are free. Withdrawals have fees that vary by method and amount. Fees are clearly displayed before confirmation. Minimum and maximum limits apply for each method.'
                )}
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
                {getText('5. Aktivite Entèdi', '5. Activités Interdites', '5. Prohibited Activities')}
              </h2>
              <ul className="list-disc list-inside text-stone-600 dark:text-stone-300 space-y-2">
                <li>{getText('Blanchi lajan oswa aktivite ilegal', 'Blanchiment d\'argent ou activités illégales', 'Money laundering or illegal activities')}</li>
                <li>{getText('Itilize kat vityèl pou sit paryaj oswa pònografi', 'Utiliser la carte virtuelle pour sites de paris ou pornographie', 'Using virtual card for gambling or pornography sites')}</li>
                <li>{getText('Kreye plizyè kont', 'Créer plusieurs comptes', 'Creating multiple accounts')}</li>
                <li>{getText('Pataje enfòmasyon kont ou ak lòt moun', 'Partager vos informations de compte', 'Sharing your account information')}</li>
                <li>{getText('Fwod oswa vòl idantite', 'Fraude ou vol d\'identité', 'Fraud or identity theft')}</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
                {getText('6. Responsablite', '6. Responsabilité', '6. Liability')}
              </h2>
              <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
                {getText(
                  'KAYICOM WALLET pa responsab pou pèt ki soti nan: erè itilizatè, fòs majè, aksyon tyès pati. Nou fè tout efò pou pwoteje kont ou, men ou responsab pou kenbe enfòmasyon koneksyon ou an sekirite.',
                  'KAYICOM WALLET n\'est pas responsable des pertes résultant de: erreurs utilisateur, force majeure, actions de tiers. Nous faisons tout notre possible pour protéger votre compte, mais vous êtes responsable de garder vos informations de connexion en sécurité.',
                  'KAYICOM WALLET is not liable for losses resulting from: user errors, force majeure, third party actions. We make every effort to protect your account, but you are responsible for keeping your login information secure.'
                )}
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
                {getText('7. Modifikasyon Kondisyon yo', '7. Modification des Conditions', '7. Modification of Terms')}
              </h2>
              <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
                {getText(
                  'Nou ka modifye kondisyon sa yo nenpòt ki lè. Modifikasyon yo ap afiche sou sit la. Kontinye itilize sèvis la apre modifikasyon yo vle di ou aksepte nouvo kondisyon yo.',
                  'Nous pouvons modifier ces conditions à tout moment. Les modifications seront publiées sur le site. Continuer à utiliser le service après les modifications signifie que vous acceptez les nouvelles conditions.',
                  'We may modify these terms at any time. Modifications will be posted on the site. Continued use of the service after modifications means you accept the new terms.'
                )}
              </p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">
                {getText('8. Kontakte Nou', '8. Nous Contacter', '8. Contact Us')}
              </h2>
              <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
                {getText(
                  'Pou nenpòt kesyon oswa enkyetid konsènan kondisyon sa yo, kontakte sipò kliyan nou an.',
                  'Pour toute question ou préoccupation concernant ces conditions, contactez notre support client.',
                  'For any questions or concerns about these terms, contact our customer support.'
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
