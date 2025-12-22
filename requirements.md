# KAYICOM WALLET - Requirements & Architecture

## Original Problem Statement
LÒD OFISYÈL – DEVLOPMAN PLATFÒM WALLET MULTI-DEVIZ (KAYICOM WALLET)
- Platform finansye wallet bilingual (Français/English)
- Multi-deviz: HTG (Gourde) & USD (Dollar)
- KYC obligatoire, depo/retrè manual, frè konfigirab
- Sistèm afilyasyon, admin panel avanse
- Sèvis: MonCash, NatCash, Zelle, PayPal, USDT

## Architecture

### Tech Stack
- **Backend**: FastAPI (Python)
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Database**: MongoDB
- **Email**: Resend (configurable via admin)

### Backend Structure
```
/app/backend/
├── server.py          # Main FastAPI application with all routes
├── requirements.txt   # Python dependencies
└── .env              # Environment variables
```

### Frontend Structure
```
/app/frontend/src/
├── App.js                    # Main app with routing
├── context/
│   ├── AuthContext.js        # Authentication state
│   └── LanguageContext.js    # Bilingual support (FR/EN)
├── components/
│   ├── Sidebar.js            # User sidebar navigation
│   ├── AdminLayout.js        # Admin layout
│   ├── DashboardLayout.js    # User dashboard layout
│   └── LanguageSwitcher.js   # FR/EN toggle
├── pages/
│   ├── Landing.js            # Public landing page
│   ├── Login.js              # User login
│   ├── Register.js           # User registration
│   ├── ForgotPassword.js     # Password reset request
│   ├── ResetPassword.js      # Password reset
│   ├── Dashboard.js          # User dashboard
│   ├── Deposit.js            # Deposit funds
│   ├── Withdraw.js           # Withdraw funds
│   ├── Transfer.js           # P2P transfers
│   ├── Transactions.js       # Transaction history
│   ├── KYC.js                # KYC verification
│   ├── Affiliate.js          # Affiliate program
│   ├── Settings.js           # User settings
│   └── admin/
│       ├── AdminDashboard.js # Admin overview
│       ├── AdminUsers.js     # User management
│       ├── AdminKYC.js       # KYC review
│       ├── AdminDeposits.js  # Deposit approval
│       ├── AdminWithdrawals.js # Withdrawal processing
│       ├── AdminRates.js     # Exchange rates
│       ├── AdminFees.js      # Fees configuration
│       ├── AdminSettings.js  # API keys config
│       └── AdminBulkEmail.js # Bulk email campaigns
```

## Features Implemented

### User Features
- [x] Registration with email/password
- [x] Login with authentication
- [x] Password reset via email
- [x] Dashboard with HTG & USD balances
- [x] Deposit via MonCash, NatCash, Zelle, PayPal, USDT
- [x] Withdrawal with configurable fees
- [x] P2P transfers between users
- [x] Transaction history
- [x] KYC verification (document upload)
- [x] Affiliate program ($1 per $300 withdrawn)
- [x] Language switcher (FR/EN)
- [x] Unique Client ID per user

### Admin Features
- [x] Admin dashboard with statistics
- [x] User management (view, block, unblock)
- [x] KYC review (approve/reject with reasons)
- [x] Deposit approval
- [x] Withdrawal processing
- [x] Exchange rates configuration (HTG ⇄ USD)
- [x] Fees configuration per method
- [x] Withdrawal limits configuration
- [x] API settings (Resend, Crisp, WhatsApp)
- [x] Bulk email campaigns
- [x] Activity logs

## Default Credentials
- **Admin**: graciaemmanuel509@gmail.com / Admin123!

## Next Tasks (Phase 2)
1. **USDT Auto-Detection**: Integrate blockchain API for automatic USDT deposit detection
2. **2FA Implementation**: Add two-factor authentication option
3. **Live Chat Integration**: Configure Crisp/WhatsApp chat widgets
4. **Mobile Optimization**: Improve responsive design for mobile users
5. **Email Templates**: Design professional email templates for notifications
6. **Rate Limiting**: Add API rate limiting for security
7. **Real-time Notifications**: WebSocket for live updates
8. **Virtual Card Creation**: Integration with card issuer
9. **Mobile Minutes Sales**: Top-up service integration
