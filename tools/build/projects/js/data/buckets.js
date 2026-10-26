// Pure helpers for the 1-Afternoon Coding Projects site.
// No DOM; imported by Node tests and by the site (ES modules).
// Canonical plan: specs/product/PROJECTS_SITE_LATEST.md.

export const SECTIONS = [
  { id: 'games', label: 'Games & Fun' },
  { id: 'creative', label: 'Creative' },
  { id: 'utilities', label: 'Utilities' },
  { id: 'task-processing', label: 'Task Processing' },
  { id: 'data-analysis', label: 'Data & Analysis' },
  { id: 'web-devops', label: 'Web & DevOps' },
  { id: 'learning-cs', label: 'Learning & CS' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'education', label: 'Education' },
];

// One fixed priority over ALL words in the purpose string. Word order in
// "A / B" does not matter; this is a lookup table, not a scan:
//   Creative > Games > Data > Web & DevOps > Learning & CS > Productivity > Utilities
// Rationale: the source file pairs one real category with a funnel word
// (Fun, Utility, SEO...), and the priority puts the real category first.
// "Fun" is the only funnel word with its own category (games).
const PRIORITY = [
  ['task-processing', ['task', 'processing']],
  ['creative', ['creative']],
  ['games', ['game', 'fun']],
  ['data-analysis', ['data', 'info', 'analysis']],
  ['web-devops', ['web', 'seo', 'devops', 'publishing', 'publish', 'security']],
  ['learning-cs', ['learning', 'learn', 'math', 'cs', 'db', 'study']],
  ['productivity', ['productivity']],
  ['utilities', ['utility', 'utilities', 'accessibility', 'a11y']],
];

export function bucketFromPurpose(purpose) {
  const words = purpose.toLowerCase().trim().split(/\s*\/\s*|\s+/).filter(Boolean);
  for (const [id, list] of PRIORITY) {
    if (words.some(w => list.includes(w))) return id;
  }
  return 'utilities';
}

// Part 3 sub-groups are fixed row ranges from the "Suggested pairing"
// table in projects.md (1-10, 11-20, 21-40, 41-46, 47-50).
export function subGroupFromNum(num) {
  if (num <= 10) return { id: 'teachers-tools', label: "Teachers' tools" };
  if (num <= 20) return { id: 'study-aids', label: "Students' study aids" };
  if (num <= 40) return { id: 'subject-drills', label: 'Subject-specific drills' };
  if (num <= 46) return { id: 'accessibility', label: 'Accessibility & formatting' };
  return { id: 'admin-workflow', label: 'Admin & workflow' };
}

// Language tags matched against the normalized stack string.
// Only languages/frameworks the source row names get tags; unknown stacks
// yield []. No invention.
const TAG_RULES = [
  ['python', /python|flask|pygame|pillow|opencv|tkinter|pandas|numpy|scikit|jinja|spacy|pdfplumber|reportlab|beautifulsoup|pythautomat|whisper/],
  ['js', /\bjs\b|javascript|three\.js|\bd3\b|chart\.js|katex|mathjax|socket\.io|html2canvas/],
  ['html', /html/],
  ['css', /\bcss\b/],
  ['react', /\breact\b/],
  ['vue', /\bvue\b/],
  ['svelte', /svelte/],
  ['node', /\bnode\b|express|socket\.io/],
  ['java', /\bjava\b(?!script)/],
  ['csharp', /c#|wpf|itextsharp/],
  ['cpp', /c\+\+/],
  ['go', /\bgo\b/],
  ['rust', /\brust\b/],
  ['ruby', /\bruby\b/],
  ['php', /\bphp\b/],
  ['bash', /\bbash\b|\bshell\b/],
  ['sql', /\bsql\b|sqlite/],
  ['dart', /\bdart\b/],
  ['nim', /\bnim\b/],
  ['swift', /\bswift\b/],
  ['ktl', /\bkotlin\b/],
  ['perl', /\bperl\b/],
  ['lua', /\blua\b/],
  ['latex', /latex/],
  ['jinja2', /jinja2/],
  ['android-studio', /android/],
  ['scratch', /scratch/],
  ['lovelace', /lovelace/],
  ['purl', /purl/],
  ['c', /\bc\b/],
];

export function languagesFromStack(stack) {
  const s = ' ' + stack.toLowerCase().replace(/\s+/g, ' ') + ' ';
  if (s.trim() === '') return [];
  const tags = new Set();
  for (const [tag, re] of TAG_RULES) {
    if (re.test(s)) tags.add(tag);
  }
  // "C++" and "C#" must not produce a bare "c" tag.
  if (tags.has('c') && (s.includes('c++') || s.includes('c#'))) {
    const hasCWord = /(^|[^+#])c(?![+#a-z])/i.test(' ' + s + ' ');
    if (!hasCWord) tags.delete('c');
  }
  return [...tags].sort();
}

export function modeFromCell(cell) {
  const c = cell.trim().toLowerCase();
  if (c === 'online') return 'online';
  if (c === 'offline') return 'offline';
  if (c === 'either') return 'either';
  return 'either';
}

export function slugFromName(name, num) {
  const base = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  if (num == null) return base.slice(0, 48);
  return ('p' + String(num).padStart(3, '0') + '-' + base.slice(0, 44));
}
