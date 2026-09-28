import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { recordUserLogin, canUserEdit, getDb } from './db';

const CLERK_ISSUER = process.env.CLERK_ISSUER || 'https://clerk.tarragon.be';
const CLERK_CLIENT_ID = process.env.CLERK_CLIENT_ID || 'UHlja8THZKIEwauP';
const CLERK_CLIENT_SECRET = process.env.CLERK_CLIENT_SECRET || 'zM1AjhFSwcp662AaBaVHawsM1cXvTGSb';
export const APP_URL = process.env.APP_URL || 'https://void.tarragon.be';
const SESSION_SECRET_STRING = process.env.SESSION_SECRET || 'super_secret_void_player_wiki_key_2026_thor_deep';
const SESSION_SECRET = new TextEncoder().encode(SESSION_SECRET_STRING);
const COOKIE_NAME = 'void_wiki_session';

export interface UserSession {
  userId: string;
  name: string;
  email: string;
  picture?: string;
  nickname?: string;
  isAdmin: boolean;
  isGamemaster: boolean;
  isMember: boolean;
  canEdit: boolean;
}

export function getLoginUrl(returnTo: string = '/'): string {
  const redirectUri = `${APP_URL}/auth/oidc.callback`;
  const state = Buffer.from(JSON.stringify({ returnTo })).toString('base64url');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLERK_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'openid profile email',
    state,
  });
  return `${CLERK_ISSUER}/oauth/authorize?${params.toString()}`;
}

export async function handleOidcCallback(code: string, stateStr?: string): Promise<{ session: UserSession; returnTo: string }> {
  const redirectUri = `${APP_URL}/auth/oidc.callback`;
  
  // 1. Exchange code for tokens
  const tokenRes = await fetch(`${CLERK_ISSUER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: CLERK_CLIENT_ID,
      client_secret: CLERK_CLIENT_SECRET,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Token exchange failed: ${tokenRes.status} ${errText}`);
  }

  const tokens = await tokenRes.json();
  const accessToken = tokens.access_token;
  const idToken = tokens.id_token;

  // 2. Fetch userinfo
  const userinfoRes = await fetch(`${CLERK_ISSUER}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  let userinfo: any = {};
  if (userinfoRes.ok) {
    userinfo = await userinfoRes.json();
  }

  // Also decode id_token claims if available
  let idClaims: any = {};
  if (idToken) {
    try {
      const parts = idToken.split('.');
      if (parts.length === 3) {
        idClaims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
      }
    } catch {}
  }

  const claims = { ...idClaims, ...userinfo };

  const userId = claims.sub || claims.id;
  const name = claims.name || claims.given_name || claims.preferred_username || 'Anonymous Player';
  const email = claims.email || '';
  const picture = claims.picture || claims.avatar_url || '';
  const nickname = claims.nickname || claims.preferred_username || name;
  
  // Check admin claim from Clerk public_metadata or super admin fallback
  const rawAdmin = claims.admin || claims.public_metadata?.admin;
  const isSuperAdmin = email === 'jasper_goens@hotmail.com' || 
    email === 'hubbe.platteau2@gmail.com' ||
    nickname?.toLowerCase() === 'zorth' || 
    nickname?.toLowerCase() === 'hubbe' ||
    userId === 'user_3AZtRlDbNyvNAaBVjvrfceGwe69' ||
    userId === 'user_3AiTA7kVIsvRACWPU8yELDGggKj';
  const isAdmin = Boolean(rawAdmin === true || rawAdmin === 'true' || isSuperAdmin);

  const rawGm = claims.gamemaster || claims.public_metadata?.gamemaster;
  const isGamemaster = Boolean(rawGm === true || rawGm === 'true');

  const rawMember = claims.isMember || claims.public_metadata?.isMember;
  const isMember = Boolean(rawMember === true || rawMember === 'true');

  // Record user in DB and determine edit rights
  recordUserLogin(userId, name, email, nickname, picture, isAdmin);
  const canEdit = canUserEdit(userId, isAdmin);

  const session: UserSession = {
    userId,
    name,
    email,
    picture,
    nickname,
    isAdmin,
    isGamemaster,
    isMember,
    canEdit,
  };

  // Decode returnTo
  let returnTo = '/';
  if (stateStr) {
    try {
      const stateObj = JSON.parse(Buffer.from(stateStr, 'base64url').toString('utf-8'));
      if (stateObj.returnTo) returnTo = stateObj.returnTo;
    } catch {}
  }

  return { session, returnTo };
}

export async function createSessionCookie(session: UserSession) {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(SESSION_SECRET);

  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
}

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET);
    const session = payload as unknown as UserSession;

    // Refresh permissions dynamically from DB and super admin check
    const isSuperAdmin = session.email === 'jasper_goens@hotmail.com' || session.nickname?.toLowerCase() === 'zorth' || session.userId === 'user_3AZtRlDbNyvNAaBVjvrfceGwe69';
    if (isSuperAdmin) {
      session.isAdmin = true;
      session.canEdit = true;
    } else {
      const db = getDb();
      const rec = db.prepare('SELECT can_edit, is_admin FROM user_permissions WHERE user_id = ?').get(session.userId) as any;
      if (rec) {
        if (rec.is_admin === 1) session.isAdmin = true;
        session.canEdit = rec.can_edit === 1 || rec.is_admin === 1 || session.isAdmin;
      } else {
        session.canEdit = canUserEdit(session.userId, session.isAdmin);
      }
    }

    return session;
  } catch {
    return null;
  }
}

export async function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}
