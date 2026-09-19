from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class CurrentPatientInfo(BaseModel):
    tokenId: Optional[str] = None
    tokenNumber: Optional[str] = None
    consultationStartedAt: Optional[str] = None
    elapsedMinutes: Optional[float] = 0.0

class WaitingPatientInfo(BaseModel):
    tokenId: str
    tokenNumber: str
    tokenType: str # ONLINE, PAPER, EMERGENCY
    queuePosition: int
    priority: Optional[int] = 0
    status: Optional[str] = "WAITING"
    joinedAt: Optional[str] = None

class DelayInfo(BaseModel):
    delayMinutes: float
    reason: Optional[str] = None
    reportedAt: Optional[str] = None

class QueueContextRequest(BaseModel):
    hospitalId: str
    opdId: str
    doctorId: str
    sessionId: Optional[str] = None
    currentTime: str
    currentPatient: Optional[CurrentPatientInfo] = None
    waitingPatients: List[WaitingPatientInfo] = []
    emergencyPatients: List[WaitingPatientInfo] = []
    recentConsultations: List[float] = [] # list of durations in minutes (e.g. [7.5, 9.0, 8.2])
    averageConsultationDuration: float = 8.0
    doctorAvailability: Dict[str, Any] = Field(default_factory=dict)
    delays: List[DelayInfo] = []
    targetToken: Optional[WaitingPatientInfo] = None

class PredictionResponse(BaseModel):
    success: bool = True
    predictedWaitMinutes: int
    estimatedConsultationTime: str
    predictionSource: str # "AI" or "FALLBACK"
    confidence: float
    modelVersion: str
    factors: Dict[str, Any] = Field(default_factory=dict)
