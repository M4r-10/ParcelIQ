# 🏛 TitleGuard AI

**Spatial Property Risk Intelligence Engine**

TitleGuard AI reduces closing friction by surfacing spatial and legal risks before underwriting begins.

## 🎯 What It Does

| Input | Output |
|-------|--------|
| 📍 Property address | AI-generated Risk Score (0-100) |
| | Explainable risk breakdown |
| | CV-estimated lot coverage |
| | Interactive 3D spatial risk visualization |

## 🏗 Architecture

```
┌──────────────┐     ┌──────────────────────┐
│   Frontend   │────▶│   Flask Backend API  │
│  React +     │     │                      │
│  Mapbox GL   │     │  ┌────────────────┐  │
│  3D Viewer   │◀────│  │ Risk Scoring   │  │
└──────────────┘     │  │ Engine         │  │
                     │  └────────────────┘  │
                     │  ┌────────────────┐  │
                     │  │ CV Coverage    │  │
                     │  │ Estimation     │  │
                     │  └────────────────┘  │
                     │  ┌────────────────┐  │
                     │  │ AI Summary     │  │
                     │  │ (GPT-4)        │  │
                     │  └────────────────┘  │
                     │  ┌────────────────┐  │
                     │  │ Mock Data      │  │
                     │  │ Layer          │  │
                     │  └────────────────┘  │
                     └──────────────────────┘
```

## 📊 Risk Scoring Formula

```
Risk Score =
  (0.30 × Flood Risk) +
  (0.25 × Easement Impact) +
  (0.20 × Lot Coverage Risk) +
  (0.15 × Ownership Irregularity) +
  (0.10 × Property Age Risk)
```

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- Docker & Docker Compose (optional)

### Option 1: Docker Compose
```bash
# 1. Copy and configure environment variables
cp .env.example .env
# Edit .env with your API keys

# 2. Start both services
docker-compose up --build
```

### Option 2: Manual Setup

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python app.py
# API runs on http://localhost:5000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# App runs on http://localhost:3000
```

## 🔑 API Keys Needed

| Service | Purpose | Get it at |
|---------|---------|-----------|
| OpenAI | AI risk summaries | [platform.openai.com](https://platform.openai.com/api-keys) |
| Mapbox | 3D map & geocoding | [account.mapbox.com](https://account.mapbox.com/access-tokens/) |

> **Note:** The app works with mock data even without API keys configured.

## 📁 Project Structure

```
├── backend/
│   ├── app.py                 # Flask entry point & API routes
│   ├── config.py              # Environment config
│   ├── services/
│   │   ├── risk_scoring.py    # Weighted risk scoring engine
│   │   ├── cv_coverage.py     # CV lot coverage estimation
│   │   ├── ai_summary.py      # GPT-powered risk summaries
│   │   └── geocoding.py       # Address → coordinates
│   ├── data/
│   │   ├── mock_data.py       # Sample parcels, flood zones, etc.
│   │   └── sample_parcels/    # GeoJSON files
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Root layout component
│   │   ├── components/
│   │   │   ├── AddressSearch   # Property address input
│   │   │   ├── RiskDashboard   # Score display & breakdown
│   │   │   ├── SpatialViewer   # 3D map (Mapbox GL)
│   │   │   ├── LayerToggle     # Risk layer controls
│   │   │   └── AISummary       # AI explanation panel
│   │   └── services/
│   │       └── api.js          # Backend API client
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
├── docker-compose.yml
├── .env
└── README.md
```

## 🎬 Demo Flow

1. Enter property address
2. 3D parcel loads on map
3. Toggle **Flood Zone** → blue overlay appears
4. Toggle **Easement** → red strip cuts through lot
5. Building footprint highlights
6. Risk score animates upward
7. AI explanation appears with recommendations

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Mapbox GL JS, Vite |
| Backend | Flask, Flask-CORS |
| CV | OpenCV, NumPy |
| AI | OpenAI GPT-4 API |
| Data | GeoJSON, Shapely |
| DevOps | Docker, Docker Compose |

## 📝 TODO

Search the codebase for `# TODO` and `// TODO` to find all implementation stubs.

---

*TitleGuard AI — Infrastructure intelligence, not loan automation.*
