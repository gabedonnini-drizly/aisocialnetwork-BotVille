// D-79 published 23 parcels; D-89 made a vacant one the TENT CAMP, precisely
// so that unhoused-ness is visible. The HUD indexed LOCATION_KEYS with a
// `?? 'loc.district'` fallback, so every camp read "On the street" — the one
// thing an agent in a camp is not, in the one surface a human actually reads.
//
// A vitest file rather than a node --test one because i18n/index.ts sets
// `document.title` at module scope: it needs a DOM, and vitest has one.
import { describe, expect, it } from 'vitest';
import { locationKey, LOCATION_KEYS } from './index.js';
import { en } from './en.js';
import { plotRegistry } from '../game/plotRegistry.js';
import { venueRegistry } from '../game/venueRegistry.js';

describe('locationKey', () => {
  it('labels an agent in a camp as camping, not as being on the street', () => {
    expect(plotRegistry.all().length).toBeGreaterThan(0);
    for (const plot of plotRegistry.all()) {
      expect(locationKey(plot.id)).toBe('loc.camp');
      expect(en[locationKey(plot.id)]).not.toBe(en['loc.district']);
    }
  });

  it('leaves every other location with exactly the label it had', () => {
    for (const [location, key] of Object.entries(LOCATION_KEYS)) {
      expect(locationKey(location)).toBe(key);
    }
    // The unknown path is unchanged: an undeclared location still falls back
    // to the street rather than inventing a camp.
    expect(locationKey('no-such-place')).toBe('loc.district');
  });

  it('can only return keys the dictionary has text for', () => {
    for (const key of [...Object.values(LOCATION_KEYS), 'loc.camp', 'loc.district']) {
      expect(en).toHaveProperty(key);
    }
    for (const v of venueRegistry.all()) expect(en).toHaveProperty(locationKey(v.id));
  });
});
