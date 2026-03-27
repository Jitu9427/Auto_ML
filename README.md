# ML-Automator: Advanced Feature Engineering & Modeling Suite 🚀

**ML-Automator** is a high-performance, iterative Machine Learning platform designed to bridge the gap between raw data and production-ready models. Engineered with a **Sequential Feature Engineering Workstation**, it allows for granular, column-targeted data transformations with a professional staging and commitment workflow.

[![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%20(Vite)-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org/)
[![Scikit-Learn](https://img.shields.io/badge/ML-Scikit--Learn-F7931E?style=flat-square&logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
[![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)

---

## 💎 Core Innovation: The V13 Workstation

Unlike standard "AutoML" tools that apply opaque "black-box" cleaning, **ML-Automator** puts you in the driver's seat with a professional iterative workflow:

### 1. Sequential Column-Targeting 🎯
Select specific subsets of columns (e.g., `Age` and `Income`) and apply isolated mathematical transformations (Scaling, Imputation, Encoding) without affecting the rest of your dataset.

### 2. The Staging Timeline 📝
Transformations are staged in a **real-time buffer**. You can chain 10+ algorithms chronologically and preview exactly how they mutate your data matrices before making any permanent changes.

### 3. Visual Before/After Snapshots 🔍
Every staged change generates an instant **Verification Matrix**, comparing 5-row snapshots of your data before and after the execution, ensuring mathematical correctness at every step.

### 4. Locked Pipeline History ✅
Once committed, your transformations are woven into a **Locked History Dashboard**. This interactive log preserves the visual state of every past transformation for auditing and reproducibility.

---

## ✨ Key Features

- **Automated Data Analysis (EDA)**: Beautiful Seaborn/Matplotlib visualizations with smart graph suggestions based on column cardinality.
- **Model Training Suite**: Concurrent training of Classification, Regression, and Clustering models with dynamic hyperparameter injection.
- **Unified Orchestration**: A single-command execution model that handles both the High-Performance FastAPI backend and the Vite-React frontend.
- **Premium UX**: A sleek, high-contrast dashboard with glassmorphic elements and ultra-responsive data tables.

## 📁 Project Architecture

```text
.
├── backend/              # FastAPI High-Performance Engine
│   ├── api/              # Granular API Route Definitions (V1/V2)
│   ├── ml/               # Scikit-Learn Pipeline Logic & Custom Transformers
│   ├── main.py           # Uvicorn entry point
│   └── requirements.txt  # Python Data Science dependencies
├── frontend/             # React + Vite Professional UI
│   ├── src/
│   │   ├── components/   # Modular Workstations (EDA, Preprocessing, Training)
│   │   ├── App.jsx       # State Orchestrator
│   │   └── index.css     # Bespoke Design System (Vibrant & Dark Modes)
│   └── package.json      # Node.js ecosystem
├── run.py                # Unified Process Multiplexer (One-Click Start)
└── start.bat             # Windows Desktop Launch Shortcut
```

## 🚀 One-Command Setup

The project is optimized for speed. You no longer need to manage multiple terminals.

### Prerequisites
- Python 3.9+
- Node.js 18+

### Instant Launch
1. Ensure your dependencies are installed (`pip install -r backend/requirements.txt` and `npm install` in frontend).
2. Run the unified launcher:
   ```cmd
   python run.py
   ```
3. Open `http://localhost:5173` in your browser.

---
*Built for precision feature engineering and scalable model discovery.*
