# Aarogya Frontend Integration Guide

This document outlines the API formats required by the frontend application for the newly integrated Live Queue, Unique Tokens, and ETA flows.

## 1. Online Token Booking

**Endpoint:** `POST /api/tokens/online`  
**Headers:** `Authorization: Bearer <token>`  

**Request Body (Example):**
```json
{
  "hospitalId": "65b...",
  "opdId": "65b...",
  "consultationType": "GENERAL",
  "patientName": "John Doe",
  "patientPhone": "+919999999999",
  "sessionId": "65b..."
}
```
*(Note: If the user is authenticated, `patientPhone` and `patientName` provided here will be overridden securely by the backend using the verified user record.)*

**Response:**
```json
{
  "success": true,
  "token": {
    "id": "65b...",
    "tokenNumber": "ARO-001",
    "tokenType": "ONLINE",
    "queuePosition": 4,
    "status": "WAITING"
  },
  "prediction": {
    "predictedWaitMinutes": 25,
    "estimatedConsultationTime": "2026-09-23T14:30:00Z",
    "predictionTimestamp": "2026-09-23T14:05:00Z",
    "predictionSource": "AI",
    "confidence": 0.89,
    "factors": {}
  }
}
```

## 2. Live Patient Tracker Status

**Endpoint:** `GET /api/tokens/:tokenId/status`

**Response:**
```json
{
  "success": true,
  "data": {
    "tokenId": "65b...",
    "sessionId": "65b...",
    "tokenNumber": "ARO-001",
    "tokenType": "ONLINE",
    "queuePosition": 4,
    "peopleAhead": 3,
    "status": "WAITING",
    "predictedWaitMinutes": 25,
    "estimatedConsultationTime": "2026-09-23T14:30:00Z",
    "predictionSource": "AI",
    "confidence": 0.89,
    "opdName": "General Medicine",
    "doctorName": "Dr. Smith",
    "roomNumber": "101",
    "hospitalName": "City Hospital"
  }
}
```

## 3. Explicit ETA Refresh

**Endpoint:** `GET /api/tokens/:tokenId/eta`

**Response:**
```json
{
  "success": true,
  "data": {
    "predictedWaitMinutes": 18,
    "estimatedConsultationTime": "2026-09-23T14:23:00Z",
    "predictionSource": "AI",
    "confidence": 0.90
  }
}
```

## 4. Live OPD Unified Queue

**Endpoint:** `GET /api/queue/:sessionId/live`

**Response:**
```json
{
  "success": true,
  "data": {
    "session": { /* session details */ },
    "currentConsultation": {
      "id": "65b...",
      "tokenNumber": "ARO-021",
      "tokenType": "ONLINE",
      "patientName": "Jane Doe",
      "consultationStartedAt": "2026-09-23T13:50:00Z",
      "elapsedMinutes": 15
    },
    "unifiedQueue": [
      {
        "id": "65b...",
        "tokenNumber": "ARO-022",
        "tokenType": "PAPER",
        "queuePosition": 1,
        "priority": 0,
        "status": "WAITING",
        "predictedWaitMinutes": 10
      },
      {
        "id": "65c...",
        "tokenNumber": "E001",
        "tokenType": "EMERGENCY",
        "queuePosition": 2,
        "priority": 2,
        "status": "WAITING",
        "predictedWaitMinutes": 18
      }
    ],
    "completedCount": 5
  }
}
```
