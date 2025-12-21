# Testing Protocol for KAYICOM Wallet

## Testing Instructions
Testing agent should verify the following flows:

### Backend Tests
1. User registration/login
2. GET /api/public/chat-settings (public endpoint)
3. Admin settings with enable/disable toggles
4. Exchange rates with separate swap rates
5. Card fees by limit

### Frontend Tests
1. Landing page shows **original KAYICOM logo** (purple/violet)
2. **Home (Akèy)** link in sidebar navigates to landing page
3. Dashboard has **5 quick action buttons** including **Swap (purple)**
4. **Copy Client ID button** shows toast
5. Admin Settings page with **toggle switches** for:
   - Imèl (Resend)
   - Chat Dirèk (Crisp)
   - WhatsApp
   - USDT (Plisio)
6. Logo is **clickable** and goes to landing page

## Test User Credentials
- Admin: admin@kayicom.com / Admin123!

## Key Features to Verify
- Original KAYICOM logo (purple/violet image)
- Home link "Akèy" in sidebar
- Integration toggle switches work
- LiveChat component loads based on settings

## Incorporate User Feedback
- Logo must be the user's original (not text-based)
- Easy navigation to home page
- Admin can enable/disable integrations
