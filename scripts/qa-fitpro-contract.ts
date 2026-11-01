import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitProPostureImages } from '../supabase/functions/fitpro-api/contract.ts';
const host = 'mfrydtrzjxscbkaiwfnw.supabase.co';
const image = `https://${host}/storage/v1/object/sign/assessments/athlete/front.jpg?token=test-only`;
const body = { front: image, back: image, left: image, right: image };
test('all four views use the actual analyze-posture image contract', () => {
  assert.deepEqual(Object.keys(fitProPostureImages(body, host)), ['front', 'back', 'leftProfile', 'rightProfile']);
});
test('gateway accepts only signed FitPro assessment images', () => {
  for (const front of ['http://localhost/image', image.replace(host, 'other.supabase.co'), image.replace('assessments/', 'private/'), image.split('?')[0], image.replace('https://', 'https://user:pass@')])
    assert.throws(() => fitProPostureImages({ ...body, front }, host));
  assert.throws(() => fitProPostureImages({ front: image }, host));
});
