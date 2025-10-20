# API Client Library for Gerch
# Contains all external API integrations

import httpx
import logging
from typing import Optional, List, Dict, Any
from urllib.parse import quote

logger = logging.getLogger(__name__)


class PollinationsClient:
    """Pollinations.AI - Free image, text, and audio generation"""
    
    def __init__(self):
        self.image_base_url = "https://image.pollinations.ai/prompt/"
        self.text_base_url = "https://text.pollinations.ai/"
        self.audio_base_url = "https://audio.pollinations.ai/prompt/"
    
    def generate_image_url(self, prompt: str, width: int = 512, height: int = 512) -> str:
        """Generate image URL from prompt"""
        encoded_prompt = quote(prompt)
        return f"{self.image_base_url}{encoded_prompt}?width={width}&height={height}&nologo=true"
    
    async def generate_text(self, prompt: str, system: str = "You are a helpful AI assistant.", model: str = "openai") -> str:
        """Generate text using Pollinations.AI"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.text_base_url,
                    json={
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": prompt}
                        ],
                        "model": model
                    }
                )
                if response.status_code == 200:
                    return response.text
        except Exception as e:
            logger.error(f"Pollinations text generation error: {e}")
        return None
    
    def generate_audio_url(self, text: str, voice: str = "alloy") -> str:
        """Generate audio URL from text using Pollinations.AI TTS"""
        encoded_text = quote(text)
        return f"{self.text_base_url}{encoded_text}?model=openai-audio&voice={voice}"


class CoinGeckoClient:
    """CoinGecko - Cryptocurrency data"""
    
    def __init__(self):
        self.base_url = "https://api.coingecko.com/api/v3"
    
    async def get_price(self, coin_ids: str, vs_currency: str = "usd") -> Optional[Dict]:
        """Get cryptocurrency prices"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/simple/price",
                    params={
                        "ids": coin_ids,
                        "vs_currencies": vs_currency,
                        "include_24hr_change": "true"
                    }
                )
                if response.status_code == 200:
                    return response.json()
        except Exception as e:
            logger.error(f"CoinGecko error: {e}")
        return None


class ArxivClient:
    """Arxiv - Academic papers"""
    
    def __init__(self):
        self.base_url = "http://export.arxiv.org/api/query"
    
    async def search(self, query: str, max_results: int = 5) -> Optional[List[Dict]]:
        """Search academic papers"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    self.base_url,
                    params={
                        "search_query": f"all:{query}",
                        "start": 0,
                        "max_results": max_results
                    }
                )
                if response.status_code == 200:
                    return self._parse_arxiv_response(response.text)
        except Exception as e:
            logger.error(f"Arxiv error: {e}")
        return None
    
    def _parse_arxiv_response(self, xml_string: str) -> List[Dict]:
        """Parse Arxiv XML response"""
        import xml.etree.ElementTree as ET
        
        results = []
        try:
            root = ET.fromstring(xml_string)
            ns = {'atom': 'http://www.w3.org/2005/Atom'}
            
            for entry in root.findall('atom:entry', ns):
                title = entry.find('atom:title', ns)
                summary = entry.find('atom:summary', ns)
                published = entry.find('atom:published', ns)
                id_elem = entry.find('atom:id', ns)
                
                results.append({
                    'title': title.text.strip() if title is not None else '',
                    'summary': summary.text.strip() if summary is not None else '',
                    'published': published.text if published is not None else '',
                    'id': id_elem.text if id_elem is not None else ''
                })
        except Exception as e:
            logger.error(f"Arxiv parsing error: {e}")
        
        return results


class StackExchangeClient:
    """Stack Exchange - Programming Q&A"""
    
    def __init__(self):
        self.base_url = "https://api.stackexchange.com/2.3"
    
    async def search(self, query: str, site: str = "stackoverflow", max_results: int = 5) -> Optional[List[Dict]]:
        """Search programming questions"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/search/advanced",
                    params={
                        "intitle": query,
                        "site": site,
                        "sort": "relevance",
                        "order": "desc",
                        "pagesize": max_results,
                        "filter": "default"
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    return data.get("items", [])
        except Exception as e:
            logger.error(f"StackExchange error: {e}")
        return None


class DuckDuckGoClient:
    """DuckDuckGo - Instant answers"""
    
    def __init__(self):
        self.base_url = "https://api.duckduckgo.com"
    
    async def instant_answer(self, query: str) -> Optional[Dict]:
        """Get instant answer"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    self.base_url,
                    params={
                        "q": query,
                        "format": "json",
                        "no_html": 1,
                        "skip_disambig": 1
                    }
                )
                if response.status_code == 200:
                    return response.json()
        except Exception as e:
            logger.error(f"DuckDuckGo error: {e}")
        return None


class OpenMeteoClient:
    """Open-Meteo - Weather data"""
    
    def __init__(self):
        self.base_url = "https://api.open-meteo.com/v1"
    
    async def get_weather(self, latitude: float, longitude: float) -> Optional[Dict]:
        """Get current weather"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/forecast",
                    params={
                        "latitude": latitude,
                        "longitude": longitude,
                        "current_weather": "true",
                        "timezone": "auto"
                    }
                )
                if response.status_code == 200:
                    return response.json()
        except Exception as e:
            logger.error(f"OpenMeteo error: {e}")
        return None


class ProgrammingQuotesClient:
    """Programming Quotes API with fallback"""
    
    def __init__(self):
        self.quotes = [
            {"en": "The best way to get a project done faster is to start sooner.", "author": "Jim Highsmith"},
            {"en": "Code is like humor. When you have to explain it, it's bad.", "author": "Cory House"},
            {"en": "First, solve the problem. Then, write the code.", "author": "John Johnson"},
            {"en": "Experience is the name everyone gives to their mistakes.", "author": "Oscar Wilde"},
            {"en": "In order to be irreplaceable, one must always be different.", "author": "Coco Chanel"},
            {"en": "Java is to JavaScript what car is to Carpet.", "author": "Chris Heilmann"},
            {"en": "Knowledge is power.", "author": "Francis Bacon"},
            {"en": "Sometimes it pays to stay in bed on Monday, rather than spending the rest of the week debugging Monday's code.", "author": "Dan Salomon"},
            {"en": "Perfection is achieved not when there is nothing more to add, but rather when there is nothing more to take away.", "author": "Antoine de Saint-Exupery"},
            {"en": "Ruby is rubbish! PHP is phpantastic!", "author": "Nikita Popov"}
        ]
    
    async def get_random_quote(self) -> Optional[Dict]:
        """Get random programming quote"""
        try:
            import random
            return random.choice(self.quotes)
        except Exception as e:
            logger.error(f"ProgrammingQuotes error: {e}")
        return None


class IPInfoClient:
    """IPInfo - IP geolocation"""
    
    def __init__(self):
        self.base_url = "https://ipinfo.io"
    
    async def get_ip_info(self, ip: Optional[str] = None) -> Optional[Dict]:
        """Get IP information"""
        try:
            url = f"{self.base_url}/{ip}/json" if ip else f"{self.base_url}/json"
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url)
                if response.status_code == 200:
                    return response.json()
        except Exception as e:
            logger.error(f"IPInfo error: {e}")
        return None


class UnsplashClient:
    """Unsplash - Random images"""
    
    def __init__(self):
        self.base_url = "https://source.unsplash.com"
    
    def get_random_image_url(self, width: int = 800, height: int = 600, query: str = "") -> str:
        """Get random image URL"""
        if query:
            return f"{self.base_url}/{width}x{height}/?{query}"
        return f"{self.base_url}/{width}x{height}"


class PokeAPIClient:
    """PokéAPI - Pokémon data"""
    
    def __init__(self):
        self.base_url = "https://pokeapi.co/api/v2"
    
    async def get_pokemon(self, name_or_id: str) -> Optional[Dict]:
        """Get Pokémon data"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/pokemon/{name_or_id.lower()}")
                if response.status_code == 200:
                    return response.json()
        except Exception as e:
            logger.error(f"PokeAPI error: {e}")
        return None


class DogAPIClient:
    """Dog CEO API - Random dog images"""
    
    def __init__(self):
        self.base_url = "https://dog.ceo/api"
    
    async def get_random_dog(self) -> Optional[str]:
        """Get random dog image"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/breeds/image/random")
                if response.status_code == 200:
                    data = response.json()
                    return data.get("message")
        except Exception as e:
            logger.error(f"DogAPI error: {e}")
        return None
    
    async def get_dog_by_breed(self, breed: str) -> Optional[str]:
        """Get dog image by breed"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/breed/{breed}/images/random")
                if response.status_code == 200:
                    data = response.json()
                    return data.get("message")
        except Exception as e:
            logger.error(f"DogAPI error: {e}")
        return None


class CatAPIClient:
    """The Cat API - Random cat images"""
    
    def __init__(self):
        self.base_url = "https://api.thecatapi.com/v1"
    
    async def get_random_cat(self) -> Optional[str]:
        """Get random cat image"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/images/search")
                if response.status_code == 200:
                    data = response.json()
                    return data[0].get("url") if len(data) > 0 else None
        except Exception as e:
            logger.error(f"CatAPI error: {e}")
        return None


class ChuckNorrisClient:
    """Chuck Norris Jokes API"""
    
    def __init__(self):
        self.base_url = "https://api.chucknorris.io/jokes"
    
    async def get_random_joke(self) -> Optional[str]:
        """Get random Chuck Norris joke"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/random")
                if response.status_code == 200:
                    data = response.json()
                    return data.get("value")
        except Exception as e:
            logger.error(f"ChuckNorris error: {e}")
        return None
