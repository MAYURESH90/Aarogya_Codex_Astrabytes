from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.predict import router as predict_router

app = FastAPI(
    title="Aarogya Prediction Engine API",
    description="Dynamic ETA Prediction and Emergency Reforecasting Engine for Aarogya Adaptive OPD Queue System",
    version="1.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict_router, prefix="/api")

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "aarogya-prediction-engine",
        "version": "1.2.0",
        "timestamp": "active"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
