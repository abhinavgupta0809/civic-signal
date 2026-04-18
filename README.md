# CivicSignal

CivicSignal is an AI-powered credibility analysis tool that helps users evaluate news articles by extracting factual claims, scoring credibility, and surfacing explainable reasoning — with special focus on election-related misinformation.

---

## 🎯 Problem

Today’s information ecosystem is broken.

Users constantly encounter:
- Misinformation and unverified claims  
- Emotionally manipulative content  
- Conflicting narratives across sources  

Verifying information manually is slow, difficult, and unrealistic for most people.

---

## 💡 Solution

CivicSignal acts as a **real-time credibility assistant**.

Users paste any article, and the system:
- Extracts key factual claims  
- Evaluates credibility using structured reasoning  
- Assigns a confidence score (0–100)  
- Explains *why* the score was given  
- Flags election-related content for extra caution  

---

## 🧠 Claude as the Core Intelligence Layer (40% Judging Criteria)

Claude is not just used as an API — it is the **central reasoning engine** of CivicSignal.

We designed the system to leverage Claude for **structured thinking, not just text generation**.

---

### 1. Claim Extraction (Understanding the Article)

Claude converts raw, unstructured text into structured data by extracting **3–5 verifiable claims**.

It filters:
- Checkable facts  
- Statements about events, policies, or statistics  
- Claims that can be independently validated  

This step transforms messy content into something the system can reason about.

---

### 2. Structured Credibility Scoring (Reasoning, Not Guessing)

Claude evaluates the article across four explicit signals:

- **Source credibility**  
- **Claim corroboration**  
- **Fact-check alignment**  
- **Manipulative language detection**  

It returns a structured JSON output:

```json
{
  "score": 42,
  "verdict": "Mixed Evidence",
  "summary": "The article contains several claims without strong corroboration and uses emotionally loaded language.",
  "signals": {
    "source_credibility": 10,
    "claim_corroboration": 12,
    "fact_check_match": 8,
    "manipulation_language": 12
  }
}
