#!/usr/bin/env python3
"""
Focused test for previously failed APIs
"""

import asyncio
import httpx
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/frontend/.env')

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:8001')
API_BASE = f"{BACKEND_URL}/api"

async def test_api(message: str, expected_content: str = None):
    """Test a specific API call"""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                f"{API_BASE}/chat",
                json={
                    "message": message,
                    "conversation_history": []
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                response_text = data.get("response", "")
                print(f"✅ {message}")
                print(f"   Response: {response_text[:100]}...")
                if expected_content and expected_content in response_text:
                    print(f"   ✅ Contains expected content: {expected_content}")
                else:
                    print(f"   ❌ Missing expected content: {expected_content}")
                return True
            else:
                print(f"❌ {message} - Status: {response.status_code}")
                return False
                
    except Exception as e:
        print(f"❌ {message} - Error: {str(e)}")
        return False

async def main():
    print("🔍 Focused Testing of Previously Failed APIs")
    print("=" * 50)
    
    # Test Stack Overflow
    print("\n💻 Testing Stack Overflow...")
    await test_api("stack overflow python async await", "Programming Questions")
    
    # Test Programming Quotes
    print("\n📝 Testing Programming Quotes...")
    await test_api("programming quote", "—")
    
    # Test Arxiv
    print("\n📚 Testing Arxiv...")
    await test_api("research papers on quantum computing", "Research Papers")
    
    # Test Dictionary
    print("\n📖 Testing Dictionary...")
    await test_api("define serendipity", "serendipity")

if __name__ == "__main__":
    asyncio.run(main())