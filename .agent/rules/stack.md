---
trigger: always_on
---

# Development Rules: Asset Management Web

## 📏 Coding Standards & Patterns
1. **Full-stack Patterns:** 모든 데이터 연산은 Remix의 `loader`(읽기)와 `action`(쓰기)을 통해 처리한다.
2. **Form Handling:** 브라우저 기본 기능을 활용하는 Remix `<Form>` 컴포넌트를 우선 사용한다.
3. **Type Safety:** 
   - `useLoaderData<typeof loader>()`를 사용하여 서버 데이터를 완벽한 타입으로 추론한다.
   - 모든 외부 데이터는 `zod` 스키마를 통해 검증한다.
4. **Performance:** 불필요한 렌더링을 방지하기 위해 서버 측 처리를 우선하고 React Compiler를 활용한다.

## 💰 Domain Specifics (Asset Management)
- **Real-time Revalidation:** 자산 업데이트 시 `shouldRevalidate` 옵션을 적절히 활용한다.
- **Security:** 모든 테이블은 Supabase RLS를 준수하며, 반드시 세션 체크 후 데이터를 처리한다.
- **Date & Timezone:** 
  - 날짜 비교 시 `Intl.DateTimeFormat`의 'Asia/Seoul' 기준 문자열 비교를 권장한다.
  - Prisma 쿼리 내 직접 필터링보다 데이터 로드 후 JS 단에서 시간를 고려한 필터링이 안전하다.
- **Data Testing Rule (CRITICAL):**
  - 데이터를 테스트할 때는 반드시 **현재월을 초과하는 미래의 월**(예: 현재월이 2026년 2월이라면 2026년 3월 이후)만 사용한다.
  - 현재월까지의 데이터는 실제 운영 데이터이므로 절대 수정하거나 삭제하지 않는다.

## ⌨️ Code Style Guide
### 1. Naming
- **Components:** `PascalCase`
- **Functions/Variables:** `camelCase`
- **Constants:** `UPPER_SNAKE_CASE`
- **Booleans:** `is`, `has`, `should` 접두사 필수

### 2. Component Structure
- Imports (External -> Internal) -> Types -> Component definition -> Utils 순서로 작성한다.
- 화살표 함수 구문을 사용하고 Props는 구조 분해 할당으로 선언한다.

### 3. Logic & Clean Code
- **Early Return:** 조건문은 가급적 일찍 반환하여 들여쓰기 깊이를 최소화한다.
- **Single Responsibility:** 하나의 함수/컴포넌트는 하나의 명확한 역할만 수행한다.
- **Comments:** '어떻게(How)'보다 '왜(Why)'를 설명하는 주석 위주로 작성한다.

## 🔐 Git & Push Rules
- 모든 푸시 시 계정 충돌 방지를 위해 `--local` 설정을 확인한다.
- 이메일 노출 방지가 활성화된 경우 리플레이스먼트 이메일을 사용하거나 설정을 일시 조정하여 푸시한다.
