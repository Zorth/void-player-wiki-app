import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const VAULT_PATH = process.env.VAULT_PATH || '/mnt/whale/07_NOTES_WORKING/void_player_wiki';
const ATTACHMENTS_DIR = path.join(VAULT_PATH, '_META', '_attachments');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

export async function GET(req: NextRequest) {
  try {
    if (!fs.existsSync(ATTACHMENTS_DIR)) {
      return NextResponse.json({ images: [] });
    }

    const files = fs.readdirSync(ATTACHMENTS_DIR);
    const images: Array<{ filename: string; url: string; size: number; mtime: string }> = [];

    for (const f of files) {
      const ext = path.extname(f).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext)) {
        try {
          const stat = fs.statSync(path.join(ATTACHMENTS_DIR, f));
          if (stat.isFile()) {
            images.push({
              filename: f,
              url: `/api/attachments/${encodeURIComponent(f)}`,
              size: stat.size,
              mtime: stat.mtime.toISOString(),
            });
          }
        } catch {}
      }
    }

    // Sort newest modified first, then alphabetically
    images.sort((a, b) => b.mtime.localeCompare(a.mtime) || a.filename.localeCompare(b.filename));

    return NextResponse.json(
      { images },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
      }
    );
  } catch (err: any) {
    console.error('Failed to list attachments:', err);
    return NextResponse.json(
      { error: err.message },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
