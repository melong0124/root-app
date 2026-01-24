import { createClient } from '@supabase/supabase-js';

// 브라우저 환경에서 window.ENV를 통해 환경 변수 가져오기
const getEnv = () => {
    if (typeof window !== 'undefined' && (window as any).ENV) {
        return (window as any).ENV;
    }
    return {};
};

const env = getEnv();
const SUPABASE_URL = env.SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY = env.SUPABASE_PUBLISHABLE_KEY || '';

/**
 * Supabase 클라이언트 (클라이언트 사이드)
 * 브라우저에서 사용하는 Supabase 클라이언트
 * PKCE flow를 사용하여 서버 사이드 인증 지원
 */
export const supabase = SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            // PKCE flow 사용 (서버 사이드 인증)
            flowType: 'pkce',
            // Storage를 localStorage로 설정
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        },
    })
    : null;
