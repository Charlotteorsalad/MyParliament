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
8. [Local Setup & Running](#8-local-setup--running)
9. [Project Structure](#9-project-structure)

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
Available after login:
| Report | Description |
|---|---|
| **Topic Category Distribution** | Real-time category mix across active Issue Portal topics |
| **Top Performing MPs** | Ranked using the same weighted scoring logic as Featured MPs. |
| **Most Viewed Topics** | Based on Issue Portal views across active topics |
All reports are printable / exportable.
<img width="1911" height="1033" alt="image" src="https://github.com/user-attachments/assets/7daf57da-a510-4b84-b315-7cdea62748e9" />
<img width="1912" height="1027" alt="image" src="https://github.com/user-attachments/assets/5b7b0a08-9d3f-45c4-be47-10b0d7dbd722" />
<img width="1619" height="1071" alt="image" src="https://github.com/user-attachments/assets/3744e630-190a-4e80-a8cd-c72fab310856" />
<img width="1307" height="970" alt="image" src="https://github.com/user-attachments/assets/0bd4c346-894e-4be4-a403-ac923a326744" />

### 4.7 Feedback
- Submit feedback with optional file attachment.
- Track submission status (Pending / In Review / Resolved).
- Receive reply notification in the bell / push notification.
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

