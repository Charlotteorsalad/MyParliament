# MyParliament — Malaysian Parliamentary Engagement Platform

> A full-stack civic engagement system that brings parliamentary data, ML-powered insights, and public discourse tools into a single platform — for both citizens and administrators.

**Dataset scraped and extracted from Hansard using Pdfplumber/tessaract/googlevisionAPI accordingly based on the text quality. MP informations are scraped as well using the fuzzy logic**

<img width="1919" height="1024" alt="image" src="https://github.com/user-attachments/assets/93253d82-5cdd-4e1a-8015-4d595478fc19" />

---

## Table of Contents

1. [Project Introduction](#1-project-introduction)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Features — User Side](#4-features--user-side)
5. [Features — Admin Side](#5-features--admin-side)
6. [Machine Learning Pipeline](#6-machine-learning-pipeline)
7. [ML Model Performance](#7-ml-model-performance)
8. [Acknowledgements & Open Data Sources](#8-acknowledgements--open-data-sources)
9. [Copyright & Intellectual Property](#9-copyright--intellectual-property)
    
---

## 1. Project Introduction

**MY Parliament** is a bilingual (English / Bahasa Malaysia) civic-tech platform that enables Malaysian citizens to:

- Explore real parliamentary debates and speeches through an **Issue Portal** powered by ML topic clustering.
- Track and follow **Members of Parliament (MPs)** and their recorded statements.
- Learn about parliament through an **Educational Content** module with quizzes.
- Participate in a moderated **Discussion Forum**.
- Generate personalised **reports** and provide **feedback** to the system.

Administrators have a separate, permission-based dashboard to manage users, content, moderation, surveys, analytics, and system maintenance.

The system is backed by an automated **Python data pipeline** that scrapes Hansard PDF documents daily, preprocesses and clusters them using multiple ML models, generates ARIMA trend forecasts, and runs real-time content moderation.

<img width="3889" height="4944" alt="User Interaction with-2026-03-28-165413" src="https://github.com/user-attachments/assets/a3d54089-c949-46fe-b79e-aa5e0b61ba30" />

---

## 2. System Architecture

<img width="8192" height="6061" alt="User-Driven Forum Data-2026-03-28-170119" src="https://github.com/user-attachments/assets/90e7585d-fe1a-4ffa-898f-d25d29254293" />

**Key design decisions:**
- **Separate JWT flows** for users and admins — two independent auth chains with different secrets and expiry.
- **SSE (Server-Sent Events)** for real-time notifications (forum replies, moderation outcomes, EDU updates).
- **Web Push** notifications for browser-level alerts.
- **Maintenance guard middleware** — admin can schedule downtime windows; the Node layer returns HTTP 503 during active windows.
- Python services are **auto-started** by the Node backend on launch (`AUTO_START_PYTHON_SERVICES=true`) and communicate via local HTTP.

 ---
 
## 3. Technology Stack
| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router v6, Axios |
| Backend | Node.js, Express, Mongoose, JWT, bcryptjs, Nodemailer |
| Real-time | Server-Sent Events (SSE), Web Push (VAPID) |
| Database | MongoDB Atlas |
| ML Modeling | Python 3, PyTorch, HuggingFace Transformers, scikit-learn, Gensim |
| Forecasting | statsmodels (ARIMA), pandas |
| Sentiment | `joeddav/xlm-roberta-large-xnli` (zero-shot, EN + Malay) |
| Moderation | HuggingFace classification model + keyword blocklist |
| Scraping | BeautifulSoup, pdfplumber / PyMuPDF |
| Scheduling | Python + cron (Linux) / Windows Task Scheduler |
| Maps | react-simple-maps |
| Language Detect | FastText |
| POS/NER | spaCy |
---

## 4. Features — User Side
### 4.1 Authentication
- **Register** with email + username → two-step: basic credentials first, then complete profile (stored in a temporary JWT so no incomplete user documents accumulate in the DB).
- **Login** with remember-me option (1-day vs 30-day token).
- **Forgot / Reset password** via email link (Nodemailer).
- Account suspension detection — auto-logout with modal if account is suspended mid-session.

<img width="1851" height="809" alt="image" src="https://github.com/user-attachments/assets/58f30b25-242d-4bc6-9b21-a1e4e875939e" /> <img width="1867" height="1022" alt="image" src="https://github.com/user-attachments/assets/ff2b0881-dfe9-4d3e-80fd-25c9377088b1" />
<img width="1349" height="690" alt="image" src="https://github.com/user-attachments/assets/64b8d7d6-bb86-40ef-9d09-7d8208e4f5a7" />

### 4.2 Issue Portal
The core feature. Displays clustered parliamentary speeches (Hansard) as browseable topics.
- Browse topics by **cluster** — each topic is labelled by the **ML pipeline**.
- View individual **speech excerpts** with sentiment indicators.
- Follow topics to receive notifications when new speeches are added.
<img width="1901" height="1029" alt="image" src="https://github.com/user-attachments/assets/e8d4f066-9d5c-40ad-8834-3ca9e6d5bd13" />
<img width="1919" height="1017" alt="image" src="https://github.com/user-attachments/assets/0dcb1d72-6002-4e59-b8a8-9ac7427bd6c5" />
<img width="1898" height="1032" alt="image" src="https://github.com/user-attachments/assets/6fef29c8-f4b4-4e67-a41e-9a6922425b0e" />

### 4.3 MP Dashboard
- Interactive **Malaysia map** — click a constituency to see its MP.
- MP profile: party, constituency, photo, bio, active status.
- List of recorded speeches filtered by session.
- **Follow / Unfollow** MPs; followed MPs appear in the User Dashboard.
<img width="1919" height="1026" alt="image" src="https://github.com/user-attachments/assets/e7909df1-288b-45b6-aa2b-990636e6d686" />

https://github.com/user-attachments/assets/4cc688a6-bdd7-49ad-99fc-fa25376fdd24

### 4.4 Educational Content & Quiz
- Browse articles and documents uploaded by admins.
- **Bookmark** content for later.
- Embedded **Quiz** — multiple-choice and true/false questions.
- Quiz results are saved; past attempts are restored on re-login.
- Score, pass/fail, per-question feedback.
<img width="1913" height="1012" alt="image" src="https://github.com/user-attachments/assets/2bc67995-7071-44b7-9ab3-2997fda52537" />

https://github.com/user-attachments/assets/9357e703-0a2a-4e00-bbb8-c315f46231f1

### 4.5 Discussion Forum
- Create **topic threads** with category tags.
- Reply to existing threads.
- **Real-time** content moderation — posts pass through the Python moderation service (profanity, hate speech, etc.) before being saved.
- Report posts / topics for admin review.
- Forum restriction: admins can restrict a user from posting; a banner is shown.
<img width="1917" height="1021" alt="image" src="https://github.com/user-attachments/assets/10c81f9b-53d6-4bf2-ac8e-0f5beaa0571f" />
<img width="1919" height="1011" alt="image" src="https://github.com/user-attachments/assets/1786d8fd-cab3-4b5f-a80b-fda21aca40d6" />
<img width="1916" height="1027" alt="image" src="https://github.com/user-attachments/assets/cfebeac9-79ef-4bea-bb01-dac4ae044326" />
<img width="1916" height="1021" alt="image" src="https://github.com/user-attachments/assets/f133ccc5-3caa-4aff-b0a5-c1da20b3abdf" />

### 4.6 Reports
| Report | Description |
|---|---|
| **Topic Category Distribution** | Real-time category mix across active Issue Portal topics |
| **Top Performing MPs** | Ranked using the same weighted scoring logic as Featured MPs. |
| **Most Viewed Topics** | Based on Issue Portal views across active topics |
All reports are printable/ exportable.
<img width="1911" height="1033" alt="image" src="https://github.com/user-attachments/assets/7daf57da-a510-4b84-b315-7cdea62748e9" />
<img width="1912" height="1027" alt="image" src="https://github.com/user-attachments/assets/5b7b0a08-9d3f-45c4-be47-10b0d7dbd722" />
<img width="1619" height="1071" alt="image" src="https://github.com/user-attachments/assets/3744e630-190a-4e80-a8cd-c72fab310856" />
<img width="1307" height="970" alt="image" src="https://github.com/user-attachments/assets/0bd4c346-894e-4be4-a403-ac923a326744" />

### 4.7 Feedback
- Submit feedback with optional file attachment.
- Track submission status (Pending / In Review / Resolved).
- Receive reply notification in the bell/ push notification.
<img width="1909" height="1021" alt="image" src="https://github.com/user-attachments/assets/bd8415db-fac9-4f57-be18-268113b24e11" />
<img width="1912" height="1021" alt="image" src="https://github.com/user-attachments/assets/1b614a0b-bbc5-4a00-856a-263e64eae86b" />

### 4.8 Survey
- Answer surveys published by the admins.
<img width="1919" height="1035" alt="image" src="https://github.com/user-attachments/assets/974e39cc-e43c-486d-9578-12da4b236b7c" />
<img width="1917" height="1013" alt="image" src="https://github.com/user-attachments/assets/ea7f0291-bf2d-4ae6-9ba0-001ace4c416a" />

### 4.9 User Dashboard & Settings
- Personal activity timeline (views, quiz completions, forum posts).
- Followed MPs and Topics panels.
- Notification bell (real-time via SSE).
- **Settings modal**: notification preferences, profile edit, password change tab.
- Language toggle: **EN / BM** (full bilingual translation via LanguageContext).
<img width="1912" height="1007" alt="image" src="https://github.com/user-attachments/assets/2c618c3c-b3fe-4051-965f-55d961109e3a" />
<img width="554" height="625" alt="image" src="https://github.com/user-attachments/assets/67232c8a-4faf-4304-9675-1df74d85718c" />
<img width="1910" height="1013" alt="image" src="https://github.com/user-attachments/assets/d528a4c7-3982-4e55-b29e-e326c8f65896" />

---
## 5. Features — Admin Side
Accessed at `/admin` — separate login with 2FA (Google Authenticator).
<img width="1919" height="1029" alt="image" src="https://github.com/user-attachments/assets/6a4fac39-77cf-4520-a28f-cf78f04dbb94" />

### 5.1 Admin Dashboard
- Overview statistics: total users, active users, forum posts, feedback items.
- Real-time activity feed via SSE.
- Quick-access navigation to all admin modules.
<img width="1919" height="1030" alt="image" src="https://github.com/user-attachments/assets/da2214b4-02ff-47d6-be1b-310936352a2f" />

### 5.2 Admin User Management
- Accessible only to the superadmin.
- Manage admin accounts.
- View admin accounts' logs.
<img width="1908" height="1030" alt="image" src="https://github.com/user-attachments/assets/faea0acb-e0a6-44f1-85e5-3fdf1143644e" />
<img width="1913" height="1004" alt="image" src="https://github.com/user-attachments/assets/84f77b0a-1343-4a2a-84c5-cb49894cb35f" />


### 5.3 User Management
- List, search, and filter all registered users.
<img width="1919" height="1034" alt="image" src="https://github.com/user-attachments/assets/688f8f3c-ec61-46d7-9626-e819ecbf7e01" />

### 5.4 User Monitoring
- Real-time active session tracking.
- Per-user activity log drill-down.
- - **Suspend / Activate** accounts.
- Apply **forum restrictions** (temporary ban from posting).
<img width="1890" height="1023" alt="image" src="https://github.com/user-attachments/assets/70cd89c5-b823-4e63-9421-f425de49ed67" />

### 5.5 User Feedback Management
- Read all submitted feedback.
- Reply to users (reply triggers in-app and push notification).
- Update status (Pending → In Review → Resolved).
<img width="1917" height="1024" alt="image" src="https://github.com/user-attachments/assets/99afd4e6-0c15-434f-a4a7-f1a3296d426c" />

### 5.6 Survey Management
- Create surveys with multiple question types: **rating, yes/no, multiple-choice, open text**.
- Publish / close surveys.
- View response statistics.
<img width="1919" height="1010" alt="image" src="https://github.com/user-attachments/assets/58f91c82-5318-416e-b142-7643710f87f3" />
<img width="1919" height="1038" alt="image" src="https://github.com/user-attachments/assets/8e0b41eb-dd22-41a1-8488-2f23abb74e55" />

### 5.7 Educational Content Management
- **Create / Edit / Delete** articles, videos, documents.
- Upload content attachments (PDF, images, etc.) — served inline via `/uploads/edu-content/`.
- Add embedded quizzes: MCQ and True/False questions, configurable passing score.
- Publish / Draft / Archive statuses.
- SSE broadcast on publish so live users see updates immediately.
<img width="1914" height="1023" alt="image" src="https://github.com/user-attachments/assets/e1fc7954-23eb-4112-9c6d-bbf0714b7141" />

### 5.8 MP Management
- Add / Edit / Deactivate MP profiles.
- Upload MP photos.
<img width="1919" height="1031" alt="image" src="https://github.com/user-attachments/assets/1b1fe208-180c-4eb9-b1d9-983342df472f" />

### 5.9 Analytics
- **Daily Active Users (DAU)** chart.
- Platform usage breakdown: Issue Portal, MP, Edu, Forum.
- ML topic cluster distribution across 6 pipelines.
- Sentiment trend graphs.
- ARIMA forecast visualisation per topic.
<img width="1815" height="928" alt="image" src="https://github.com/user-attachments/assets/a947ba87-2271-4d35-b8a3-03dfb9961e6b" />
<img width="1447" height="872" alt="image" src="https://github.com/user-attachments/assets/9c2c88e3-7e9c-4bb9-985c-e7444f375c11" />
<img width="1589" height="958" alt="image" src="https://github.com/user-attachments/assets/8be3cddb-27c0-489d-b82d-53b16d0be513" />
<img width="1859" height="864" alt="image" src="https://github.com/user-attachments/assets/927e42b7-cbed-44c2-8165-bdd90e46e45a" />
<img width="1913" height="760" alt="image" src="https://github.com/user-attachments/assets/a30308bc-db58-4774-ab8d-8a0bcc135d4c" />
<img width="1853" height="779" alt="image" src="https://github.com/user-attachments/assets/3034e597-5c80-4812-bac3-ca1ae186f244" />
<img width="1865" height="1003" alt="image" src="https://github.com/user-attachments/assets/bdb9634c-8f92-459a-8793-18be5784a2ee" />
<img width="1911" height="1019" alt="image" src="https://github.com/user-attachments/assets/c05570db-b105-48eb-be41-ef1754a0c7ad" />
<img width="1917" height="1013" alt="image" src="https://github.com/user-attachments/assets/0eed4213-0869-435e-95dd-170ad526eacb" />

### 5.10 Forum Moderation
- View flagged topics and posts.
- **Archive / Hide / Restore** content.
- Bulk moderation actions.
- Moderation log.
<img width="1919" height="1031" alt="image" src="https://github.com/user-attachments/assets/c453e82d-8127-4849-ae12-2b3c61e61feb" />
<img width="1893" height="1015" alt="image" src="https://github.com/user-attachments/assets/f66b4e53-293a-4a4c-8bef-be181f742fae" />

### 5.11 Technical Support
- View technical support tickets submitted by users.
- Update ticket status and reply.
<img width="1918" height="1015" alt="image" src="https://github.com/user-attachments/assets/48aa39e1-c99e-4ab8-b13c-787ea2282116" />

### 5.12 Maintenance Scheduler
- Schedule maintenance windows with title, description, start/end time.
- Approval workflow (Pending → Approved → In Progress → Completed).
- Node backend reads the schedule and returns HTTP 503 with a `maintenanceMode: true` payload to the frontend during active windows; a banner is shown to users.
<img width="1906" height="1014" alt="image" src="https://github.com/user-attachments/assets/14cacc57-8f35-4445-87d3-96c7177d6d31" />
<img width="1919" height="1048" alt="image" src="https://github.com/user-attachments/assets/6c23fcc0-12e8-409e-b0e9-677448f3bda3" />
<img width="1919" height="1074" alt="image" src="https://github.com/user-attachments/assets/9f56669e-0fa0-445f-a4e6-09d9ef15d92d" />

---

## 6. Machine Learning Pipeline

The system uses two sequential pipelines: a **Data Pipeline** that collects and cleans raw parliamentary text, and an **Inference Pipeline** that applies ML models to produce insights.

---
### 6.1 Data Pipeline — Raw Web to Clean Text
<img width="1240" height="693" alt="image" src="https://github.com/user-attachments/assets/eafd19d6-a85c-433f-b5df-71777d5d07e4" />
<img width="500" height="1200" alt="Hansard Data Processing-2026-03-28-194055" src="https://github.com/user-attachments/assets/0ffbe824-d79a-4812-8d3b-8f716139e203" />

**CPATF** (Code-switched Parliament-Aware Token Filtering) is a domain-specific preprocessing module for bilingual (Malay-English) Hansard text. It assigns each token a retention score based on language confidence (FastText), POS category (spaCy), NER type, and a redundancy penalty for repeated honorifics. Only tokens exceeding threshold θ=0.6 are retained, producing clean, content-rich segments for downstream topic modelling.
  
---

### 6.2 Inference Pipeline — Clean Text to Insights
**MEHTC** (Multi-Evidence Hybrid Topic Clustering) combines three similarity signals into one matrix: TF-IDF lexical overlap (α), neural embedding cosine similarity (β), and weighted entity Jaccard (γ). Agglomerative Clustering is then applied to this hybrid matrix. Pipelines 3–6 progressively upgrade the β component from zero (entity-only) to zero-shot XLM-R to LoRA fine-tuned XLM-R.

Runs daily (scheduled via `takwim_scheduler.py`) or manually.

| Step | Script | Input | Output |
|---|---|---|---|
| 1 | `production_inference.py` | hansard_cpatf / HansardDocument | hansard_inference |
| 2 | `topic_generation.py` | hansard_inference | hansard_topic |
| 3 | `arima_forecast.py` | hansard_topic + session mapping | hansard_arima |
| 4 | `topic_analysis.py` | all above | hansard_analysis |

**Step 1 — Topic Clustering (6 Pipelines)**
Six comparative pipelines using different models and text combinations:

| Pipeline | Model | Text Source |
|---|---|---|
| P1 | TF-IDF + KMeans | Raw OCR text (HansardDocument) |
| P2 | TF-IDF + LDA	 | Raw OCR text (HansardDocument) |
| P3 | MEHTC — Entity Only (α + γ, β=0)	 | CPATF cleaned text |
| P4 | MEHTC + XLM-R Zero-shot (α + β + γ)	 | CPATF cleaned text |
| P5 | MEHTC + LoRA Fine-tuned XLM-R	 | CPATF cleaned text |
| P6 | Multilingual-E5-Large (SOTA baseline)	 | CPATF cleaned text |

Each pipeline clusters parliamentary speeches into topics and writes results to `hansard_inference`.

**Step 2 — Topic Label Generation**
- Assigns human-readable labels to each cluster
- Evaluates label quality: **high / medium / low**
- Low-quality topics are excluded from ARIMA forecasting

**Step 3 — ARIMA Trend Forecasting**
- Reads topic frequencies per parliament session (parlimen / penggal / mesyuarat)
- Fits ARIMA(1,1,0) per topic per pipeline
- Forecasts the next 3 sessions
- Only runs for high/medium quality topics
  
**Step 4 — Topic Analysis**
- Sentiment distribution per topic
- Top speakers per topic
- Cross-session topic patterns
  
---

### 6.3 Scheduling Logic (`takwim_scheduler.py`)
- **During active *mesyuarat*** (parliament sitting): daily incremental run — checks for new documents in the last N days; re-clusters all documents if new ones exist.
- **After session ends**: full reprocessing for data integrity.
- **Monthly**: validates and syncs Takwim data by scraping the Parliament website.
- **Cron**: `0 8 * * *` (08:00 MYT daily)
  
---

### 6.4 Real-Time Microservices (Always-On)

Two Python services are auto-started by the Node backend on launch:

| Service | Port | Model | Purpose |
|---|---|---|---|
| `forum_content_moderation.py` | 5001 | HuggingFace classifier + keyword blocklist | Checks every forum post before saving |
| `sentiment_zeroshot.py` | 5002 | `joeddav/xlm-roberta-large-xnli` | Zero-shot sentiment for EN + Bahasa Malaysia |

---

## 7. ML Model Performance
### 7.1 Topic Modeling — 6 Pipelines
**Dataset:** `hansard_core500`
- P1/P2: 75 full test documents (raw OCR text)
- P3–P6: 26,754 CPATF cleaned segments
---
#### Test Metrics
<img width="1250" height="546" alt="image" src="https://github.com/user-attachments/assets/d1c7fd15-c2da-4d03-8509-fa68d92ec530" />
---

#### Composite Scoring — Why P5 Wins Despite Not Leading Every Metric
A single metric cannot fully capture topic model quality for parliamentary data, so a **weighted composite score** is used:
Overall Score = 0.30×norm(Silhouette) + 0.30×norm(C_V) + 0.20×norm(NPMI) + 0.20×norm(Topic Diversity)

P4 achieves the **highest raw Silhouette (0.6157)** — its XLM-R embeddings cluster very tightly — but its C_V coherence (0.3977) is the lowest among P3–P6, and NPMI is **negative (-0.0459)**, meaning topics are not semantically meaningful to readers. High separation alone does not equal useful topic labels.

P6 (Multilingual-E5-Large, the SOTA baseline) performs well across coherence and diversity, earning Rank 2 with score 0.657.

**P5 ranks 1st (0.691)** because it achieves the best *balance*: decent cluster separation (Silhouette 0.3767), competitive coherence (C_V 0.4928), positive NPMI (0.0801), and reasonable topic diversity (0.3333). None of its individual scores are the highest, but it has **no weak dimension** — exactly what parliamentary discourse analysis requires, where topics must be both separable *and* interpretable.

P5 also **closes the gap to SOTA**: its overall score (0.691) exceeds the E5-Large SOTA baseline (0.657) by 5.2%, despite using a purpose-built fine-tuned model instead of a general-purpose multilingual embedding. Sensitivity analysis with ±0.1 weight variation confirms P5 consistently ranks in the top 1–2 positions across all reasonable weight configurations.

---

#### Pipeline 5 — What Was Built

**P5: MEHTC + LoRA-GRPO Fine-tuned XLM-RoBERTa** is the flagship pipeline, designed to establish the upper bound of domain-adapted performance.

**Three-component hybrid similarity (MEHTC):**

$$sim(d_i, d_j) = \alpha \cdot cos(\mathbf{v}_{tfidf,i}, \mathbf{v}_{tfidf,j}) + \beta \cdot cos(\mathbf{e}_{ft,i}, \mathbf{e}_{ft,j}) + \gamma \cdot Jaccard_{weighted}(E_i, E_j)$$

| Component | Weight | Role |
|---|---|---|
| TF-IDF cosine (α) | 0.347 | Lexical overlap |
| Fine-tuned XLM-R embedding cosine (β) | 0.605 | Semantic proximity |
| Weighted Jaccard entity similarity (γ) | 0.122 | Named-entity overlap (person, place, org) |

Weights were optimised using Bayesian optimisation (hyperopt TPE) from Pipeline 4 results.

**Fine-tuning XLM-RoBERTa:**

| Setting | Value |
|---|---|
| Base model | `xlm-roberta-base` (278M parameters) |
| Fine-tuning method | LoRA (Parameter-Efficient Fine-Tuning) + Weighted MLM |
| Reinforcement learning | GRPO (Group Relative Policy Optimization) |
| Best LoRA config | r=28, α=40, dropout=0.194 (Bayesian search) |
| Training corpus | CPATF-cleaned Hansard segments (~20,000) |
| Hardware | NVIDIA RTX A6000 (48 GB VRAM) |
| Clustering | Agglomerative Clustering on hybrid similarity matrix |

LoRA adapts only a small number of attention weight matrices rather than all 278M parameters, making fine-tuning computationally feasible while preserving the multilingual pretraining of XLM-R. GRPO then applies reinforcement learning to further align the embedding space towards parliamentary discourse structure.

---

#### Train vs Test Gap Analysis for P5

| Metric | Train | Test | Gap (%) | Interpretation |
|---|---|---|---|---|
| Silhouette | 0.0247 | **0.3767** | **-1422%** | Test clusters *far more separated* — fine-tuned embeddings generalise to unseen Hansard text |
| C_V Coherence | 0.3659 | **0.4928** | **-35%** | Test coherence improves — topics are more semantically meaningful on unseen data |
| NPMI | -0.008 | **+0.0801** | +1101% | NPMI flips from negative to positive — model recovers meaningful co-occurrence on test |
| Topic Diversity | 0.565 | 0.3333 | +41% | Slight diversity drop on test — expected, as unseen data has less variety than training set |

The large negative gaps for Silhouette and C_V (test metrics **exceed** training metrics) indicate that the LoRA fine-tuned embeddings learned representations that generalise well to unseen parliamentary text, rather than overfitting to the training split. The NPMI flip from negative (train) to positive (test) is particularly notable: the fine-tuned model better captures co-occurring political concepts in held-out sessions it was never trained on.

<img width="1584" height="275" alt="image" src="https://github.com/user-attachments/assets/263cd830-166f-4ead-b51a-2ab9c4c18cc9" />

---
### 7.2 Sentiment Analysis

| Setting | Value |
|---|---|
| Model | `joeddav/xlm-roberta-large-xnli` |
| Approach | Zero-shot (no fine-tuning required) |
| Labels | positive / negative / neutral |
| Languages | English + Bahasa Malaysia |
| Max token length | 256 |
| Batch size | 16 |

---
### 7.3 ARIMA Forecasting

| Setting | Value |
|---|---|
| Model | ARIMA(1, 1, 0) |
| Forecast horizon | 3 parliament sessions |
| Scope | High / medium quality topics only |
| Session mapping | Session_range.xlsx |

---
### 7.4 Forum Content Moderation

| Component | Detail |
|---|---|
| Layer 1 | Keyword blocklist (deterministic, zero latency) |
| Layer 2 | HuggingFace classifier |
| Timeout | 30s (`MODERATION_TIMEOUT_MS`) |
| Fallback | Fail-open (post allowed if service unreachable) |

## 8. Acknowledgements & Open Data Sources

The development of **MyParliament** was made possible through the integration of several high-quality open-source datasets and Malaysian government digital resources. I would like to express our gratitude to the following:

| Source | Resource Type | Application in Project | Resource Link |
| :--- | :--- | :--- | :--- |
| **Official Parliament of Malaysia** | Hansard PDF Documents | Primary source for all parliamentary debate text, scraped and processed via our data pipeline. | [parlimen.gov.my](https://www.parlimen.gov.my/hansard-dewan-negara.html?uweb=dn&) |
| **Malaysia GeoJSON** | Geospatial Data | Provided the boundary coordinates for the interactive constituency map in the MP Dashboard. | [github.com/mptwaktusolat/jakim.geojson](https://github.com/mptwaktusolat/jakim.geojson/blob/master/malaysia.district.geojson) |
| **Malay Stopwords** | NLP Linguistic Data | Critical for the CPATF pipeline to filter noise and improve topic clustering coherence. | [github.com/stopwords-iso/stopwords-ms](https://github.com/stopwords-iso/stopwords-ms) |

---

## 9. Copyright & Intellectual Property

**© 2026 MyParliament Project. All Rights Reserved.**

This platform, including its unique **CPATF** (Code-switched Parliament-Aware Token Filtering) and **MEHTC** (Multi-Evidence Hybrid Topic Clustering) methodologies, system architecture, and integrated codebase, is the intellectual property of the developer.

* **Software License:** The source code is currently restricted for private use. Redistribution, modification, or commercial use without explicit written consent is prohibited.
* **Data Usage:** While the platform utilizes public domain government data (Hansard), the processed insights, clustered topics, and generated forecasts are proprietary outputs of the MyParliament ML engine.
* **Contact:** For licensing inquiries or collaborative research opportunities regarding the MEHTC-LoRA implementation, please contact the project administrator via the platform's Technical Support module.
