import json
import os
import re
import random
from http.server import SimpleHTTPRequestHandler, HTTPServer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

PORT = 8000
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), 'public')
FAQS_PATH = os.path.join(os.path.dirname(__file__), 'faqs.json')
USERS_PATH = os.path.join(os.path.dirname(__file__), 'users.json')

def load_users():
    if os.path.exists(USERS_PATH):
        try:
            with open(USERS_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "admin": {
            "name": "Administrator",
            "email": "admin@aura.io",
            "password": "password123"
        }
    }

def save_users(users):
    try:
        with open(USERS_PATH, 'w', encoding='utf-8') as f:
            json.dump(users, f, indent=2)
    except Exception as e:
        print("Error saving users:", e)

# NLTK imports and downloads
try:
    import nltk
    from nltk.corpus import stopwords
    from nltk.tokenize import word_tokenize
    from nltk.stem import PorterStemmer
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
    NLTK_AVAILABLE = True
except Exception:
    NLTK_AVAILABLE = False
    print("NLTK library or datasets not available. Using custom regex-based NLP engine.")

# Conversational intents smalltalk rules
GREETING_PATTERNS = [
    (r'\b(hi|hello|hey|greetings|howdy|hola|yo|hello assistant)\b', [
        "Hello! How can I help you today with your Aura Smart Home system?",
        "Hi there! What can I assist you with today?",
        "Greetings! How may I help you with your Aura ecosystem?"
    ]),
    (r'\b(how are you|how\'s it going|how are things)\b', [
        "I'm doing great, thank you! Ready to assist you with any Aura Smart Home questions you have. How can I help you?",
        "System is running at 100% efficiency! I'm ready to help. What's on your mind today?"
    ]),
    (r'\b(thank you|thanks|thank|cheers|appreciate|perfect|awesome)\b', [
        "You're very welcome! Let me know if you need help with anything else.",
        "Happy to help! Let me know if there's anything else I can do for you.",
        "Anytime! Have a wonderful day."
    ]),
    (r'\b(who are you|your name|what is your name|what are you)\b', [
        "I am the Aura Assistant, your virtual guide for the Aura Smart Home ecosystem. I can help you with setups, device connections, and troubleshooting.",
        "You're chatting with Aura Assistant, the AI helper for Aura Home Intelligence."
    ]),
    (r'\b(what can you do|help me|what should i ask|help)\b', [
        "I can guide you through setting up your Aura Hub, pairing new smart devices, configuring automations, and troubleshooting connectivity issues. You can also click the FAQ categories in the sidebar to browse documentation."
    ]),
    (r'\b(goodbye|bye|see you|exit|quit)\b', [
        "Goodbye! Have a wonderful day with your smart home.",
        "Bye! Feel free to reach out anytime you need assistance."
    ])
]

# Custom preprocessing function
def preprocess_text(text):
    text = text.lower()
    if NLTK_AVAILABLE:
        try:
            tokens = word_tokenize(text)
            stop_words = set(stopwords.words('english'))
            tokens = [w for w in tokens if w.isalnum() and w not in stop_words]
            stemmer = PorterStemmer()
            tokens = [stemmer.stem(w) for w in tokens]
            return " ".join(tokens)
        except Exception:
            pass
    
    # Fallback preprocessing
    tokens = re.findall(r'\b\w+\b', text)
    stop_words = {
        'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'are', 'as', 'by', 'for', 'from', 'in', 'it', 'of', 'to', 'with', 
        'you', 'i', 'your', 'my', 'how', 'what', 'where', 'why', 'can', 'do', 'does', 'did', 'have', 'has', 'had', 
        'use', 'using', 'get', 'getting', 'make', 'making', 'show', 'shows', 'showing', 'need', 'needs', 'want', 'wants', 
        'please', 'help', 'ask', 'asking', 'question', 'questions', 'should', 'would', 'could', 'about', 'some', 'any', 'or'
    }
    tokens = [w for w in tokens if w not in stop_words]
    
    # Simple suffix stemming fallback
    cleaned = []
    for w in tokens:
        if len(w) > 4:
            if w.endswith('ing'):
                w = w[:-3]
            elif w.endswith('ed'):
                w = w[:-2]
            elif w.endswith('es'):
                w = w[:-2]
            elif w.endswith('s') and not w.endswith('ss'):
                w = w[:-1]
        cleaned.append(w)
    return " ".join(cleaned)

# Load FAQs
if os.path.exists(FAQS_PATH):
    with open(FAQS_PATH, 'r', encoding='utf-8') as f:
        faqs = json.load(f)
else:
    faqs = []

# Preprocess all FAQ questions + tags + categories for richer matching
faq_questions = [faq['question'] for faq in faqs]
preprocessed_faqs = []
for faq in faqs:
    combined = faq['question'] + " " + faq['category'] + " " + " ".join(faq['tags'])
    preprocessed_faqs.append(preprocess_text(combined))

class FAQChatbotHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.0"

    def translate_path(self, path):
        # Override file path resolution to point to the 'public' directory
        path = SimpleHTTPRequestHandler.translate_path(self, path)
        rel_path = os.path.relpath(path, os.getcwd())
        return os.path.join(PUBLIC_DIR, rel_path)

    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        if self.path == '/api/login':
            try:
                data = json.loads(post_data.decode('utf-8'))
                username = data.get('username', '').strip()
                password = data.get('password', '').strip()
                
                users = load_users()
                if username in users and users[username]['password'] == password:
                    response_data = {
                        "success": True,
                        "token": f"aura-session-token-{username}-987654",
                        "user": {
                            "name": users[username]["name"],
                            "email": users[username]["email"]
                        }
                    }
                    self.send_json_response(200, response_data)
                else:
                    self.send_json_response(401, {
                        "success": False,
                        "error": "Invalid username or password"
                    })
            except json.JSONDecodeError:
                self.send_error_response(400, "Invalid JSON payload")
            except Exception as e:
                self.send_error_response(500, f"Internal server error: {str(e)}")
                
        elif self.path == '/api/signup':
            try:
                data = json.loads(post_data.decode('utf-8'))
                name = data.get('name', '').strip()
                email = data.get('email', '').strip()
                username = data.get('username', '').strip()
                password = data.get('password', '').strip()
                
                if not name or not email or not username or not password:
                    self.send_error_response(400, "All fields are required")
                    return
                
                users = load_users()
                if username in users:
                    self.send_json_response(400, {
                        "success": False,
                        "error": "Username already exists"
                    })
                    return
                
                users[username] = {
                    "name": name,
                    "email": email,
                    "password": password
                }
                save_users(users)
                
                self.send_json_response(200, {
                    "success": True, 
                    "message": "User registered successfully"
                })
            except json.JSONDecodeError:
                self.send_error_response(400, "Invalid JSON payload")
            except Exception as e:
                self.send_error_response(500, f"Internal server error: {str(e)}")
                
        elif self.path == '/api/logout':
            self.send_json_response(200, {"success": True})
            
        elif self.path == '/api/chat':
            try:
                data = json.loads(post_data.decode('utf-8'))
                user_question = data.get('question', '').strip()
                
                if not user_question:
                    self.send_error_response(400, "Missing 'question' in request body")
                    return
                
                # Check for simple conversational intents first
                matched_response = None
                user_lower = user_question.lower().strip()
                for pattern, responses in GREETING_PATTERNS:
                    if re.search(pattern, user_lower):
                        matched_response = random.choice(responses)
                        break
                
                if matched_response:
                    response_data = {
                        "success": True,
                        "match": {
                            "id": 0,
                            "question": user_question,
                            "answer": matched_response,
                            "category": "Conversational",
                            "similarity": 1.0
                        },
                        "suggestions": [
                            "How do I set up my Aura Hub?",
                            "How do I connect a new smart device to Aura?",
                            "What should I do if a device shows as 'Offline'?"
                        ]
                    }
                    self.send_json_response(200, response_data)
                    return
                
                # Preprocess user question
                prep_user = preprocess_text(user_question)
                
                # Fit TF-IDF on FAQs + user question
                all_corpus = preprocessed_faqs + [prep_user]
                vectorizer = TfidfVectorizer()
                tfidf_matrix = vectorizer.fit_transform(all_corpus)
                
                # Compute cosine similarities between user query and all FAQs
                user_vector = tfidf_matrix[-1]
                faq_vectors = tfidf_matrix[:-1]
                similarities = cosine_similarity(user_vector, faq_vectors).flatten()
                
                # Find best match
                best_idx = int(similarities.argsort()[-1])
                best_score = float(similarities[best_idx])
                
                # Sort indices of matches for suggestions
                sorted_indices = similarities.argsort()[::-1]
                
                # Get up to 3 similar questions as suggestions
                suggestions = []
                for idx in sorted_indices:
                    idx = int(idx)
                    # Exclude the best match itself, and check if suggestion already added
                    if idx != best_idx and len(suggestions) < 3 and similarities[idx] > 0.05:
                        suggestions.append(faq_questions[idx])
                
                # If no other questions had any similarity, fall back to general suggestions
                if len(suggestions) < 3:
                    for idx in range(len(faqs)):
                        if idx != best_idx and faq_questions[idx] not in suggestions and len(suggestions) < 3:
                            suggestions.append(faq_questions[idx])
                
                # Match threshold check
                SIMILARITY_THRESHOLD = 0.25
                if best_score >= SIMILARITY_THRESHOLD:
                    response_data = {
                        "success": True,
                        "match": {
                            "id": faqs[best_idx]["id"],
                            "question": faqs[best_idx]["question"],
                            "answer": faqs[best_idx]["answer"],
                            "category": faqs[best_idx]["category"],
                            "similarity": best_score
                        },
                        "suggestions": suggestions
                    }
                else:
                    response_data = {
                        "success": False,
                        "match": None,
                        "answer": "I'm sorry, I couldn't find a direct answer to your question. Could you please try rephrasing it? Alternatively, here are some topics you might find helpful:",
                        "suggestions": [
                            "How do I set up my Aura Hub?",
                            "What should I do if a device shows as 'Offline'?",
                            "How do I connect a new smart device to Aura?"
                        ]
                    }
                
                self.send_json_response(200, response_data)
                
            except json.JSONDecodeError:
                self.send_error_response(400, "Invalid JSON payload")
            except Exception as e:
                import traceback
                traceback.print_exc()
                self.send_error_response(500, f"Internal server error: {str(e)}")
        else:
            self.send_error_response(404, "Not Found")

    def do_GET(self):
        normalized_path = self.path.split('?')[0].split('#')[0]
        
        # API to fetch all FAQs
        if normalized_path == '/api/faqs':
            self.send_json_response(200, faqs)
            return
            
        # Serve index.html for root path or empty paths
        if normalized_path in ('/', '', '/index.html'):
            self.path = '/index.html'
        
        super().do_GET()

    def send_json_response(self, status, data):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def send_error_response(self, status, message):
        body = json.dumps({"success": False, "error": message}).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

if __name__ == '__main__':
    # Ensure public folder exists
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    
    server = HTTPServer(('127.0.0.1', PORT), FAQChatbotHandler)
    print(f"Server running at http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        server.server_close()
