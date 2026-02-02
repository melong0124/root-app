
# Project Context: Asset Management Web (Remix / React Router v7)

### 📁 AI Agent Configuration (.agent)
이 프로젝트는 Antigravity 표준 지침을 준수하여 에이전트 설정을 관리합니다.
- **`memory/`**: 장기 기억 공간입니다. 프로젝트의 변하지 않는 맥락(기술 스택, 인프라 정보)을 `stack.md`에 저장합니다.
- **`rules/`**: 가이드라인 공간입니다. 코딩 스타일, 보안 제약, 비즈니스 규칙을 `stack.md`에 정의하여 에이전트의 동작을 규제합니다.
- **`skills/`**: 재사용 가능한 기술 패키지 공간입니다. 특정 작업 수행 방식(SKILL.md)을 저장합니다.
- **`workflows/`**: 작업 흐름 공간입니다. 복잡한 절차를 마크다운 형태의 워크플로우로 정의하여 슬래시 명령어로 활용합니다.

## 🔐 Git Identity & Environment
- **GitHub Account:** `melong0124` (Personal Account)
- **Local Git Config:** 반드시 로컬 설정(`git config --local`)을 사용하여 회사 계정과 격리한다.
  - `user.name`: `melong0124`
  - `user.email`: `melong0124@gmail.com`
- **Authentication & Push:** 
  - 기본적으로 `gh auth switch`를 통해 계정을 전환하여 사용할 수 있으나, 인증 토큰 충돌 발생 시 아래 명령어로 강제 푸시한다.
  - `git push -u "https://$(gh auth token)@github.com/melong0124/root-app.git" main` 

## 🌐 Port Configuration
- **Frontend (Vite):** `5174` (URL: `http://localhost:5174`)
- **Backend (Supabase Local):** `54321` (URL: `http://localhost:54321`)

## 🛠 Core Technology Stack
- **Framework:** Remix (React Router v7 Framework mode)
- **Runtime:** Node.js (Vite-based compiler)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Data Fetching:** Remix Loaders & Actions (Standard)
- **Database:** Supabase (Auth/DB/RLS)
- **ORM:** Prisma
- **State Management:** Remix Navigation State, Zustand (Optional)
- **Charts:** Recharts

## 🚀 Development Workflow & Scripts
1. `npm run dev`: 개발 서버 실행
2. `npx prisma migrate dev`: DB 마이그레이션
3. `npx prisma studio`: DB GUI 실행

## 🔑 Environment Variables (.env)
- `DATABASE_URL` / `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`
- `SESSION_SECRET` / `DEV_MODE`
