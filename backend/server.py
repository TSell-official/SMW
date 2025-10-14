from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from serpapi import GoogleSearch
from cerebras.cloud.sdk import Cerebras
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Cerebras client
cerebras_client = Cerebras(api_key=os.environ.get('CEREBRAS_API_KEY'))

# SerpAPI key
SERPAPI_KEY = os.environ.get('SERPAPI_KEY')

# Create the main app
app = FastAPI()
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
    displayed_link: Optional[str] = None

class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total_results: Optional[str] = None
    search_time: Optional[float] = None

class AskRequest(BaseModel):
    question: str

class AskResponse(BaseModel):
    answer: str
    sources: List[str] = []

# Search endpoint using SerpAPI
@api_router.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    try:
        # Execute search using SerpAPI
        params = {
            "q": request.query,
            "api_key": SERPAPI_KEY,
            "engine": "google",
            "num": min(request.num_results, 20),  # Limit to 20 results
            "hl": "en",
            "gl": "us"
        }
        
        search = GoogleSearch(params)
        results_data = search.get_dict()
        
        # Extract organic results
        organic_results = results_data.get("organic_results", [])
        
        results = []
        for idx, result in enumerate(organic_results):
            results.append(SearchResult(
                title=result.get("title", "Untitled"),
                link=result.get("link", ""),
                snippet=result.get("snippet", "No description available"),
                position=result.get("position", idx + 1),
                displayed_link=result.get("displayed_link", result.get("link", ""))
            ))
        
        # Get search metadata
        search_info = results_data.get("search_information", {})
        total_results = search_info.get("total_results", "")
        search_time = search_info.get("time_taken_displayed", 0)
        
        return SearchResponse(
            query=request.query,
            results=results,
            total_results=total_results,
            search_time=search_time
        )
    
    except Exception as e:
        logging.error(f"Search error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

# AI Q&A endpoint using Cerebras
@api_router.post("/ask", response_model=AskResponse)
async def ask_question(request: AskRequest):
    try:
        # Use Cerebras to answer the question
        cerebras_response = cerebras_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a knowledgeable AI assistant. Answer the user's question clearly and concisely. Provide accurate and helpful information."
                },
                {
                    "role": "user",
                    "content": request.question
                }
            ],
            model="llama3.1-8b",
            temperature=0.7,
            max_tokens=500
        )
        
        answer = cerebras_response.choices[0].message.content.strip()
        
        return AskResponse(
            answer=answer,
            sources=[]
        )
    
    except Exception as e:
        logging.error(f"Ask error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to answer question: {str(e)}")

# Health check
@api_router.get("/")
async def root():
    return {"message": "Gerch API is running", "status": "healthy"}

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