import { Hono } from 'hono';
import type { Env } from '../types';

const r2 = new Hono<{ Bindings: Env }>();

// R2 파일 서빙: /r2/deliver-mgmt/*
r2.get('/deliver-mgmt/*', async (c) => {
  // URL에서 파일 경로 추출: /r2/deliver-mgmt/deliveries/{id}/{ts}.jpg → deliveries/{id}/{ts}.jpg
  const path = c.req.path.replace('/r2/deliver-mgmt/', '');

  if (!path) {
    return c.json({ error: 'File path required' }, 400);
  }

  const object = await c.env.STORAGE.get(path);

  if (!object) {
    return c.json({ error: 'File not found' }, 404);
  }

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000'); // 1년 캐시
  headers.set('ETag', object.etag);

  return new Response(object.body, { headers });
});

export default r2;
