# Testing Protocol for KAYICOM Wallet

## Testing Instructions
Testing agent should verify the following flows:

### Backend Tests
1. User registration/login
2. GET /api/public/chat-settings endpoint
3. Admin settings with integration toggles
4. All existing endpoints

### Frontend Tests
1. Landing page shows **professional black woman image**
2. **Logo only in header** (not in sidebar)
3. **Scroll to top** works when navigating between pages
4. **Admin page** opens similar to Dashboard layout
5. **"Akèy"** (Home) link in sidebar
6. **"Ale nan Admin"** link for admin users
7. Dashboard has **5 quick action buttons**
8. Admin Settings has **toggle switches** for integrations

## Test User Credentials
- Admin credentials: configured via `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD`

## Key Features to Verify
- Professional black woman image on landing page
- Logo only at top of site (header), not in sidebar
- Scroll to top when navigating
- Admin page layout similar to other pages
- Integration toggles work

## Incorporate User Feedback
- Logo ONLY in header/top
- Professional black woman image
- Easy navigation to home
- Admin page opens properly like other pages
