import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the LimeZu credit link is present and wired into the app', () => {
  const credit = readFileSync('packages/client/src/ui/ArtCredit.tsx', 'utf8');
  assert.match(credit, /https:\/\/limezu\.itch\.io\//, 'licence requires the credit URL');
  assert.match(credit, /LimeZu/, 'the artist is named');
  const app = readFileSync('packages/client/src/App.tsx', 'utf8');
  assert.match(app, /ArtCredit/, 'the credit is actually mounted');
});
