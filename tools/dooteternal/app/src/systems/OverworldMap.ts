import { OVERWORLD, nodeState, type Progress } from './Progress';

/**
 * The descent map, plans.md §15. Nodes are stacked in the order the map's y
 * coordinates give them, so progress reads downward as a descent. Locked nodes
 * are greyed, the available one is highlighted, cleared ones are marked.
 *
 * Returning here after each exit is what makes the descent visible, which §15
 * recommends over auto-loading the next level.
 */
export class OverworldMap {
  private readonly root: HTMLDivElement;
  private readonly list: HTMLDivElement;

  constructor(private readonly onEnter: (levelId: string) => void) {
    this.root = document.querySelector<HTMLDivElement>('#overworld')!;
    this.list = document.querySelector<HTMLDivElement>('#overworld-nodes')!;
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(progress: Progress): void {
    this.render(progress);
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  private render(progress: Progress): void {
    // Deeper nodes have lower y in the data; render them further down the page.
    const nodes = [...OVERWORLD.nodes].sort((a, b) => b.y - a.y);

    this.list.replaceChildren(
      ...nodes.map((node, depth) => {
        const state = nodeState(progress, node.id);

        const button = document.createElement('button');
        button.className = `node ${state}`;
        button.disabled = state === 'locked';
        button.addEventListener('click', () => this.onEnter(node.id));

        const label = document.createElement('span');
        label.className = 'node-name';
        label.textContent = `${String(depth + 1).padStart(2, '0')}  ${node.name}`;

        const status = document.createElement('span');
        status.className = 'node-state';
        status.textContent = state === 'cleared' ? 'CLEARED' : state === 'available' ? 'DESCEND' : 'LOCKED';

        button.append(label, status);
        return button;
      }),
    );
  }
}
