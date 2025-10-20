from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import ast
import operator
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from serpapi import GoogleSearch
from cerebras.cloud.sdk import Cerebras
import httpx
import asyncio
from api_clients import (
    PollinationsClient, CoinGeckoClient, ArxivClient, StackExchangeClient,
    DuckDuckGoClient, OpenMeteoClient, ProgrammingQuotesClient, IPInfoClient,
    UnsplashClient, PokeAPIClient, DogAPIClient, CatAPIClient, ChuckNorrisClient
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Cerebras client
cerebras_client = Cerebras(api_key=os.environ.get('CEREBRAS_API_KEY'))

# API Keys
SERPAPI_KEY = os.environ.get('SERPAPI_KEY')
PIXABAY_API_KEY = os.environ.get('PIXABAY_API_KEY')

# Initialize API clients
pollinations = PollinationsClient()
coingecko = CoinGeckoClient()
arxiv = ArxivClient()
stackexchange = StackExchangeClient()
duckduckgo = DuckDuckGoClient()
openmeteo = OpenMeteoClient()
programming_quotes = ProgrammingQuotesClient()
ipinfo = IPInfoClient()
unsplash = UnsplashClient()
pokeapi = PokeAPIClient()
dogapi = DogAPIClient()
catapi = CatAPIClient()
chucknorris = ChuckNorrisClient()

# Create the main app
app = FastAPI(title="Gerch Search Engine", version="2.0.0")
api_router = APIRouter(prefix="/api")

# Models
class SearchRequest(BaseModel):
    query: str
    num_results: Optional[int] = 10

class SearchResult(BaseModel):
    title: str
    link: str
    snippet: str
    position: Optional[int] = None

class ImageResult(BaseModel):
    url: str
    thumbnail: str
    width: int
    height: int

class DictionaryDefinition(BaseModel):
    definition: str
    part_of_speech: str
    example: Optional[str] = None

class SearchResponse(BaseModel):
    query: str
    ai_overview: Optional[str] = None
    web_results: List[SearchResult] = []
    images: List[ImageResult] = []
    dictionary: Optional[Dict[str, Any]] = None
    calculator_result: Optional[Dict[str, Any]] = None
    wikipedia_summary: Optional[str] = None
    total_results: Optional[str] = None
    search_time: Optional[str] = None

# Calculator Service
class CalculatorService:
    OPERATORS = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.Pow: operator.pow,
        ast.USub: operator.neg,
        ast.UAdd: operator.pos
    }
    
    def __init__(self):
        self.valid_pattern = re.compile(r'^[\d+\-*/().\s]+$')
    
    def is_valid_expression(self, expression: str) -> bool:
        return bool(self.valid_pattern.match(expression))
    
    def evaluate_node(self, node):
        if isinstance(node, ast.Num):
            return node.n
        elif isinstance(node, ast.Constant):
            return node.value
        elif isinstance(node, ast.BinOp):
            left = self.evaluate_node(node.left)
            right = self.evaluate_node(node.right)
            return self.OPERATORS[type(node.op)](left, right)
        elif isinstance(node, ast.UnaryOp):
            operand = self.evaluate_node(node.operand)
            return self.OPERATORS[type(node.op)](operand)
        else:
            raise ValueError("Unsupported operation")
    
    async def calculate(self, expression: str) -> Dict[str, Any]:
        try:
            expression = expression.strip()
            if not self.is_valid_expression(expression):
                return {"success": False, "error": "Invalid expression"}
            
            tree = ast.parse(expression, mode='eval')
            result = self.evaluate_node(tree.body)
            
            return {"success": True, "expression": expression, "result": result}
        except ZeroDivisionError:
            return {"success": False, "error": "Division by zero"}
        except Exception as e:
            return {"success": False, "error": str(e)}

calculator = CalculatorService()

# Helper Functions
async def get_ai_overview(query: str) -> Optional[str]:
    """Get AI overview using Cerebras"""
    try:
        response = cerebras_client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a helpful search assistant. Provide a concise, accurate overview of the topic in 2-3 sentences."},
                {"role": "user", "content": f"Provide a brief overview about: {query}"}
            ],
            model="llama3.1-8b",
            max_tokens=200,
            temperature=0.7
        )
        return response.choices[0].message.content
    except Exception as e:
        logging.error(f"AI overview error: {e}")
        return None

async def get_wikipedia_summary(query: str) -> Optional[str]:
    """Get Wikipedia summary"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                "https://en.wikipedia.org/api/rest_v1/page/summary/" + query.replace(" ", "_")
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("extract", None)
    except Exception as e:
        logging.error(f"Wikipedia error: {e}")
    return None

async def get_dictionary_definition(word: str) -> Optional[Dict[str, Any]]:
    """Get dictionary definition"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
            )
            if response.status_code == 200:
                data = response.json()[0]
                definitions = []
                for meaning in data.get("meanings", [])[:2]:
                    for definition in meaning.get("definitions", [])[:2]:
                        definitions.append({
                            "definition": definition.get("definition", ""),
                            "part_of_speech": meaning.get("partOfSpeech", ""),
                            "example": definition.get("example", "")
                        })
                
                phonetic = data.get("phonetic", "")
                if not phonetic and data.get("phonetics"):
                    phonetic = data["phonetics"][0].get("text", "")
                
                return {
                    "word": data.get("word", word),
                    "phonetic": phonetic,
                    "definitions": definitions
                }
    except Exception as e:
        logging.error(f"Dictionary error: {e}")
    return None

async def search_pixabay_images(query: str, per_page: int = 8) -> List[ImageResult]:
    """Search images on Pixabay"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://pixabay.com/api/",
                params={
                    "key": PIXABAY_API_KEY,
                    "q": query,
                    "per_page": per_page,
                    "image_type": "photo",
                    "safesearch": "true"
                }
            )
            if response.status_code == 200:
                data = response.json()
                return [
                    ImageResult(
                        url=hit["webformatURL"],
                        thumbnail=hit["previewURL"],
                        width=hit["webformatWidth"],
                        height=hit["webformatHeight"]
                    )
                    for hit in data.get("hits", [])
                ]
    except Exception as e:
        logging.error(f"Pixabay error: {e}")
    return []

# Conversational chat endpoint
class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[Dict[str, str]]] = []

class ChatResponse(BaseModel):
    response: str
    needs_search: bool = False
    search_data: Optional[SearchResponse] = None
    audio_url: Optional[str] = None

async def determine_intent(message: str) -> Dict[str, Any]:
    """Determine if message needs search or just conversation"""
    # Keywords that indicate search needs
    search_keywords = ["search", "find", "show me", "images of", "pictures of", "articles about", "define", "what is", "tell me about", "explain"]
    
    message_lower = message.lower()
    needs_search = any(keyword in message_lower for keyword in search_keywords)
    
    # Check for specific API triggers
    if any(word in message_lower for word in ["generate image", "create image", "draw", "make a picture", "can you generate an image", "can you create an image"]):
        needs_search = True
    
    if any(word in message_lower for word in ["crypto", "bitcoin", "ethereum", "price of"]):
        needs_search = True
    
    if any(word in message_lower for word in ["research", "paper", "arxiv", "academic"]):
        needs_search = True
    
    if any(word in message_lower for word in ["programming question", "stack overflow", "how to code"]):
        needs_search = True
    
    if any(word in message_lower for word in ["weather", "temperature", "forecast"]):
        needs_search = True
    
    if any(word in message_lower for word in ["pokemon", "pokémon"]):
        needs_search = True
    
    if "dog" in message_lower or "cat" in message_lower or "puppy" in message_lower or "kitten" in message_lower:
        needs_search = True
    
    if "joke" in message_lower and "chuck" in message_lower:
        needs_search = True
    
    if "quote" in message_lower and ("programming" in message_lower or "dev" in message_lower):
        needs_search = True
    
    if "my ip" in message_lower or "ip address" in message_lower or "ip info" in message_lower:
        needs_search = True
    
    # Always search for definitions of single words
    words = message.split()
    if len(words) == 1 and len(words[0]) > 3:
        needs_search = True
    
    # Always calculate math expressions
    if calculator.is_valid_expression(message):
        needs_search = True
    
    return {"needs_search": needs_search}


async def handle_pollinations_query(message: str) -> Optional[Dict]:
    """Handle Pollinations.AI image generation"""
    message_lower = message.lower()
    
    triggers = ["generate image", "create image", "draw", "make a picture", "generate an image", "create an image", "can you generate", "can you create"]
    
    if any(trigger in message_lower for trigger in triggers):
        # Extract the prompt
        prompt = message
        for trigger in triggers:
            prompt = prompt.lower().replace(trigger, "").strip()
        
        if not prompt or prompt.startswith("of"):
            prompt = prompt.replace("of", "").strip()
        
        if not prompt:
            prompt = "a beautiful landscape"
        
        image_url = pollinations.generate_image_url(prompt)
        
        return {
            "type": "image_generation",
            "image_url": image_url,
            "prompt": prompt
        }
    
    return None


async def handle_crypto_query(message: str) -> Optional[Dict]:
    """Handle cryptocurrency queries"""
    message_lower = message.lower()
    
    if any(word in message_lower for word in ["crypto", "bitcoin", "ethereum", "price"]):
        coin_ids = []
        
        if "bitcoin" in message_lower or "btc" in message_lower:
            coin_ids.append("bitcoin")
        if "ethereum" in message_lower or "eth" in message_lower:
            coin_ids.append("ethereum")
        if "dogecoin" in message_lower or "doge" in message_lower:
            coin_ids.append("dogecoin")
        if "cardano" in message_lower or "ada" in message_lower:
            coin_ids.append("cardano")
        if "solana" in message_lower or "sol" in message_lower:
            coin_ids.append("solana")
        
        if not coin_ids:
            coin_ids = ["bitcoin", "ethereum"]
        
        prices = await coingecko.get_price(",".join(coin_ids))
        
        if prices:
            return {
                "type": "crypto",
                "data": prices
            }
    
    return None


async def handle_arxiv_query(message: str) -> Optional[Dict]:
    """Handle academic paper queries"""
    message_lower = message.lower()
    
    if any(word in message_lower for word in ["research", "paper", "arxiv", "academic"]):
        query = message
        for word in ["research on", "paper about", "arxiv", "academic"]:
            query = query.lower().replace(word, "").strip()
        
        if query:
            papers = await arxiv.search(query)
            if papers:
                return {
                    "type": "arxiv",
                    "papers": papers
                }
    
    return None


async def handle_stackoverflow_query(message: str) -> Optional[Dict]:
    """Handle Stack Overflow queries"""
    message_lower = message.lower()
    
    if any(word in message_lower for word in ["stack overflow", "programming question", "how to code"]):
        query = message
        for word in ["stack overflow", "programming question", "how to code"]:
            query = query.lower().replace(word, "").strip()
        
        if query:
            questions = await stackexchange.search(query)
            if questions:
                return {
                    "type": "stackoverflow",
                    "questions": questions
                }
    
    return None


async def handle_weather_query(message: str) -> Optional[Dict]:
    """Handle weather queries"""
    message_lower = message.lower()
    
    if any(word in message_lower for word in ["weather", "temperature", "forecast"]):
        # Default location (New York)
        latitude, longitude = 40.7128, -74.0060
        location_name = "New York"
        
        # Simple location detection
        if "london" in message_lower:
            latitude, longitude = 51.5074, -0.1278
            location_name = "London"
        elif "paris" in message_lower:
            latitude, longitude = 48.8566, 2.3522
            location_name = "Paris"
        elif "tokyo" in message_lower:
            latitude, longitude = 35.6762, 139.6503
            location_name = "Tokyo"
        elif "sydney" in message_lower:
            latitude, longitude = -33.8688, 151.2093
            location_name = "Sydney"
        
        weather_data = await openmeteo.get_weather(latitude, longitude)
        
        if weather_data and weather_data.get("current_weather"):
            return {
                "type": "weather",
                "data": weather_data["current_weather"],
                "location": location_name
            }
    
    return None


async def handle_pokemon_query(message: str) -> Optional[Dict]:
    """Handle Pokemon queries"""
    message_lower = message.lower()
    
    if "pokemon" in message_lower or "pokémon" in message_lower:
        pokemon_name = message_lower.replace("pokemon", "").replace("pokémon", "").strip()
        
        if pokemon_name:
            pokemon_data = await pokeapi.get_pokemon(pokemon_name)
            if pokemon_data:
                return {
                    "type": "pokemon",
                    "data": pokemon_data
                }
    
    return None


async def handle_dog_query(message: str) -> Optional[Dict]:
    """Handle dog image queries"""
    message_lower = message.lower()
    
    if "dog" in message_lower or "puppy" in message_lower:
        image_url = await dogapi.get_random_dog()
        if image_url:
            return {
                "type": "dog",
                "image_url": image_url
            }
    
    return None


async def handle_cat_query(message: str) -> Optional[Dict]:
    """Handle cat image queries"""
    message_lower = message.lower()
    
    if "cat" in message_lower or "kitten" in message_lower:
        image_url = await catapi.get_random_cat()
        if image_url:
            return {
                "type": "cat",
                "image_url": image_url
            }
    
    return None


async def handle_joke_query(message: str) -> Optional[Dict]:
    """Handle joke queries"""
    message_lower = message.lower()
    
    if "joke" in message_lower and ("chuck" in message_lower or "norris" in message_lower):
        joke = await chucknorris.get_random_joke()
        if joke:
            return {
                "type": "joke",
                "joke": joke
            }
    
    return None


async def handle_quote_query(message: str) -> Optional[Dict]:
    """Handle programming quote queries"""
    message_lower = message.lower()
    
    if "quote" in message_lower and ("programming" in message_lower or "dev" in message_lower):
        quote_data = await programming_quotes.get_random_quote()
        if quote_data:
            return {
                "type": "quote",
                "data": quote_data
            }
    
    return None


async def handle_ip_query(message: str) -> Optional[Dict]:
    """Handle IP info queries"""
    message_lower = message.lower()
    
    if "my ip" in message_lower or "ip address" in message_lower or "ip info" in message_lower:
        ip_data = await ipinfo.get_ip_info()
        if ip_data:
            return {
                "type": "ip_info",
                "data": ip_data
            }
    
    return None



def generate_audio_for_response(text: str, voice: str = "alloy") -> Optional[str]:
    """Generate audio URL for text using Pollinations.ai"""
    try:
        # Limit text length for audio generation (max 500 chars for better performance)
        if len(text) > 500:
            text = text[:497] + "..."
        
        audio_url = pollinations.generate_audio_url(text, voice)
        return audio_url
    except Exception as e:
        logging.error(f"Audio generation error: {e}")
        return None


async def generate_enhanced_response(message: str, history: List[Dict], search_context: str = None) -> str:
    """Generate enhanced AI response combining Pollinations, Cerebras, and search context"""
    try:
        # Build system message with search context if available
        system_content = "You are Gerch, a helpful and conversational AI assistant. Be friendly, concise, and engaging. Provide clear, accurate answers."
        
        if search_context:
            system_content += f"\n\nAdditional context from search: {search_context[:500]}"
        
        # Build conversation history
        messages = [
            {"role": "system", "content": system_content}
        ]
        
        # Add conversation history
        for msg in history[-5:]:
            messages.append(msg)
        
        # Add current message
        messages.append({"role": "user", "content": message})
        
        # Try Pollinations.AI text generation first (it's free and fast)
        try:
            pollinations_response = await pollinations.generate_text(
                prompt=message,
                system=system_content,
                model="openai"
            )
            if pollinations_response:
                return pollinations_response
        except Exception as e:
            logging.error(f"Pollinations text error: {e}")
        
        # Fallback to Cerebras
        try:
            response = cerebras_client.chat.completions.create(
                model="llama3.1-8b",
                messages=messages,
                max_tokens=500,
                temperature=0.7
            )
            return response.choices[0].message.content
        except Exception as e:
            logging.error(f"Cerebras error: {e}")
        
    except Exception as e:
        logging.error(f"Enhanced response error: {e}")
    
    # Final fallback to rule-based response
    return await generate_fallback_response(message)


async def generate_fallback_response(message: str) -> str:
    """Generate fallback response when all AI services fail"""
    message_lower = message.lower()
    
    if any(greeting in message_lower for greeting in ["hi", "hello", "hey", "greetings"]):
        return "Hello! I'm Gerch, your AI-powered search assistant. How can I help you today?"
    
    if any(word in message_lower for word in ["how are you", "what's up", "how do you do"]):
        return "I'm doing great, thank you! I'm here to help you search for information, answer questions, and assist with various tasks. What would you like to know?"
    
    if any(word in message_lower for word in ["thank", "thanks", "appreciate"]):
        return "You're very welcome! Let me know if you need anything else."
    
    if "who are you" in message_lower or "what are you" in message_lower:
        return "I'm Gerch, an AI-powered search engine and assistant. I can help you find information, answer questions, generate images, get crypto prices, check weather, and much more!"
    
    return "I understand your message. I'm here to help! Could you please provide more details or ask a specific question?"


async def generate_conversational_response(message: str, history: List[Dict[str, str]]) -> str:
    """Legacy function - redirects to enhanced response"""
    return await generate_enhanced_response(message, history)

@api_router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        # Check all new API handlers first
        pollinations_result = await handle_pollinations_query(request.message)
        if pollinations_result:
            return ChatResponse(
                response=f"Here's your image: {pollinations_result['prompt']}",
                needs_search=True,
                search_data=SearchResponse(
                    query=request.message,
                    images=[ImageResult(url=pollinations_result['image_url'], thumbnail=pollinations_result['image_url'], width=512, height=512)],
                    web_results=[]
                )
            )
        
        crypto_result = await handle_crypto_query(request.message)
        if crypto_result:
            response_text = "**Cryptocurrency Prices:**\n\n"
            for coin, data in crypto_result['data'].items():
                price = data.get('usd', 0)
                change = data.get('usd_24h_change', 0)
                response_text += f"**{coin.capitalize()}**: ${price:,.2f} ({change:+.2f}%)\n"
            
            return ChatResponse(response=response_text, needs_search=False)
        
        arxiv_result = await handle_arxiv_query(request.message)
        if arxiv_result:
            response_text = "**Research Papers:**\n\n"
            for i, paper in enumerate(arxiv_result['papers'][:3], 1):
                response_text += f"**{i}. {paper['title']}**\n"
                response_text += f"{paper['summary'][:200]}...\n"
                response_text += f"[Read more]({paper['id']})\n\n"
            
            return ChatResponse(response=response_text, needs_search=False)
        
        stackoverflow_result = await handle_stackoverflow_query(request.message)
        if stackoverflow_result:
            response_text = "**Programming Questions:**\n\n"
            for i, q in enumerate(stackoverflow_result['questions'][:3], 1):
                response_text += f"**{i}. {q.get('title', 'No title')}**\n"
                response_text += f"Score: {q.get('score', 0)} | Answers: {q.get('answer_count', 0)}\n"
                response_text += f"[View question]({q.get('link', '#')})\n\n"
            
            return ChatResponse(response=response_text, needs_search=False)
        
        weather_result = await handle_weather_query(request.message)
        if weather_result:
            weather = weather_result['data']
            temp = weather.get('temperature', 0)
            windspeed = weather.get('windspeed', 0)
            location = weather_result['location']
            
            response_text = f"**Weather in {location}**\n\n"
            response_text += f"Temperature: {temp}°C\n"
            response_text += f"Wind Speed: {windspeed} km/h\n"
            
            return ChatResponse(response=response_text, needs_search=False)
        
        pokemon_result = await handle_pokemon_query(request.message)
        if pokemon_result:
            pokemon = pokemon_result['data']
            name = pokemon['name'].capitalize()
            height = pokemon['height'] / 10
            weight = pokemon['weight'] / 10
            types = ', '.join([t['type']['name'] for t in pokemon['types']])
            
            response_text = f"**{name}**\n\n"
            response_text += f"Height: {height}m | Weight: {weight}kg\n"
            response_text += f"Types: {types}\n"
            
            # Include sprite image
            sprite_url = pokemon['sprites']['front_default']
            if sprite_url:
                return ChatResponse(
                    response=response_text,
                    needs_search=True,
                    search_data=SearchResponse(
                        query=request.message,
                        images=[ImageResult(url=sprite_url, thumbnail=sprite_url, width=96, height=96)],
                        web_results=[]
                    )
                )
            
            return ChatResponse(response=response_text, needs_search=False)
        
        dog_result = await handle_dog_query(request.message)
        if dog_result:
            return ChatResponse(
                response="Here's a cute dog for you!",
                needs_search=True,
                search_data=SearchResponse(
                    query=request.message,
                    images=[ImageResult(url=dog_result['image_url'], thumbnail=dog_result['image_url'], width=400, height=400)],
                    web_results=[]
                )
            )
        
        cat_result = await handle_cat_query(request.message)
        if cat_result:
            return ChatResponse(
                response="Here's a cute cat for you!",
                needs_search=True,
                search_data=SearchResponse(
                    query=request.message,
                    images=[ImageResult(url=cat_result['image_url'], thumbnail=cat_result['image_url'], width=400, height=400)],
                    web_results=[]
                )
            )
        
        joke_result = await handle_joke_query(request.message)
        if joke_result:
            return ChatResponse(response=f"😄 {joke_result['joke']}", needs_search=False)
        
        quote_result = await handle_quote_query(request.message)
        if quote_result:
            quote = quote_result['data']
            response_text = f"*\"{quote.get('en', '')}\"*\n\n— {quote.get('author', 'Unknown')}"
            return ChatResponse(response=response_text, needs_search=False)
        
        ip_result = await handle_ip_query(request.message)
        if ip_result:
            ip_data = ip_result['data']
            response_text = "**IP Information**\n\n"
            response_text += f"IP: {ip_data.get('ip', 'N/A')}\n"
            response_text += f"Location: {ip_data.get('city', 'N/A')}, {ip_data.get('region', 'N/A')}, {ip_data.get('country', 'N/A')}\n"
            response_text += f"Organization: {ip_data.get('org', 'N/A')}\n"
            
            return ChatResponse(response=response_text, needs_search=False)
        
        # Determine if we need to search
        intent = await determine_intent(request.message)
        
        # If it's just a conversation
        if not intent["needs_search"]:
            response_text = await generate_conversational_response(request.message, request.conversation_history)
            audio_url = generate_audio_for_response(response_text)
            return ChatResponse(
                response=response_text,
                needs_search=False,
                audio_url=audio_url
            )
        
        # If we need to search/use tools (existing logic)
        else:
            # Perform full search
            search_result = await search(SearchRequest(query=request.message, num_results=10))
            
            # Generate conversational response based on search results
            response_text = ""
            
            if search_result.calculator_result and search_result.calculator_result.get("success"):
                result = search_result.calculator_result['result']
                response_text = f"The answer is {result}."
            
            elif search_result.dictionary:
                dict_data = search_result.dictionary
                word = dict_data['word']
                phonetic = dict_data.get('phonetic', '')
                definitions = dict_data['definitions']
                
                response_text = f"**{word}**"
                if phonetic:
                    response_text += f" {phonetic}"
                response_text += "\n\n"
                
                for defn in definitions[:2]:
                    response_text += f"*{defn['part_of_speech']}*: {defn['definition']}\n"
                    if defn.get('example'):
                        response_text += f"Example: \"{defn['example']}\"\n"
            
            elif search_result.wikipedia_summary:
                response_text = search_result.wikipedia_summary
            
            elif search_result.web_results:
                # Use first web result snippet
                response_text = f"Based on my search: {search_result.web_results[0].snippet}"
            
            else:
                response_text = "I found some information, but let me show you what I discovered."
            
            # Try to enhance with AI using the new enhanced response function
            try:
                if search_result.calculator_result and not search_result.calculator_result.get("success"):
                    pass  # Keep simple response for calculator
                elif search_result.dictionary:
                    pass  # Keep simple response for dictionary
                else:
                    # Use enhanced response with search context
                    enhanced_response = await generate_enhanced_response(
                        request.message, 
                        request.conversation_history, 
                        response_text
                    )
                    if enhanced_response:
                        response_text = enhanced_response
            except Exception as e:
                logging.error(f"Enhanced AI response error: {e}")
                # Keep the original response_text
            
            # Generate audio for the response
            audio_url = generate_audio_for_response(response_text)
            
            return ChatResponse(
                response=response_text,
                needs_search=True,
                search_data=search_result,
                audio_url=audio_url
            )
    
    except Exception as e:
        logging.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")

# Legacy search endpoint (keep for compatibility)
@api_router.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    try:
        # Check if it's a calculator expression
        calc_result = None
        if calculator.is_valid_expression(request.query):
            calc_result = await calculator.calculate(request.query)
        
        # Check if it's a single word for dictionary
        dict_result = None
        words = request.query.split()
        if len(words) == 1:
            dict_result = await get_dictionary_definition(words[0])
        
        # Execute all searches concurrently
        tasks = []
        
        # SerpAPI search
        async def serp_search():
            try:
                params = {
                    "q": request.query,
                    "api_key": SERPAPI_KEY,
                    "engine": "google",
                    "num": min(request.num_results, 20)
                }
                search = GoogleSearch(params)
                return search.get_dict()
            except Exception as e:
                logging.error(f"SerpAPI error: {e}")
                return {}
        
        # Execute all tasks concurrently
        results = await asyncio.gather(
            serp_search(),
            get_ai_overview(request.query),
            search_pixabay_images(request.query),
            get_wikipedia_summary(request.query),
            return_exceptions=True
        )
        
        serp_data = results[0] if not isinstance(results[0], Exception) else {}
        ai_overview = results[1] if not isinstance(results[1], Exception) else None
        images = results[2] if not isinstance(results[2], Exception) else []
        wiki_summary = results[3] if not isinstance(results[3], Exception) else None
        
        # Extract web results
        web_results = []
        for idx, result in enumerate(serp_data.get("organic_results", [])):
            web_results.append(SearchResult(
                title=result.get("title", "Untitled"),
                link=result.get("link", ""),
                snippet=result.get("snippet", "No description available"),
                position=result.get("position", idx + 1)
            ))
        
        # Get search metadata
        search_info = serp_data.get("search_information", {})
        total_results = str(search_info.get("total_results", ""))
        search_time = str(search_info.get("time_taken_displayed", ""))
        
        return SearchResponse(
            query=request.query,
            ai_overview=ai_overview,
            web_results=web_results,
            images=images,
            dictionary=dict_result,
            calculator_result=calc_result,
            wikipedia_summary=wiki_summary,
            total_results=total_results,
            search_time=search_time
        )
    
    except Exception as e:
        logging.error(f"Search error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

# Health check
@api_router.get("/")
async def root():
    return {"message": "Gerch API v2.0 is running", "status": "healthy"}

# Include router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
