from fastapi import APIRouter, HTTPException
from app.models.schemas import QueueContextRequest, PredictionResponse
from app.prediction.engine import prediction_engine

router = APIRouter(tags=["Prediction"])

@router.post("/predict", response_model=PredictionResponse)
def calculate_prediction(request: QueueContextRequest):
    try:
        predicted_wait, estimated_time, source, confidence, factors = prediction_engine.predict(request.model_dump())
        return PredictionResponse(
            success=True,
            predictedWaitMinutes=predicted_wait,
            estimatedConsultationTime=estimated_time,
            predictionSource=source,
            confidence=confidence,
            modelVersion=prediction_engine.model_version,
            factors=factors
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction calculation failed: {str(e)}")

@router.post("/reforecast")
def reforecast_queue(request: QueueContextRequest):
    """
    Reforecast wait times for all remaining waiting patients in the queue context.
    """
    try:
        results = []
        waiting_tokens = request.waitingPatients
        for token in waiting_tokens:
            req_dict = request.model_dump()
            req_dict["targetToken"] = token.model_dump()
            predicted_wait, estimated_time, source, confidence, factors = prediction_engine.predict(req_dict)
            results.append({
                "tokenId": token.tokenId,
                "tokenNumber": token.tokenNumber,
                "queuePosition": token.queuePosition,
                "predictedWaitMinutes": predicted_wait,
                "estimatedConsultationTime": estimated_time,
                "predictionSource": source,
                "confidence": confidence,
                "factors": factors
            })
        return {
            "success": True,
            "reforecastCount": len(results),
            "predictions": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Queue reforecasting failed: {str(e)}")
