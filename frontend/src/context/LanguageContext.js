import React, { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  ht: {
    // Navigation
    home: "Akèy",
    dashboard: "Tablo bò",
    deposit: "Depoze",
    withdraw: "Retire",
    transfer: "Voye",
    transactions: "Tranzaksyon",
    kyc: "Verifikasyon KYC",
    affiliate: "Afilyasyon",
    settings: "Paramèt",
    logout: "Dekonekte",
    admin: "Administrasyon",
    
    // Auth
    login: "Konekte",
    register: "Enskri",
    email: "Imèl",
    password: "Modpas",
    confirmPassword: "Konfime modpas",
    fullName: "Non konplè",
    phone: "Telefòn",
    forgotPassword: "Bliye modpas?",
    resetPassword: "Reyinisyalize modpas",
    newPassword: "Nouvo modpas",
    alreadyHaveAccount: "Ou gen yon kont deja?",
    dontHaveAccount: "Ou pa gen kont?",
    
    // Landing
    heroTitle: "Pòtfèy Multi-Deviz Ou",
    heroSubtitle: "Jere finans ou an HTG ak USD, fè transfè enstantane, epi benefisye nan sistèm afilyasyon nou.",
    getStarted: "Kòmanse",
    learnMore: "Aprann plis",
    features: "Karakteristik",
    secureWallet: "Pòtfèy Sekirize",
    secureWalletDesc: "Lajan ou pwoteje ak sekirite nivo bank.",
    instantTransfers: "Transfè Enstantane",
    instantTransfersDesc: "Voye lajan bay nenpòt moun nan kèk segonn.",
    multiCurrency: "Multi-Deviz",
    multiCurrencyDesc: "Jere HTG ak USD nan yon sèl kont.",
    affiliateProgram: "Pwogram Afilyasyon",
    affiliateProgramDesc: "Touche G 2,000 pou chak 5 moun ou refere ki komande yon kat!",
    
    // Dashboard
    welcomeBack: "Byenveni",
    totalBalance: "Balans Total",
    availableBalance: "Balans Disponib",
    recentTransactions: "Tranzaksyon Resan",
    noTransactions: "Pa gen tranzaksyon",
    viewAll: "Wè tout",
    
    // Deposit
    depositFunds: "Depoze lajan",
    selectMethod: "Chwazi metòd",
    amount: "Montan",
    uploadProof: "Telechaje prèv peman",
    submitDeposit: "Soumèt depo",
    depositPending: "Depo ap tann validasyon",
    
    // Withdraw
    withdrawFunds: "Retire lajan",
    destination: "Destinasyon",
    fee: "Frè",
    netAmount: "Montan nèt",
    submitWithdrawal: "Soumèt retrè",
    
    // Transfer
    sendMoney: "Voye lajan",
    recipientId: "ID Destinatè",
    transferSuccess: "Transfè reyisi",
    
    // KYC
    kycVerification: "Verifikasyon idantite",
    kycRequired: "Verifikasyon KYC obligatwa pou fè tranzaksyon.",
    dateOfBirth: "Dat nesans",
    address: "Adrès",
    nationality: "Nasyonalite",
    idType: "Tip dokiman",
    idCard: "Kat idantite",
    passport: "Paspò",
    frontPhoto: "Foto devan",
    backPhoto: "Foto dèyè",
    selfieWithId: "Selfie ak dokiman",
    submitKyc: "Soumèt verifikasyon",
    kycPending: "Ap tann verifikasyon",
    kycApproved: "Verifye",
    kycRejected: "Rejte",
    
    // Affiliate
    yourAffiliateLink: "Lyen afilyasyon ou",
    copyLink: "Kopye lyen",
    linkCopied: "Lyen kopye!",
    totalEarnings: "Tout sa ou touche",
    totalReferrals: "Total moun ou refere",
    affiliateRules: "Règ pwogram nan",
    affiliateRule1: "Touche G 2,000 pou chak 5 moun ou refere ki komande yon kat",
    
    // Status
    pending: "Ap tann",
    approved: "Apwouve",
    rejected: "Rejte",
    completed: "Konplete",
    
    // Common
    submit: "Soumèt",
    cancel: "Anile",
    save: "Anrejistre",
    edit: "Modifye",
    delete: "Efase",
    search: "Chèche",
    filter: "Filtre",
    loading: "Chajman...",
    error: "Erè",
    success: "Siksè",
    confirm: "Konfime",
    back: "Retounen",
    next: "Pwochen",
    close: "Fèmen",
    
    // Admin
    adminPanel: "Panèl Administrasyon",
    users: "Itilizatè",
    deposits: "Depo",
    withdrawals: "Retrè",
    exchangeRates: "To chanj",
    fees: "Frè",
    bulkEmail: "Imèl an mas",
    logs: "Jounal",
    approve: "Apwouve",
    reject: "Rejte",
    
    // Virtual Card
    virtualCard: "Kat Vityèl",
    orderCard: "Komande kat",
    cardBalance: "Balans kat",
    
    // Errors
    invalidCredentials: "Idantifyan envalid",
    insufficientBalance: "Balans ensifizan",
    kycRequiredError: "Verifikasyon KYC obligatwa",
    networkError: "Erè rezo",
  },
  fr: {
    // Navigation
    home: "Accueil",
    dashboard: "Tableau de bord",
    deposit: "Déposer",
    withdraw: "Retirer",
    transfer: "Envoyer",
    transactions: "Transactions",
    kyc: "Vérification KYC",
    affiliate: "Affiliation",
    settings: "Paramètres",
    logout: "Déconnexion",
    admin: "Administration",
    
    // Auth
    login: "Connexion",
    register: "Inscription",
    email: "Email",
    password: "Mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    fullName: "Nom complet",
    phone: "Téléphone",
    forgotPassword: "Mot de passe oublié?",
    resetPassword: "Réinitialiser le mot de passe",
    newPassword: "Nouveau mot de passe",
    alreadyHaveAccount: "Vous avez déjà un compte?",
    dontHaveAccount: "Vous n'avez pas de compte?",
    
    // Landing
    heroTitle: "Votre Portefeuille Multi-Devises",
    heroSubtitle: "Gérez vos finances en HTG et USD, effectuez des transferts instantanés, et profitez de notre système d'affiliation.",
    getStarted: "Commencer",
    learnMore: "En savoir plus",
    features: "Fonctionnalités",
    secureWallet: "Portefeuille Sécurisé",
    secureWalletDesc: "Vos fonds sont protégés avec une sécurité de niveau bancaire.",
    instantTransfers: "Transferts Instantanés",
    instantTransfersDesc: "Envoyez de l'argent à n'importe qui en quelques secondes.",
    multiCurrency: "Multi-Devises",
    multiCurrencyDesc: "Gérez HTG et USD dans un seul compte.",
    affiliateProgram: "Programme d'Affiliation",
    affiliateProgramDesc: "Gagnez $1 pour chaque $300 de retraits de vos filleuls.",
    
    // Dashboard
    welcomeBack: "Bienvenue",
    totalBalance: "Solde Total",
    availableBalance: "Solde Disponible",
    recentTransactions: "Transactions Récentes",
    noTransactions: "Aucune transaction",
    viewAll: "Voir tout",
    
    // Deposit
    depositFunds: "Déposer des fonds",
    selectMethod: "Sélectionner la méthode",
    amount: "Montant",
    uploadProof: "Télécharger la preuve de paiement",
    submitDeposit: "Soumettre le dépôt",
    depositPending: "Dépôt en attente de validation",
    
    // Withdraw
    withdrawFunds: "Retirer des fonds",
    destination: "Destination",
    fee: "Frais",
    netAmount: "Montant net",
    submitWithdrawal: "Soumettre le retrait",
    
    // Transfer
    sendMoney: "Envoyer de l'argent",
    recipientId: "ID du destinataire",
    transferSuccess: "Transfert réussi",
    
    // KYC
    kycVerification: "Vérification d'identité",
    kycRequired: "La vérification KYC est requise pour effectuer des transactions.",
    dateOfBirth: "Date de naissance",
    address: "Adresse",
    nationality: "Nationalité",
    idType: "Type de document",
    idCard: "Carte d'identité",
    passport: "Passeport",
    frontPhoto: "Photo recto",
    backPhoto: "Photo verso",
    selfieWithId: "Selfie avec document",
    submitKyc: "Soumettre la vérification",
    kycPending: "En attente de vérification",
    kycApproved: "Vérifié",
    kycRejected: "Rejeté",
    
    // Affiliate
    yourAffiliateLink: "Votre lien d'affiliation",
    copyLink: "Copier le lien",
    linkCopied: "Lien copié!",
    totalEarnings: "Gains totaux",
    totalReferrals: "Total de filleuls",
    affiliateRules: "Règles du programme",
    affiliateRule1: "Gagnez $1 pour chaque $300 de retraits de vos filleuls",
    
    // Status
    pending: "En attente",
    approved: "Approuvé",
    rejected: "Rejeté",
    completed: "Complété",
    
    // Common
    submit: "Soumettre",
    cancel: "Annuler",
    save: "Enregistrer",
    edit: "Modifier",
    delete: "Supprimer",
    search: "Rechercher",
    filter: "Filtrer",
    loading: "Chargement...",
    error: "Erreur",
    success: "Succès",
    confirm: "Confirmer",
    back: "Retour",
    next: "Suivant",
    close: "Fermer",
    
    // Admin
    adminPanel: "Panneau d'administration",
    users: "Utilisateurs",
    deposits: "Dépôts",
    withdrawals: "Retraits",
    exchangeRates: "Taux de change",
    fees: "Frais",
    bulkEmail: "Email en masse",
    logs: "Journaux",
    approve: "Approuver",
    reject: "Rejeter",
    
    // Errors
    invalidCredentials: "Identifiants invalides",
    insufficientBalance: "Solde insuffisant",
    kycRequiredError: "Vérification KYC requise",
    networkError: "Erreur réseau",
  },
  en: {
    // Navigation
    home: "Home",
    dashboard: "Dashboard",
    deposit: "Deposit",
    withdraw: "Withdraw",
    transfer: "Send",
    transactions: "Transactions",
    kyc: "KYC Verification",
    affiliate: "Affiliate",
    settings: "Settings",
    logout: "Logout",
    admin: "Administration",
    
    // Auth
    login: "Login",
    register: "Register",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm Password",
    fullName: "Full Name",
    phone: "Phone",
    forgotPassword: "Forgot password?",
    resetPassword: "Reset Password",
    newPassword: "New Password",
    alreadyHaveAccount: "Already have an account?",
    dontHaveAccount: "Don't have an account?",
    
    // Landing
    heroTitle: "Your Multi-Currency Wallet",
    heroSubtitle: "Manage your finances in HTG and USD, make instant transfers, and benefit from our affiliate system.",
    getStarted: "Get Started",
    learnMore: "Learn More",
    features: "Features",
    secureWallet: "Secure Wallet",
    secureWalletDesc: "Your funds are protected with bank-level security.",
    instantTransfers: "Instant Transfers",
    instantTransfersDesc: "Send money to anyone in seconds.",
    multiCurrency: "Multi-Currency",
    multiCurrencyDesc: "Manage HTG and USD in one account.",
    affiliateProgram: "Affiliate Program",
    affiliateProgramDesc: "Earn $1 for every $300 withdrawn by your referrals.",
    
    // Dashboard
    welcomeBack: "Welcome back",
    totalBalance: "Total Balance",
    availableBalance: "Available Balance",
    recentTransactions: "Recent Transactions",
    noTransactions: "No transactions",
    viewAll: "View all",
    
    // Deposit
    depositFunds: "Deposit Funds",
    selectMethod: "Select Method",
    amount: "Amount",
    uploadProof: "Upload payment proof",
    submitDeposit: "Submit Deposit",
    depositPending: "Deposit pending validation",
    
    // Withdraw
    withdrawFunds: "Withdraw Funds",
    destination: "Destination",
    fee: "Fee",
    netAmount: "Net Amount",
    submitWithdrawal: "Submit Withdrawal",
    
    // Transfer
    sendMoney: "Send Money",
    recipientId: "Recipient ID",
    transferSuccess: "Transfer successful",
    
    // KYC
    kycVerification: "Identity Verification",
    kycRequired: "KYC verification is required to make transactions.",
    dateOfBirth: "Date of Birth",
    address: "Address",
    nationality: "Nationality",
    idType: "Document Type",
    idCard: "ID Card",
    passport: "Passport",
    frontPhoto: "Front Photo",
    backPhoto: "Back Photo",
    selfieWithId: "Selfie with Document",
    submitKyc: "Submit Verification",
    kycPending: "Pending Verification",
    kycApproved: "Verified",
    kycRejected: "Rejected",
    
    // Affiliate
    yourAffiliateLink: "Your Affiliate Link",
    copyLink: "Copy Link",
    linkCopied: "Link copied!",
    totalEarnings: "Total Earnings",
    totalReferrals: "Total Referrals",
    affiliateRules: "Program Rules",
    affiliateRule1: "Earn $1 for every $300 withdrawn by your referrals",
    
    // Status
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    completed: "Completed",
    
    // Common
    submit: "Submit",
    cancel: "Cancel",
    save: "Save",
    edit: "Edit",
    delete: "Delete",
    search: "Search",
    filter: "Filter",
    loading: "Loading...",
    error: "Error",
    success: "Success",
    confirm: "Confirm",
    back: "Back",
    next: "Next",
    close: "Close",
    
    // Admin
    adminPanel: "Admin Panel",
    users: "Users",
    deposits: "Deposits",
    withdrawals: "Withdrawals",
    exchangeRates: "Exchange Rates",
    fees: "Fees",
    bulkEmail: "Bulk Email",
    logs: "Logs",
    approve: "Approve",
    reject: "Reject",
    
    // Errors
    invalidCredentials: "Invalid credentials",
    insufficientBalance: "Insufficient balance",
    kycRequiredError: "KYC verification required",
    networkError: "Network error",
  }
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('kayicom_language');
    return saved || 'ht'; // Default to Haitian Creole
  });

  useEffect(() => {
    localStorage.setItem('kayicom_language', language);
  }, [language]);

  const t = (key) => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  };

  const toggleLanguage = () => {
    // Cycle through: ht -> fr -> en -> ht
    setLanguage(prev => {
      if (prev === 'ht') return 'fr';
      if (prev === 'fr') return 'en';
      return 'ht';
    });
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
