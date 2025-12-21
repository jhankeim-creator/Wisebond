# Testing Protocol for KAYICOM Wallet

## Testing Instructions
Testing agent should verify the following flows:

### Backend Tests
1. User registration with affiliate referral code
2. User login
3. Exchange rates API
4. Cross-currency withdrawal (deposit USD, withdraw HTG)
5. Virtual card order API
6. Admin settings API

### Frontend Tests
1. Landing page in Haitian Creole
2. Login/Register flow
3. Dashboard displays balances in both currencies with equivalent values
4. Withdraw page shows currency conversion options
5. Virtual card page
6. Affiliate page shows referral link and rules
7. Admin settings page with API key inputs
8. Language switcher works (KR/FR/EN)

## Test User Credentials
- Email: demo@kayicom.com
- Password: Demo1234!
- Role: Admin

## Key Features to Verify
- Cross-currency withdrawal (HTG to USD and vice versa)
- Card withdrawal option in withdraw page
- Haitian Creole translations throughout the app
- All buttons visible and styled correctly

## Incorporate User Feedback
- N/A
