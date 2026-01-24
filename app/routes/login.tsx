import { redirect, type LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { checkSupabaseConfig } from '~/lib/supabase.server';
import { getSupabaseSession } from '~/lib/session.server';

export async function loader({ request }: LoaderFunctionArgs) {
    // Supabase 설정 확인
    const config = checkSupabaseConfig();
    if (!config.configured) {
        return { error: config.message, configured: false };
    }

    // 이미 로그인된 경우 대시보드로 리다이렉트
    const session = await getSupabaseSession(request);
    if (session) {
        return redirect('/');
    }

    return { configured: true };
}

export default function Login() {
    const data = useLoaderData<typeof loader>();

    // Supabase가 설정되지 않은 경우
    if (!data.configured) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
                <div className="w-full max-w-md p-8">
                    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                        <div className="text-center mb-6">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-yellow-100 mb-4">
                                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Supabase 설정 필요</h1>
                            <p className="text-gray-600 text-sm">{data.error}</p>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <h3 className="font-semibold text-blue-900 mb-2">설정 방법:</h3>
                            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                                <li>프로젝트 루트의 <code className="bg-blue-100 px-1 rounded">.env</code> 파일 생성</li>
                                <li>다음 환경 변수 추가:
                                    <pre className="bg-blue-100 p-2 rounded mt-2 text-xs overflow-x-auto">
                                        {`SUPABASE_URL="your-url"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SESSION_SECRET="random-secret"`}
                                    </pre>
                                </li>
                                <li>서버 재시작</li>
                            </ol>
                        </div>

                        <div className="text-center text-xs text-gray-500">
                            <p>자세한 설정 방법은 <code className="bg-gray-100 px-1 rounded">SUPABASE_AUTH_SETUP.md</code> 파일을 참고하세요.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const handleGoogleLogin = async () => {
        // 클라이언트용 Supabase 동적 import
        const { supabase } = await import('~/lib/supabase.client');

        if (!supabase) {
            alert('Supabase가 설정되지 않았습니다.');
            return;
        }

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                // PKCE flow 사용 (서버 사이드 인증에 필요)
                skipBrowserRedirect: false,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        });

        if (error) {
            console.error('Login error:', error);
            alert('로그인 중 오류가 발생했습니다.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
            <div className="w-full max-w-md p-8">
                {/* 로고 및 타이틀 */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 mb-4 shadow-lg">
                        <svg
                            className="w-8 h-8 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">자산 관리</h1>
                    <p className="text-gray-600">간편하게 로그인하고 자산을 관리하세요</p>
                </div>

                {/* 로그인 카드 */}
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                    <div className="space-y-4">
                        <button
                            onClick={handleGoogleLogin}
                            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-gray-200 rounded-xl font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm hover:shadow-md group"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            <span className="text-base">Google 계정으로 로그인</span>
                        </button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-4 bg-white text-gray-500">또는</span>
                            </div>
                        </div>

                        <div className="text-center text-sm text-gray-500">
                            <p>이메일/비밀번호 로그인은 추후 지원 예정입니다.</p>
                        </div>
                    </div>
                </div>

                {/* 푸터 */}
                <div className="mt-8 text-center text-sm text-gray-500">
                    <p>로그인하면 서비스 이용약관 및 개인정보 처리방침에 동의하게 됩니다.</p>
                </div>
            </div>
        </div>
    );
}
