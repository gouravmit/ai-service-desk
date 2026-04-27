# 🤖 AI Service Desk

<div align="center">

![AI Service Desk Banner](https://img.shields.io/badge/AI%20Service%20Desk-Enterprise%20Grade-6366f1?style=for-the-badge&logo=robot&logoColor=white)

**An enterprise-grade, AI-powered IT support ticketing system**  
Built with FastAPI · React · Google Gemini · SQLite/PostgreSQL

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Gemini](https://img.shields.io/badge/Google%20Gemini-1.5%20Flash-4285F4?style=flat-square&logo=google)](https://ai.google.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

</div>

---

## 🎥 Demo

> *Screenshot / GIF placeholder — replace with your own recording*

| Ticket Creation | AI Analysis | Analytics |
|:-:|:-:|:-:|
| ![create]() | ![analyze]() | ![analytics]() |

---

## 🚀 Project Overview

AI Service Desk is a production-ready internal IT support system that leverages **Google Gemini 1.5 Flash** to automatically classify, prioritize, and resolve support tickets. It mirrors real enterprise IT workflows — from ticket submission to AI-driven triage — all behind a sleek glassmorphism UI.

This is not a demo. Every component is production-quality:
- **Background AI analysis** runs immediately on ticket creation
- **Structured Gemini output** enforced via strict JSON prompting
- **Similar ticket detection** using Jaccard similarity
- **Suggested IT reply generation** for professional comms
- **Confidence scoring** on every AI analysis
- **Analytics dashboard** for operational visibility

---

## ✨ Features

### 🎫 Ticket Management
- Create tickets with title, description, and optional tags
- Filter by status: `OPEN` · `IN_PROGRESS` · `RESOLVED`
- Update status inline
- Soft delete

### 🧠 AI-Powered Analysis (Gemini 1.5 Flash)
| Field | Description |
|---|---|
| **Category** | `bug` · `infrastructure` · `access` · `other` |
| **Priority** | `low` · `medium` · `high` |
| **Root Cause** | Concise technical root cause analysis |
| **Resolution** | Step-by-step fix instructions |
| **Confidence** | 0–100% AI confidence score |

### ⚡ Elite AI Enhancements
- **Auto-Analysis** — every new ticket analyzed in background via FastAPI `BackgroundTasks`
- **Suggested Reply Generator** — professional email drafted for the support agent
- **Similar Ticket Detection** — Jaccard similarity across all existing tickets
- **Model Fallback** — auto-falls back to `gemini-1.5-pro-latest` if Flash fails

### 📊 Analytics Dashboard
- Total ticket count
- Breakdown by status, category, priority
- Average AI confidence across all analyzed tickets

---

## 🧠 Architecture

```mermaid
graph TD
    Browser["🌐 React Frontend\n(Vite + TypeScript)"]

    subgraph Backend["⚙️ FastAPI Backend"]
        API["Routes\n/api/v1/..."]
        BG["Background Tasks\n(Auto Analysis)"]
        AI["AI Service\n(ai_service.py)"]
        DB_Layer["SQLAlchemy ORM"]
    end

    subgraph AI_Layer["🤖 AI Layer"]
        G1["Gemini 1.5 Flash\n(Primary)"]
        G2["Gemini 1.5 Pro\n(Fallback)"]
    end

    subgraph Data["💾 Data Layer"]
        SQLite["SQLite\n(dev default)"]
        PG["PostgreSQL\n(production)"]
    end

    Browser -->|HTTP REST| API
    API --> BG
    API --> DB_Layer
    BG --> AI
    AI -->|Ticket Analysis| G1
    AI -->|Fallback| G2
    AI -->|Reply Generation| G1
    AI -->|Similarity Detection| DB_Layer
    DB_Layer --> SQLite
    DB_Layer --> PG
```

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18 + Vite + TypeScript | SPA with type safety |
| **Styling** | Pure CSS (Glassmorphism) | Dark theme, animations |
| **Backend** | FastAPI 0.115 | Async REST API |
| **AI** | Google Gemini 1.5 Flash/Pro | Ticket analysis & NLP |
| **ORM** | SQLAlchemy 2.0 | Database abstraction |
| **DB (dev)** | SQLite (WAL mode) | Zero-config local dev |
| **DB (prod)** | PostgreSQL | Production workloads |
| **Config** | pydantic-settings + `.env` | Secure config management |
| **Fonts** | Syne + Space Mono + DM Sans | Distinctive typography |

---

## 🔐 Security

- **API key never exposed** — all Gemini calls are server-side only
- **`.env` excluded** from version control via `.gitignore`
- **No key logging** — structured logging filters sensitive fields
- **CORS configured** — only whitelisted origins accepted
- **Input validation** — Pydantic schemas validate all request payloads
- **Error sanitization** — internal errors never leak to client responses

---

## ⚡ Run Locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- Google Gemini API key → [Get one free at AI Studio](https://aistudio.google.com)

### 1. Clone the repo
```bash
git clone https://github.com/yourusername/ai-service-desk.git
cd ai-service-desk
```

### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Start the API server
uvicorn app.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/api/docs

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start dev server (proxies /api → localhost:8000)
npm run dev
```

App available at: http://localhost:5173

### 4. Production (PostgreSQL)
```bash
# In .env, change:
DATABASE_URL=postgresql://user:password@localhost:5432/servicedesk

# Run migrations (auto-handled by SQLAlchemy on startup)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/tickets` | Create a new ticket |
| `GET` | `/api/v1/tickets` | List all tickets (with filters) |
| `GET` | `/api/v1/tickets/{id}` | Get single ticket |
| `POST` | `/api/v1/tickets/{id}/analyze` | Run AI analysis |
| `PATCH` | `/api/v1/tickets/{id}/status` | Update ticket status |
| `DELETE` | `/api/v1/tickets/{id}` | Delete a ticket |
| `GET` | `/api/v1/analytics` | Get aggregated analytics |
| `GET` | `/health` | Health check |

Full interactive docs: `http://localhost:8000/api/docs`

---

## 📁 Project Structure

```
ai-service-desk/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app factory & lifespan
│   │   ├── config.py        # Pydantic settings (env-based)
│   │   ├── database.py      # SQLAlchemy engine & session
│   │   ├── models.py        # ORM models
│   │   ├── schemas.py       # Pydantic request/response schemas
│   │   ├── routes.py        # All API endpoints
│   │   └── ai_service.py    # Gemini integration & NLP utils
│   ├── .env.example
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.tsx           # Main application component
    │   ├── App.css           # Global styles
    │   ├── main.tsx          # React entry point
    │   ├── types/index.ts    # TypeScript interfaces
    │   ├── utils/api.ts      # API client
    │   └── hooks/useToast.ts # Toast notification hook
    ├── index.html
    ├── vite.config.ts
    └── package.json
```

---

## 👨‍💻 Author

**Your Name**  
Full Stack Engineer · AI Systems Architect

[![GitHub](https://img.shields.io/badge/GitHub-@yourusername-181717?style=flat-square&logo=github)](https://github.com/yourusername)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=flat-square&logo=linkedin)](https://linkedin.com/in/yourprofile)
[![Portfolio](https://img.shields.io/badge/Portfolio-yoursite.dev-6366f1?style=flat-square)](https://yoursite.dev)

---

## 📄 License

MIT © 2024 Your Name

---

<div align="center">
  <sub>Built with 🧠 + ☕ — Enterprise-grade AI tooling for real teams</sub>
</div>
