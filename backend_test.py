#!/usr/bin/env python3
"""
Backend API Testing for Gerch Enhanced Backend
Tests all new API integrations as specified in the review request
"""

import asyncio
import httpx
import json
import time
from typing import Dict, Any, List
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:8001')
API_BASE = f"{BACKEND_URL}/api"

class BackendTester:
    def __init__(self):
        self.results = []
        self.failed_tests = []
        self.passed_tests = []
        
    async def test_chat_endpoint(self, message: str, expected_type: str = None, timeout: int = 10) -> Dict[str, Any]:
        """Test the chat endpoint with a specific message"""
        start_time = time.time()
        
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{API_BASE}/chat",
                    json={
                        "message": message,
                        "conversation_history": []
                    }
                )
                
                end_time = time.time()
                response_time = end_time - start_time
                
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "status_code": response.status_code,
                        "response_time": response_time,
                        "data": data,
                        "message": message
                    }
                else:
                    return {
                        "success": False,
                        "status_code": response.status_code,
                        "response_time": response_time,
                        "error": response.text,
                        "message": message
                    }
                    
        except Exception as e:
            end_time = time.time()
            response_time = end_time - start_time
            return {
                "success": False,
                "status_code": None,
                "response_time": response_time,
                "error": str(e),
                "message": message
            }
    
    async def test_pollinations_image_generation(self):
        """Test Pollinations.ai Image Generation"""
        print("🖼️  Testing Pollinations.ai Image Generation...")
        
        test_cases = [
            "generate an image of a sunset over mountains",
            "create an image of a futuristic city",
            "draw a peaceful forest scene"
        ]
        
        for message in test_cases:
            result = await self.test_chat_endpoint(message)
            
            if result["success"]:
                data = result["data"]
                # Check if response contains image data
                if data.get("search_data") and data["search_data"].get("images"):
                    images = data["search_data"]["images"]
                    if len(images) > 0 and "pollinations.ai" in images[0]["url"]:
                        print(f"  ✅ {message} - Image URL: {images[0]['url']}")
                        self.passed_tests.append(f"Pollinations: {message}")
                    else:
                        print(f"  ❌ {message} - No Pollinations image found")
                        self.failed_tests.append(f"Pollinations: {message} - No image URL")
                else:
                    print(f"  ❌ {message} - No image data in response")
                    self.failed_tests.append(f"Pollinations: {message} - No image data")
            else:
                print(f"  ❌ {message} - API Error: {result.get('error', 'Unknown error')}")
                self.failed_tests.append(f"Pollinations: {message} - API Error")
    
    async def test_cryptocurrency_prices(self):
        """Test Cryptocurrency Prices"""
        print("💰 Testing Cryptocurrency Prices...")
        
        test_cases = [
            "bitcoin price",
            "crypto prices ethereum and dogecoin",
            "price of bitcoin"
        ]
        
        for message in test_cases:
            result = await self.test_chat_endpoint(message)
            
            if result["success"]:
                data = result["data"]
                response_text = data.get("response", "")
                
                # Check if response contains crypto price information
                if "Cryptocurrency Prices" in response_text or "$" in response_text:
                    print(f"  ✅ {message} - Response: {response_text[:100]}...")
                    self.passed_tests.append(f"Crypto: {message}")
                else:
                    print(f"  ❌ {message} - No crypto price data found")
                    self.failed_tests.append(f"Crypto: {message} - No price data")
            else:
                print(f"  ❌ {message} - API Error: {result.get('error', 'Unknown error')}")
                self.failed_tests.append(f"Crypto: {message} - API Error")
    
    async def test_academic_papers(self):
        """Test Academic Papers"""
        print("📚 Testing Academic Papers...")
        
        test_cases = [
            "research papers on quantum computing",
            "arxiv papers about machine learning",
            "academic research on artificial intelligence"
        ]
        
        for message in test_cases:
            result = await self.test_chat_endpoint(message)
            
            if result["success"]:
                data = result["data"]
                response_text = data.get("response", "")
                
                # Check if response contains research paper information
                if "Research Papers" in response_text or "arxiv" in response_text.lower():
                    print(f"  ✅ {message} - Found papers in response")
                    self.passed_tests.append(f"Arxiv: {message}")
                else:
                    print(f"  ❌ {message} - No research papers found")
                    self.failed_tests.append(f"Arxiv: {message} - No papers found")
            else:
                print(f"  ❌ {message} - API Error: {result.get('error', 'Unknown error')}")
                self.failed_tests.append(f"Arxiv: {message} - API Error")
    
    async def test_stackoverflow(self):
        """Test Stack Overflow"""
        print("💻 Testing Stack Overflow...")
        
        test_cases = [
            "stack overflow python async await",
            "programming question about javascript promises",
            "how to code recursive functions"
        ]
        
        for message in test_cases:
            result = await self.test_chat_endpoint(message)
            
            if result["success"]:
                data = result["data"]
                response_text = data.get("response", "")
                
                # Check if response contains Stack Overflow information
                if "Programming Questions" in response_text or "Score:" in response_text:
                    print(f"  ✅ {message} - Found programming questions")
                    self.passed_tests.append(f"StackOverflow: {message}")
                else:
                    print(f"  ❌ {message} - No programming questions found")
                    self.failed_tests.append(f"StackOverflow: {message} - No questions found")
            else:
                print(f"  ❌ {message} - API Error: {result.get('error', 'Unknown error')}")
                self.failed_tests.append(f"StackOverflow: {message} - API Error")
    
    async def test_weather_data(self):
        """Test Weather Data"""
        print("🌤️  Testing Weather Data...")
        
        test_cases = [
            "weather in London",
            "weather in Tokyo",
            "temperature in Paris"
        ]
        
        for message in test_cases:
            result = await self.test_chat_endpoint(message)
            
            if result["success"]:
                data = result["data"]
                response_text = data.get("response", "")
                
                # Check if response contains weather information
                if "Weather in" in response_text and "Temperature:" in response_text:
                    print(f"  ✅ {message} - Weather data found")
                    self.passed_tests.append(f"Weather: {message}")
                else:
                    print(f"  ❌ {message} - No weather data found")
                    self.failed_tests.append(f"Weather: {message} - No weather data")
            else:
                print(f"  ❌ {message} - API Error: {result.get('error', 'Unknown error')}")
                self.failed_tests.append(f"Weather: {message} - API Error")
    
    async def test_pokemon_data(self):
        """Test Pokemon Data"""
        print("🎮 Testing Pokemon Data...")
        
        test_cases = [
            "pokemon pikachu",
            "pokemon charizard",
            "pokémon bulbasaur"
        ]
        
        for message in test_cases:
            result = await self.test_chat_endpoint(message)
            
            if result["success"]:
                data = result["data"]
                response_text = data.get("response", "")
                
                # Check if response contains Pokemon information
                if "Height:" in response_text and "Weight:" in response_text and "Types:" in response_text:
                    print(f"  ✅ {message} - Pokemon data found")
                    self.passed_tests.append(f"Pokemon: {message}")
                else:
                    print(f"  ❌ {message} - No Pokemon data found")
                    self.failed_tests.append(f"Pokemon: {message} - No Pokemon data")
            else:
                print(f"  ❌ {message} - API Error: {result.get('error', 'Unknown error')}")
                self.failed_tests.append(f"Pokemon: {message} - API Error")
    
    async def test_pet_images(self):
        """Test Pet Images"""
        print("🐕 Testing Pet Images...")
        
        test_cases = [
            "show me a dog",
            "show me a cat",
            "random puppy image"
        ]
        
        for message in test_cases:
            result = await self.test_chat_endpoint(message)
            
            if result["success"]:
                data = result["data"]
                
                # Check if response contains pet image
                if data.get("search_data") and data["search_data"].get("images"):
                    images = data["search_data"]["images"]
                    if len(images) > 0:
                        print(f"  ✅ {message} - Pet image found: {images[0]['url']}")
                        self.passed_tests.append(f"Pet Images: {message}")
                    else:
                        print(f"  ❌ {message} - No pet image found")
                        self.failed_tests.append(f"Pet Images: {message} - No image")
                else:
                    print(f"  ❌ {message} - No image data in response")
                    self.failed_tests.append(f"Pet Images: {message} - No image data")
            else:
                print(f"  ❌ {message} - API Error: {result.get('error', 'Unknown error')}")
                self.failed_tests.append(f"Pet Images: {message} - API Error")
    
    async def test_jokes_and_quotes(self):
        """Test Jokes and Quotes"""
        print("😄 Testing Jokes and Quotes...")
        
        test_cases = [
            "chuck norris joke",
            "programming quote",
            "random chuck norris joke"
        ]
        
        for message in test_cases:
            result = await self.test_chat_endpoint(message)
            
            if result["success"]:
                data = result["data"]
                response_text = data.get("response", "")
                
                # Check if response contains joke or quote
                if ("😄" in response_text) or ("—" in response_text and "\"" in response_text):
                    print(f"  ✅ {message} - Content found")
                    self.passed_tests.append(f"Jokes/Quotes: {message}")
                else:
                    print(f"  ❌ {message} - No joke/quote found")
                    self.failed_tests.append(f"Jokes/Quotes: {message} - No content")
            else:
                print(f"  ❌ {message} - API Error: {result.get('error', 'Unknown error')}")
                self.failed_tests.append(f"Jokes/Quotes: {message} - API Error")
    
    async def test_ip_information(self):
        """Test IP Information"""
        print("🌐 Testing IP Information...")
        
        test_cases = [
            "my ip address",
            "ip info",
            "what is my ip"
        ]
        
        for message in test_cases:
            result = await self.test_chat_endpoint(message)
            
            if result["success"]:
                data = result["data"]
                response_text = data.get("response", "")
                
                # Check if response contains IP information
                if "IP Information" in response_text and "IP:" in response_text:
                    print(f"  ✅ {message} - IP info found")
                    self.passed_tests.append(f"IP Info: {message}")
                else:
                    print(f"  ❌ {message} - No IP info found")
                    self.failed_tests.append(f"IP Info: {message} - No IP data")
            else:
                print(f"  ❌ {message} - API Error: {result.get('error', 'Unknown error')}")
                self.failed_tests.append(f"IP Info: {message} - API Error")
    
    async def test_existing_features(self):
        """Test Existing Features (Regression Test)"""
        print("🔄 Testing Existing Features (Regression)...")
        
        test_cases = [
            ("define serendipity", "dictionary"),
            ("2 + 2 * 5", "calculator"),
            ("Albert Einstein", "wikipedia")
        ]
        
        for message, feature_type in test_cases:
            result = await self.test_chat_endpoint(message)
            
            if result["success"]:
                data = result["data"]
                response_text = data.get("response", "")
                search_data = data.get("search_data", {})
                
                success = False
                if feature_type == "dictionary" and search_data.get("dictionary"):
                    success = True
                elif feature_type == "calculator" and "12" in response_text:
                    success = True
                elif feature_type == "wikipedia" and len(response_text) > 50:
                    success = True
                
                if success:
                    print(f"  ✅ {message} - {feature_type} working")
                    self.passed_tests.append(f"Regression: {message}")
                else:
                    print(f"  ❌ {message} - {feature_type} not working")
                    self.failed_tests.append(f"Regression: {message} - {feature_type} failed")
            else:
                print(f"  ❌ {message} - API Error: {result.get('error', 'Unknown error')}")
                self.failed_tests.append(f"Regression: {message} - API Error")
    
    async def test_response_times(self):
        """Test Response Times"""
        print("⏱️  Testing Response Times...")
        
        test_message = "hello"
        result = await self.test_chat_endpoint(test_message)
        
        if result["success"]:
            response_time = result["response_time"]
            if response_time < 10:
                print(f"  ✅ Response time: {response_time:.2f}s (< 10s)")
                self.passed_tests.append("Response Time: Under 10 seconds")
            else:
                print(f"  ❌ Response time: {response_time:.2f}s (> 10s)")
                self.failed_tests.append("Response Time: Over 10 seconds")
        else:
            print(f"  ❌ Could not test response time - API Error")
            self.failed_tests.append("Response Time: API Error")
    
    async def run_all_tests(self):
        """Run all backend tests"""
        print(f"🚀 Starting Backend API Tests for Gerch Enhanced Backend")
        print(f"📡 Backend URL: {API_BASE}")
        print("=" * 60)
        
        # Test all API integrations
        await self.test_pollinations_image_generation()
        await self.test_cryptocurrency_prices()
        await self.test_academic_papers()
        await self.test_stackoverflow()
        await self.test_weather_data()
        await self.test_pokemon_data()
        await self.test_pet_images()
        await self.test_jokes_and_quotes()
        await self.test_ip_information()
        await self.test_existing_features()
        await self.test_response_times()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"✅ Passed: {len(self.passed_tests)}")
        print(f"❌ Failed: {len(self.failed_tests)}")
        print(f"📈 Success Rate: {len(self.passed_tests)/(len(self.passed_tests)+len(self.failed_tests))*100:.1f}%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                print(f"  - {test}")
        
        if self.passed_tests:
            print("\n✅ PASSED TESTS:")
            for test in self.passed_tests:
                print(f"  - {test}")
        
        return {
            "passed": len(self.passed_tests),
            "failed": len(self.failed_tests),
            "passed_tests": self.passed_tests,
            "failed_tests": self.failed_tests
        }

async def main():
    """Main test runner"""
    tester = BackendTester()
    results = await tester.run_all_tests()
    return results

if __name__ == "__main__":
    asyncio.run(main())