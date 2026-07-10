/* ============================================================
   contrapaul / make — /projects data
   Add a project by appending an entry to PROJECTS (any order —
   the timeline sorts itself and extends to cover new dates).

   Each entry:
     title:       string  (required)
     date:        "YYYY-MM" (required — month the project landed)
     cover:       image path (optional — striped slot shows if missing)
     images:      array of extra image paths (optional — delete freely)
     description: string (required)
     links:       array of { label, url } (optional — delete freely)
   ============================================================ */

const PROJECTS = [
  {
    title: "Project Title One",
    date: "2026-06",
    cover: "../images/projects/project-one.jpg",
    images: [
      "../images/projects/project-one-2.jpg",
      "../images/projects/project-one-3.jpg",
    ],
    description: "Placeholder description for the most recent project. A couple of sentences about what it is, why it exists, and what was learned building it.",
    links: [
      { label: "Write-up", url: "#" },
      { label: "Files", url: "#" },
    ],
  },
  {
    title: "Project Title Two",
    date: "2026-04",
    cover: "../images/projects/project-two.jpg",
    description: "A placeholder project with no extra images and no links — the minimum viable entry: title, date, cover, description.",
  },
  {
    title: "Project Title Three",
    date: "2026-01",
    cover: "../images/projects/project-three.jpg",
    images: ["../images/projects/project-three-2.jpg"],
    description: "Placeholder sitting before a two-month gap, so you can see how empty months keep the timeline evenly spaced.",
    links: [{ label: "GitHub", url: "#" }],
  },
  {
    title: "Project Title Four",
    date: "2025-11",
    cover: "../images/projects/project-four.jpg",
    description: "First of four projects in the same month — demonstrating the busiest layout the timeline supports.",
    links: [{ label: "Demo", url: "#" }],
  },
  {
    title: "Project Title Five",
    date: "2025-11",
    cover: "../images/projects/project-five.jpg",
    description: "Second of four projects in one month. On desktop these pair up side by side; on mobile they stack.",
  },
  {
    title: "Project Title Six",
    date: "2025-11",
    cover: "../images/projects/project-six.jpg",
    images: ["../images/projects/project-six-2.jpg"],
    description: "Third of four projects in one month, with one extra image and one link.",
    links: [{ label: "Write-up", url: "#" }],
  },
  {
    title: "Project Title Seven",
    date: "2025-11",
    cover: "../images/projects/project-seven.jpg",
    description: "Fourth of four projects in one month — the desktop cap. Anything past this stacks below.",
  },
];
