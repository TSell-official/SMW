from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import requests
from cerebras.cloud.sdk import Cerebras
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import asyncio
from functools import lru_cache

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Cerebras client
cerebras_client = Cerebras(api_key=os.environ.get('CEREBRAS_API_KEY'))

# Embedding model for semantic search
embedding_model = None
faiss_index = None
document_store = []  # Store document chunks with metadata

# Wikipedia API configuration
WIKI_API_URL = "https://en.wikipedia.org/w/api.php"
WIKI_USER_AGENT = "WikiAI/1.0 (dark-wiki-ai)"

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class SearchRequest(BaseModel):
    query: str

class SearchResult(BaseModel):
    title: str
    summary: str
    url: str
    relevance_score: Optional[float] = None

class ArticleResponse(BaseModel):
    title: str
    content: str
    url: str
    categories: List[str] = []
    summary: str

class AskRequest(BaseModel):
    question: str
    context: Optional[str] = None

class AskResponse(BaseModel):
    answer: str
    sources: List[str] = []

class ClassifyRequest(BaseModel):
    text: str

class ClassifyResponse(BaseModel):
    categories: List[str]
    confidence_scores: List[float]

# Initialize embedding model on startup
@app.on_event("startup")
async def startup_event():
    global embedding_model, faiss_index
    logging.info("Loading embedding model...")
    embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    # Initialize FAISS index (384 dimensions for all-MiniLM-L6-v2)
    faiss_index = faiss.IndexFlatL2(384)
    logging.info("Models loaded successfully")

# Helper function to search Wikipedia
def search_wikipedia(query: str, limit: int = 5):
    params = {
        "action": "opensearch",
        "search": query,
        "limit": limit,
        "namespace": 0,
        "format": "json"
    }
    headers = {"User-Agent": WIKI_USER_AGENT}
    response = requests.get(WIKI_API_URL, params=params, headers=headers)
    data = response.json()
    return list(zip(data[1], data[2], data[3]))  # titles, descriptions, urls

# Helper function to get Wikipedia page
def get_wikipedia_page(title: str):
    params = {
        "action": "query",
        "titles": title,
        "prop": "extracts|categories|info",
        "exintro": False,
        "explaintext": True,
        "inprop": "url",
        "format": "json"
    }
    headers = {"User-Agent": WIKI_USER_AGENT}
    response = requests.get(WIKI_API_URL, params=params, headers=headers)
    data = response.json()
    pages = data["query"]["pages"]
    page_id = list(pages.keys())[0]
    
    if page_id == "-1":
        return None
    
    return pages[page_id]

# Smart search endpoint using Cerebras
@api_router.post("/search", response_model=List[SearchResult])
async def smart_search(request: SearchRequest):
    try:
        # Use Cerebras to enhance the search query
        cerebras_response = cerebras_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a search query optimizer. Given a user's question or search query, extract the key Wikipedia-searchable terms. Return only the essential keywords or topic name, nothing else."
                },
                {
                    "role": "user",
                    "content": f"Query: {request.query}"
                }
            ],
            model="llama3.1-8b",
            temperature=0.3,
            max_tokens=50
        )
        
        optimized_query = cerebras_response.choices[0].message.content.strip()
        
        # Search Wikipedia
        search_results = search_wikipedia(optimized_query, limit=5)
        
        results = []
        for title, description, url in search_results:
            results.append(SearchResult(
                title=title,
                summary=description if description else "No description available",
                url=url
            ))
        
        return results
    
    except Exception as e:
        logging.error(f"Search error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

# Get Wikipedia article
@api_router.get("/article/{title}", response_model=ArticleResponse)
async def get_article(title: str):
    try:
        page = wiki_wiki.page(title)
        
        if not page.exists():
            raise HTTPException(status_code=404, detail="Article not found")
        
        # Get categories
        categories = list(page.categories.keys())[:5]
        
        # Generate AI summary
        cerebras_response = cerebras_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that creates concise summaries. Summarize the given text in 2-3 sentences."
                },
                {
                    "role": "user",
                    "content": f"Summarize this article: {page.summary[:1000]}"
                }
            ],
            model="llama3.1-8b",
            temperature=0.5,
            max_tokens=150
        )
        
        ai_summary = cerebras_response.choices[0].message.content.strip()
        
        return ArticleResponse(
            title=page.title,
            content=page.text,
            url=page.fullurl,
            categories=categories,
            summary=ai_summary
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Article fetch error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch article: {str(e)}")

# Q&A endpoint using Cerebras with article context
@api_router.post("/ask", response_model=AskResponse)
async def ask_question(request: AskRequest):
    try:
        # If context is provided, use it directly
        if request.context:
            context_text = request.context[:3000]  # Limit context size
        else:
            # Search for relevant Wikipedia articles
            search_results = wiki_wiki.search(request.question, results=2)
            context_text = ""
            for title in search_results[:2]:
                page = wiki_wiki.page(title)
                if page.exists():
                    context_text += f"\n\n{page.title}:\n{page.summary[:1000]}"
        
        # Use Cerebras to answer the question
        cerebras_response = cerebras_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a knowledgeable AI assistant. Answer the user's question based on the provided context. If the context doesn't contain enough information, use your general knowledge but mention that. Be clear, concise, and accurate."
                },
                {
                    "role": "user",
                    "content": f"Context: {context_text}\n\nQuestion: {request.question}\n\nPlease provide a detailed answer."
                }
            ],
            model="llama3.1-8b",
            temperature=0.7,
            max_tokens=500
        )
        
        answer = cerebras_response.choices[0].message.content.strip()
        
        return AskResponse(
            answer=answer,
            sources=[] if not request.context else ["Provided context"]
        )
    
    except Exception as e:
        logging.error(f"Ask error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to answer question: {str(e)}")

# Content classification endpoint
@api_router.post("/classify", response_model=ClassifyResponse)
async def classify_content(request: ClassifyRequest):
    try:
        # Use Cerebras to classify the content
        cerebras_response = cerebras_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a content classifier. Classify the given text into 3-5 relevant categories. Return ONLY the categories as a comma-separated list, nothing else."
                },
                {
                    "role": "user",
                    "content": f"Text: {request.text[:1000]}"
                }
            ],
            model="llama3.1-8b",
            temperature=0.3,
            max_tokens=100
        )
        
        categories_text = cerebras_response.choices[0].message.content.strip()
        categories = [cat.strip() for cat in categories_text.split(',')]
        
        # Generate confidence scores (placeholder - in real app, would use proper classification model)
        confidence_scores = [0.9 - (i * 0.1) for i in range(len(categories))]
        
        return ClassifyResponse(
            categories=categories,
            confidence_scores=confidence_scores
        )
    
    except Exception as e:
        logging.error(f"Classification error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")

# Health check
@api_router.get("/")
async def root():
    return {"message": "WikiAI API is running", "status": "healthy"}

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