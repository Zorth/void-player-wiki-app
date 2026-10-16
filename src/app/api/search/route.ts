import { NextRequest, NextResponse } from 'next/server';
import { searchVault } from '@/lib/search';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const rawQuery = req.nextUrl.searchParams.get('q') || '';
  const results = searchVault(rawQuery);
  return NextResponse.json({ results });
}
