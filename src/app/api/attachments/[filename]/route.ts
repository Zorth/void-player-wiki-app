import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const VAULT_PATH = process.env.VAULT_PATH || '/mnt/whale/07_NOTES_WORKING/void_player_wiki';

const SEARCH_DIRS = [
  path.join(VAULT_PATH, '_META', '_attachments'),
  path.join(VAULT_PATH, '_attachments'),
  path.join(VAULT_PATH, 'attachments'),
  path.join(VAULT_PATH, 'Player Characters'),
  path.join(VAULT_PATH, 'World Notes'),
  VAULT_PATH,
];

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

export async function GET(req: NextRequest, { params }: { params: { filename: string } }) {
  const filename = decodeURIComponent(params.filename);

  // Security: prevent path traversal
  const safeFilename = path.basename(filename);
  let filePath: string | null = null;

  for (const dir of SEARCH_DIRS) {
    if (!fs.existsSync(dir)) continue;

    const directPath = path.join(dir, safeFilename);
    if (fs.existsSync(directPath) && !fs.statSync(directPath).isDirectory()) {
      filePath = directPath;
      break;
    }

    try {
      const allFiles = fs.readdirSync(dir);
      let matched = allFiles.find(f => f.toLowerCase() === safeFilename.toLowerCase());
      if (!matched) {
        const baseWithoutExt = safeFilename.substring(0, safeFilename.lastIndexOf('.')) || safeFilename;
        matched = allFiles.find(f => f.toLowerCase() === `${baseWithoutExt.toLowerCase()}.webp`);
      }
      if (matched) {
        const candidate = path.join(dir, matched);
        if (fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()) {
          filePath = candidate;
          break;
        }
      }
    } catch {}
  }

  if (!fs.existsSync(filePath)) {
    return new NextResponse('File Not Found', {
      status: 404,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_MAP[ext] || 'application/octet-stream';
  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
