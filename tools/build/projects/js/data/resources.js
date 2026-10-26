// e02s04t01: the 3 Resources-tab links (data only, "3 links only" per plan).
// Ghost entry has url: null - the languages page is not deployed yet, so we
// show no link rather than a 404.
export const RESOURCES = [
  {
    id: 'build',
    title: 'Build your own site',
    url: 'https://build.contrapaul.com',
    desc: 'How to build and publish small learning sites with an AI coding agent. The pattern that produced this page.',
  },
  {
    id: 'languages',
    title: 'Languages, one screen each',
    url: null,
    desc: 'A hand-built reference covering the 22 languages that appear in these 150 rows. In progress: no link yet.',
  },
  {
    id: 'codewithai',
    title: 'Coding with AI (teacher kit)',
    url: 'https://edu.contrapaul.com/codewithai',
    desc: 'Lesson plans and starter prompts for running part 3 with a class of students.',
  },
];
