<div align="center">

# 🤖 AI Service Desk
**Transforming IT Support with AI-Powered Triage and Analysis**

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](#)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](#)
[![Gemini API](https://img.shields.io/badge/Google%20Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)](#)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](#)

*An intelligent, full-stack ticketing system designed to eliminate manual IT triage bottlenecks.*

</div>

---

## 🧠 Why This Project Exists

In modern IT environments, Tier 1 support teams spend countless hours manually reading, categorizing, and prioritizing incoming tickets. This manual triage is notoriously slow, prone to human error, and inconsistent across different agents.

**AI Service Desk** solves this by acting as an intelligent middleware. By leveraging the Google Gemini API, it intercepts tickets upon creation and instantly analyzes them. It predicts categories, assigns priority levels, identifies probable root causes, suggests actionable resolution steps, and even detects similar past tickets—empowering IT teams to resolve issues faster and with higher accuracy.

---

## ✨ Key Features

- **AI Analysis Engine**: Instantly categorizes tickets (e.g., `bug`, `infrastructure`, `access`) and sets priority levels based on urgency and business impact.
- **Structured Outputs**: Bypasses generic chatbot responses by strictly enforcing JSON-structured outputs from the LLM, ensuring predictable and parsable data for the backend system.
- **Suggested Replies**: Automatically drafts professional, empathetic, and context-aware responses tailored to the specific user issue.
- **Similar Ticket Detection**: Uses Jaccard similarity and tokenization to find related historical tickets, helping agents reference past resolutions.
- **Background Processing**: Employs background tasks for async AI analysis, ensuring the frontend remains blazingly fast during ticket creation.
- **Analytics Dashboard**: Visualizes ticket distributions, status tracking, and the AI's average confidence scoring.

---

## 🏗️ Architecture Overview

The system is designed with a clean separation of concerns, ensuring scalability and maintainability.

```mermaid
graph LR
    A[React Frontend] -->|REST API| B(FastAPI Backend)
    B -->|Async Background Task| C{AI Service Layer}
    C -->|API Calls| D[Google Gemini API]
    C -->|Read/Write| E[(SQLite / DB)]
    B -->|Query| E
```

1. **Client Layer**: A responsive React/Vite SPA provides ticket management and analytics views.
2. **API Layer**: FastAPI routes handle incoming requests, database sessions, and payload validation.
3. **AI Service Layer**: A dedicated module isolates all LLM interactions, prompt engineering, and parsing logic.
4. **Data Layer**: SQLAlchemy ORM manages relational data, making it trivial to swap SQLite for PostgreSQL in production.

---

## 🧪 Example Output

The AI engine doesn't just return free text; it returns highly structured, deterministic JSON.

**Input Ticket:**
> **Title:** Cannot access VPN from home office
> **Description:** I am unable to connect to the company VPN when working from home. It shows authentication failed error even after entering the correct password and 2FA token.

**System Output:**
```json
{
  "category": "access",
  "priority": "high",
  "root_cause": "Potential synchronization issue with the 2FA token or an expired active directory password.",
  "solution": "1. Verify the user's AD account is not locked.\n2. Ask the user to resync their authenticator app.\n3. If issue persists, generate a temporary bypass code and check VPN gateway logs.",
  "confidence": 0.92
}
```

---

## ⚙️ Tech Stack

| Domain | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend** | Python, FastAPI | High-performance async API server |
| **Frontend** | React (Vite), TypeScript | Fast, modern client interface |
| **Database** | SQLite, SQLAlchemy | Relational data persistence & ORM |
| **AI Integration** | Google Gemini API SDK | Large Language Model interactions |

---

## 🚀 Getting Started

Follow these steps to run the project locally.

### 1. Clone the Repository
```bash
git clone https://github.com/gouravmit/ai-service-desk.git
cd ai-service-desk
```

### 2. Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Set up your environment variables:
```bash
cp .env.example .env
```
*Edit `.env` and add your `GEMINI_API_KEY` (Get one from [Google AI Studio](https://aistudio.google.com/)).*

Run the FastAPI server:
```bash
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup
Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
The application will be available at `http://localhost:5173`.

---

## 🔐 Environment Variables

The backend relies on the `.env` file for configuration. Example:

```env
# Required: Google Gemini API key
GEMINI_API_KEY=your_api_key_here

# Optional: Override default SQLite DB path (PostgreSQL example below)
# DATABASE_URL=postgresql://user:password@localhost:5432/servicedesk
DATABASE_URL=sqlite:///./servicedesk.db

# Optional: Debug mode
DEBUG=false
```

---

## 📡 API Overview

The backend exposes a clean RESTful API:

- `POST /api/v1/tickets` — Create a new ticket (triggers async AI analysis)
- `GET /api/v1/tickets` — Retrieve a list of tickets (supports filtering & pagination)
- `GET /api/v1/tickets/{id}` — Retrieve a specific ticket
- `POST /api/v1/tickets/{id}/analyze` — Manually trigger synchronous AI analysis
- `PATCH /api/v1/tickets/{id}/status` — Update ticket status
- `GET /api/v1/analytics` — Fetch aggregated metrics for the dashboard

---

## 🧠 Engineering Highlights

- **Structured AI Outputs**: Instead of parsing unstructured text using regex, the system enforces strict JSON output from the LLM, passing it through Pydantic validators to ensure type safety.
- **Fallback Model Handling**: The AI service gracefully falls back to secondary models (e.g., from `gemini-2.5-flash` to `gemini-2.5-pro`) if the primary model experiences high load (503) or unavailability (404).
- **Background Processing**: AI analysis can take several seconds. The `POST /tickets` endpoint delegates this to a FastAPI `BackgroundTasks` worker, allowing the API to return a `201 Created` instantly.
- **Separation of Concerns**: All AI logic is isolated in `ai_service.py`, making it incredibly easy to swap out the underlying LLM provider (e.g., to OpenAI or Anthropic) without touching the route handlers or business logic.
- **Resilient Parsing**: Custom serialization logic handles unexpected edge cases from the LLM (e.g., gracefully joining lists into strings if the AI deviates from the schema).

---

## 🚧 Future Improvements

- **Semantic Search using Embeddings**: Replace Jaccard similarity with vector embeddings (e.g., using pgvector) to identify similar tickets based on contextual meaning rather than raw token overlap.
- **SLA Prediction**: Train a smaller model to predict resolution times based on historical ticket completion data.
- **Auto-Ticket Routing**: Automatically assign tickets to specific engineer groups based on the AI-determined category.
- **Multi-Tenant Support**: Extend the database schema to support multiple organizations in a single instance.

---

## 👨‍💻 Author

**Gourav Mittal**  
*AI / Full Stack Developer*  
[GitHub Profile](https://github.com/gouravmit)

---

## ⭐ Call to Action

If you found this project interesting or helpful, please consider giving it a **star** ⭐️! It helps others discover the repository.
