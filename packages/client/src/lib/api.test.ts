// Addendum II.1/II.2: the client half of the presence seam — mode pick and
// tolerant LocationsSnapshot parsing. Venue-knownness is deliberately NOT
// tested here: presenceModel (game/presence.ts, F-3) is the shipped
// authority on somewhere/absent/unknown; this parser only validates row
// SHAPE and passes venueId through untouched. Module state (the
// once-per-warn flag) is reset between tests via vi.resetModules().
import { afterEach, describe, expect, it, vi } from 'vitest';

type ApiModule = typeof import('./api.js');

const PLATFORM_URL = 'https://platform.test/api/public/botville/locations';

async function importApi(env: Record<string, string>): Promise<ApiModule> {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return await import('./api.js');
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const validSnapshot = {
  schemaVersion: 2,
  gameHour: 13.5,
  locations: [
    { id: 'uuid-1', displayName: 'Ada', spriteSeed: 'ada', venueId: 'cafe', activity: 'reading' },
    { id: 'uuid-2', displayName: 'Bob', spriteSeed: 'bob', venueId: null },
    { id: 'uuid-3', displayName: 'Eve', spriteSeed: 'eve', venueId: 'observatory' },
  ],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PRESENCE_MODE', () => {
  it('is fixture when VITE_PLATFORM_LOCATIONS_URL is unset', async () => {
    const api = await importApi({ VITE_PLATFORM_LOCATIONS_URL: '' });
    expect(api.PRESENCE_MODE).toBe('fixture');
  });

  it('is integrated when VITE_PLATFORM_LOCATIONS_URL is set', async () => {
    const api = await importApi({ VITE_PLATFORM_LOCATIONS_URL: PLATFORM_URL });
    expect(api.PRESENCE_MODE).toBe('integrated');
  });
});

describe('fetchPlatformLocations', () => {
  it('passes every well-formed row through unfiltered (presenceModel decides placement)', async () => {
    const api = await importApi({ VITE_PLATFORM_LOCATIONS_URL: PLATFORM_URL });
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(validSnapshot)));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await api.fetchPlatformLocations();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.gameHour).toBe(13.5);
    // All three rows survive — venueId null AND the unknown 'observatory'
    // included: absent/unknown handling belongs to presenceModel (F-3),
    // never to this parser, and the parser itself never warns about them.
    expect(result.roster).toEqual(validSnapshot.locations);
    expect(warn).not.toHaveBeenCalled();
  });

  it('rejects schemaVersion < 2 with exactly one warning (fixture-fallback signal)', async () => {
    const api = await importApi({ VITE_PLATFORM_LOCATIONS_URL: PLATFORM_URL });
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ...validSnapshot, schemaVersion: 1 })));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await api.fetchPlatformLocations()).toEqual({ ok: false, reason: 'invalid-schema' });
    expect(await api.fetchPlatformLocations()).toEqual({ ok: false, reason: 'invalid-schema' });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('reports network failures without warning', async () => {
    const api = await importApi({ VITE_PLATFORM_LOCATIONS_URL: PLATFORM_URL });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await api.fetchPlatformLocations()).toEqual({ ok: false, reason: 'network' });
    expect(warn).not.toHaveBeenCalled();
  });

  it('skips malformed rows instead of failing the poll, and drops undeclared activity', async () => {
    const api = await importApi({ VITE_PLATFORM_LOCATIONS_URL: PLATFORM_URL });
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      schemaVersion: 2,
      gameHour: 1,
      locations: [
        { id: 42 },
        null,
        { id: 'ok', displayName: 'Ok', spriteSeed: 'ok', venueId: 'office', activity: 7 },
      ],
    })));
    const result = await api.fetchPlatformLocations();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.roster).toEqual([
      { id: 'ok', displayName: 'Ok', spriteSeed: 'ok', venueId: 'office' },
    ]);
  });
});

describe('fetchVenueNotes', () => {
  const NOTES_ENV = {
    VITE_PLATFORM_LOCATIONS_URL: PLATFORM_URL,
    VITE_PLATFORM_API_BASE: 'https://platform.test',
  };

  it('returns [] without fetching when VITE_PLATFORM_API_BASE is unset', async () => {
    const api = await importApi({ VITE_PLATFORM_API_BASE: '' });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await api.fetchVenueNotes('cafe')).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns at most 10 notes, newest first, skipping malformed rows', async () => {
    const api = await importApi(NOTES_ENV);
    // createdAt is ISO-8601, per the platform's VenueNoteSchema.
    const iso = (i: number) => new Date(Date.UTC(2026, 6, 29, 12, 0, i)).toISOString();
    const raw = [
      ...Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, body: `note ${i}`, createdAt: iso(i) })),
      { id: 'bad-no-body' },
    ];
    const fetchSpy = vi.fn(async () => jsonResponse({ success: true, venueId: 'cafe', notes: raw }));
    vi.stubGlobal('fetch', fetchSpy);
    const notes = await api.fetchVenueNotes('cafe');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://platform.test/api/public/botville/venues/cafe/notes',
      expect.anything(),
    );
    expect(notes).toHaveLength(10);
    expect(notes[0]).toEqual({ id: 'n11', body: 'note 11', createdAt: iso(11) });
    expect(notes[9]).toEqual({ id: 'n2', body: 'note 2', createdAt: iso(2) });
  });

  it('returns [] on network error or non-array payloads', async () => {
    const api = await importApi(NOTES_ENV);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down'); }));
    expect(await api.fetchVenueNotes('cafe')).toEqual([]);
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ success: true, venueId: 'cafe', notes: 'nope' })));
    expect(await api.fetchVenueNotes('cafe')).toEqual([]);
  });
});
