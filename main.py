from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from huggingface_hub import InferenceClient
import json
import time
import re

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Input Hugging Face API token
HUGGINGFACE_API_TOKEN = "example"

# Initialize Hugging Face Inference Client
client = InferenceClient(token=HUGGINGFACE_API_TOKEN) if HUGGINGFACE_API_TOKEN != "your-huggingface-token-here" else None

# Using a high-quality sentiment model
SENTIMENT_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest"

last_request_time = None
MIN_REQUEST_INTERVAL = 1

class TextRequest(BaseModel):
    text: str

def analyze_sentiment_with_ai(text: str):
    """
    Use AI model to analyze sentiment via Hugging Face
    """
    if not client:
        raise HTTPException(status_code=500, detail="Hugging Face client not configured. Please add your API token.")
    
    try:
        print(f"\n📝 Analyzing: '{text}'")
        
        # Call Hugging Face AI model using official client
        result = client.text_classification(text, model=SENTIMENT_MODEL)
        
        print(f"🤖 AI Response: {result}")
        
        # Parse the AI model's response
        if isinstance(result, list) and len(result) > 0:
            # Get all sentiment scores
            sentiment_scores = {}
            for item in result:
                label = item['label'].upper()
                score = item['score']
                sentiment_scores[label] = score
                print(f"  {label}: {score:.3f}")
            
            # Get the highest scoring sentiment
            best_item = result[0]  # Already sorted by score
            best_sentiment = best_item['label'].upper()
            best_score = best_item['score']
            
            # Map model labels to our format
            label_map = {
                'POSITIVE': 'positive',
                'NEGATIVE': 'negative',
                'NEUTRAL': 'neutral',
                'LABEL_2': 'positive',
                'LABEL_1': 'neutral',
                'LABEL_0': 'negative'
            }
            
            sentiment = label_map.get(best_sentiment, 'neutral')
            
            # Map sentiment to emotions
            emotion_map = {
                'positive': ['happy', 'joyful', 'excited'],
                'negative': ['angry', 'sad', 'frustrated'],
                'neutral': ['calm', 'neutral', 'composed']
            }
            
            emotions = emotion_map.get(sentiment, ['neutral'])
            
            print(f"✅ Result: {sentiment} (score: {best_score:.2f})")
            
            return {
                'sentiment': sentiment,
                'sentiment_score': round(best_score, 2),
                'emotions': emotions
            }
        else:
            raise Exception(f"Unexpected API response format: {result}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=f"Sentiment analysis failed: {str(e)}")

def extract_keywords(text: str):
    """Extract keywords from text"""
    common_words = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'must', 'can', 'i', 'you', 'he', 'she',
        'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
        'this', 'that', 'these', 'those', 'am', 'what', 'when', 'where', 'why',
        'how', 'who', 'which', 'hello', 'hi', 'guess', 'um', 'uh', 'just'
    }
    
    words = re.findall(r'\b[a-zA-Z]+\b', text.lower())
    keywords = [w for w in words if len(w) > 3 and w not in common_words]
    
    # Get unique keywords, limit to 5
    unique_keywords = []
    for word in keywords:
        if word not in unique_keywords:
            unique_keywords.append(word)
        if len(unique_keywords) >= 5:
            break
    
    return unique_keywords if unique_keywords else ["speech"]

@app.post("/process_text")
async def process_text(req: TextRequest):
    global last_request_time
    
    try:
        # Rate limiting
        if last_request_time:
            time_since_last = time.time() - last_request_time
            if time_since_last < MIN_REQUEST_INTERVAL:
                wait_time = MIN_REQUEST_INTERVAL - time_since_last
                raise HTTPException(
                    status_code=429, 
                    detail=f"Please wait {wait_time:.1f} seconds"
                )
        
        if not req.text or req.text.strip() == "":
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        last_request_time = time.time()
        
        # Use AI to analyze sentiment
        sentiment_data = analyze_sentiment_with_ai(req.text)
        
        # Extract keywords
        keywords = extract_keywords(req.text)
        
        # Combine results
        result_json = {
            "sentiment": sentiment_data['sentiment'],
            "sentiment_score": sentiment_data['sentiment_score'],
            "keywords": keywords,
            "emotions": sentiment_data['emotions']
        }
        
        print(f"📦 Final result: {json.dumps(result_json, indent=2)}\n")
        
        return {
            "result": json.dumps(result_json, indent=2),
            "data": result_json
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Unexpected error: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing text: {str(e)}")

@app.get("/")
async def root():
    return {
        "message": "AI-Powered Sentiment Analysis API",
        "status": "ok",
        "model": "Hugging Face RoBERTa",
        "info": "100% AI-driven sentiment analysis"
    }

@app.get("/health")
async def health():
    configured = client is not None
    return {
        "status": "healthy",
        "api_key_configured": configured,
        "ai_provider": "Hugging Face (FREE)"
    }

if __name__ == "__main__":
    import uvicorn
    print("=" * 70)
    print("🤖 AI-Powered Sentiment Analysis API")
    print("Using: Hugging Face RoBERTa model")
    print("=" * 70)
    
    if not client:
        print("\n⚠️  WARNING: Set your Hugging Face token on line 18!")
        print("Get one FREE at: https://huggingface.co/settings/tokens\n")
    else:
        print("✅ API token configured\n")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)