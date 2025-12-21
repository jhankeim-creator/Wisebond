import requests
import sys
from datetime import datetime

class KayicomWalletTester:
    def __init__(self, base_url="https://payiwallet.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.user_id = None
        self.client_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, use_admin=False):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        # Use admin token if specified
        token_to_use = self.admin_token if use_admin else self.token
        if token_to_use:
            test_headers['Authorization'] = f'Bearer {token_to_use}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)

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
                try:
                    print(f"   Response: {response.json()}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@kayicom.com", "password": "Admin123!"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            print(f"   Admin logged in successfully")
            return True
        return False

    def test_user_login(self):
        """Test regular user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={"email": "demo@kayicom.com", "password": "Demo1234!"}
        )
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['user_id']
            self.client_id = response['user']['client_id']
            print(f"   User logged in successfully - Client ID: {self.client_id}")
            return True
        return False

    def test_virtual_card_endpoints(self):
        """Test virtual card related endpoints"""
        print("\n📱 Testing Virtual Card Endpoints...")
        
        # Test virtual card order endpoint
        self.run_test(
            "POST /api/virtual-cards/order",
            "POST",
            "virtual-cards/order",
            200,  # Should work if user has KYC approved and sufficient balance
            data={"card_email": "test@example.com"}
        )
        
        # Test get user's virtual card orders
        self.run_test(
            "GET /api/virtual-cards/orders",
            "GET",
            "virtual-cards/orders",
            200
        )
        
        # Test get user's virtual card deposits
        self.run_test(
            "GET /api/virtual-cards/deposits",
            "GET",
            "virtual-cards/deposits",
            200
        )

    def test_topup_endpoints(self):
        """Test TopUp related endpoints"""
        print("\n📞 Testing TopUp Endpoints...")
        
        # Test topup order endpoint
        self.run_test(
            "POST /api/topup/order",
            "POST",
            "topup/order",
            200,  # Should work if user has KYC approved and sufficient USD balance
            data={
                "country": "US",
                "country_name": "USA",
                "minutes": 30,
                "price": 5.0,
                "phone_number": "+1234567890"
            }
        )
        
        # Test get user's topup orders
        self.run_test(
            "GET /api/topup/orders",
            "GET",
            "topup/orders",
            200
        )

    def test_admin_virtual_card_endpoints(self):
        """Test admin virtual card management endpoints"""
        print("\n🔧 Testing Admin Virtual Card Endpoints...")
        
        # Test get all virtual card orders (admin)
        self.run_test(
            "GET /api/admin/virtual-card-orders",
            "GET",
            "admin/virtual-card-orders",
            200,
            use_admin=True
        )
        
        # Test get pending virtual card orders
        self.run_test(
            "GET /api/admin/virtual-card-orders?status=pending",
            "GET",
            "admin/virtual-card-orders?status=pending",
            200,
            use_admin=True
        )

    def test_admin_topup_endpoints(self):
        """Test admin topup management endpoints"""
        print("\n🔧 Testing Admin TopUp Endpoints...")
        
        # Test get all topup orders (admin)
        self.run_test(
            "GET /api/admin/topup-orders",
            "GET",
            "admin/topup-orders",
            200,
            use_admin=True
        )
        
        # Test get pending topup orders
        self.run_test(
            "GET /api/admin/topup-orders?status=pending",
            "GET",
            "admin/topup-orders?status=pending",
            200,
            use_admin=True
        )

    def test_swap_endpoint(self):
        """Test swap functionality"""
        print("\n💱 Testing Swap Endpoint...")
        
        self.run_test(
            "POST /api/wallet/swap",
            "POST",
            "wallet/swap",
            200,  # Should work if user has sufficient balance
            data={
                "from_currency": "HTG",
                "to_currency": "USD",
                "amount": 100
            }
        )

    def test_basic_endpoints(self):
        """Test basic endpoints for completeness"""
        print("\n🔍 Testing Basic Endpoints...")
        
        # Test health endpoint
        self.run_test(
            "Health Check",
            "GET",
            "health",
            200
        )
        
        # Test exchange rates
        self.run_test(
            "Exchange Rates",
            "GET",
            "exchange-rates",
            200
        )
        
        # Test user profile
        self.run_test(
            "User Profile",
            "GET",
            "auth/me",
            200
        )
        
        # Test wallet balance
        self.run_test(
            "Wallet Balance",
            "GET",
            "wallet/balance",
            200
        )

def main():
    print("🚀 Starting KAYICOM Wallet API Testing...")
    print("=" * 60)
    
    tester = KayicomWalletTester()
    
    # Test admin login first
    if not tester.test_admin_login():
        print("❌ Admin login failed, continuing with user tests only")
    
    # Test user login
    if not tester.test_user_login():
        print("❌ User login failed, stopping tests")
        return 1
    
    # Test basic endpoints
    tester.test_basic_endpoints()
    
    # Test virtual card endpoints
    tester.test_virtual_card_endpoints()
    
    # Test topup endpoints
    tester.test_topup_endpoints()
    
    # Test swap endpoint
    tester.test_swap_endpoint()
    
    # Test admin endpoints if admin login worked
    if tester.admin_token:
        tester.test_admin_virtual_card_endpoints()
        tester.test_admin_topup_endpoints()
    
    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    if success_rate >= 80:
        print("🎉 Overall: GOOD - Most functionality working")
        return 0
    elif success_rate >= 60:
        print("⚠️  Overall: FAIR - Some issues need attention")
        return 0
    else:
        print("❌ Overall: POOR - Major issues detected")
        return 1

if __name__ == "__main__":
    sys.exit(main())