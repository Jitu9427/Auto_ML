# AutoML Platform 🚀

A scalable, professional, and automated Machine Learning training platform. Users can upload CSV datasets, select a target variable, and automatically train multiple ML models to compare their performance.

![Architecture Diagram](https://img.shields.io/badge/Architecture-FastAPI%20%2B%20React-blue)
![Python](https://img.shields.io/badge/Python-3.8%2B-green)
![Node](https://img.shields.io/badge/Node-16%2B-orange)

## ✨ Key Features

- **Drag & Drop Upload**: Seamlessly upload `.csv` files via a premium glassmorphic UI.
- **Auto-Preprocessing**: Automatic handling of missing values, numeric scaling, and categorical encoding.
- **Multi-Model Training**: Trains a suite of models including Random Forest, Logistic Regression, Gradient Boosting, and SVM.
- **Real-time Results**: Compare models based on Accuracy, F1-Score, or R2-Score with a beautiful dashboard.
- **Scalable Architecture**: Decoupled Frontend (Vite/React) and Backend (FastAPI).

## 📁 Project Structure

```text
.
├── backend/              # FastAPI Python Backend
│   ├── api/              # API Route definitions
│   ├── ml/               # Machine Learning pipeline and logic
│   ├── main.py           # Application entry point
│   └── requirements.txt  # Python dependencies
├── frontend/             # Vite + React Frontend
│   ├── src/
│   │   ├── components/   # UI components (Upload, Config, Results)
│   │   ├── App.jsx       # Main application logic
│   │   └── index.css     # Premium Vanilla CSS styling
│   └── package.json      # Node dependencies
└── .gitignore            # Git exclusion rules
```

## 🚀 Getting Started

### Prerequisites

- Python 3.8+
- Node.js 16+
- npm or yarn

### 1. Backend Setup

```bash
cd backend
python -m venv venv
# Windows
.\venv\Scripts\activate
# Linux/macOS
source venv/bin/activate

pip install fastapi uvicorn pandas scikit-learn python-multipart
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The application will be available at `http://localhost:5173`.

## 🛠️ Technology Stack

- **Frontend**: React, Vite, Vanilla CSS (Premium Custom Design)
- **Backend**: FastAPI, Python
- **ML/DS**: Pandas, Scikit-Learn, NumPy

## 📈 Future Roadmap

- [ ] Add support for Large Datasets via Celery/Redis background tasks.
- [ ] Implement user authentication and saved model history.
- [ ] Export trained models as `.pkl` or ONNX files.
- [ ] Support for JSON and Parquet data formats.

---
Created with ❤️ for Scalable ML Automation.
