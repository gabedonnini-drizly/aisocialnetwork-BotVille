/**
 * The CI gate behind I-2: every contract name resolves in the active
 * adapter, every venue prop exists in the contract, and declared
 * geometry matches the real bitmaps. An unresolved name fails the
 * BUILD — never a missing texture at runtime.
 */
import { readSprite, pinFor } from './spriteReader.mjs';

export function validate(contract, adapter, { checkPixels = true, venues = [], pins = null } = {}) {
  const errors = [];
  const warnings = [];

  // 1. Every contract name resolves.
  for (const name of adapter.unresolved(contract.allNames())) {
    errors.push(`unresolved contract name in pack "${adapter.pack}": ${name}`);
  }

  // 2. Every emote status has a frame pair in the adapter (indices are pack-specific).
  for (const status of contract.emotes.icons.statuses) {
    const pair = adapter.emoteFrames[status];
    if (!Array.isArray(pair) || pair.length !== 2) {
      errors.push(`pack "${adapter.pack}" has no two-frame emote pair for status: ${status}`);
    }
  }

  // 3. Every venue prop, seat kind, animated object and glow kind is known.
  const knownProps = new Set([...Object.keys(contract.props.district), ...Object.keys(contract.props.interior)]);
  const knownAnimated = new Set(Object.keys(contract.animatedObjects));
  for (const v of venues) {
    for (const f of v.furniture ?? []) {
      if (!knownProps.has(f.name)) errors.push(`venue ${v.id}: furniture "${f.name}" is not in the contract`);
    }
    for (const an of v.animated ?? []) {
      if (!knownAnimated.has(an.name)) errors.push(`venue ${v.id}: animated "${an.name}" is not in the contract`);
    }
    if (v.groundAtlas && !contract.groundAtlases[v.groundAtlas]) {
      errors.push(`venue ${v.id}: unknown groundAtlas "${v.groundAtlas}"`);
    }
  }

  if (!checkPixels) return { errors, warnings };

  // 4. Declared geometry matches real bitmaps.
  for (const atlasId of Object.keys(contract.groundAtlases)) {
    for (const t of contract.groundAtlases[atlasId].tiles) {
      if (!adapter.has(t)) continue;
      let s;
      try { s = readSprite(adapter, t); } catch (e) { errors.push(`tile ${t}: ${e.message}`); continue; }
      if (s.w !== contract.tileSize || s.h !== contract.tileSize) {
        errors.push(`tile ${t} is ${s.w}x${s.h}, expected ${contract.tileSize}x${contract.tileSize}`);
      }
    }
  }
  for (const [group, defs] of Object.entries(contract.props)) {
    for (const [name, def] of Object.entries(defs)) {
      if (!adapter.has(name)) continue;
      let s;
      try { s = readSprite(adapter, name); } catch (e) { errors.push(`prop ${name}: ${e.message}`); continue; }
      const [mw, mh] = def.maxSize;
      if (s.w > mw || s.h > mh) {
        errors.push(`prop ${group}/${name} is ${s.w}x${s.h}, exceeds contract maxSize ${mw}x${mh}`);
      }
    }
  }
  for (const [name, def] of Object.entries(contract.animatedObjects)) {
    if (!adapter.has(name)) continue;
    let s;
    try { s = readSprite(adapter, name); } catch (e) { errors.push(`animated ${name}: ${e.message}`); continue; }
    const need = def.frameWidth * def.frames;
    if (s.w < need) errors.push(`animated ${name} sheet is ${s.w}px wide, needs ${need}px for ${def.frames} frames`);
    if (s.h < def.frameHeight) errors.push(`animated ${name} sheet is ${s.h}px tall, needs ${def.frameHeight}px`);
  }

  // 4b. Layered characters share one canvas, in whole frames.
  //
  // Dimensions are read THROUGH the adapter's rects (readSprite), so a
  // declared crop applies before this check. That is what makes the real
  // pack pass: raw Bodies files are 927x656 while the other layers are
  // 896x656, and the adapter crops char_body to 896 wide (its rect, Task 7)
  // — cropping-then-parity, not raw-file parity. What composition cannot
  // survive is the post-crop LAYERS disagreeing with each other: stacking
  // assumes every char_* sheet resolves to the same dimensions and at least
  // one whole frame each way. Assert that here, per pack.
  if (adapter.capabilities.characterLayers === true) {
    const { frameWidth: cfw, frameHeight: cfh, parts } = contract.characters;
    let first = null;
    for (const part of parts) {
      const name = `char_${part}`;
      if (!adapter.has(name)) continue;
      let s;
      try { s = readSprite(adapter, name); } catch (e) { errors.push(`char layer ${name}: ${e.message}`); continue; }
      if (Math.floor(s.w / cfw) < 1 || Math.floor(s.h / cfh) < 1) {
        errors.push(`char layer ${name} is ${s.w}x${s.h} — smaller than one ${cfw}x${cfh} frame`);
      }
      if (!first) { first = { name, w: s.w, h: s.h }; continue; }
      if (s.w !== first.w || s.h !== first.h) {
        errors.push(`char layer ${name} is ${s.w}x${s.h} but ${first.name} is ${first.w}x${first.h} — `
          + `layered composition requires all char_* sheets on one canvas`);
      }
    }
  }

  // 5. Every crop still contains the pixels that were chosen (the `pin`
  //    field, Task 9).
  //
  // Coordinates resolving is not the same as the sprite being right. A pack
  // update that inserts a row leaves every rect valid and every crop
  // different — the build succeeds and the chair is wrong. The pin is the
  // only check that catches that, so a MISMATCH is an error while a MISSING
  // pin is a warning: the licensed pack legitimately is not on most machines.
  if (pins) {
    for (const name of adapter.names()) {
      const want = pins[name];
      if (!want) { warnings.push(`unpinned crop: ${name} has never been verified against real pixels`); continue; }
      let got;
      try { got = pinFor(adapter, name); } catch (e) { errors.push(`pin ${name}: ${e.message}`); continue; }
      if (got !== want) {
        errors.push(`pin mismatch: ${name} no longer contains the pixels it was chosen for `
          + `(expected ${want.slice(0, 12)}…, got ${got.slice(0, 12)}…). `
          + `The pack changed under this crop — re-review it with 'npm run contact'.`);
      }
    }
  }

  return { errors, warnings };
}
