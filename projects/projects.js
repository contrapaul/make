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

   Life events (milestones, talks, etc.) — same timeline, styled as
   a dark marker card instead of a project card:
     type:  "event"  (switches on the alternate styling)
     tag:   string (optional — short label like "TALK" or
            "MILESTONE"; defaults to "MILESTONE")
     cover / images: optional, same as above — omit both for a
            plain text marker with no photo
   ============================================================ */

const PROJECTS = [
  {
    title: "Project Title One",
    date: "2026-08",
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
    date: "2026-07",
    cover: "../images/projects/project-two.jpg",
    description: "A placeholder project with no extra images and no links — the minimum viable entry: title, date, cover, description.",
  },
  {
    title: "Project Title Six",
    date: "2026-04",
    cover: "../images/projects/project-six.jpg",
    images: ["../images/projects/project-six-2.jpg"],
    description: "Third of four projects in one month, with one extra image and one link.",
    links: [{ label: "Write-up", url: "#" }],
  },
  {
    title: "Project Title Seven",
    date: "2026-03",
    cover: "../images/projects/project-seven.jpg",
    description: "Fourth of four projects in one month — the desktop cap. Anything past this stacks below.",
  },
  {
    title: "Project Title Six",
    date: "2026-02",
    cover: "../images/projects/project-six.jpg",
    images: ["../images/projects/project-six-2.jpg"],
    description: "Third of four projects in one month, with one extra image and one link.",
    links: [{ label: "Write-up", url: "#" }],
  },
  {
    title: "Project Title Seven",
    date: "2026-01",
    cover: "../images/projects/project-seven.jpg",
    description: "Fourth of four projects in one month — the desktop cap. Anything past this stacks below.",
  },
  {
    title: "Project Title Six",
    date: "2025-12",
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
  {
    title: "Project Title Six",
    date: "2025-10",
    cover: "../images/projects/project-six.jpg",
    images: ["../images/projects/project-six-2.jpg"],
    description: "Third of four projects in one month, with one extra image and one link.",
    links: [{ label: "Write-up", url: "#" }],
  },
  {
    title: "Project Title Seven",
    date: "2025-09",
    cover: "../images/projects/project-seven.jpg",
    description: "Fourth of four projects in one month — the desktop cap. Anything past this stacks below.",
  },
  {
    title: "Project Title Six",
    date: "2025-08",
    cover: "../images/projects/project-six.jpg",
    images: ["../images/projects/project-six-2.jpg"],
    description: "Third of four projects in one month, with one extra image and one link.",
    links: [{ label: "Write-up", url: "#" }],
  },
  {
    title: "Project Title Seven",
    date: "2025-07",
    cover: "../images/projects/project-seven.jpg",
    description: "Fourth of four projects in one month — the desktop cap. Anything past this stacks below.",
  },
  {
    title: "Project Title Six",
    date: "2025-06",
    cover: "../images/projects/project-six.jpg",
    images: ["../images/projects/project-six-2.jpg"],
    description: "Third of four projects in one month, with one extra image and one link.",
    links: [{ label: "Write-up", url: "#" }],
  },
  {
    title: "Project Title Seven",
    date: "2025-05",
    cover: "../images/projects/project-seven.jpg",
    description: "Fourth of four projects in one month — the desktop cap. Anything past this stacks below.",
  },
  {
    title: "Project Title Six",
    date: "2024-12",
    cover: "../images/projects/project-six.jpg",
    images: ["../images/projects/project-six-2.jpg"],
    description: "Third of four projects in one month, with one extra image and one link.",
    links: [{ label: "Write-up", url: "#" }],
  },
  {
    title: "Project Title Six",
    date: "2023-08",
    cover: "../images/projects/project-six.jpg",
    images: ["../images/projects/project-six-2.jpg"],
    description: "Third of four projects in one month, with one extra image and one link.",
    links: [{ label: "Write-up", url: "#" }],
  },
  {
    title: "Project Title Seven",
    date: "2023-07",
    cover: "../images/projects/project-seven.jpg",
    description: "Fourth of four projects in one month — the desktop cap. Anything past this stacks below.",
  },
  {
    title: "Project Title Six",
    date: "2023-06",
    cover: "../images/projects/project-six.jpg",
    images: ["../images/projects/project-six-2.jpg"],
    description: "Third of four projects in one month, with one extra image and one link.",
    links: [{ label: "Write-up", url: "#" }],
  },
  {
    title: "Project Title Seven",
    date: "2023-05",
    cover: "../images/projects/project-seven.jpg",
    description: "Fourth of four projects in one month — the desktop cap. Anything past this stacks below.",
  },
  {
    title: "Project Title Six",
    date: "2021-03",
    cover: "../images/projects/project-six.jpg",
    images: ["../images/projects/project-six-2.jpg"],
    description: "Third of four projects in one month, with one extra image and one link.",
    links: [{ label: "Write-up", url: "#" }],
  },
  {
    title: "Project Title Seven",
    date: "2020-10",
    cover: "../images/projects/project-seven.jpg",
    description: "Fourth of four projects in one month — the desktop cap. Anything past this stacks below.",
  },
  {
    title: "Project Title Six",
    date: "2020-04",
    cover: "../images/projects/project-six.jpg",
    images: ["../images/projects/project-six-2.jpg"],
    description: "Third of four projects in one month, with one extra image and one link.",
    links: [{ label: "Write-up", url: "#" }],
  },
  {
    title: "Project Title Seven",
    date: "2019-08",
    cover: "../images/projects/project-seven.jpg",
    description: "Fourth of four projects in one month — the desktop cap. Anything past this stacks below.",
  },
  {
    title: "Project Title Six",
    date: "2019-02",
    cover: "../images/projects/project-six.jpg",
    images: ["../images/projects/project-six-2.jpg"],
    description: "Third of four projects in one month, with one extra image and one link.",
    links: [{ label: "Write-up", url: "#" }],
  },
  {
    title: "Project Title Seven",
    date: "2018-11",
    cover: "../images/projects/project-seven.jpg",
    description: "Fourth of four projects in one month — the desktop cap. Anything past this stacks below.",
  },
  {
    title: "Project Title Six",
    date: "2018-05",
    cover: "../images/projects/project-six.jpg",
    images: ["../images/projects/project-six-2.jpg"],
    description: "Third of four projects in one month, with one extra image and one link.",
    links: [{ label: "Write-up", url: "#" }],
  },
  {
    title: "Project Title Seven",
    date: "2018-01",
    cover: "../images/projects/project-seven.jpg",
    description: "Fourth of four projects in one month — the desktop cap. Anything past this stacks below.",
  },
  {
    title: "Project Title Six",
    date: "2017-11",
    cover: "../images/projects/project-six.jpg",
    images: ["../images/projects/project-six-2.jpg"],
    description: "Third of four projects in one month, with one extra image and one link.",
    links: [{ label: "Write-up", url: "#" }],
  },
  {
    title: "Project Title Seven",
    date: "2017-05",
    cover: "../images/projects/project-seven.jpg",
    description: "Fourth of four projects in one month — the desktop cap. Anything past this stacks below.",
  },
  {
    title: "Project Title Six",
    date: "2017-10",
    cover: "../images/projects/princess1.jpg",
    images: ["../images/projects/project-six-2.jpg"],
    description: "Princess Bride.",
  },
  {
    title: "Poplar Headboard with Integrated Lighting",
    date: "2016-09",
    cover: "../images/projects/headboard1.jpg",
    images: ["../images/projects/bed1.jpg", "../images/projects/bed2.jpg"],
    description: "This headboard with integrated illuminated shelves was a lengthy but very satisfying project. I ripped down 3/4 inch poplar planks to produce the slats, and routed a channel in the shelves to house IKEA lights. The shelves required a lot of additional work to hide seams, but the results looked great.",
  },
  {
    title: "Live-edge Maple Coffee Table",
    date: "2016-08",
    cover: "../images/projects/coffeetablecover.jpg",
    images: ["../images/projects/coffeetable.jpg"],
    description: "After moving in with my future wife, I endeavored to create several pieces of furniture for our larger place. This live-edge ambrosia maple coffee table is deceptively simple, but has been sanded and polished to a brilliant lustre. In my opinion. I used toothpicks to fill worm holes (The source of the striations) and installed powdercoated steel hairpin legs.",
  },
  {
    title: "Waxed Canvas Market Bag",
    date: "2016-06",
    cover: "../images/projects/shopbag.jpg",
    description: "A waxed canvas bag intended to resemble the classic brown paper grocery bag. Very strong, and ultimately a popular addition to the collection. We still use this specific bag more than 10 years later.",
  },
    {
    title: "Burgatorium Set",
    date: "2016-04",
    cover: "../images/projects/burgatorium.jpg",
    description: "One of the first major set projects I assisted in creating. I produced spray paint burger stencils to decorate the walls, designed the Burgatorium logo and menu, and assembled the set.",
  },
   {
    title: "Pollock-Inspired Paintings",
    date: "2015-07",
    cover: "../images/projects/apartment.jpg",
    images: ["../images/projects/pollock1.jpg", "../images/projects/pollock2.jpg", "../images/projects/pollock3.jpg"],
    description: "After moving to Winston-Salem I found a great loft apartment and set out to create furniture and artwork for my new place. I produced 4 paintings directly inspired by the works of Jackson Pollock- including the same canvas (hardboard) and similar paints. I created similar works in 2021, and set up a summer camp workshop for students to produce their own in 2022. One painting was given to a friend, and 3 are now permanently displayed at my parents' house.",
  },
  {
    title: "Assorted Furniture",
    date: "2015-07",
    cover: "../images/projects/furniture2.jpg",
    images: ["../images/projects/furniture1.jpg"],
    description: "A selection of furniture created for my first loft apartment, and later used in the second. These were intended to be built for as little money as possible, and while I'd later convert to using hardwoods for furniture, these mostly feature ripped down 2x8 lumber.",
  },
  {
    title: "Waxed Canvas Lunchbags",
    date: "2014-08",
    cover: "../images/projects/lunchbags.jpg",
    images: ["../images/projects/furniture1.jpg"],
    description: "A selection of furniture created for my first loft apartment, and later used in the second. These were intended to be built for as little money as possible, and while I'd later convert to using hardwoods for furniture, these mostly feature ripped down 2x8 lumber.",
  },
  {
    title: "Spring Collection: 2014",
    date: "2014-04",
    cover: "../images/projects/spring2014.png",
    images: ["../images/projects/doppkits.jpg"],
    description: "My first 'capsule collection', consisting of backpacks, keychains, dopp kits, and tote bags. Also the last 'collection' under the 'contrapaul' name, as I'd rebrand in September 2014.",
  },
    {
    title: "Two-tone Backpack",
    date: "2014-06",
    cover: "../images/projects/jan20142.jpg",
    images: ["../images/projects/jan2014.jpg"],
    description: "I produced a handful of customizable bags- offering customers the chance to choose upper and lower colors, and to decide if they wanted a waxed base. Dropped in favor of the easier to produce 'daypack' a few months later.",
  },
    {
    title: "Festival Packs Collaboration",
    date: "2014-02",
    cover: "../images/projects/billionaires.jpg",
    images: ["../images/projects/billion2.jpg"],
    description: "A friend of mine operated Billionaires Apparel, an 'underground' clothing brand and commissioned 9 backpacks after I produced a sample as a gift. 3 were black/purple, 3 black/neon blue, and 3 black/lime green.",
  },
   {
    title: "Accessory Bags",
    date: "2013-11",
    cover: "../images/projects/nov2013.jpg",
    description: "As things ramped up with contrapaul (the brand) I churned out a ton of simple bags, as practice and as a cheap item that helped fund materials.",
    links: [{ label: "Write-up", url: "#" }],
  },
    {
    title: "Backpack #3",
    date: "2013-09",
    cover: "../images/projects/sep2013.jpg",
    images: ["../images/projects/sep20132.jpg"],
    description: "The third backpack I created- 2 colors of canvas combined with a leather carabiner clip (I've forgotten the oficial name of the square patch). This is the real origin of me thinking I'd produce bags to sell." 
    },
     {
    title: "Backpack #2",
    date: "2013-08",
    cover: "../images/projects/bp2aug2013.jpg",
    description: "Immediately after finishing my first backpack I dove into a second project to address the many issues I identified." 
    },
     {
    title: "Backpack #1",
    date: "2013-08",
    cover: "../images/projects/bpaug2013.jpg",
    description: "After a couple projects I was ready to try making a backpack, and this is the result. All things considered it turned out pretty great." 
    },
      {
    title: "Jacket",
    date: "2013-03",
    cover: "../images/projects/jacketmar2013.jpg",
    description: "My first sewing machine project. Fleece knit material and a broadcloth liner- not a great combo, but featured an assymetrical zip and a novel 'X' pattern integrating pockets."
    },
  {
    type: "event",
    tag: "career",
    title: "Begin Teaching DP Design Technology",
    date: "2025-08",
    description: "My first cohort of DP Design started, along with very little curriculum, due to a total overhaul by IB. It's been a delight to teach, and a fun challenge to build curriculum.",
  },
  {
    type: "event",
    tag: "Presentation",
    title: "AI for Students",
    date: "2025-01",
    description: "I delivered a presentation at EDTechGZ 2025 proposing a framework for teaching students how to use AI effectively and responsibly.",
  },
  {
    type: "event",
    tag: "Moving",
    title: "Moved to China",
    date: "2019-08",
    description: "Something of a notable, important event. Perhaps second only to marriage.",
  },
  {
    type: "event",
    tag: "Marriage",
    title: "Married my Best Friend",
    date: "2019-05",
    description: "And many years later she's still the greatest thing to ever happen to me",
  },
  {
    type: "event",
    tag: "Moving",
    title: "Moved to Winston-Salem",
    date: "2015-06",
    description: "Placeholder milestone card — swap in a real talk, launch, or life event. Renders as a dark marker instead of a project card; delete the cover/images lines entirely for a plain text-only version.",
  },
];
