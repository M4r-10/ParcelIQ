# 🏛 ParcelIQ

**Spatial Property Risk & Financial Intelligence Engine**

ParcelIQ reduces closing friction and improves underwriting by surfacing spatial risks (flood, wildfire, seismic) and legal risks (easement, survey discrepancies, ownership volatility) before underwriting begins. It then uses live financial market data and high-speed LLMs to forecast the real-world financial impact of these risks.

## 🎯 What It Does

| Input | Output |
|-------|--------|
| 📍 Property address | AI-generated Overall Risk Score (0-100) & Risk Tier |
| | Interactive 3D spatial risk visualization (Wildfire, Flood, Earthquake) |
| | Real-time Zillow market & rental data |
| | Ground-truth County Assessor data |
| | CV-estimated lot coverage vs recorded area discrepancies |
| | AI-powered 3-year/5-year financial forecast & mitigation strategies |
| | Downloadable markdown Underwriting Report |

## 🏗 Architecture

```text
┌──────────────┐     ┌────────────────────────────────────┐
│   Frontend   │────▶│         Flask Backend API          │
│  React +     │     │                                    │
│  Mapbox GL   │     │  ┌──────────────────────────────┐  │
│  3D Viewer   │◀────│  │ Risk Scoring ML Ensemble     │  │
│              │     │  └──────────────────────────────┘  │
│  Tailwind    │     │  ┌──────────────────────────────┐  │
│  Animations  │     │  │ AI Summary & Finance (Groq)  │  │
│              │     │  └──────────────────────────────┘  │
│  Markdown    │     │  ┌──────────────────────────────┐  │
│  Reports     │     │  │ Spatial Data (NIFC, FEMA)    │  │
│              │     │  └──────────────────────────────┘  │
└──────────────┘     │  ┌──────────────────────────────┐  │
                     │  │ Property APIs (HasData,      │  │
                     │  │ Melissa Data)                │  │
                     │  └──────────────────────────────┘  │
                     └────────────────────────────────────┘
```

## 📊 Risk Scoring Factors & Weights

TitleGuard calculates Risk Score using an ensemble machine learning approach (Gradient Boosting, Logistic Regression, Neural Networks) and a traditional weighted method. Unifying features include:

- **Flood Risk Analysis** (20%) - FEMA NFIP claims
- **Wildfire Risk Analysis** (15%) - NIFC historical burn perimeters
- **Seismic Risk Analysis** (15%) - USGS >4.5M earthquakes
- **Easement Encroachment** (15%) - Building setback proximity to parcel boundary
- **Lot Coverage** (15%) - Building footprint vs zoning max
- **Ownership Volatility** (10%) - Title transfer frequency (Melissa Assessor Data)
- **Survey Discrepancy** (5%) - Computer Vision segmentation vs recorded area
- **Property Age** (5%) - Year built (Melissa Assessor Data)

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+

### Manual Setup

1. **Clone the repository and set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env and enter your API keys
   ```

2. **Backend:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python app.py
   # API runs on http://localhost:5001
   ```

3. **Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   # App runs on http://localhost:5173
   ```

## 🔑 Required API Keys (.env)

| Service | Purpose |
|---------|---------|
| **Groq / OpenAI** | High-speed LLM risk summaries & financial forecasting |
| **Mapbox** | 3D map rendering & address geocoding |
| **Melissa Data** | County assessor property records (Age, Size, Ownership) |
| **HasData** | Live Zillow property valuation & rental estimates |

> **Note:** The app implements smart fallbacks. If HasData or Melissa keys are missing/exhausted, it will automatically serve deterministic mock data to ensure the UI continues functioning beautifully.

## 🎬 Demo Flow

1. Enter a high-risk property address (e.g., `21231 Avenida Planicie, Lake Forest, CA 92630` for Wildfires, or `141 Old Field Ln, Milford, CT 06460` for Floods).
2. The 3D map animates to the property.
3. Toggle **Risk Layers** (Wildfire, Flood, Earthquake) to visualize the hazards.
4. The **Risk Factors** panel breaks down the exact scores for 8 different geographic and legal metrics.
5. The **AI Summary** intelligently forecasts the 3-year/5-year financial impact of these hazards and generates mitigation strategies based on Live Zillow data.
6. Click **Export Report** to download the analysis as a formatted Markdown underwriter document.

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React, Vite, Mapbox GL JS, Tailwind CSS, Framer Motion, Lucide React |
| **Backend** | Python, Flask, Flask-CORS, Requests |
| **AI / ML** | Groq (Llama 3.3 70B), scikit-learn, LightGBM, SHAP |
| **Spatial / APIs** | FEMA, USGS, NIFC (Wildfire), HasData (Zillow), Melissa Data (Assessor) |

