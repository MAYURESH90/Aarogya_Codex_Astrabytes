const axios = require('axios');
const env = require('../config/env');

class PredictionService {
  /**
   * Request dynamic ETA from FastAPI Prediction Engine with robust fallback
   */
  static async getWaitTimePrediction(queueContext) {
    const {
      averageConsultationDuration = 8,
      currentPatient = null,
      waitingPatients = [],
      emergencyPatients = [],
      delays = [],
      recentConsultations = [],
      targetToken = null
    } = queueContext;

    try {
      const payload = {
        hospitalId: String(queueContext.hospitalId || ''),
        opdId: String(queueContext.opdId || ''),
        doctorId: String(queueContext.doctorId || ''),
        sessionId: String(queueContext.sessionId || ''),
        currentTime: new Date().toISOString(),
        currentPatient: currentPatient ? {
          tokenId: String(currentPatient._id || currentPatient.tokenId),
          tokenNumber: currentPatient.tokenNumber,
          consultationStartedAt: currentPatient.consultationStartedAt ? currentPatient.consultationStartedAt.toISOString() : new Date().toISOString(),
          elapsedMinutes: currentPatient.consultationStartedAt ? (Date.now() - new Date(currentPatient.consultationStartedAt).getTime()) / 60000 : 0
        } : null,
        waitingPatients: waitingPatients.map(t => ({
          tokenId: String(t._id || t.tokenId),
          tokenNumber: t.tokenNumber,
          tokenType: t.tokenType,
          queuePosition: t.queuePosition,
          priority: t.priority || 0,
          status: t.status,
          joinedAt: t.joinedAt ? new Date(t.joinedAt).toISOString() : new Date().toISOString()
        })),
        emergencyPatients: emergencyPatients.map(t => ({
          tokenId: String(t._id || t.tokenId),
          tokenNumber: t.tokenNumber,
          tokenType: t.tokenType,
          queuePosition: t.queuePosition,
          priority: t.priority || 2,
          status: t.status,
          joinedAt: t.joinedAt ? new Date(t.joinedAt).toISOString() : new Date().toISOString()
        })),
        recentConsultations: recentConsultations || [],
        averageConsultationDuration: Number(averageConsultationDuration) || 8,
        doctorAvailability: queueContext.doctorAvailability || {},
        delays: delays.map(d => ({
          delayMinutes: Number(d.delayMinutes || 0),
          reason: d.reason || '',
          reportedAt: d.reportedAt ? new Date(d.reportedAt).toISOString() : new Date().toISOString()
        })),
        targetToken: targetToken ? {
          tokenId: String(targetToken._id || targetToken.tokenId),
          tokenNumber: targetToken.tokenNumber,
          tokenType: targetToken.tokenType,
          queuePosition: targetToken.queuePosition,
          priority: targetToken.priority || 0,
          status: targetToken.status,
          joinedAt: targetToken.joinedAt ? new Date(targetToken.joinedAt).toISOString() : new Date().toISOString()
        } : null
      };

      const response = await axios.post(`${env.PREDICTION_SERVICE_URL}/predict`, payload, {
        timeout: 2500 // Fast timeout for responsiveness
      });

      if (response.data && response.data.success) {
        return {
          predictedWaitMinutes: response.data.predictedWaitMinutes,
          estimatedConsultationTime: new Date(response.data.estimatedConsultationTime),
          predictionSource: response.data.predictionSource, // 'AI' or 'FALLBACK'
          confidence: response.data.confidence,
          predictionTimestamp: new Date(),
          factors: response.data.factors || {}
        };
      }
    } catch (err) {
      // FastAPI unreachable or timed out -> use deterministic fallback
      console.warn(`[PredictionService] FastAPI prediction call failed (${err.message}). Using deterministic fallback algorithm.`);
    }

    // Deterministic Fallback Algorithm (Adheres to Rule 9, 13 & 29)
    return this._calculateFallbackPrediction(queueContext);
  }

  /**
   * Deterministic mathematical fallback queue simulation
   */
  static _calculateFallbackPrediction(queueContext) {
    const avgDuration = Number(queueContext.averageConsultationDuration) || 8;
    const currentPatient = queueContext.currentPatient;
    const waitingPatients = queueContext.waitingPatients || [];
    const emergencyPatients = queueContext.emergencyPatients || [];
    const delays = queueContext.delays || [];
    const targetToken = queueContext.targetToken;

    // Remaining duration on current ongoing consultation
    let currentRemaining = 0;
    if (currentPatient && currentPatient.consultationStartedAt) {
      const elapsed = (Date.now() - new Date(currentPatient.consultationStartedAt).getTime()) / 60000;
      if (elapsed < avgDuration) {
        currentRemaining = avgDuration - elapsed;
      } else {
        currentRemaining = 2; // buffer wrap-up
      }
    }

    // Count waiting patients ahead of target token
    const targetPos = targetToken ? targetToken.queuePosition : waitingPatients.length + 1;
    let patientsAhead = 0;
    for (const p of waitingPatients) {
      if (targetToken && String(p._id || p.tokenId) === String(targetToken._id || targetToken.tokenId)) {
        continue;
      }
      if (p.queuePosition < targetPos) {
        patientsAhead++;
      }
    }

    // Emergencies ahead
    const emergencyAhead = emergencyPatients.length;

    // Active operational delays
    const totalDelay = delays.reduce((acc, d) => acc + Number(d.delayMinutes || 0), 0);

    const calcWait = currentRemaining + (patientsAhead * avgDuration) + (emergencyAhead * avgDuration) + totalDelay;
    const predictedWaitMinutes = Math.max(0, Math.round(calcWait));
    const estimatedConsultationTime = new Date(Date.now() + (predictedWaitMinutes * 60000));

    return {
      predictedWaitMinutes,
      estimatedConsultationTime,
      predictionSource: 'FALLBACK',
      confidence: Math.max(0.50, +(0.85 - (patientsAhead * 0.015)).toFixed(2)),
      predictionTimestamp: new Date(),
      factors: {
        patientsAhead,
        emergencyAhead,
        currentConsultationRemainingMinutes: +currentRemaining.toFixed(1),
        operationalDelayMinutes: totalDelay,
        effectiveDuration: avgDuration,
        source: 'DETERMINISTIC_FALLBACK'
      }
    };
  }
}

module.exports = PredictionService;
