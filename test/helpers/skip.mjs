/**
 * A skipped test that nobody notices is a test that does not exist.
 * Every conditional skip in this repo records its reason here, and the
 * summary prints once at the end of the run.
 */
const reasons = new Set();

export function skipUnless(condition, reason) {
  if (condition) return { skip: false };
  reasons.add(reason);
  return { skip: reason };
}

process.on('exit', () => {
  if (!reasons.size) return;
  process.stderr.write(`\n! ${reasons.size} suite(s) skipped:\n`);
  for (const r of reasons) process.stderr.write(`!   ${r}\n`);
});
