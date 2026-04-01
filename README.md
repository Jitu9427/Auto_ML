# ML-Automator: Advanced Feature Engineering & Modeling Suite 🚀

**ML-Automator** is a high-performance, iterative Machine Learning platform designed to bridge the gap between raw data and production-ready models. Engineered with a **Sequential Feature Engineering Workstation**, it allows for granular, column-targeted data transformations with a professional staging and commitment workflow.

---

## 💎 Core Innovation: The Workstation

Unlike standard "AutoML" tools that apply opaque "black-box" cleaning, **ML-Automator** puts you in the driver's seat with a professional iterative workflow:

### 1. Sequential Column-Targeting 🎯
Select specific subsets of columns and apply isolated mathematical transformations (Scaling, Imputation, Encoding, Outlier handling) without affecting the rest of your dataset.

### 2. The Staging Timeline 📝
Transformations are staged in a **real-time buffer**. You can chain algorithms chronologically and preview exactly how they mutate your data matrices before making any permanent changes.

### 3. Persistent Workspace & Data Lineage 💾
Your uploaded datasets, Data Analysis (EDA) visualizations, and Machine Learning runs are automatically hydrated onto a persistent local database and file storage engine. 

### 4. Interactive Data Analysis (EDA) 🔍
Explore datasets instantly with dynamic Data Summaries, Missing Value trackers, and a comprehensive suite of charting tools (Histograms, Boxplots, Scatterplots) powered by Seaborn and Matplotlib.

---

## 📁 Project Architecture

A clean, modern containerized approach separates backend performance from frontend rendering:

```text
.
├── backend/              # FastAPI High-Performance Engine (Python 3.11)
│   ├── api/              # API Route Definitions (Projects, Preprocessing, EDA)
│   ├── data/             # Persistent File Storage for Data lineage
│   ├── ml/               # Scikit-Learn Pipeline Logic & Custom Transformers
│   ├── main.py           # Uvicorn entry point
│   ├── models.py         # SQLAlchemy Database models
│   └── Dockerfile        # Backend container definition
├── frontend/             # React + Vite Professional UI
│   ├── src/
│   │   ├── components/   # Modular Workstations (EDA, Preprocessing, Training)
│   │   ├── App.jsx       # Global State Orchestrator
│   │   └── index.css     # Bespoke Design System (Vibrant & Dark Modes)
│   ├── Dockerfile        # Nginx distribution container
│   └── package.json      # Node.js ecosystem
└── docker-compose.yml    # Master orchestrator for the platform
```

## 🚀 Setup & Execution

ML-Automator utilizes Docker to eliminate complex dependency hurdles.

### Prerequisites
- [Docker](https://www.docker.com/products/docker-desktop/) 
- [Docker Compose](https://docs.docker.com/compose/install/)

### Running the App
1. Clone this repository and ensure Docker is running.
2. Initialize and run the multi-container setup:
   ```bash
   docker compose up -d --build
   ```
3. Access the platform iteratively:
   - **Frontend UI**: `http://localhost:8080`
   - **Backend API Docs**: `http://localhost:8000/docs`

---
*Built for precision feature engineering and scalable model discovery.*
