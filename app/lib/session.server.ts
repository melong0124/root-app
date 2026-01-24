import { createCookieSessionStorage, redirect } from 'react-router';
import type { Session } from '@supabase/supabase-js';

type SessionData = {
    accessToken: string;
    refreshToken: string;
};

type SessionFlashData = {
    error: string;
};

/**
 * 쿠키 기반 세션 스토리지
 * Supabase 액세스 토큰과 리프레시 토큰을 안전하게 저장
 */
const { getSession, commitSession, destroySession } =
    createCookieSessionStorage<SessionData, SessionFlashData>({
        cookie: {
            name: '__session',
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
            sameSite: 'lax',
            secrets: [process.env.SESSION_SECRET || 'default-secret-change-in-production'],
            secure: process.env.NODE_ENV === 'production',
        },
    });

export { getSession, commitSession, destroySession };

/**
 * 요청 헤더에서 세션을 가져오는 헬퍼 함수
 */
export async function getSessionFromRequest(request: Request) {
    const cookie = request.headers.get('Cookie');
    return getSession(cookie);
}

/**
 * 세션에서 Supabase 세션 데이터를 가져오는 함수
 */
export async function getSupabaseSession(request: Request): Promise<Session | null> {
    const session = await getSessionFromRequest(request);
    const accessToken = session.get('accessToken');
    const refreshToken = session.get('refreshToken');

    if (!accessToken || !refreshToken) {
        return null;
    }

    return {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 3600,
        token_type: 'bearer',
        user: null as any, // 실제 사용 시 Supabase에서 user 정보를 가져와야 함
    };
}

/**
 * 인증이 필요한 라우트에서 사용하는 헬퍼 함수
 * 로그인하지 않은 경우 로그인 페이지로 리다이렉트
 * DEV_MODE=true인 경우 인증을 건너뜁니다 (로컬 개발용)
 */
export async function requireAuth(request: Request) {
    // 개발 모드에서는 인증 건너뛰기
    if (process.env.DEV_MODE === 'true') {
        console.log('🔓 DEV_MODE: Authentication skipped');
        return null; // 개발 모드에서는 세션 없이 진행
    }

    const session = await getSupabaseSession(request);

    if (!session) {
        throw redirect('/login');
    }

    return session;
}

/**
 * 세션에서 사용자 정보를 가져오는 함수
 * Supabase API를 호출하여 현재 로그인한 사용자 정보 반환
 */
export async function getUserFromSession(request: Request) {
    const session = await getSupabaseSession(request);

    if (!session) {
        return null;
    }

    // Supabase에서 사용자 정보 가져오기
    const { supabase } = await import('~/lib/supabase.server');

    if (!supabase) {
        return null;
    }

    const { data: { user }, error } = await supabase.auth.getUser(session.access_token);

    if (error || !user) {
        return null;
    }

    return user;
}
