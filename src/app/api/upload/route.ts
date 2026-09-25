import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import path from 'path';
import fs from 'fs';

const VAULT_PATH = process.env.VAULT_PATH || '/mnt/whale/07_NOTES_WORKING/void_player_wiki';
const ATTACHMENTS_DIR = path.join(VAULT_PATH, '_META', '_attachments');

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.canEdit) {
    return NextResponse.json({ error: 'Unauthorized: Edit permission required' }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!fs.existsSync(ATTACHMENTS_DIR)) {
    fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  }

  const filename = path.basename(file.name);
  const filePath = path.join(ATTACHMENTS_DIR, filename);

  const bytes = await file.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(bytes));

  try {
    fs.chownSync(filePath, 1000, 1000);
    fs.chmodSync(filePath, 0o775);
  } catch (err) {
    // ignore error if not supported in dev
  }

  return NextResponse.json({
    success: true,
    filename,
    url: `/api/attachments/${encodeURIComponent(filename)}`,
    markdown: `![[${filename}]]`,
  });
}
