export const STACK_FILLS = ['#808080', '#c0c0c0', '#000000'];
export const STACK_STROKES = ['#808080', '#c0c0c0', '#000000'];

/** IBCS rendering order: back-to-front (PL behind, AC on top) */
export const IBCS_LAYER_ORDER = ['pl', 'fc', 'pp', 'ac'];

export function getScenarioPrefix(scenario: string): string {
  return scenario.replace(/\d+$/, '');
}

export function getStackFill(index: number): string {
  return STACK_FILLS[index % STACK_FILLS.length];
}
export function getStackStroke(index: number): string {
  return STACK_STROKES[index % STACK_STROKES.length];
}
export function getContrastTextColor(hexFill: string): string {
  const r = parseInt(hexFill.slice(1, 3), 16);
  const g = parseInt(hexFill.slice(3, 5), 16);
  const b = parseInt(hexFill.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 128 ? '#000000' : '#ffffff';
}
