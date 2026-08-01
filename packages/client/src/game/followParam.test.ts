// Plan 03 Task 3: the presence-model-level half of the ?follow= deep-link —
// parse + resolve against a synced roster. The bus wiring (navigation.ts →
// agent:goto → agent:focus / pendingFocusId) imports Phaser and is covered by
// the manual browser pass recorded in the plan's execution log, not here.
import { describe, expect, it } from 'vitest';
import { createPendingFollow, parseFollowParam, type FollowTarget } from './followParam.js';

const ada: FollowTarget = { id: 'uuid-1', location: 'cafe', spriteSeed: 'ada' };
const bob: FollowTarget = { id: 'uuid-2', location: 'district', spriteSeed: 'bob' };
const fixtureAgent: FollowTarget = { id: 'local-3', location: 'observatory' }; // fixture mode: no spriteSeed

describe('parseFollowParam', () => {
  it('reads the follow param', () => {
    expect(parseFollowParam('?follow=ada')).toBe('ada');
  });

  it('is null when absent or empty', () => {
    expect(parseFollowParam('')).toBeNull();
    expect(parseFollowParam('?other=1')).toBeNull();
    expect(parseFollowParam('?follow=')).toBeNull();
  });

  it('decodes percent-encoded values', () => {
    expect(parseFollowParam('?follow=liora%2D7')).toBe('liora-7');
  });
});

describe('createPendingFollow', () => {
  it('matches by spriteSeed (the username the frontend links)', () => {
    const follow = createPendingFollow('?follow=ada');
    expect(follow.consume([bob, ada])).toBe(ada);
  });

  it('matches by id (fixture mode has no spriteSeed)', () => {
    const follow = createPendingFollow('?follow=local-3');
    expect(follow.consume([fixtureAgent])).toBe(fixtureAgent);
  });

  it('stays pending until the roster first contains the agent (presence loads async)', () => {
    const follow = createPendingFollow('?follow=ada');
    expect(follow.consume([])).toBeNull(); // boot: roster not loaded yet
    expect(follow.consume([bob])).toBeNull(); // still not arrived
    expect(follow.consume([bob, ada])).toBe(ada); // arrives later — resolves now
  });

  it('fires exactly once', () => {
    const follow = createPendingFollow('?follow=ada');
    expect(follow.consume([ada])).toBe(ada);
    expect(follow.consume([ada])).toBeNull(); // later polls never re-aim the camera
  });

  it('an unknown agent never fires — default camera', () => {
    const follow = createPendingFollow('?follow=nobody');
    expect(follow.consume([ada, bob, fixtureAgent])).toBeNull();
    expect(follow.consume([ada, bob, fixtureAgent])).toBeNull();
  });

  it('no param never fires', () => {
    const follow = createPendingFollow('');
    expect(follow.consume([ada, bob])).toBeNull();
  });
});
