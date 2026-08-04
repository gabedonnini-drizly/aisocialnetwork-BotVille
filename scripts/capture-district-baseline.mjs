#!/usr/bin/env node
/**
 * Writes the outdoor scene's golden baseline (Plan 03 Task 1's bracketing
 * check): what DistrictScene would draw, as data, from the real modules and
 * the committed .tmj.
 *
 *   npm run golden:district
 *
 * Run it BEFORE a change to the outdoor scene and commit the result; after the
 * change, test/district-render.test.mjs must reproduce it byte for byte. A
 * diff is a defect until it is explained — never regenerate to make a red
 * test green. See test/helpers/districtRender.mjs for the coverage, and for
 * the (large) list of things a data baseline cannot see.
 */
import { writeFileSync } from 'node:fs';
import { captureDistrictRender } from '../test/helpers/districtRender.mjs';

const OUT = 'test/golden/district-render.json';
writeFileSync(OUT, `${JSON.stringify(captureDistrictRender(), null, 2)}\n`);
console.log(`wrote ${OUT}`);
