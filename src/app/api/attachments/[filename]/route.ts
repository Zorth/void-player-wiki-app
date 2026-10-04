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

// In-memory cache for attachment locations: safeFilename.toLowerCase() -> filePath
const attachmentCache = new Map<string, string>();
let lastAttachmentScan = 0;
const ATTACHMENT_SCAN_TTL = 60 * 1000;

function refreshAttachmentCache() {
  const now = Date.now();
  if (now - lastAttachmentScan < ATTACHMENT_SCAN_TTL && attachmentCache.size > 0) {
    return;
  }
  attachmentCache.clear();
  for (const dir of SEARCH_DIRS) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (f.endsWith('.md')) continue;
        const full = path.join(dir, f);
        try {
          if (!fs.statSync(full).isDirectory()) {
            const fLower = f.toLowerCase();
            if (!attachmentCache.has(fLower)) {
              attachmentCache.set(fLower, full);
            }
          }
        } catch {}
      }
    } catch {}
  }
  lastAttachmentScan = now;
}

export async function GET(req: NextRequest, { params }: { params: { filename: string } }) {
  const filename = decodeURIComponent(params.filename);

  // Security: prevent path traversal
  const safeFilename = path.basename(filename);
  const lowerName = safeFilename.toLowerCase();
  let filePath: string | null = null;

  // 1. Direct path check across search dirs
  for (const dir of SEARCH_DIRS) {
    const directPath = path.join(dir, safeFilename);
    if (fs.existsSync(directPath)) {
      try {
        if (!fs.statSync(directPath).isDirectory()) {
          filePath = directPath;
          break;
        }
      } catch {}
    }
  }

  // 2. Check in-memory attachment cache
  if (!filePath) {
    refreshAttachmentCache();
    filePath = attachmentCache.get(lowerName) || null;
    if (!filePath) {
      const baseWithoutExt = lowerName.substring(0, lowerName.lastIndexOf('.')) || lowerName;
      filePath = attachmentCache.get(`${baseWithoutExt}.webp`) || null;
    }
  }

  if (!filePath || !fs.existsSync(filePath)) {
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
