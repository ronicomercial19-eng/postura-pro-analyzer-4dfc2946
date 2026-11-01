export function fitProPostureImages(body: unknown, storageHost: string): Record<string, string> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Four posture images required');
  const images: Record<string, string> = {};
  const views = { front: 'front', back: 'back', left: 'leftProfile', right: 'rightProfile' };
  for (const [side, view] of Object.entries(views)) {
    const value = (body as Record<string, unknown>)[side];
    if (typeof value !== 'string' || value.length > 8192) throw new Error('Four posture images required');
    const image = new URL(value);
    if (image.protocol !== 'https:' || image.hostname !== storageHost || image.port || image.username || image.password || !image.pathname.startsWith('/storage/v1/object/sign/assessments/') || !image.searchParams.get('token'))
      throw new Error('Invalid posture image URL');
    images[view] = image.href;
  }
  return images;
}
