# Supabase 구글 로그인 설정 가이드 (2025 최신)

이 프로젝트는 Supabase Auth를 사용하여 구글 OAuth 로그인을 구현합니다.

## 1. Supabase 프로젝트 설정

### 1.1 Supabase 프로젝트 생성
1. [Supabase Dashboard](https://app.supabase.com)에 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택

### 1.2 API 키 가져오기

Supabase는 2025년부터 새로운 API 키 시스템을 사용합니다:

1. Supabase Dashboard > **Project Settings > API**로 이동
2. **API Keys** 탭에서:
   - **Project URL** 복사 (예: `https://xxxxx.supabase.co`)
   - **Publishable key** 복사 (형식: `sb_publishable_...`)
     - 만약 Publishable key가 없다면 **Create new API Keys** 클릭

> **참고**: 이전의 `anon` 키와 `service_role` 키는 레거시 방식입니다. 새로운 프로젝트는 Publishable key를 사용하세요.

### 1.3 환경 변수 설정
`.env` 파일에 다음 정보를 추가하세요:

```bash
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_your-key-here"
SESSION_SECRET="your-random-secret-key"
```

- `SUPABASE_URL`: Supabase 프로젝트 설정 > API > Project URL
- `SUPABASE_PUBLISHABLE_KEY`: Supabase 프로젝트 설정 > API > Publishable key
- `SESSION_SECRET`: 랜덤 문자열 (예: `openssl rand -base64 32`로 생성)

## 2. Google OAuth 설정 (2025 최신 방식)

### 2.1 Google Cloud 프로젝트 준비
1. [Google Cloud Platform](https://console.cloud.google.com/home/dashboard)에 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택

### 2.2 Google Auth Platform 설정

Google은 이제 **Google Auth Platform Console**을 사용합니다:

#### Step 1: Audience (대상 사용자) 설정
1. [Google Auth Platform - Audience](https://console.cloud.google.com/auth/audience)로 이동
2. 어떤 Google 사용자가 로그인할 수 있는지 설정
   - **External** (외부): 모든 Google 계정 사용자
   - **Internal** (내부): 조직 내부 사용자만

#### Step 2: Data Access (Scopes) 설정
1. [Google Auth Platform - Scopes](https://console.cloud.google.com/auth/scopes)로 이동
2. 다음 스코프가 활성화되어 있는지 확인:
   - ✅ `openid` (수동으로 추가 필요)
   - ✅ `.../auth/userinfo.email` (기본 추가됨)
   - ✅ `.../auth/userinfo.profile` (기본 추가됨)

> **중요**: 추가 스코프를 요청하면 Google 검증이 필요할 수 있으며, 이는 시간이 오래 걸릴 수 있습니다.

#### Step 3: Branding (브랜딩) 설정 (권장)
1. [Google Auth Platform - Branding](https://console.cloud.google.com/auth/branding)로 이동
2. 앱 이름, 로고, 지원 이메일 등을 설정
3. 브랜드 검증 신청 (선택사항, 수 영업일 소요)

> **보안 팁**: 브랜딩을 설정하지 않으면 사용자에게 `<project-id>.supabase.co`가 표시되어 피싱 공격에 취약할 수 있습니다.

### 2.3 OAuth Client 생성

1. [Google Auth Platform - Clients](https://console.cloud.google.com/auth/clients)로 이동
2. **Create OAuth client ID** 클릭
3. **Application type**: Web application 선택
4. **Name**: 원하는 이름 입력 (예: "자산 관리 앱")

5. **Authorized JavaScript origins** 추가:
   ```
   http://localhost:5174
   https://yourdomain.com
   ```
   - 개발 환경: `http://localhost:5174`
   - 프로덕션: 실제 도메인 (예: `https://yourdomain.com`)

6. **Authorized redirect URIs** 추가:
   ```
   https://<your-project-id>.supabase.co/auth/v1/callback
   http://localhost:54321/auth/v1/callback
   ```
   - Supabase 프로덕션: `https://<your-project-id>.supabase.co/auth/v1/callback`
   - 로컬 개발: `http://localhost:54321/auth/v1/callback`

   > **참고**: Supabase Dashboard의 [Google Provider 페이지](https://supabase.com/dashboard/project/_/auth/providers?provider=Google)에서 정확한 콜백 URL을 확인할 수 있습니다.

7. **Create** 클릭
8. **Client ID**와 **Client Secret** 복사 및 저장

### 2.4 Supabase에 Google Provider 설정

1. Supabase Dashboard > **Authentication > Providers**로 이동
2. **Google** 찾아서 클릭
3. **Enable** 토글 켜기
4. Google Cloud Console에서 복사한 정보 입력:
   - **Client ID**: Google OAuth 클라이언트 ID
   - **Client Secret**: Google OAuth 클라이언트 보안 비밀번호
5. **Save** 클릭

### 2.5 Redirect URLs 설정

1. Supabase Dashboard > **Authentication > URL Configuration**으로 이동
2. **Site URL** 설정:
   - 개발: `http://localhost:5174`
   - 프로덕션: `https://yourdomain.com`

3. **Redirect URLs** 추가:
   - 개발: `http://localhost:5174/auth/callback`
   - 프로덕션: `https://yourdomain.com/auth/callback`

## 3. 데이터베이스 사용자 연동

### 3.1 Prisma 스키마 확인
현재 Prisma 스키마의 `User` 모델에 `email` 필드가 있는지 확인하세요:

```prisma
model User {
  id           String        @id @default(cuid())
  email        String        @unique
  // ... 기타 필드
}
```

### 3.2 첫 로그인 시 사용자 자동 생성 (선택사항)

로그인 후 사용자가 데이터베이스에 없으면 자동으로 생성하려면 `auth.callback.tsx`를 수정:

```typescript
// 사용자 정보로 DB에 사용자 생성 또는 조회
const user = await prisma.user.upsert({
  where: { email: data.session.user.email },
  create: { email: data.session.user.email },
  update: {},
});
```

## 4. 로컬 개발 테스트

1. 개발 서버 실행:
   ```bash
   npm run dev
   ```

2. 브라우저에서 `http://localhost:5174/login` 접속

3. **Google 계정으로 로그인** 버튼 클릭

4. Google 계정 선택 및 권한 승인

5. 로그인 성공 시 홈페이지(`/`)로 리다이렉트

## 5. 프로덕션 배포 시 주의사항

1. **환경 변수 설정**: 프로덕션 환경에 모든 환경 변수를 설정하세요.

2. **Redirect URL 업데이트**:
   - Google Auth Platform의 Authorized redirect URIs에 프로덕션 URL 추가
   - Supabase의 Redirect URLs에 프로덕션 URL 추가

3. **SESSION_SECRET**: 프로덕션에서는 반드시 강력한 랜덤 문자열을 사용하세요.

4. **HTTPS 사용**: 프로덕션에서는 반드시 HTTPS를 사용해야 합니다.

5. **Custom Domain** (권장):
   - Supabase [Custom Domain](https://supabase.com/docs/guides/platform/custom-domains) 설정
   - 예: `auth.yourdomain.com` 또는 `api.yourdomain.com`
   - 사용자 신뢰도 향상 및 피싱 방지

## 6. 문제 해결

### "provider is not enabled" 에러
- Supabase Dashboard > Authentication > Providers에서 Google이 활성화되어 있는지 확인
- Client ID와 Client Secret이 올바르게 입력되었는지 확인

### "redirect_uri_mismatch" 에러
- Google Auth Platform의 Authorized redirect URIs 확인
- Supabase의 정확한 콜백 URL을 사용하고 있는지 확인
- URL에 후행 슬래시(/)가 있는지 확인 (있으면 안 됨)

### 로그인 후 리다이렉트되지 않음
- Supabase의 Redirect URLs 설정 확인
- 브라우저 콘솔에서 에러 메시지 확인

### "User not found" 에러
- 데이터베이스에 사용자 이메일이 등록되어 있는지 확인
- 첫 로그인 시 자동 사용자 생성 로직 추가 고려

### 세션이 유지되지 않음
- `SESSION_SECRET` 환경 변수가 설정되어 있는지 확인
- 쿠키 설정 확인 (httpOnly, secure, sameSite)

## 7. 2025년 변경 사항 요약

### Google Auth Platform (새로운 방식)
- ✅ [Google Auth Platform Console](https://console.cloud.google.com/auth/overview) 사용
- ✅ Audience, Scopes, Branding을 별도로 설정
- ✅ [Clients](https://console.cloud.google.com/auth/clients)에서 OAuth 클라이언트 생성

### 이전 방식 (레거시)
- ❌ OAuth 동의 화면 (Consent Screen)
- ❌ API 및 서비스 > 사용자 인증 정보

> **참고**: 레거시 방식도 당분간 작동하지만, 새로운 Google Auth Platform을 사용하는 것이 권장됩니다.

## 8. API 키 관련 참고사항

### Supabase API 키 변경사항

- **레거시 (2024년 이전)**:
  - `anon` key: 클라이언트용
  - `service_role` key: 서버용

- **새로운 방식 (2025년 이후)**:
  - `sb_publishable_...`: 클라이언트용 (anon 대체)
  - `sb_secret_...`: 서버용 (service_role 대체)

현재 프로젝트는 새로운 Publishable key 방식을 사용합니다.

## 9. 추가 기능

### 이메일/비밀번호 로그인 추가
Supabase는 이메일/비밀번호 로그인도 지원합니다. 필요시 추가 구현 가능합니다.

### 다른 OAuth 제공자 추가
GitHub, Facebook, Twitter 등 다른 OAuth 제공자도 동일한 방식으로 추가할 수 있습니다.

## 10. 유용한 링크

- [Supabase Google Auth 공식 문서](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google Auth Platform Console](https://console.cloud.google.com/auth/overview)
- [Supabase Dashboard](https://app.supabase.com)
- [Supabase Custom Domains](https://supabase.com/docs/guides/platform/custom-domains)
