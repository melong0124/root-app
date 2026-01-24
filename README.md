# Asset Management Web Application

개인 자산 관리를 위한 풀스택 웹 애플리케이션입니다. Remix (React Router v7)와 Supabase를 사용하여 구축되었습니다.

## 🌟 Features

- 💰 자산 및 부채 관리
- 📊 월별 자산 추적 및 시각화
- 📝 복식부기 기반 가계부
- 📈 자산 현황 통계 및 대시보드
- 🔐 Supabase Auth를 통한 Google OAuth 로그인
- 📱 반응형 디자인 (모바일/데스크톱)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL (또는 Supabase 계정)
- Google Cloud Platform 계정 (OAuth용)

### Installation

1. 저장소 클론:
```bash
git clone https://github.com/melong0124/root-app.git
cd root-app
```

2. 의존성 설치:
```bash
npm install
```

3. 환경 변수 설정:
```bash
cp .env.example .env
```

`.env` 파일을 열어 다음 값들을 설정하세요:
```bash
DATABASE_URL="postgresql://..."
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SESSION_SECRET="random-secret-key"
```

4. 데이터베이스 마이그레이션:
```bash
npx prisma migrate dev
```

### Development

개발 서버 실행:

```bash
npm run dev
```

애플리케이션이 다음 주소에서 실행됩니다:
- **Frontend:** `http://localhost:5174`
- **Backend (Supabase Local):** `http://localhost:54321`

## 🔧 Port Configuration

### 고정 포트
- **Frontend (Vite):** `5174`
- **Backend (Supabase):** `54321`

### 포트 충돌 해결

포트가 이미 사용 중인 경우, 다음 명령어로 프로세스를 종료하세요:

#### macOS/Linux:
```bash
# 5174 포트 사용 중인 프로세스 종료
lsof -ti:5174 | xargs kill -9

# 54321 포트 사용 중인 프로세스 종료
lsof -ti:54321 | xargs kill -9

# 서버 재시작
npm run dev
```

#### Windows (PowerShell):
```powershell
# 5174 포트 사용 중인 프로세스 종료
Get-Process -Id (Get-NetTCPConnection -LocalPort 5174).OwningProcess | Stop-Process -Force

# 54321 포트 사용 중인 프로세스 종료
Get-Process -Id (Get-NetTCPConnection -LocalPort 54321).OwningProcess | Stop-Process -Force

# 서버 재시작
npm run dev
```

## 🔐 Authentication Setup

Google OAuth 로그인을 설정하려면 `SUPABASE_AUTH_SETUP.md` 파일을 참고하세요.

간단 요약:
1. Google Auth Platform에서 OAuth 클라이언트 생성
2. Supabase Dashboard에서 Google Provider 활성화
3. Client ID와 Client Secret 입력

자세한 내용: [SUPABASE_AUTH_SETUP.md](./SUPABASE_AUTH_SETUP.md)

## 🛠 Tech Stack

### Frontend
- **Framework:** Remix (React Router v7)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Charts:** Recharts
- **State Management:** Remix Navigation State + Zustand (optional)

### Backend
- **Database:** PostgreSQL (via Supabase)
- **ORM:** Prisma
- **Auth:** Supabase Auth
- **API:** Remix Loaders & Actions

## 📁 Project Structure

```
root-app/
├── app/
│   ├── components/      # React 컴포넌트
│   ├── lib/            # 유틸리티 및 헬퍼 함수
│   ├── routes/         # Remix 라우트
│   └── root.tsx        # 루트 레이아웃
├── prisma/
│   └── schema.prisma   # 데이터베이스 스키마
├── public/             # 정적 파일
└── vite.config.ts      # Vite 설정
```

## 🚢 Building for Production

프로덕션 빌드 생성:

```bash
npm run build
```

프로덕션 서버 실행:

```bash
npm start
```

## 📝 Available Scripts

- `npm run dev` - 개발 서버 실행
- `npm run build` - 프로덕션 빌드
- `npm start` - 프로덕션 서버 실행
- `npm run typecheck` - TypeScript 타입 체크
- `npx prisma studio` - Prisma Studio 실행 (DB GUI)
- `npx prisma migrate dev` - 데이터베이스 마이그레이션

## 🔒 Security

- Row Level Security (RLS) 활성화
- 쿠키 기반 세션 관리
- CSRF 보호
- 환경 변수를 통한 시크릿 관리

## 📚 Documentation

- [Supabase Auth 설정 가이드](./SUPABASE_AUTH_SETUP.md)
- [프로젝트 컨텍스트](./.agent/memory/stack.md)
- [React Router 문서](https://reactrouter.com/)
- [Supabase 문서](https://supabase.com/docs)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is private and proprietary.

## 👤 Author

**melong0124**
- GitHub: [@melong0124](https://github.com/melong0124)

---

Built with ❤️ using Remix and Supabase.
