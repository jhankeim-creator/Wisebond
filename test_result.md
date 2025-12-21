# Testing Protocol for KAYICOM Wallet

## Testing Instructions
Testing agent should verify the following flows:

### Backend Tests
1. User registration with affiliate referral code
2. User login
3. Exchange rates API
4. Cross-currency withdrawal (deposit USD, withdraw HTG)
5. Virtual card order API (new endpoint with card_email)
6. TopUp order API (new endpoint)
7. Admin virtual card orders management
8. Admin topup orders management
9. Swap API endpoint

### Frontend Tests
1. Landing page in Haitian Creole
2. Login/Register flow
3. Dashboard displays balances with **copy button for Client ID**
4. Swap page with currency conversion
5. Virtual card page with order form (email input)
6. TopUp page with country selection
7. Admin panel - Virtual Cards orders page
8. Admin panel - TopUp orders page
9. Mobile responsiveness on admin panel
10. Language switcher works (KR/FR/EN)

## Test User Credentials
- Email: admin@kayicom.com
- Password: Admin123!
- Role: Admin

## Key Features to Verify
- Copy Client ID button on Dashboard (click and verify toast message)
- Virtual Card order with email (card_email field)
- TopUp order with phone number and country
- Admin can approve/reject virtual card orders
- Admin can complete/cancel topup orders
- $5 USD bonus added when admin approves card order
- Refund when admin rejects card order

## Incorporate User Feedback
- Verify Haitian Creole translations throughout
- Test mobile responsiveness on all admin pages
