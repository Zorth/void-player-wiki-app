import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const VAULT_PATH = process.env.VAULT_PATH || '/mnt/whale/07_NOTES_WORKING/void_player_wiki';
const ATTACHMENTS_DIR = path.join(VAULT_PATH, '_META', '_attachments');
const UPLOAD_API_KEY = process.env.UPLOAD_API_KEY;

const ALLOWED_ORIGINS = [
  'https://guild.tarragon.be',
  'http://localhost:3000',
  'http://localhost:3005',
  'https://void.tarragon.be',
];

function getCorsHeaders(req: NextRequest) {
  const origin = req.headers.get('origin') || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.tarragon.be');
  const allowOrigin = isAllowed ? origin : 'https://guild.tarragon.be';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(req),
  });
}

export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  // Authentication check:
  // 1. Check API Key header (X-API-Key or Authorization: Bearer <key>)
  const apiKeyHeader = req.headers.get('x-api-key');
  const authHeader = req.headers.get('authorization');
  let bearerKey: string | null = null;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    bearerKey = authHeader.substring(7).trim();
  }

  const providedKey = apiKeyHeader || bearerKey;
  let isAuthorized = false;

  if (UPLOAD_API_KEY && providedKey === UPLOAD_API_KEY) {
    isAuthorized = true;
  } else {
    // 2. Fall back to user session cookie
    const session = await getSession();
    if (session && session.canEdit) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid session or API key required' },
      { status: 403, headers: corsHeaders }
    );
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400, headers: corsHeaders });
  }

  if (!fs.existsSync(ATTACHMENTS_DIR)) {
    fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  }

  // Sanitize filename and enforce .webp extension
  const originalName = path.basename(file.name);
  const baseNameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
  const safeBaseName = baseNameWithoutExt.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'image';
  const webpFilename = `${safeBaseName}.webp`;
  const filePath = path.join(ATTACHMENTS_DIR, webpFilename);

  const arrayBuffer = await file.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);

  try {
    // Automatically convert and compress into WebP with Sharp:
    // Max dimension 2048px (preserving aspect ratio) to prevent bloated uploads
    // WebP quality 82 (lossy, visually near-lossless, optimal web performance)
    await sharp(inputBuffer)
      .rotate() // Auto-orient based on EXIF
      .resize(2048, 2048, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toFile(filePath);

    try {
      fs.chownSync(filePath, 1000, 1000);
      fs.chmodSync(filePath, 0o775);
    } catch {}

    const fullUrl = `https://void.tarragon.be/api/attachments/${encodeURIComponent(webpFilename)}`;

    return NextResponse.json(
      {
        success: true,
        filename: webpFilename,
        url: `/api/attachments/${encodeURIComponent(webpFilename)}`,
        fullUrl,
        markdown: `![[${webpFilename}]]`,
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('Error processing image with sharp:', err);
    return NextResponse.json(
      { error: `Failed to process image: ${err.message}` },
      { status: 500, headers: corsHeaders }
    );
  }
}
