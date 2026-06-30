import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const response = await fetch(targetUrl);
    if (!response.ok)
      throw new Error('Backend responded with ' + response.status);

    return new NextResponse(response.body as any, {
      headers: {
        'Content-Type':
          response.headers.get('Content-Type') || 'application/octet-stream',
      },
    });
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }
}
