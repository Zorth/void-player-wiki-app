import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const VAULT_PATH = process.env.VAULT_PATH || '/mnt/whale/07_NOTES_WORKING/void_player_wiki';
const ATTACHMENTS_DIR = path.join(VAULT_PATH, '_META', '_attachments');

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
  let filePath = path.join(ATTACHMENTS_DIR, safeFilename);

  // Fallback case-insensitive check
  if (!fs.existsSync(filePath)) {
    if (fs.existsSync(ATTACHMENTS_DIR)) {
      const allFiles = fs.readdirSync(ATTACHMENTS_DIR);
      // Direct match case-insensitive
      let matched = allFiles.find(f => f.toLowerCase() === safeFilename.toLowerCase());
      
      // If original image not found, check if a converted .webp version exists
      if (!matched) {
        const baseWithoutExt = safeFilename.substring(0, safeFilename.lastIndexOf('.')) || safeFilename;
        matched = allFiles.find(f => f.toLowerCase() === `${baseWithoutExt.toLowerCase()}.webp`);
      }

      if (matched) {
        filePath = path.join(ATTACHMENTS_DIR, matched);
      }
    }
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
