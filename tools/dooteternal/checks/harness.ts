/**
 * Minimal check harness. Not a test framework: the game's logic modules are
 * plain TypeScript, so bundling them and asserting in Node needs no runner and
 * no dependencies beyond the rolldown that ships inside Vite.
 *
 * Every check runs even if an earlier one fails, so one run reports everything.
 */
const results: string[] = [];
let failures = 0;

export function check(name: string, assertions: () => void): void {
  try {
    assertions();
    results.push(`  ok    ${name}`);
  } catch (error) {
    failures += 1;
    const detail = error instanceof Error ? error.message.split('\n')[0] : String(error);
    results.push(`  FAIL  ${name}\n        ${detail}`);
  }
}

export function section(title: string): void {
  results.push(`\n${title}`);
}

export function report(): void {
  console.log(results.join('\n'));

  const total = results.filter((line) => line.includes('  ok    ') || line.includes('  FAIL  ')).length;
  console.log(`\n${total - failures}/${total} checks passed`);

  if (failures > 0) process.exitCode = 1;
}
