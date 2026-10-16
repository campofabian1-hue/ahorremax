import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePesoInput, formatPesoInput } from '../src/peso-input.mjs';

test('peso fields show a symbol and Colombian thousands separators', () => {
  assert.equal(formatPesoInput('1000000'), '$ 1.000.000');
  assert.equal(formatPesoInput('$ 26.000'), '$ 26.000');
  assert.equal(parsePesoInput('$ 1.250.000'), 1_250_000);
  assert.equal(parsePesoInput(''), NaN);
});
