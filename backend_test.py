import requests
import sys
import json
from datetime import datetime

class KayicomAPITester:
    def __init__(self, base_url="https://fintech-wallet-17.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.admin_token = None
        self.test_user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, use_admin=False):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        # Add authorization header if token exists
        token_to_use = self.admin_token if use_admin else self.token
        if token_to_use:
            test_headers['Authorization'] = f'Bearer {token_to_use}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        print(f"   Method: {method}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_health_check(self):
        """Test basic health endpoints"""
        print("\n=== HEALTH CHECK TESTS ===")
        self.run_test("API Root", "GET", "", 200)
        self.run_test("Health Check", "GET", "health", 200)

    def test_exchange_rates(self):
        """Test exchange rates endpoint"""
        print("\n=== EXCHANGE RATES TESTS ===")
        success, response = self.run_test("Get Exchange Rates", "GET", "exchange-rates", 200)
        if success and response:
            print(f"   HTG to USD: {response.get('htg_to_usd', 'N/A')}")
            print(f"   USD to HTG: {response.get('usd_to_htg', 'N/A')}")
        return success

    def test_user_registration(self):
        """Test user registration"""
        print("\n=== USER REGISTRATION TESTS ===")
        
        # Test user registration
        timestamp = datetime.now().strftime('%H%M%S')
        user_data = {
            "email": f"test_user_{timestamp}@test.com",
            "password": "TestPass123!",
            "full_name": "Test User",
            "phone": "+509 1234 5678",
            "language": "fr"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=user_data
        )
        
        if success and response:
            self.token = response.get('token')
            self.test_user_id = response.get('user', {}).get('user_id')
            print(f"   User ID: {self.test_user_id}")
            print(f"   Client ID: {response.get('user', {}).get('client_id')}")
            return True
        return False

    def test_user_login(self):
        """Test user login"""
        print("\n=== USER LOGIN TESTS ===")
        
        # Test admin login
        admin_data = {
            "email": "admin@kayicom.com",
            "password": "Admin123!"
        }
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data=admin_data
        )
        
        if success and response:
            self.admin_token = response.get('token')
            print(f"   Admin logged in successfully")
            return True
        return False

    def test_user_profile(self):
        """Test user profile endpoints"""
        print("\n=== USER PROFILE TESTS ===")
        
        if not self.token:
            print("❌ No user token available")
            return False
            
        success, response = self.run_test("Get User Profile", "GET", "auth/me", 200)
        if success and response:
            print(f"   User: {response.get('full_name')}")
            print(f"   Email: {response.get('email')}")
            print(f"   KYC Status: {response.get('kyc_status')}")
        return success

    def test_wallet_endpoints(self):
        """Test wallet related endpoints"""
        print("\n=== WALLET TESTS ===")
        
        if not self.token:
            print("❌ No user token available")
            return False
            
        # Test get balance
        success1, response = self.run_test("Get Wallet Balance", "GET", "wallet/balance", 200)
        if success1 and response:
            print(f"   HTG Balance: {response.get('wallet_htg', 0)}")
            print(f"   USD Balance: {response.get('wallet_usd', 0)}")
        
        # Test get transactions
        success2, _ = self.run_test("Get Transactions", "GET", "wallet/transactions", 200)
        
        return success1 and success2

    def test_admin_endpoints(self):
        """Test admin endpoints"""
        print("\n=== ADMIN TESTS ===")
        
        if not self.admin_token:
            print("❌ No admin token available")
            return False
            
        # Test admin dashboard
        success1, response = self.run_test("Admin Dashboard", "GET", "admin/dashboard", 200, use_admin=True)
        if success1 and response:
            print(f"   Total Users: {response.get('total_users', 0)}")
            print(f"   Pending KYC: {response.get('pending_kyc', 0)}")
            print(f"   Total HTG: {response.get('total_htg', 0)}")
            print(f"   Total USD: {response.get('total_usd', 0)}")
        
        # Test get users
        success2, _ = self.run_test("Admin Get Users", "GET", "admin/users", 200, use_admin=True)
        
        # Test get KYC submissions
        success3, _ = self.run_test("Admin Get KYC", "GET", "admin/kyc", 200, use_admin=True)
        
        return success1 and success2 and success3

    def test_kyc_endpoints(self):
        """Test KYC endpoints"""
        print("\n=== KYC TESTS ===")
        
        if not self.token:
            print("❌ No user token available")
            return False
            
        # Test get KYC status
        success, _ = self.run_test("Get KYC Status", "GET", "kyc/status", 200)
        return success

    def test_deposit_endpoints(self):
        """Test deposit endpoints"""
        print("\n=== DEPOSIT TESTS ===")
        
        if not self.token:
            print("❌ No user token available")
            return False
            
        # Test get deposits
        success, _ = self.run_test("Get Deposits", "GET", "deposits", 200)
        return success

    def test_withdrawal_endpoints(self):
        """Test withdrawal endpoints"""
        print("\n=== WITHDRAWAL TESTS ===")
        
        if not self.token:
            print("❌ No user token available")
            return False
            
        # Test get withdrawals
        success1, _ = self.run_test("Get Withdrawals", "GET", "withdrawals", 200)
        
        # Test get withdrawal fees
        success2, _ = self.run_test("Get Withdrawal Fees", "GET", "withdrawals/fees", 200)
        
        return success1 and success2

    def test_affiliate_endpoints(self):
        """Test affiliate endpoints"""
        print("\n=== AFFILIATE TESTS ===")
        
        if not self.token:
            print("❌ No user token available")
            return False
            
        # Test get affiliate info
        success, response = self.run_test("Get Affiliate Info", "GET", "affiliate/info", 200)
        if success and response:
            print(f"   Affiliate Code: {response.get('affiliate_code')}")
            print(f"   Earnings: {response.get('earnings', 0)}")
        return success

def main():
    print("🚀 Starting KAYICOM Wallet API Tests")
    print("=" * 50)
    
    tester = KayicomAPITester()
    
    # Run all tests
    test_results = []
    
    # Basic health tests
    tester.test_health_check()
    
    # Exchange rates test
    test_results.append(tester.test_exchange_rates())
    
    # User registration and login
    test_results.append(tester.test_user_registration())
    test_results.append(tester.test_user_login())
    
    # User profile tests
    test_results.append(tester.test_user_profile())
    
    # Wallet tests
    test_results.append(tester.test_wallet_endpoints())
    
    # KYC tests
    test_results.append(tester.test_kyc_endpoints())
    
    # Deposit tests
    test_results.append(tester.test_deposit_endpoints())
    
    # Withdrawal tests
    test_results.append(tester.test_withdrawal_endpoints())
    
    # Affiliate tests
    test_results.append(tester.test_affiliate_endpoints())
    
    # Admin tests
    test_results.append(tester.test_admin_endpoints())
    
    # Print final results
    print("\n" + "=" * 50)
    print("📊 FINAL TEST RESULTS")
    print("=" * 50)
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Tests failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    if tester.failed_tests:
        print("\n❌ FAILED TESTS:")
        for failure in tester.failed_tests:
            print(f"   - {failure.get('test', 'Unknown')}: {failure.get('error', failure.get('response', 'Unknown error'))}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())