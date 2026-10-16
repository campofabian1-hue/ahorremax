import test from 'node:test';
import assert from 'node:assert/strict';
import { coverCrop } from '../src/dream-photo.mjs';

test('a wide photo is cropped horizontally without changing its proportions', () => {
  const crop = coverCrop(2000, 1000, 960, 576);
  assert.ok(Math.abs(crop.sx - 166.67) < 0.01);
  assert.ok(Math.abs(crop.sw - 1666.67) < 0.01);
  assert.equal(crop.sy, 0);
  assert.equal(crop.sh, 1000);
});

test('position adjusts the part of a portrait shown in the dream frame', () => {
  const top = coverCrop(1000, 2000, 960, 576, 50, 0);
  const bottom = coverCrop(1000, 2000, 960, 576, 50, 100);
  assert.equal(top.sy, 0);
  assert.equal(bottom.sy, 1400);
  assert.equal(top.sw / top.sh, 960 / 576);
});

test('invalid dimensions are rejected before drawing', () => {
  assert.throws(() => coverCrop(0, 1000, 960, 576), /tamaño/);
});
