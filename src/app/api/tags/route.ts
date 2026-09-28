import { NextResponse } from 'next/server';
import { getAllTags } from '@/lib/vault';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tags = getAllTags();
    return NextResponse.json({ tags });
  } catch (err: any) {
    console.error('Failed to get tags:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
