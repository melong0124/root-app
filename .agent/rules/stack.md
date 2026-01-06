---
trigger: always_on
---

# Project Context: Asset Management Web (Remix / React Router v7)

## 🛠 Core Technology Stack
- **Framework:** Remix (React Router v7 Framework mode)
- **Runtime:** Node.js (Vite-based compiler)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Data Fetching:** Remix Loaders & Actions (Standard)
- **State Management:** - Server-Client Sync: Remix Navigation State
  - Client-only: Zustand (Optional, for UI local state)
- **Validation:** Zod (Essential for Action data validation)
- **Charts:** Recharts (for Financial Data Visualization)

## 📏 Coding Standards & Rules
1. **Full-stack Patterns:** 데이터 읽기는 `loader`, 쓰기(POST/PUT/DELETE)는 `action` 함수 내에서 처리한다.
2. **Form Handling:** 브라우저 기본 기능을 활용하는 Remix `<Form>` 컴포넌트를 우선 사용한다.
3. **Type Safety:** - `useLoaderData<typeof loader>()`를 사용하여 서버 데이터를 완벽한 타입으로 추론한다.
   - 모든 API 응답과 폼 데이터는 `zod` 스키마를 통해 검증한다.
4. **Performance:** - React Compiler를 활성화하여 불필요한 렌더링 최적화 코드를 줄인다.
   - 자산 계산 등 무거운 로직은 가급적 서버(loader)에서 처리하여 클라이언트로 전달한다.
5. **Asset Formatting:** 금액 표기 시 원화(KRW) 기준 `Intl.NumberFormat` 유틸리티를 공통으로 사용한다.

## 💰 Domain Specifics (Asset Management)
- 실시간 자산 업데이트가 필요한 경우 Remix의 `shouldRevalidate` 옵션을 활용하여 효율적으로 데이터를 갱신한다.
- 보안이 중요한 금융 데이터 처리는 반드시 서버측 `action`에서 검증 후 처리한다.

## ⌨️ Code Style Guide (General & React)

### 1. Naming Conventions
- **Components:** `PascalCase` (예: `AssetDashboard.tsx`)
- **Functions/Variables:** `camelCase` (예: `const totalBalance = ...`)
- **Constants:** `UPPER_SNAKE_CASE` (예: `const MAX_LIMIT = 100`)
- **Booleans:** `is`, `has`, `should` 접두사 사용 (예: `isLoaded`, `hasError`)
- **Folder Names:** `kebab-case` (예: `components/asset-card/`)

### 2. Component Structure
- **Order:**
  1. Imports (External -> Internal)
  2. TypeScript Types/Interfaces
  3. Component definition
  4. Styled Components or Sub-components (if any)
- **Functional Components:** 화살표 함수(`const MyComponent = () => {}`) 사용을 기본으로 한다.
- **Props:** 구조 분해 할당(Destructuring)을 사용하여 선언부에서 명시한다.

### 3. TypeScript Best Practices
- `any` 사용을 절대 금지하며, 불분명한 경우 `unknown`을 사용한다.
- Interface보다는 `type` 사용을 권장한다 (Remix/React 생태계 지향).
- API 응답은 반드시 명시적인 타입을 정의한다.

### 4. Logic & Clean Code
- **Early Return:** 조건문은 가급적 일찍 반환(Return Early)하여 들여쓰기 깊이를 줄인다.
- **Magic Numbers:** 의미를 알 수 없는 숫자는 상수로 선언하여 사용한다.
- **Single Responsibility:** 하나의 함수/컴포넌트는 가급적 하나의 역할만 수행한다.

### 5. Comments
- 코드로 의도를 파악할 수 있도록 명확한 변수명을 짓고, 설명이 꼭 필요한 '이유(Why)' 위주로 주석을 작성한다.
- JSDoc 스타일을 활용하여 복잡한 유틸리티 함수의 파라미터와 반환값을 명시한다.