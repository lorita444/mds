# 🚀 Focus — Aplicație Educațională Gamificată

> **Focus** transformă studiul individual și în grup într-o experiență de tip galaxie interactivă. Încarcă materiale de curs, primești rezumate AI, generează quizuri și flashcard-uri, studiezi cu prietenii în sesiuni co-op și câștigă recompense cosmice pentru fiecare sesiune completată.

[![CI](https://github.com/lorita444/mds/actions/workflows/ci.yml/badge.svg)](https://github.com/lorita444/mds/actions/workflows/ci.yml)

---

## 📖 Cuprins

- [Cum funcționează](#cum-funcționează)
- [Agenți AI](#-agenți-ai-integrați)
- [User Stories](#-user-stories)
- [Arhitectură](#️-arhitectură)
- [Teste automate](#-teste-automate)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Source Control](#-source-control-git)
- [Raport AI Development](#-raport-folosire-tooluri-ai)
- [Raportare Bug + Rezolvare PR](#-raportare-bug--rezolvare-pr)

---

## Cum funcționează

- **Document Analysis (Agent Sumarizare):** Utilizatorul încarcă materiale de curs (PDF/TXT), care sunt analizate de un agent AI bazat pe OpenAI Codex SDK și rezumate automat.
- **Quiz & Flashcard Generation (Agent Generator):** Un al doilea agent AI generează întrebări grilă și flashcard-uri personalizate pe baza materialelor sumarizate.
- **AI Chat Tutor (Agent Chat):** Un agent conversațional răspunde la întrebările studentului în contextul materiei, folosind rezumatele ca sursă principală.
- **Sesiuni de studiu:** Sesiuni solo (casual / mission) sau co-op cu prieteni. Fiecare sesiune finalizată aduce cristale, planete, extratereștri sau artefacte cosmice ca recompensă.
- **Galaxia personală:** Progresul academic se transformă vizual într-o hartă stelară în continuă expansiune.

---

## 🤖 Agenți AI Integrați

Proiectul conține **4 agenți AI funcționali**, fiecare cu un rol distinct în cadrul aplicației. Toți folosesc **OpenAI Codex SDK** (model de limbaj mic care poate rula local).

### Agent 1 — Sumarizare Materiale
**Endpoint:** `POST /api/materials/:id/summarize-file`

Primește un fișier PDF sau TXT, extrage textul și îl trimite agentului AI pentru a genera un rezumat structurat, concentrat pe concepte cheie, definiții și relații importante. Rezumatul este salvat în baza de date și folosit de ceilalți agenți ca sursă de cunoaștere.

```
PDF/TXT → extragere text → Agent Sumarizare (Codex) → rezumat JSON → DB
```

### Agent 2 — Generator Quiz
**Endpoint:** `POST /api/quizzes/generate`

Pe baza rezumatelor materialelor dintr-un subiect, generează întrebări mixte (multiple choice cu 4 opțiuni, adevărat/fals, short answer) cu explicații pentru fiecare răspuns corect. Dificultatea variază adaptiv.

```
Rezumate materiale → Agent Quiz (Codex) → întrebări JSON → quiz activ
```

### Agent 3 — Generator Flashcard-uri
**Endpoint:** `POST /api/flashcards/generate`

Generează flashcard-uri cu distribuție de dificultate (~30% easy, ~50% medium, ~20% hard) acoperind conceptele principale din materialele de studiu.

```
Rezumate materiale → Agent Flashcard (Codex) → flashcard-uri JSON → DB
```

### Agent 4 — Chat Tutor / Explicator Curs
**Endpoint-uri:** `POST /api/chat/respond`, `POST /api/chat/explain-course`

Agent conversațional care răspunde la întrebările studentului în limba acestuia, folosind rezumatele ca sursă principală. Construiește și explicații complete structurate (overview, concepte cheie, plan de învățare).

```
Întrebare student + istoricul conversației + rezumate → Agent Chat (Codex) → răspuns JSON
```

---

## 📋 User Stories

**Backlog complet:** [GitHub Issues](https://github.com/lorita444/mds/issues)

| # | Rol | Dorință | Beneficiu |
|---|-----|---------|-----------|
| 1 | Student | Să încarc un PDF al unui curs stufos | AI-ul să genereze un rezumat mai ușor de urmărit |
| 2 | Jucător | Să primesc întrebări grilă generate de AI | Să-mi fortific apărarea galaxiei prin cunoaștere |
| 3 | Utilizator | Să văd propria mea galaxie care se dezvoltă | Motivație vizuală pentru progresul academic |
| 4 | Student | AI-ul să genereze quiz-uri mai grele pe capitolele unde am greșit | Să îmbunătățesc zonele slabe din materie |
| 5 | Utilizator | Să mi se estimeze timpul de studiu pentru fiecare curs | O mai bună organizare a timpului |
| 6 | Jucător | Galaxia mea să sufere penalizări la răspunsuri greșite | Să simt consecințe și să fiu motivat să studiez corect |
| 7 | Student | Feedback imediat și explicații de la AI pentru greșeli | Înțelegere mai profundă a materiei |
| 8 | Utilizator | Progresul să fie salvat în baza de date | Să reiau studiul oricând de unde am rămas |
| 9 | Jucător | Să deblochez noi planete și extratereștri | Recompensare pentru parcurgerea materialelor |
| 10 | Utilizator | Dashboard cu statistici de progres | Monitorizarea evoluției personale |
| 11 | Student | Să studiez în sesiuni co-op cu un prieten | Beneficiu bonus (cristale și recompense coop) |
| 12 | Jucător | Să pun la bătaie cristale sau iteme pe o sesiune | Să fac studiul mai captivant și riscant |
| 13 | Student | Să generez flashcard-uri din materialele mele | Recapitulare rapidă înainte de examen |
| 14 | Utilizator | Să am un chat cu AI tutorul pe materia mea | Să obțin explicații fără să caut pe Google |
| 15 | Student | Să primesc o explicație completă a cursului | Să înțeleg materia înainte de a studia detalii |

---

## 🏗️ Arhitectură

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React Native / Expo)        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Auth     │ │ Subjects │ │ Session  │ │ Universe │  │
│  │ Screens  │ │ & Mats   │ │ Timer    │ │ / Galaxy │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Quiz     │ │ Flash-   │ │ AI Chat  │ │ Co-op    │  │
│  │ Screen   │ │ cards    │ │ Tutor    │ │ Rooms    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API (HTTP/JSON)
┌─────────────────────▼───────────────────────────────────┐
│                BACKEND (Node.js / Express)               │
│  ┌──────────────────────────────────────────────────┐   │
│  │              AI AGENTS LAYER                     │   │
│  │  [Agent 1: Sumarizare]  [Agent 2: Quiz Gen]     │   │
│  │  [Agent 3: Flashcard]   [Agent 4: Chat Tutor]   │   │
│  │           ↕ OpenAI Codex SDK                    │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Auth     │ │ Sessions │ │ Rewards  │ │ Co-op    │  │
│  │ JWT      │ │ Streaks  │ │ Wagers   │ │ Rooms    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                 DATABASE (MySQL)                         │
│  users │ subjects │ chapters │ materials │ sessions     │
│  rewards │ flashcards │ quizzes │ coop_rooms │ streaks  │
└─────────────────────────────────────────────────────────┘
```

### Stack tehnologic
| Layer | Tehnologie |
|---|---|
| Frontend | React Native (Expo), TypeScript, NativeWind |
| Backend | Node.js, Express.js |
| Bază de date | MySQL (Docker) |
| AI Agents | OpenAI Codex SDK (`@openai/codex-sdk`) |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| File processing | multer, pdf-parse |
| CI/CD | GitHub Actions |
| Teste | Jest, Supertest |

---

## 🧪 Teste Automate

Testele sunt scrise cu **Jest** și **Supertest** și acoperă:

| Fișier | Ce testează |
|--------|-------------|
| `backend/tests/middleware.test.js` | Middleware autentificare JWT (401, 403, 200) |
| `backend/tests/routes.test.js` | Rute API: login, signup, subjects, reset-password |
| `backend/tests/helpers.test.js` | Funcții helper: `mapBools`, `mapBoolsArray`, `generateUUID` |

### Rulare teste
```bash
cd backend
npm test
```

### Eval agenți AI
Agenții sunt testați indirect prin mock-uri ale Codex SDK: se verifică că:
- Formatul JSON returnat conține câmpurile obligatorii (`summary`, `flashcards`, `questions`, `reply`)
- Răspunsurile invalide sunt gestionate cu eroare clară (HTTP 500)
- Schema JSON de output este validată strict (jsonSchema cu `additionalProperties: false`)

---

## ⚙️ CI/CD Pipeline

Configurat în `.github/workflows/ci.yml`. Rulează automat la **orice push sau pull request**:

```
Push / PR
    │
    ├── [Job 1] Backend Tests
    │     ├── npm ci
    │     └── npm test (Jest)
    │
    └── [Job 2] Frontend Checks
          ├── npm ci
          ├── npm run lint (ESLint)
          └── npm run type-check (TypeScript)
```

---

## 🌿 Source Control Git

Repository: [https://github.com/lorita444/mds](https://github.com/lorita444/mds)

### Branches
| Branch | Autor | Scop |
|--------|-------|------|
| `main` | toți | branch principal, cod stabil |
| `miruna` | Miruna Zaharia | features UI, quiz, mission setup |
| `domi` | dominic999 | AI chat, sumarizare, profile UI |
| `ollama` | lorita444 | integrare model AI local Ollama |

### Contribuții Membri
- **lorita444**: A configurat pipeline-ul de CI/CD (GitHub Actions), testele automate și baza de date MySQL. A dezvoltat backend-ul (gestionarea fișierelor, rutele API, notificările) și a integrat posibilitatea de a rula agentul AI local prin Ollama.
- **dominic999**: A integrat agentul conversațional (Chat Tutor) cu OpenAI Codex SDK, a corectat flow-ul de sumarizare a materialelor în backend și a stilizat ecranele de profil și de discipline în React Native.
- **Miruna Zaharia**: A reproiectat interfața grafică pe frontend (ecranul de timer, configurarea misiunilor, feedback-ul quiz-urilor, flashcard-urile), a refăcut structura de navigare a aplicației și a rutat generarea quiz-urilor prin backend pentru rezolvarea timeout-urilor.

### Workflow Git
1. Feature branches create per funcționalitate (`miruna`, `domi`, `ollama`)
2. Modificările sunt merguite în `main` prin Pull Requests cu review
3. CI rulează automat la fiecare PR pentru a valida testele și linting-ul

---

## 🤖 Raport Folosire Tooluri AI

### Tooluri folosite în procesul de dezvoltare

| Tool | Utilizare |
|------|-----------|
| **Antigravity (Google DeepMind)** | Generator principal de cod — arhitectură backend, componente React Native, CI/CD pipeline, teste Jest |
| **Claude (Anthropic)** | Co-autor de commits (vizibil în istoricul GitHub), debugging, refactorizare UI |
| **ChatGPT / GPT-4** | Clarificări conceptuale, design decizii pentru schema bazei de date |
| **GitHub Copilot** | Autocompletare inline în VS Code pentru boilerplate și query-uri SQL |

### Cum a fost folosit AI-ul

**1. Generare de cod (est. ~65% din cod)**
- Backend complet (`index.js` — 2234 linii): structura rutelor Express, logica de recompense, integrarea Codex SDK
- Componente React Native: `mission-setup.tsx`, `casual-focus.tsx`, `settings.tsx`, `quiz/`, `flashcards/`
- Schema bazei de date în `db.js`
- Fișierele de teste Jest (`routes.test.js`, `middleware.test.js`, `helpers.test.js`)
- Configurarea CI/CD (`ci.yml`)

**2. Debugging**
- Rezolvarea erorilor de timeout la generarea quizurilor → mutat în backend (commit: `Route quiz generation through backend`)
- Fix schema Codex: `options` trebuia adăugat în array-ul `required` al JSON Schema (commit: `Fix quiz schema`)
- Erori de sumarizare materiale (commit: `Fix material summarization and clean`)

**3. Design decizii cu AI**
- Sistemul de recompense (cristale, planete, extratereștri, raritate) — generat și rafinat iterativ
- Logica de streak și multiplicator de consistență
- Arhitectura co-op rooms (polling, status machine: `waiting → starting → active → completed`)

**4. Evaluare critică**
- ✅ AI-ul a accelerat dramatic viteza de development (estimat 3-4x mai rapid)
- ✅ Excelent pentru boilerplate, structuri repetitive, teste unitare
- ⚠️ A halucinat uneori API-uri inexistente (ex. parametri greșiți pentru `multer`)
- ⚠️ Necesită validare manuală a logicii de business (ex. calculul streak-ului)
- ❌ Documentația generată automat trebuie revizuită pentru acuratețe

### Prompts reprezentative folosite
```
"Generează un sistem de recompense pentru sesiuni de studiu cu cristale, 
planete și extratereștri, bazat pe durata sesiunii și dacă quiz-ul a fost trecut"

"Scrie teste Jest cu Supertest pentru rutele de autentificare, 
folosind mock pentru modulul db"

"Creează un workflow GitHub Actions care rulează Jest pe backend 
și ESLint + TypeScript check pe frontend Expo"
```

---

## 🐛 Raportare Bug + Rezolvare PR

### Bug #1 — Agentul AI de generare quiz returna eroare de validare schema

**Issue:** [Bug: Agentul AI quiz generează eroare — `options` lipsește din schema required](https://github.com/lorita444/mds/issues)

**Descriere:**  
La apelarea endpoint-ului `POST /api/quizzes/generate`, agentul AI (Codex SDK) returna eroare de validare deoarece câmpul `options` nu era inclus în array-ul `required` din JSON Schema-ul de output. Codex refuza să genereze răspunsul și arunca excepție, blocând complet funcționalitatea de quiz pentru utilizatori.

**Simptome observate:**
- Răspuns HTTP 500 la orice request de generare quiz
- Log în consolă: `"AI returned invalid format"` / eroare Codex de validare schema
- Generarea flashcard-urilor funcționa, dar quiz-urile nu

**Cauza root (root cause):**  
JSON Schema transmis agentului Codex avea `options` în `properties` dar nu și în `required`. Codex SDK-ul, cu modul strict activat, refuza să returneze un obiect care nu respecta schema completă.

**Ramuri implicate:**
- **`domi`** — `dominic999` a identificat problema în logica de sumarizare și a curățat codul agentului: commit [`6e98114`](https://github.com/lorita444/mds/commit/6e981146f001257a6e9485ceb6e4187d0e057c73) — _"Fix material summarization and clean"_
- **`miruna`** — Miruna Zaharia a aplicat fix-ul în schema Codex și a redirecționat generarea quizului prin backend: commit [`fdc8025`](https://github.com/lorita444/mds/commit/fdc8025acffe68fdfeab3fa3141b209e2302b0bb) — _"Fix quiz schema: add options to required array for Codex validation"_ + commit [`92d7300`](https://github.com/lorita444/mds/commit/92d730084c382f023682a34454e263555b1ae1ee) — _"Route quiz generation through backend (fix timeout)"_

**Fix aplicat:**
```js
// ÎNAINTE (buggy)
const quizSchema = {
  properties: {
    questions: {
      items: {
        properties: {
          options: { type: ['array', 'null'] },  // ← era în properties
          // ...
        },
        required: ['question_text', 'question_type', 'correct_answer', 'explanation']
        // ← options lipsea din required!
      }
    }
  }
};

// DUPĂ (fix)
required: ['question_text', 'question_type', 'options', 'correct_answer', 'explanation']
//                                             ↑ adăugat
```

**Status:** ✅ Rezolvat — fix-urile de pe `domi` și `miruna` merguite în `main`


