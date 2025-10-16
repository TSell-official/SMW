// Lightweight ML Service using TensorFlow.js Universal Sentence Encoder
// Lazy-loaded to minimize initial bundle size

let model = null;
let isLoading = false;
let loadError = null;

/**
 * Initialize TensorFlow.js model (lazy loaded)
 */
export const initializeModel = async () => {
  if (model) return model;
  if (isLoading) {
    // Wait for existing load to complete
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return model;
  }

  try {
    isLoading = true;
    console.log('🧠 Loading Universal Sentence Encoder...');
    
    // Dynamically import to enable code splitting
    const use = await import('@tensorflow-models/universal-sentence-encoder');
    
    // Load the lite model (smaller, faster)
    model = await use.load();
    
    console.log('✅ Model loaded successfully');
    loadError = null;
    return model;
  } catch (error) {
    console.error('❌ Failed to load ML model:', error);
    loadError = error;
    return null;
  } finally {
    isLoading = false;
  }
};

/**
 * Get embedding for a text query
 */
export const getEmbedding = async (text) => {
  try {
    const encoder = await initializeModel();
    if (!encoder) return null;

    const embeddings = await encoder.embed([text]);
    const embedding = await embeddings.array();
    return embedding[0];
  } catch (error) {
    console.error('Embedding error:', error);
    return null;
  }
};

/**
 * Calculate cosine similarity between two vectors
 */
const cosineSimilarity = (vecA, vecB) => {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
};

/**
 * Enhanced query understanding using embeddings
 */
export const enhanceQuery = async (query) => {
  try {
    // Get embedding for the query
    const queryEmbedding = await getEmbedding(query);
    if (!queryEmbedding) {
      return {
        originalQuery: query,
        enhancedQuery: query,
        intent: detectIntentKeywords(query),
        confidence: 0.5
      };
    }

    // Define intent categories with sample queries
    const intentCategories = {
      search: ['find information about', 'tell me about', 'what is', 'explain'],
      imageGeneration: ['generate image', 'create image', 'draw', 'make picture'],
      crypto: ['bitcoin price', 'ethereum', 'cryptocurrency', 'crypto market'],
      weather: ['weather', 'temperature', 'forecast', 'climate'],
      code: ['programming', 'code example', 'how to code', 'javascript'],
      research: ['research papers', 'academic', 'scientific study'],
      factual: ['who is', 'when did', 'where is', 'how many']
    };

    // Calculate similarities with intent categories
    const similarities = {};
    for (const [intent, samples] of Object.entries(intentCategories)) {
      const sampleEmbedding = await getEmbedding(samples.join(' '));
      if (sampleEmbedding) {
        similarities[intent] = cosineSimilarity(queryEmbedding, sampleEmbedding);
      }
    }

    // Find best matching intent
    const bestIntent = Object.entries(similarities)
      .sort(([, a], [, b]) => b - a)[0];

    return {
      originalQuery: query,
      enhancedQuery: query,
      intent: bestIntent ? bestIntent[0] : 'search',
      confidence: bestIntent ? bestIntent[1] : 0.5,
      allIntents: similarities
    };
  } catch (error) {
    console.error('Query enhancement error:', error);
    return {
      originalQuery: query,
      enhancedQuery: query,
      intent: detectIntentKeywords(query),
      confidence: 0.5
    };
  }
};

/**
 * Fallback keyword-based intent detection
 */
const detectIntentKeywords = (query) => {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('generate') || lowerQuery.includes('create') || lowerQuery.includes('draw')) {
    return 'imageGeneration';
  }
  if (lowerQuery.includes('bitcoin') || lowerQuery.includes('crypto') || lowerQuery.includes('ethereum')) {
    return 'crypto';
  }
  if (lowerQuery.includes('weather') || lowerQuery.includes('temperature')) {
    return 'weather';
  }
  if (lowerQuery.includes('code') || lowerQuery.includes('programming') || lowerQuery.includes('stack overflow')) {
    return 'code';
  }
  if (lowerQuery.includes('research') || lowerQuery.includes('paper') || lowerQuery.includes('arxiv')) {
    return 'research';
  }
  
  return 'search';
};

/**
 * Generate related questions based on query
 */
export const generateRelatedQuestions = async (query, context = '') => {
  // Simple related question generation
  const intent = detectIntentKeywords(query);
  const relatedQuestions = [];

  switch (intent) {
    case 'crypto':
      relatedQuestions.push(
        `What are the top cryptocurrencies by market cap?`,
        `How does ${query} compare to other cryptocurrencies?`,
        `What factors affect cryptocurrency prices?`
      );
      break;
    case 'weather':
      relatedQuestions.push(
        `What's the 7-day forecast?`,
        `How does the weather compare to last year?`,
        `What's the best time to visit?`
      );
      break;
    case 'research':
      relatedQuestions.push(
        `What are the latest findings in this field?`,
        `Who are the leading researchers?`,
        `What are related research topics?`
      );
      break;
    default:
      relatedQuestions.push(
        `Tell me more about ${query}`,
        `What are the key facts about ${query}?`,
        `How does ${query} work?`
      );
  }

  return relatedQuestions.slice(0, 3);
};

export const isModelLoaded = () => model !== null;
export const getLoadError = () => loadError;
