import { redirect, type ActionFunctionArgs } from 'react-router';
import { getSession, destroySession } from '~/lib/session.server';
import { supabase } from '~/lib/supabase.server';

/**
 * 로그아웃 처리
 * POST 요청으로만 처리하여 CSRF 방지
 */
export async function action({ request }: ActionFunctionArgs) {
    const session = await getSession(request.headers.get('Cookie'));
    const accessToken = session.get('accessToken');

    // Supabase 세션 무효화
    if (accessToken) {
        await supabase.auth.signOut();
    }

    // 세션 쿠키 삭제하고 로그인 페이지로 리다이렉트
    return redirect('/login', {
        headers: {
            'Set-Cookie': await destroySession(session),
        },
    });
}

/**
 * GET 요청은 POST로 리다이렉트
 */
export async function loader() {
    return redirect('/');
}
