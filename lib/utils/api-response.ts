import { NextResponse } from 'next/server';

export function createResponse(
  data: any,
  options?: { status?: number; headers?: HeadersInit }
) {
  return NextResponse.json(data, options);
}