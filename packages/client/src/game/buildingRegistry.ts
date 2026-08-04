/**
 * archetype -> the exterior art that stands on a built plot.
 *
 * D-89: "the construction must keep adding buildings a CONFIG change — plot
 * size classes x building (archetype) config decide what can stand where".
 * `contract/buildings.json` IS that config, and it is the same file
 * `scripts/derive-plots.mjs` reads to compute each parcel's
 * `allowedArchetypes` by footprint fit. Reading the same file here is what
 * stops the client and the packer from disagreeing about what a `school` is.
 *
 * A bake INPUT rather than a bake OUTPUT, so it is a static import — see
 * plotComposition.ts for the rule.
 *
 * Do not import Phaser: the module is tested under node --test.
 */
import buildings from '../../../../contract/buildings.json' with { type: 'json' };

export interface Building {
  archetype: string;
  /** The contract prop name of the exterior sprite. */
  exterior: string;
  /** D-65's housing ladder position, where the row has one. */
  tier?: number;
  civic?: boolean;
  /** Rows that are a bigger exterior for an existing venue archetype. */
  archetypeVenue?: string;
}

interface BuildingsDoc {
  buildings: Record<string, { exterior: string; tier?: number; civic?: boolean; archetypeVenue?: string }>;
}

const doc = buildings as unknown as BuildingsDoc;

const BUILDINGS: readonly Building[] = Object.entries(doc.buildings ?? {})
  .map(([archetype, row]) => ({ archetype, ...row }));

const byArchetype = new Map<string, Building>(BUILDINGS.map(b => [b.archetype, b]));

export const buildingRegistry = {
  all(): readonly Building[] {
    return BUILDINGS;
  },
  get(archetype: string): Building | undefined {
    return byArchetype.get(archetype);
  },
  /**
   * The exterior prop for a built archetype, or undefined if nothing declares
   * it. Undefined is what makes an unknown archetype draw NOTHING rather than
   * a missing texture — I-2's failure mode, chosen deliberately, and pinned by
   * a test that every declared exterior is a preloaded district prop.
   */
  exteriorFor(archetype: string): string | undefined {
    return byArchetype.get(archetype)?.exterior;
  },
};
