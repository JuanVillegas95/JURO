# JURO Architecture Diagrams

## Project Basics

- **Project name:** JURO
- **One-line description:** Java-only desktop study app for authoring coding problems, launching local editor scaffolds, running Java tests, evaluating verbal explanations with a local AI provider, and scheduling spaced repetition reviews.
- **Tech stack:** React 19, TypeScript, Vite, Tauri 2, Rust launcher, Java 17, Spring Boot 3.4, Spring Data JPA/Hibernate, Flyway, H2 desktop database, optional PostgreSQL default server profile, Zod, React Hook Form.

## Folder Structure

```mermaid
mindmap
  root((juro))
    backend
      pom.xml
      src/main/java/com/orahub/juro
        JuroApplication
        config
          CorsConfig
        problem
          controller
          dto
          mapper
          model
          repository
          service
        submission
          controller
          dto
          judge
          model
          repository
          service
        localworkspace
          settings
          scaffold
          editor lifecycle
          AI clients
        knowledge
          controller
          dto
          service
        review
          controller
          dto
          model
          repository
          service
        shared
          API errors
      src/main/resources
        application.yml
        application-desktop.yml
        db/migration
        db/desktop-migration
    frontend
      package.json
      src
        app
          App
          theme
        api.ts
        types.ts
        features
          problem-bank
          problem-authoring
          local-workspace
          knowledge-check
          help
        components
          code
          markdown
          ui
      src-tauri
        tauri.conf.json
        Cargo.toml
        src/lib.rs
        icons
```

The project is organized by backend feature packages and frontend feature folders. Tauri owns the desktop process shell and launches the packaged backend.

## Component / Module Diagram

```mermaid
flowchart TB
  User[User]

  subgraph Desktop["macOS Desktop App"]
    Tauri[Tauri shell<br/>Rust launcher]
    React[React UI<br/>Problem Bank / Settings / Dialogs]
    ApiClient[frontend/src/api.ts<br/>HTTP API wrapper]
  end

  subgraph Backend["Spring Boot backend on 127.0.0.1:18191"]
    Controllers[REST controllers]
    ProblemSvc[ProblemService]
    WorkspaceSvc[LocalWorkspaceService]
    SubmissionSvc[SubmissionService]
    KnowledgeSvc[KnowledgeEvaluationService]
    ReviewSvc[ProblemReviewService]
    Scheduler[ReviewScheduleCalculator]
    Judge[JavaSubmissionJudge]
    Scaffold[LocalJavaScaffoldGenerator]
    AiGateway[AiEvaluationGateway]
    Settings[LocalSettingsService]
    Repos[Spring Data repositories]
  end

  subgraph LocalTools["Local tools and files"]
    LocalEditor[VS Code or Neovim<br/>preferred editor]
    JDK[JDK tools<br/>java / javac]
    Workspace[Workspace directory<br/>juro-current]
    SettingsFile[settings.json]
    Logs[backend logs]
  end

  subgraph Persistence["Persistence"]
    H2[(H2 file DB<br/>desktop profile)]
    Postgres[(PostgreSQL<br/>default server profile)]
  end

  subgraph AI["Local AI providers"]
    Ollama[Ollama<br/>/api/generate]
    Codex[Codex Adapter<br/>/v1/chat/completions]
  end

  User --> React
  Tauri --> React
  Tauri --> Backend
  React --> ApiClient --> Controllers
  Controllers --> ProblemSvc
  Controllers --> WorkspaceSvc
  Controllers --> SubmissionSvc
  Controllers --> KnowledgeSvc
  Controllers --> ReviewSvc
  ProblemSvc --> Repos
  SubmissionSvc --> Judge
  SubmissionSvc --> ReviewSvc
  KnowledgeSvc --> AiGateway
  KnowledgeSvc --> ProblemSvc
  ReviewSvc --> Scheduler
  ReviewSvc --> Repos
  WorkspaceSvc --> Scaffold
  WorkspaceSvc --> Settings
  WorkspaceSvc --> Workspace
  WorkspaceSvc --> LocalEditor
  WorkspaceSvc --> JDK
  Settings --> SettingsFile
  Repos --> H2
  Repos -.default profile.-> Postgres
  AiGateway --> Ollama
  AiGateway --> Codex
  Backend --> Logs
```

The backend is the boundary for persistence, local tooling, editor launch, Java execution, AI evaluation, and scheduling. The frontend keeps UI state and calls backend endpoints through one API wrapper.

## Deployment Diagram

```mermaid
flowchart TB
  subgraph Host["User macOS machine"]
    subgraph AppBundle["JURO.app"]
      TauriBin[Tauri native executable]
      StaticAssets[Built React assets]
      BackendJar[backend/juro-backend.jar]
    end

    TauriBin --> StaticAssets
    TauriBin -->|starts child process| BackendJar
    BackendJar -->|listens| LocalApi[127.0.0.1:18191]
    StaticAssets -->|fetch| LocalApi

    BackendJar --> AppData[(App data dir<br/>backend/juro H2 DB)]
    BackendJar --> SettingsJson[backend/settings.json]
    BackendJar --> AppLogs[App log dir<br/>juro-backend.log]
    BackendJar --> WorkspaceDir[Configured workspace<br/>juro-current]
    BackendJar --> LocalEditor[VS Code app / code CLI or Neovim]
    BackendJar --> JavaTools[Java 17+ runtime and javac]
    BackendJar --> Ollama[Ollama localhost:11434]
    BackendJar --> CodexAdapter[Codex Adapter localhost:11435/v1]
  end
```

The production path is local desktop deployment. The app bundle includes frontend assets and the backend jar; local tools remain host dependencies.

## ERD

```mermaid
erDiagram
  PROBLEMS ||--o{ PROBLEM_EXAMPLES : has
  PROBLEMS ||--o{ PROBLEM_TEST_CASES : has
  PROBLEMS ||--o{ SUBMISSIONS : receives
  PROBLEMS ||--o{ PROBLEM_REVIEW_STATES : schedules

  PROBLEMS {
    uuid id PK
    varchar slug UK
    varchar title
    varchar summary
    text description_markdown
    text constraints_markdown
    varchar type
    varchar difficulty
    text starter_code
    text reference_solution
    text evaluation_notes
    text solution_video_url
    text knowledge_rubric
    timestamp created_at
    timestamp updated_at
  }

  PROBLEM_EXAMPLES {
    uuid id PK
    uuid problem_id FK
    varchar label
    int sort_order
    text input_data
    text expected_output
    text explanation
    timestamp created_at
  }

  PROBLEM_TEST_CASES {
    uuid id PK
    uuid problem_id FK
    varchar label
    int sort_order
    text input_data
    text expected_output
    boolean hidden
    text explanation
    timestamp created_at
  }

  SUBMISSIONS {
    uuid id PK
    uuid problem_id FK
    varchar submitted_language
    text source_code
    varchar status
    text result_summary
    bigint total_runtime_millis
    text result_details_json
    timestamp created_at
  }

  PROBLEM_REVIEW_STATES {
    uuid id PK
    uuid problem_id FK
    varchar track
    varchar status
    timestamp due_at
    timestamp last_reviewed_at
    int interval_days
    double ease_factor
    int repetitions
    int lapses
    varchar last_result
    double priority_score
    timestamp created_at
    timestamp updated_at
  }
```

The database stores problem content, visible examples, runnable test cases, submission history, and two review states per problem: `CODING` and `EXPLANATION`.

## Backend Class / Service Diagram

```mermaid
classDiagram
  class ProblemController {
    +listProblems()
    +getProblem(id)
    +createProblem(request)
    +updateProblem(id, request)
    +deleteProblem(id)
  }
  class ProblemService {
    +listProblems()
    +getProblem(id)
    +createProblem(request)
    +updateProblem(id, request)
    +deleteProblem(id)
    +getProblemEntity(id)
  }
  class ProblemRepository
  class ProblemMapper

  class LocalWorkspaceController {
    +getSettings()
    +saveSettings(request)
    +toolingStatus()
    +aiStatus()
    +activeWorkspace()
    +clearActiveWorkspace()
    +createScaffold(problemId)
    +openInEditor(problemId)
    +runTests(problemId)
  }
  class LocalWorkspaceService {
    +toolingStatus()
    +createScaffold(problemId)
    +openInEditor(problemId)
    +activeWorkspace()
    +clearActiveWorkspace()
    +runTests(problemId)
  }
  class LocalSettingsService {
    +getSettings()
    +saveSettings(request)
  }
  class LocalJavaScaffoldGenerator {
    +mainJava(problem)
  }

  class SubmissionController
  class SubmissionRunController
  class SubmissionService {
    +listSubmissions(problemId)
    +createSubmission(problemId, language, sourceCode)
  }
  class SubmissionJudgeService
  class SubmissionJudge {
    <<interface>>
    +supports(type)
    +judge(problem, sourceCode)
  }
  class JavaSubmissionJudge

  class KnowledgeEvaluationController
  class KnowledgeEvaluationService {
    +evaluate(problemId, transcript)
  }
  class AiEvaluationGateway {
    +status()
    +generateJson(prompt)
    +modelLabel()
  }
  class AiProviderClient {
    <<interface>>
    +provider()
    +status(settings)
    +generateJson(prompt, settings)
  }
  class OllamaClient
  class OpenAiCompatibleClient

  class ProblemReviewController
  class ProblemReviewService {
    +ensureStates(problem)
    +recordCodingResult(problem, passed)
    +recordManualResult(problem, track, passed)
    +recordExplanationScore(problem, score)
  }
  class ReviewScheduleCalculator {
    +passedIntervalDays(track, repetitions, previousInterval, ease, grade, settings)
    +failedIntervalDays(track, settings)
    +masteryIntervalDays(track)
  }
  class ProblemReviewStateRepository
  class SubmissionRepository

  ProblemController --> ProblemService
  ProblemService --> ProblemRepository
  ProblemService --> ProblemMapper
  ProblemService --> ProblemReviewService

  LocalWorkspaceController --> LocalWorkspaceService
  LocalWorkspaceController --> LocalSettingsService
  LocalWorkspaceController --> AiEvaluationGateway
  LocalWorkspaceService --> ProblemService
  LocalWorkspaceService --> LocalSettingsService
  LocalWorkspaceService --> LocalJavaScaffoldGenerator

  SubmissionController --> SubmissionService
  SubmissionRunController --> SubmissionService
  SubmissionService --> ProblemService
  SubmissionService --> SubmissionRepository
  SubmissionService --> SubmissionJudgeService
  SubmissionService --> ProblemReviewService
  SubmissionJudgeService --> SubmissionJudge
  SubmissionJudge <|.. JavaSubmissionJudge

  KnowledgeEvaluationController --> KnowledgeEvaluationService
  KnowledgeEvaluationService --> ProblemService
  KnowledgeEvaluationService --> AiEvaluationGateway
  AiEvaluationGateway --> LocalSettingsService
  AiEvaluationGateway --> AiProviderClient
  AiProviderClient <|.. OllamaClient
  AiProviderClient <|.. OpenAiCompatibleClient

  ProblemReviewController --> ProblemService
  ProblemReviewController --> ProblemReviewService
  ProblemReviewService --> ProblemReviewStateRepository
  ProblemReviewService --> LocalSettingsService
  ProblemReviewService --> ReviewScheduleCalculator
```

The backend is layered as controllers → services → repositories/integrations. Java judging and AI provider calls are strategy-style integrations behind service interfaces.

## Domain Class Diagram

```mermaid
classDiagram
  class Problem {
    UUID id
    String slug
    String title
    String summary
    String descriptionMarkdown
    String constraintsMarkdown
    ProblemType type
    ProblemDifficulty difficulty
    String starterCode
    String referenceSolution
    String solutionVideoUrl
    String knowledgeRubric
    Instant createdAt
    Instant updatedAt
  }

  class ProblemExample {
    UUID id
    String label
    int sortOrder
    String inputData
    String expectedOutput
    String explanation
    Instant createdAt
  }

  class ProblemTestCase {
    UUID id
    String label
    int sortOrder
    String inputData
    String expectedOutput
    boolean hidden
    String explanation
    Instant createdAt
  }

  class Submission {
    UUID id
    String submittedLanguage
    String sourceCode
    SubmissionStatus status
    String resultSummary
    Long totalRuntimeMillis
    String resultDetailsJson
    Instant createdAt
  }

  class ProblemReviewState {
    UUID id
    ReviewTrack track
    ReviewStatus status
    Instant dueAt
    Instant lastReviewedAt
    int intervalDays
    double easeFactor
    int repetitions
    int lapses
    ReviewResult lastResult
    double priorityScore
  }

  Problem "1" --> "0..*" ProblemExample
  Problem "1" --> "0..*" ProblemTestCase
  Problem "1" --> "0..*" Submission
  Problem "1" --> "0..2" ProblemReviewState
```

The current domain is Java-only at the application layer. The persisted `type` field remains a string enum, but services validate and filter for `JAVA`.

## Frontend Module Diagram

```mermaid
flowchart TB
  Main[main.tsx] --> AppWrapper[src/App.tsx]
  AppWrapper --> App[src/app/App.tsx]
  App --> Theme[ThemeProvider]
  App --> Router[BrowserRouter]
  Router --> ProblemList[ProblemListPage]

  ProblemList --> Api[api.ts]
  ProblemList --> Catalog[catalog.ts]
  ProblemList --> EditDrawer[EditProblemDrawer]
  ProblemList --> SettingsDialog[LocalWorkspaceSettingsDialog]
  ProblemList --> WorkspacePanel[LocalWorkspacePanel]
  ProblemList --> KnowledgeDialog[KnowledgeCheckDialog]
  ProblemList --> HelpDialog[AboutHelpDialog]

  EditDrawer --> ProblemForm[problemForm.ts<br/>Zod schema]
  EditDrawer --> CodeComponents[CodeEditorCard / CodePreview]
  EditDrawer --> MarkdownEditor[MarkdownEditor]
  SettingsDialog --> FormSelect[FormSelect]
  KnowledgeDialog --> BrowserSpeech[Browser SpeechRecognition API]
  WorkspacePanel --> Api
  Api --> Backend[Spring Boot REST API]
```

The only route renders `ProblemListPage`; modal and drawer state inside that page drives authoring, settings, current workspace, help, and knowledge-check UI.

## API Map

```mermaid
flowchart LR
  Client[React api.ts]

  subgraph Problems["Problems"]
    P1["GET /api/problems"]
    P2["GET /api/problems/{id}"]
    P3["POST /api/problems"]
    P4["PUT /api/problems/{id}"]
    P5["DELETE /api/problems/{id}"]
  end

  subgraph Submissions["Submissions / Java judge"]
    S1["GET /api/problems/{problemId}/submissions"]
    S2["POST /api/problems/{problemId}/submissions"]
    S3["POST /api/submissions"]
  end

  subgraph Local["Local workspace"]
    L1["GET /api/local/settings"]
    L2["PUT /api/local/settings"]
    L3["GET /api/local/tooling/status"]
    L4["GET /api/local/ai/status"]
    L5["GET /api/local/ollama/status"]
    L6["GET /api/local/workspace/active"]
    L7["POST /api/local/workspace/active/clear"]
    L8["POST /api/local/problems/{problemId}/scaffold"]
    L9["POST /api/local/problems/{problemId}/open-editor"]
    L10["POST /api/local/problems/{problemId}/run-tests"]
  end

  subgraph Knowledge["Knowledge evaluation"]
    K1["POST /api/problems/{problemId}/knowledge-evaluations"]
  end

  subgraph Review["Review scheduling"]
    R1["POST /api/problems/{problemId}/review-results"]
  end

  Client --> Problems
  Client --> Submissions
  Client --> Local
  Client --> Knowledge
  Client --> Review
```

The frontend uses these endpoints through `frontend/src/api.ts`; no separate frontend API clients exist per feature.

## Sequence: Desktop App Startup

```mermaid
sequenceDiagram
  actor User
  participant Tauri as Tauri Rust shell
  participant Backend as Spring Boot jar
  participant React as React frontend
  participant DB as H2 file DB
  participant Logs as App log files

  User->>Tauri: Open JURO.app
  Tauri->>Tauri: Resolve bundled backend/juro-backend.jar
  Tauri->>Backend: java -jar with desktop profile on 127.0.0.1:18191
  Backend->>DB: Flyway desktop migration / JPA startup
  Backend->>Logs: Write stdout/stderr logs
  Tauri->>React: Load built frontend assets
  React->>Backend: GET /api/problems
  Backend-->>React: Problem summaries with review states
```

Tauri starts the backend as a child process and injects desktop settings such as `SPRING_PROFILES_ACTIVE=desktop`, `SERVER_PORT=18191`, and `JURO_DATA_DIR`.

## Sequence: Open Problem In Editor

```mermaid
sequenceDiagram
  actor User
  participant UI as ProblemListPage
  participant API as LocalWorkspaceController
  participant WS as LocalWorkspaceService
  participant Problem as ProblemService
  participant Gen as LocalJavaScaffoldGenerator
  participant FS as Workspace filesystem
  participant Editor as Preferred editor

  User->>UI: Click problem row or Open in Editor
  UI->>API: POST /api/local/problems/{problemId}/open-editor
  API->>WS: openInEditor(problemId)
  WS->>Problem: getProblemEntity(problemId)
  WS->>FS: Delete and regenerate juro-current
  WS->>Gen: Generate src/Main.java from solve signature and test cases
  WS->>FS: Write README.md, src/Solution.java, tests/cases.json, run scripts
  WS->>FS: Write scaffold files and editor metadata when needed
  WS->>Editor: Open scaffold in VS Code or Neovim
  Editor-->>WS: process id when available
  WS-->>API: LocalProblemWorkspaceResponse status OPEN
  API-->>UI: active workspace
  UI->>UI: Show Current Problem panel
```

JURO isolates its VS Code workflow with a dedicated user-data directory under the JURO workspace metadata folder. Neovim opens the generated scaffold directly in a terminal.

## Sequence: Run Local Java Tests And Grade Coding

```mermaid
sequenceDiagram
  actor User
  participant UI as LocalWorkspacePanel
  participant API as LocalWorkspaceController
  participant WS as LocalWorkspaceService
  participant Shell as run.sh / run.bat
  participant Java as javac + java Main
  participant ReviewAPI as ProblemReviewController
  participant Review as ProblemReviewService
  participant DB as problem_review_states

  User->>UI: Run Tests
  UI->>API: POST /api/local/problems/{problemId}/run-tests
  API->>WS: runTests(problemId)
  WS->>Shell: bash run.sh
  Shell->>Java: javac src/*.java
  Shell->>Java: java -cp out Main tests/cases.json
  Java-->>Shell: JURO_CASE lines + JURO_RESULT
  Shell-->>WS: stdout/stderr/exit code
  WS->>WS: Parse JURO_CASE JSON lines
  WS-->>UI: LocalProblemRunResponse
  UI->>UI: Render case results and grade buttons
  User->>UI: Passed or Needs review
  UI->>ReviewAPI: POST /api/problems/{problemId}/review-results
  ReviewAPI->>Review: recordManualResult(CODING, passed)
  Review->>DB: Update coding schedule
  DB-->>UI: ReviewStateResponse
```

Local test execution does not automatically grade the review in the UI; the user marks the coding review based on the deterministic test output.

## Sequence: Knowledge Check With Local AI

```mermaid
sequenceDiagram
  actor User
  participant UI as KnowledgeCheckDialog
  participant Speech as Browser SpeechRecognition
  participant API as KnowledgeEvaluationController
  participant Service as KnowledgeEvaluationService
  participant Gateway as AiEvaluationGateway
  participant Provider as Ollama or Codex Adapter
  participant ReviewAPI as ProblemReviewController
  participant Review as ProblemReviewService
  participant DB as problem_review_states

  User->>UI: Record or type explanation
  UI->>Speech: Optional browser speech transcription
  Speech-->>UI: final/interim transcript chunks
  User->>UI: Submit
  UI->>API: POST /api/problems/{problemId}/knowledge-evaluations
  API->>Service: evaluate(problemId, transcript)
  Service->>Service: Build rubric prompt
  Service->>Gateway: generateJson(prompt)
  Gateway->>Provider: Ollama /api/generate or Codex /v1/chat/completions
  Provider-->>Gateway: JSON-like evaluation text
  Gateway-->>Service: generated text
  Service->>Service: Parse score, status, strengths, missing concepts
  Service-->>UI: KnowledgeEvaluationResponse
  UI->>UI: Show AI feedback and grade buttons
  User->>UI: Passed or Needs review
  UI->>ReviewAPI: POST /api/problems/{problemId}/review-results
  ReviewAPI->>Review: recordManualResult(EXPLANATION, passed)
  Review->>DB: Update explanation schedule
```

The AI gives feedback, but the frontend records the explanation review only after the user chooses the grade.

## Sequence: Create Or Edit Problem

```mermaid
sequenceDiagram
  actor User
  participant Drawer as EditProblemDrawer
  participant Zod as problemSchema
  participant API as ProblemController
  participant Service as ProblemService
  participant Mapper as ProblemMapper
  participant DB as problems / examples / test_cases
  participant Review as ProblemReviewService

  User->>Drawer: Fill New/Edit Problem form
  Drawer->>Zod: Validate Java-only form, 3 examples, 3 test cases, video URL, rubric
  Zod-->>Drawer: valid or field errors
  User->>Drawer: Save
  Drawer->>API: POST /api/problems or PUT /api/problems/{id}
  API->>Service: createProblem/updateProblem(request)
  Service->>Service: Validate Java-only, minimum examples/test cases, YouTube URL, rubric length
  Service->>DB: Save Problem with cascaded examples/test cases
  Service->>Review: ensureStates(problem)
  Review->>DB: Create CODING and EXPLANATION states if missing
  Service->>Mapper: toDetail(problem)
  Mapper-->>Drawer: ProblemDetailResponse
```

Frontend and backend both validate the same core constraints: Java-only, at least three examples, at least three runnable test cases, solution video, and knowledge rubric.

## Review Scheduling Flow

```mermaid
flowchart TD
  Start[Review result recorded] --> Track{Track}
  Track --> Coding[CODING]
  Track --> Explain[EXPLANATION]
  Coding --> Passed{Passed?}
  Explain --> Passed
  Passed -->|No| Fail[Set LEARNING<br/>lastResult FAILED<br/>lapses + 1<br/>repetitions = 0]
  Passed -->|Yes| Pass[Set REVIEW or MASTERED<br/>lastResult PASSED<br/>repetitions + 1<br/>ease adjusted]
  Fail --> FailInterval[Base failed interval<br/>coding: 2 days<br/>explanation: 1 day]
  Pass --> BaseInterval[SM-2 style base interval<br/>explanation grows faster early but shorter overall<br/>coding uses longer intervals]
  FailInterval --> Settings[Apply LocalWorkspaceSettings<br/>track frequency multiplier<br/>minimum interval<br/>track maximum interval]
  BaseInterval --> Settings
  Settings --> Due[Set dueAt = now + intervalDays]
  Due --> Priority[Refresh priorityScore<br/>due weight x track weight x lapse weight]
  Priority --> Save[Save problem_review_states row]
```

The scheduler uses the saved settings when a future review result is recorded; it does not recalculate every stored due date globally.

## Data Flow Diagram

```mermaid
flowchart LR
  ProblemAuthor[Problem authoring input] --> ProblemAPI[Problem API]
  ProblemAPI --> ProblemDB[(Problem tables)]
  ProblemDB --> ProblemBank[Problem Bank UI]

  ProblemBank --> EditorAPI[Open editor API]
  EditorAPI --> ScaffoldFiles[Local scaffold files<br/>README / Solution.java / Main.java / cases.json]
  ScaffoldFiles --> LocalEditor[Preferred editor]
  LocalEditor --> Solution[Edited Solution.java]
  Solution --> RunAPI[Run tests API]
  RunAPI --> JavaRun[javac + Main]
  JavaRun --> TestResult[Test result response]
  TestResult --> CodingGrade[User coding grade]
  CodingGrade --> ReviewDB[(Review state)]

  ProblemBank --> KnowledgeUI[Knowledge Check UI]
  KnowledgeUI --> Transcript[Transcript text]
  Transcript --> AiAPI[Knowledge evaluation API]
  AiAPI --> LocalAI[Ollama or Codex Adapter]
  LocalAI --> AiFeedback[Score and feedback]
  AiFeedback --> ExplanationGrade[User explanation grade]
  ExplanationGrade --> ReviewDB

  ReviewDB --> ProblemBank
```

Problem content, deterministic code results, AI feedback, and user grading converge into review state that drives Problem Bank ordering and status pills.
