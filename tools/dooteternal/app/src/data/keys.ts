/**
 * Key colours, shared by keys and the doors they open (plans.md §11.5).
 *
 * Pure data with no browser dependencies, so level checks can validate a map's
 * colours without loading the canvas code that draws them.
 */
export const KEY_COLORS: Record<string, string> = {
  red: '#ff4a4a',
  blue: '#4aa8ff',
  green: '#4aff7a',
};

export function keyColor(color: string): string {
  return KEY_COLORS[color] ?? '#ffffff';
}
