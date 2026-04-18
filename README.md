# CivicSignal

CivicSignal is an AI-powered credibility analysis tool that helps users evaluate news articles by extracting factual claims, scoring credibility, and surfacing explainable reasoning — with a special focus on election-related misinformation.

---

## ⚠️ Important Hackathon Disclaimer
The web application represents the fully committed and submitted codebase.
The Chrome extension was built after the official submission deadline as an additional interface layer.

To ensure fairness:

We did not push the extension code to this repository after the deadline
Instead, we have provided a screen recording demonstrating the extension functionality

The extension uses the same backend and Claude-powered analysis pipeline, ensuring consistency with the submitted system.

---

## 🎯 Problem

Today’s information ecosystem is increasingly difficult to navigate.

Users constantly encounter:
- Misinformation and unverified claims  
- Emotionally manipulative content  
- Conflicting narratives across sources  

Verifying information manually is slow, difficult, and unrealistic for most people.

---

## 💡 Solution

CivicSignal acts as a **real-time credibility assistant**.

### 🌐 Web Application

Users can paste any article, and the system:
- Extracts key factual claims  
- Evaluates credibility using structured reasoning  
- Assigns a confidence score (0–100)  
- Explains *why* the score was given  
- Flags election-related content  

---

### 🧩 Chrome Extension (Local MVP)

Users can:
- Open any article on the web  
- Click the CivicSignal extension  
- Instantly analyze the page  

The extension:
- Extracts article content directly from the webpage  
- Sends it to the backend  
- Displays score, claims, and reasoning in a popup UI  

---

## 🧠 Claude as the Core Intelligence Layer

Claude is not just used as an API — it is the **central reasoning engine** of CivicSignal.

We designed the system to leverage Claude for **structured reasoning, explainability, and decision-making**, not just text generation.

---

### 1. Claim Extraction

Claude converts raw article text into structured data by extracting **3–5 verifiable claims**.

It focuses on:
- Checkable facts  
- Statements about events, policies, or statistics  

---

### 2. Structured Credibility Scoring

Claude evaluates the article across four signals:

- **Source credibility**  
- **Claim corroboration**  
- **Fact-check alignment**  
- **Manipulative language detection**  

Example output:

```json
{
  "score": 42,
  "verdict": "Mixed Evidence",
  "summary": "The article contains multiple claims with limited corroboration and emotionally loaded language.",
  "signals": {
    "source_credibility": 10,
    "claim_corroboration": 12,
    "fact_check_match": 8,
    "manipulation_language": 12
  }
}
