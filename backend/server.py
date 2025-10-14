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

# Pollinations.AI - No API key needed!
POLLINATIONS_BASE_URL = "https://image.pollinations.ai/prompt/"

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
            raise ValueError(f"Unsupported operation")
    
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

async def determine_intent(message: str) -> Dict[str, Any]:
    """Determine if message needs search or just conversation"""
    # Keywords that indicate search needs
    search_keywords = ["search", "find", "show me", "images of", "pictures of", "articles about", "define", "what is", "tell me about", "explain"]
    
    message_lower = message.lower()
    needs_search = any(keyword in message_lower for keyword in search_keywords)
    
    # Always search for definitions of single words
    words = message.split()
    if len(words) == 1 and len(words[0]) > 3:
        needs_search = True
    
    # Always calculate math expressions
    if calculator.is_valid_expression(message):
        needs_search = True
    
    return {"needs_search": needs_search}

async def generate_conversational_response(message: str, history: List[Dict[str, str]]) -> str:
    """Generate conversational response with fallback to rule-based responses"""
    message_lower = message.lower()
    
    # Greetings
    greetings = ["hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening"]
    if any(greeting in message_lower for greeting in greetings):
        return "Hello! I'm Gerch, your AI assistant. I'm here to help you search the web, answer questions, do calculations, define words, and much more. What can I help you with today?"
    
    # How are you
    if "how are you" in message_lower or "how's it going" in message_lower:
        return "I'm doing great, thank you for asking! I'm ready to help you with anything you need. Whether it's searching the web, doing calculations, or just having a chat, I'm here for you."
    
    # Thank you
    if "thank" in message_lower:
        return "You're very welcome! I'm always happy to help. Feel free to ask me anything else!"
    
    # What can you do / help with
    if ("what can you" in message_lower or "what do you" in message_lower or "help me with" in message_lower or "your capabilities" in message_lower):
        return "I can help you with many things! I can search the web for information, show you images, define words, calculate math expressions, provide summaries from Wikipedia, and have natural conversations. Just ask me anything!"
    
    # Goodbye
    if any(word in message_lower for word in ["goodbye", "bye", "see you", "later"]):
        return "Goodbye! It was nice chatting with you. Come back anytime you need help!"
    
    # Try to use Cerebras for other conversations
    try:
        response = cerebras_client.chat.completions.create(
            model="llama3.1-8b",
            messages=[
                {"role": "system", "content": "You are Gerch, a helpful and friendly AI assistant. Keep responses concise and natural."},
                *history[-4:],
                {"role": "user", "content": message}
            ],
            max_tokens=300,
            temperature=0.8
        )
        return response.choices[0].message.content
    except Exception as e:
        logging.error(f"Cerebras conversation error: {e}")
        # Fallback response
        return "I'm here to help! You can ask me to search for information, show you images, define words, calculate math problems, or just chat. What would you like to know?"

@api_router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        # Determine if we need to search
        intent = await determine_intent(request.message)
        
        # If it's just a conversation
        if not intent["needs_search"]:
            response_text = await generate_conversational_response(request.message, request.conversation_history)
            return ChatResponse(
                response=response_text,
                needs_search=False
            )
        
        # If we need to search/use tools
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
            
            # Try to enhance with AI if available
            try:
                if search_result.calculator_result and not search_result.calculator_result.get("success"):
                    pass  # Keep simple response for calculator
                elif search_result.dictionary:
                    pass  # Keep simple response for dictionary
                else:
                    # Try to use Cerebras for natural response
                    ai_response = cerebras_client.chat.completions.create(
                        model="llama3.1-8b",
                        messages=[
                            {"role": "system", "content": "You are Gerch. Provide a brief, natural response based on the search context. Be conversational."},
                            {"role": "user", "content": f"User asked: {request.message}\n\nContext: {response_text[:500]}\n\nProvide a natural 2-3 sentence response."}
                        ],
                        max_tokens=200,
                        temperature=0.7
                    )
                    response_text = ai_response.choices[0].message.content
            except Exception as e:
                logging.error(f"AI enhancement error: {e}")
                # Keep the original response_text
            
            return ChatResponse(
                response=response_text,
                needs_search=True,
                search_data=search_result
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
