import { type ActionFunctionArgs } from 'react-router';
import { getSession, commitSession } from '~/lib/session.server';
import { supabase } from '~/lib/supabase.server';
import { prisma } from '~/db.server';

/**
 * 클라이언트에서 받은 세션 토큰을 서버 쿠키에 저장
 * 첫 로그인 시 사용자를 DB에 자동 생성
 */
export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const body = await request.json();
        const { access_token, refresh_token } = body;

        if (!access_token || !refresh_token) {
            return new Response('Missing tokens', { status: 400 });
        }

        // Supabase에서 사용자 정보 가져오기
        if (!supabase) {
            console.error('[API Auth Session] Supabase not configured');
            return new Response('Supabase not configured', { status: 500 });
        }

        // 액세스 토큰으로 사용자 정보 조회
        const { data: { user }, error: userError } = await supabase.auth.getUser(access_token);

        if (userError || !user) {
            console.error('[API Auth Session] Failed to get user. Error:', JSON.stringify(userError));
            console.error('[API Auth Session] Access Token (shortened):', access_token?.substring(0, 10) + '...');
            return new Response(JSON.stringify({ error: 'Failed to get user info', detail: userError }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log('[API Auth Session] User info:', user.email);

        // DB에 사용자가 있는지 확인하고 없으면 생성
        try {
            const dbUser = await prisma.user.upsert({
                where: { email: user.email! },
                create: {
                    email: user.email!,
                    // 필요한 다른 필드들도 추가
                },
                update: {
                    // 로그인 시마다 업데이트할 필드가 있다면 여기에
                },
            });

            console.log('[API Auth Session] User synced to DB:', dbUser.email);
        } catch (dbError) {
            console.error('[API Auth Session] DB error:', dbError);
            // DB 에러가 있어도 세션은 저장 (나중에 수동으로 처리 가능)
        }

        // 세션 쿠키에 토큰 저장
        const session = await getSession(request.headers.get('Cookie'));
        session.set('accessToken', access_token);
        session.set('refreshToken', refresh_token);

        console.log('[API Auth Session] Session saved successfully');

        return new Response(JSON.stringify({ success: true }), {
            headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': await commitSession(session),
            },
        });
    } catch (error) {
        console.error('[API Auth Session] Error:', error);
        return new Response('Internal server error', { status: 500 });
    }
}
