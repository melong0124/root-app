import { useEffect } from 'react';
import { useNavigate } from 'react-router';

/**
 * Google OAuth 콜백 처리 (클라이언트 사이드)
 * Supabase PKCE flow는 클라이언트에서 처리해야 함
 */
export default function AuthCallback() {
    const navigate = useNavigate();

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // 클라이언트용 Supabase import
                const { supabase } = await import('~/lib/supabase.client');

                if (!supabase) {
                    console.error('[Auth Callback] Supabase client not initialized');
                    navigate('/login?error=supabase_not_configured');
                    return;
                }

                // URL에서 에러 확인
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const queryParams = new URLSearchParams(window.location.search);

                const error = queryParams.get('error') || hashParams.get('error');
                const errorDescription = queryParams.get('error_description') || hashParams.get('error_description');

                if (error) {
                    console.error('[Auth Callback] OAuth error:', error, errorDescription);
                    navigate('/login?error=' + encodeURIComponent(errorDescription || error));
                    return;
                }

                console.log('[Auth Callback] Processing session from URL...');

                // Supabase가 자동으로 URL에서 세션을 감지하고 처리
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    console.error('[Auth Callback] Session error:', sessionError);
                    navigate('/login?error=' + encodeURIComponent(sessionError.message));
                    return;
                }

                if (!session) {
                    console.error('[Auth Callback] No session found');
                    navigate('/login?error=no_session');
                    return;
                }

                console.log('[Auth Callback] Session obtained successfully');
                console.log('[Auth Callback] User:', session.user.email);

                // 세션이 localStorage에 자동 저장됨
                // 이제 서버로 세션 정보를 전달하기 위해 쿠키에 저장
                await fetch('/api/auth/session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        access_token: session.access_token,
                        refresh_token: session.refresh_token,
                    }),
                });

                console.log('[Auth Callback] Redirecting to home...');
                navigate('/');
            } catch (err) {
                console.error('[Auth Callback] Unexpected error:', err);
                navigate('/login?error=unexpected_error');
            }
        };

        handleCallback();
    }, [navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
            <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-lg text-gray-700">로그인 처리 중...</p>
            </div>
        </div>
    );
}
