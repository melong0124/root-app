import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || '';

/**
 * Supabase 클라이언트 (서버 사이드)
 * 인증 및 데이터베이스 작업에 사용
 * 
 * 환경 변수가 설정되지 않은 경우 더미 클라이언트를 반환합니다.
 */
export const supabase = SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
    : null;

/**
 * Supabase 설정 확인
 */
export function checkSupabaseConfig() {
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
        return {
            configured: false,
            message: 'Supabase 환경 변수가 설정되지 않았습니다. SUPABASE_AUTH_SETUP.md 파일을 참고하여 설정해주세요.',
        };
    }
    return { configured: true };
}
