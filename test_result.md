# Testing Protocol for KAYICOM Wallet

## Testing Instructions
Testing agent should verify the following flows:

### Backend Tests
1. User registration with affiliate referral code
2. User login
3. Exchange rates API with separate swap rates
4. Cross-currency withdrawal
5. Virtual card order API with card_email
6. TopUp order API
7. Admin card fees API (by limit)
8. Admin swap rates update

### Frontend Tests
1. Landing page in Haitian Creole
2. Login/Register flow
3. Dashboard with **Swap button in quick actions** (5 buttons total)
4. **Copy Client ID button** - shows toast "ID kopye!"
5. **Dark/Light mode toggle** in header
6. **New KAYICOM logo** (purple gradient text logo)
7. Admin Rates page with **separate swap rates**
8. Admin Fees page with **card withdrawal fees by limit**
9. Admin Users page with **client management** (view, block/unblock)
10. KYC page with **example images** for selfie
11. All text in Haitian Creole

## Test User Credentials
- Admin: admin@kayicom.com / Admin123!

## Key Features to Verify
- Logo is text-based "KAYICOM" with purple gradient
- Dark mode toggle works correctly
- Swap is in dashboard quick actions
- Admin can set different rates for swap vs general conversion
- Admin can configure card withdrawal fees by amount range
- All deposits are FREE (no fees)
- Withdrawals have configurable fees
- Card fees depend on withdrawal limit

## Incorporate User Feedback
- Verify logo has no background
- Verify dark/light mode toggle
- Verify swap in quick actions
- Verify separate swap rates in admin
