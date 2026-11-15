// Turns the page address (#about, #spark, #spark/model-server) into a view. Pure.

export const TABS = ['about', 'history', 'contact'];

const MAP_ROUTE = { view: 'map', node: null, service: null };

/** `parseRoute('#spark/model-server', NODES)` gives { view: 'service', node, service } */
export function parseRoute(hash, nodes) {
  const [first, second] = hash.replace(/^#/, '').split('/');
  if (TABS.includes(first)) return { view: first, node: null, service: null };
  const node = nodes.find((candidate) => candidate.id === first);
  if (!node) return MAP_ROUTE;
  const service = node.services.find((candidate) => candidate.id === second);
  if (!service) return { view: 'node', node, service: null };
  return { view: 'service', node, service };
}

/** The address one zoom level out from `route`. */
export function parentHash(route) {
  return route.view === 'service' ? `#${route.node.id}` : '#';
}
