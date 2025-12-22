import os
import requests
import sys
from datetime import datetime

class KayicomWalletTester:
    def __init__(self, base_url="https://payiwallet.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.user_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_email = os.environ.get("DEFAULT_ADMIN_EMAIL", "graciaemmanuel509@gmail.com")
        self.admin_password = os.environ.get("DEFAULT_ADMIN_PASSWORD", "Admin123!")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                if response.content:
                    try:
                        resp_data = response.json()
                        if isinstance(resp_data, dict) and len(str(resp_data)) < 200:
                            print(f"   Response: {resp_data}")
                    except:
                        pass
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response.content:
                    try:
                        error_data = response.json()
                        print(f"   Error: {error_data}")
                    except:
                        print(f"   Raw response: {response.text[:200]}")

            return success, response.json() if response.content and success else {}

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
            data={"email": self.admin_email, "password": self.admin_password}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            return True
        return False

    def test_exchange_rates_with_swap(self):
        """Test exchange rates endpoint includes swap rates"""
        success, response = self.run_test(
            "GET Exchange Rates with Swap Rates",
            "GET",
            "exchange-rates",
            200
        )
        if success:
            has_swap_rates = 'swap_htg_to_usd' in response and 'swap_usd_to_htg' in response
            print(f"   Swap rates present: {has_swap_rates}")
            if has_swap_rates:
                print(f"   swap_htg_to_usd: {response.get('swap_htg_to_usd')}")
                print(f"   swap_usd_to_htg: {response.get('swap_usd_to_htg')}")
        return success

    def test_admin_update_swap_rates(self):
        """Test admin can update swap rates"""
        if not self.admin_token:
            print("❌ Admin token required")
            return False
            
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        success, response = self.run_test(
            "PUT Admin Exchange Rates with Swap",
            "PUT",
            "admin/exchange-rates",
            200,
            data={
                "htg_to_usd": 0.0075,
                "usd_to_htg": 133.0,
                "swap_htg_to_usd": 0.0074,
                "swap_usd_to_htg": 132.0
            },
            headers=headers
        )
        return success

    def test_admin_card_fees_endpoints(self):
        """Test admin card fees management"""
        if not self.admin_token:
            print("❌ Admin token required")
            return False
            
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Test GET card fees
        success1, response1 = self.run_test(
            "GET Admin Card Fees",
            "GET",
            "admin/card-fees",
            200,
            headers=headers
        )
        
        # Test POST card fee
        success2, response2 = self.run_test(
            "POST Admin Card Fee",
            "POST",
            "admin/card-fees",
            200,
            data={
                "min_amount": 0,
                "max_amount": 100,
                "fee": 5
            },
            headers=headers
        )
        
        fee_id = None
        if success2 and 'fee' in response2:
            fee_id = response2['fee'].get('fee_id')
        
        # Test DELETE card fee if we created one
        success3 = True
        if fee_id:
            success3, _ = self.run_test(
                "DELETE Admin Card Fee",
                "DELETE",
                f"admin/card-fees/{fee_id}",
                200,
                headers=headers
            )
        
        return success1 and success2 and success3

    def test_chat_settings_endpoint(self):
        """Test public chat settings endpoint"""
        success, response = self.run_test(
            "GET Public Chat Settings",
            "GET",
            "public/chat-settings",
            200
        )
        if success:
            expected_keys = ['crisp_enabled', 'crisp_website_id', 'whatsapp_enabled', 'whatsapp_number']
            has_all_keys = all(key in response for key in expected_keys)
            print(f"   Has all expected keys: {has_all_keys}")
            print(f"   Response keys: {list(response.keys())}")
        return success

    def test_admin_settings_toggles(self):
        """Test admin settings with toggle functionality"""
        if not self.admin_token:
            print("❌ Admin token required")
            return False
            
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Test GET admin settings
        success1, response1 = self.run_test(
            "GET Admin Settings",
            "GET",
            "admin/settings",
            200,
            headers=headers
        )
        
        if success1:
            settings = response1.get('settings', {})
            toggle_keys = ['resend_enabled', 'crisp_enabled', 'whatsapp_enabled', 'plisio_enabled']
            has_toggles = all(key in settings for key in toggle_keys)
            print(f"   Has toggle keys: {has_toggles}")
            print(f"   Toggle states: {[(k, settings.get(k)) for k in toggle_keys]}")
        
        # Test PUT admin settings (update toggles)
        success2, response2 = self.run_test(
            "PUT Admin Settings Update",
            "PUT",
            "admin/settings",
            200,
            data={
                "resend_api_key": "test_key",
                "sender_email": "test@kayicom.com",
                "crisp_website_id": "test-crisp-id",
                "whatsapp_number": "+50939308318"
            },
            headers=headers
        )
        
        return success1 and success2

    def test_dashboard_features(self):
        """Test dashboard related features"""
        # Test basic dashboard data endpoints
        success1, response1 = self.run_test(
            "GET Exchange Rates for Dashboard",
            "GET",
            "exchange-rates",
            200
        )
        
        return success1

def main():
    print("🚀 Starting KAYICOM Wallet New Features Testing...")
    print("=" * 60)
    
    tester = KayicomWalletTester()
    
    # Test admin login first
    if not tester.test_admin_login():
        print("❌ Admin login failed, stopping tests")
        return 1

    print("\n📊 Testing New Features...")
    print("-" * 40)
    
    # Test new features
    tests = [
        ("Public Chat Settings Endpoint", tester.test_chat_settings_endpoint),
        ("Admin Settings with Toggles", tester.test_admin_settings_toggles),
        ("Exchange Rates with Swap", tester.test_exchange_rates_with_swap),
        ("Admin Update Swap Rates", tester.test_admin_update_swap_rates),
        ("Admin Card Fees Management", tester.test_admin_card_fees_endpoints),
        ("Dashboard Features", tester.test_dashboard_features),
    ]
    
    for test_name, test_func in tests:
        print(f"\n🔧 {test_name}...")
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with error: {e}")
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 FINAL RESULTS")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%" if tester.tests_run > 0 else "No tests run")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())