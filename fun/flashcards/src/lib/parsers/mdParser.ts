import { RawRow } from './csvParser';

export function parseMD(text: string): RawRow[] {
  const rows: RawRow[] = [];

  const blocks = text.split(/^\-\-\-+$/m).filter(b => b.trim());

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const row: RawRow = {};

    for (const line of lines) {
      const match = line.match(/^[\w\s]+:\s*(.+)$/);
      if (match) {
        const key = match[0].split(':')[0].trim();
        const value = match[1].trim();
        row[key] = value;
      } else if (!line.startsWith('#') && line.trim()) {
        row._body = (row._body || '') + line.trim() + ' ';
      }
    }

    if (Object.keys(row).length > 0) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    const frontMatch = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (frontMatch) {
      const metaLines = frontMatch[1].split('\n');
      const body = frontMatch[2];
      const row: RawRow = {};

      for (const line of metaLines) {
        const match = line.match(/^([\w\s]+):\s*(.+)$/);
        if (match) {
          row[match[1].trim()] = match[2].trim();
        }
      }

      row._body = body.trim();
      rows.push(row);
    }
  }

  return rows;
}
