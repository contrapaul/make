// e02s07 part 3 enrichment notes (50/50). Assembled from reviewer-drafted batches;
// owner reviews before merge. One entry per card, id-ordered to match PROJECTS.
export const NOTES = [
{
  "id": "p001-mcq-exam-auto-grader",
  "why": "Every student gets a different paper, and scoring returns fast and consistent. The full loop, from reading a CSV to printing a scored report, is compact, and the relief from manual marking makes it a friendly first offline data project.",
  "starter": "Start with a ten-question bank. A script reads the CSV, picks fifteen at random, saves a paper, and grades one answer file with a total to check. Once students can try it live, wrap the same script in a Tkinter window to pick the bank file.",
  "references": [
    {
      "title": "Python: csv module",
      "url": "https://docs.python.org/3/library/csv.html"
    },
    {
      "title": "Python: random module",
      "url": "https://docs.python.org/3/library/random.html"
    }
  ]
},
{
  "id": "p002-rubric-builder-and-pdf-exporter",
  "why": "Building a tool that makes real rubrics makes the grid itself the lesson. Dragging a criteria-by-levels matrix into a neat layout teaches state and component layout, and students see a printed result from their own work the same day.",
  "starter": "Build a 4 by 4 grid from a data array and a CSS grid. Wire one editable cell first, then the add-row and add-column buttons. Use html2canvas to snap the grid and hand the canvas to print for a PNG. Seed subject-specific rubrics and let the class use them in lesson.",
  "references": [
    {
      "title": "React documentation: learn to build",
      "url": "https://react.dev/learn"
    },
    {
      "title": "html2canvas home page",
      "url": "https://html2canvas.hertzen.com/"
    }
  ]
},
{
  "id": "p003-reading-level-differentiator",
  "why": "One passage back at three grade levels is a small Flask form paired with a text analytics library, and each student reads at their own pace. Even a simple Flesch-Kincaid score readout teaches why measurement comes before rewriting.",
  "starter": "Build a Flask page with one text field. Return the textstat readouts, Flesch-Kincaid score and syllable counts, next to the passage. Then build the rewrite path, with teacher-added leveled versions or a library call, and highlight tricky vocabulary with spans.",
  "references": [
    {
      "title": "Flask documentation",
      "url": "https://flask.palletsprojects.com/en/latest/"
    },
    {
      "title": "textstat: text readability metrics",
      "url": "https://textstat.readthedocs.io/en/latest/"
    }
  ]
},
{
  "id": "p004-math-worksheet-generator",
  "why": "Print-ready problems that never repeat twice, with an answer key that is exact, is the best motivator for procedural generation. Students see a same-day PDF output, and the path from random numbers to a printable worksheet is a punchy full arc.",
  "starter": "Generate one topic, say fractions, with add, subtract and simplify generation plus checkers. Assemble an answer key into a page with reportlab so it is print-ready. Then add form controls for topic, difficulty and question count, all in one screen.",
  "references": [
    {
      "title": "reportlab documentation",
      "url": "https://docs.reportlab.com/"
    },
    {
      "title": "jsPDF home page",
      "url": "https://jspdf.dev/"
    }
  ]
},
{
  "id": "p005-iep-504-goal-tracker",
  "why": "Goals, dated data points, and charts plotted over a semester is a small real database, and it is the most tangible intro to persistence a data-logging teacher will get. Seeing a line chart grow week by week proves the value of storing data.",
  "starter": "Define three tables: objectives, data points, and sessions. Insert a goal with a target score, enter three data points now, and write a script that plots the last ten for one goal in matplotlib.",
  "references": [
    {
      "title": "Python: sqlite3 module",
      "url": "https://docs.python.org/3/library/sqlite3.html"
    },
    {
      "title": "matplotlib documentation",
      "url": "https://matplotlib.org/stable/"
    }
  ]
},
{
  "id": "p006-attendance-quick-entry-csv",
  "why": "A roster on screen that saves a full term of data is a real database in miniature: one table, one query, one print. Students see why structured data beats the manual spreadsheet ritual they have been doing by hand.",
  "starter": "Seed a SQLite table with ten names and build a page with present, absent, and tardy buttons per row. POST a tap and re-render. A /export route walks one month of rows and returns CSV. Demo the full loop live on a class device.",
  "references": [
    {
      "title": "Express official documentation",
      "url": "https://expressjs.com/"
    },
    {
      "title": "Node.js: SQLite (node:sqlite)",
      "url": "https://nodejs.org/docs/latest-v24.x/api/sqlite.html"
    }
  ]
},
{
  "id": "p007-classroom-token-economy-tracker",
  "why": "A visual token regime that resets weekly is a live game engine, and localStorage makes every device an independent small server. Assigning tokens is an argument for persistence, and students watch their own data carry across reloads without a round trip.",
  "starter": "Store a student array with name and token count under a single localStorage key. Build the student grid with plus and minus buttons per row. Add a weekly reset button behind a confirm dialog. Then add a sorted leaderboard column and test that values survive a page reload.",
  "references": [
    {
      "title": "React documentation: learn to build",
      "url": "https://react.dev/learn"
    },
    {
      "title": "MDN: localStorage API",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API"
    }
  ]
},
{
  "id": "p008-parent-newsletter-generator",
  "why": "Filling five fields and printing one page is the fastest trip from bare HTML to a deliverable the school can use next Monday. The core skill is filling a template layout from form values, and every student keeps a personal version of the same one-pager afterwards.",
  "starter": "Build the one-pager as a fixed HTML layout with five empty slots. Write a JS form that fills them via template literals and calls window.print(). Save the last entry and restore on load. Demo by entering this week's actual notices.",
  "references": [
    {
      "title": "MDN: template literals",
      "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals"
    },
    {
      "title": "MDN: window.print()",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Window/print"
    }
  ]
},
{
  "id": "p009-standards-alignment-checker",
  "why": "Turning a unit plan and a standards list into a coverage report turns a vague worry into a check grid. The code is humble, a join against two CSVs, but the payoff is concrete: which standards nobody has touched yet, and which everyone thinks are covered.",
  "starter": "Prepare two small CSVs: a unit plan with named activities and a standards list with code and title. Load both and build a matrix showing which activities cover which standards, flagging the uncovered ones. Wrap it in a single offline screen.",
  "references": [
    {
      "title": "Python: csv module",
      "url": "https://docs.python.org/3/library/csv.html"
    },
    {
      "title": "Python: match statement / if-elif basics",
      "url": "https://docs.python.org/3/tutorial/datastructures.html"
    }
  ]
},
{
  "id": "p010-peer-review-form-builder",
  "why": "Designing a feedback form in code and using it in a real peer feedback rotation pays off fast. The aggregation step teaches structured inputs against free text, and doubles as a tangible argument for typing form data.",
  "starter": "Model the form as rubric rows each with a level picker, plus one free text box. In Flask, validate on submit and store the results. The aggregation route groups and averages each criterion per student, and Jinja2 renders form, results, and aggregate.",
  "references": [
    {
      "title": "Flask documentation: request and data validation basics",
      "url": "https://flask.palletsprojects.com/en/latest/"
    },
    {
      "title": "Jinja2 documentation",
      "url": "https://jinja.palletsprojects.com/en/latest/"
    }
  ]
},
{
  "id": "p011-homework-deadline-dashboard",
  "why": "Every student has due dates and none of them live in one place. A week-at-a-glance Gantt made from plain data is a compact exercise in date math and layout, and localStorage means the tool keeps working on their own machine all semester.",
  "starter": "Store assignments, subject, due date, and effort, under one localStorage key. Render a week view as CSS grid with one column per day and place each due-date bar across columns with grid-column. Give assignments due today a strong accent color.",
  "references": [
    {
      "title": "MDN: CSS Grid layout",
      "url": "https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Grids"
    },
    {
      "title": "MDN: localStorage API",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API"
    }
  ]
},
{
  "id": "p012-revision-timetable-generator",
  "why": "Spaced repetition is a real learning strategy, and turning it into a working calendar makes the idea concrete. The scheduling is short and worth explaining out loud, and printing a plan that is genuinely useful for an upcoming test is a strong motivator.",
  "starter": "Do the JS side first: take subjects with exam dates, then place study sessions one, three, seven, and fourteen days before each date, moving the earliest one earlier when two collide. Draw a month grid, one cell per day, colored by subject.",
  "references": [
    {
      "title": "MDN: CSS Grid layout",
      "url": "https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Grids"
    },
    {
      "title": "Flask documentation",
      "url": "https://flask.palletsprojects.com/en/latest/"
    }
  ]
},
{
  "id": "p013-concept-map-mind-map-tool",
  "why": "A drag-and-drop node graph is one of the most satisfying builds in a classroom, and the graph data model (nodes, typed edges) is a transferable idea. Export to PNG gives a real artifact, and the tool is usable for essay planning that same week.",
  "starter": "Use vis.js: seed a handful of nodes and one typed edge in an array, then wire up dragging, selecting, and deleting a node or link. Finally add export: grab an SVG of the network, draw it onto a canvas, and offer a PNG download.",
  "references": [
    {
      "title": "vis.js documentation",
      "url": "https://visjs.github.io/vis-network/docs/network/"
    },
    {
      "title": "D3.js home page",
      "url": "https://d3js.org/"
    }
  ]
},
{
  "id": "p014-essay-outline-builder",
  "why": "A guided hook, thesis, three body sections, counter-argument, and conclusion is a small exercise in accordion UI plus string composition, and the .docx export solves a real weekend problem. The export surprises: producing a Word file is easier than students expect.",
  "starter": "Lay each section out in an accordion with a prompt and a textarea. Add an export button that reads every field in order into one plain-text outline and downloads it as a blob. Opening it in Word shows the shape already right.",
  "references": [
    {
      "title": "MDN: DOM APIs and createElement",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement"
    },
    {
      "title": "MDN: File and Blob basics",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Blob"
    }
  ]
},
{
  "id": "p015-citation-bibliography-formatter",
  "why": "Preparing a bibliography used to derail the whole research project. A form that returns a clean APA or MLA entry from a few fields is a compact exercise in string templates with exact formatting rules, and students see the payoff in the next homework.",
  "starter": "Start with a plain form: author, title, publisher, year, and URL. Write a string-building function per style, APA first, then MLA, and check each against an example from a source the class already uses. The works-cited list is an array of those entries as an ordered list.",
  "references": [
    {
      "title": "Purdue OWL citation resources",
      "url": "https://owl.purdue.edu/"
    },
    {
      "title": "Flask documentation",
      "url": "https://flask.palletsprojects.com/en/latest/"
    }
  ]
},
{
  "id": "p016-study-planner-with-pomodoro",
  "why": "Spreading a syllabus across the weeks left is a real planning problem, and pairing each chunk with a built-in 25-minute timer makes studying feel achievable. IndexedDB adds a small taste of a real browser database without any server in the middle.",
  "starter": "Model the syllabus as a list of items with subject, topic, and estimated hours. Write a splitter that hands the remaining days one item per day, starting with the biggest. Store the plan in one IndexedDB object store, draw today's list, and attach a 25-minute timer plus a completion checkbox per item.",
  "references": [
    {
      "title": "MDN: IndexedDB",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API"
    },
    {
      "title": "React documentation: learn to build",
      "url": "https://react.dev/learn"
    }
  ]
},
{
  "id": "p017-student-portfolio-builder",
  "why": "A year of work scattered across folders becomes one page a student can share with a college or employer. Building it from a data file plus a generated layout separates content from presentation, which is the core idea behind static export with Svelte or Next.js.",
  "starter": "Collect three project items from one student, each with a title, a screenshot or file, and a paragraph of reflection. Define that shape as a JSON file. Render one project block per entry on a single page. Verify the site builds as a static export you can open from a folder.",
  "references": [
    {
      "title": "Svelte documentation",
      "url": "https://svelte.dev/docs/svelte"
    },
    {
      "title": "Next.js documentation",
      "url": "https://nextjs.org/docs"
    }
  ]
},
{
  "id": "p018-grade-calculator-gpa-tracker",
  "why": "Grades are all weighted, and students already do this math by hand in a hurry. Turning the calculation into a small program is a gentle win: cleaning up the input, letter-scale conversion, and the projected final average are genuinely useful to the whole class at once.",
  "starter": "Store assignments as name, points earned, points possible, and a category column (homework, projects, tests). Compute each category's percentage and the weighted term average. Then project the final grade by assuming the remaining week matches the current term average. Add a Tkinter window that reads the same data from CSV.",
  "references": [
    {
      "title": "Python: csv module",
      "url": "https://docs.python.org/3/library/csv.html"
    },
    {
      "title": "Python: Tkinter documentation",
      "url": "https://docs.python.org/3/library/tkinter.html"
    }
  ]
},
{
  "id": "p019-self-assessment-reflection-prompts",
  "why": "Forty metacognitive prompts on a spinner turn into a daily routine, and saving each answer next to the prompt turns it into a journal. The mechanics are small, but building a prompt deck with shuffle, free text, and saved responses is a complete data loop for the price of one page.",
  "starter": "Write the deck as an array of forty prompt objects. Show one at a time with a shuffle button and a textarea below. Save each response keyed by date into localStorage. Finally add a journal view that lists last week's prompts with its own answers below each.",
  "references": [
    {
      "title": "MDN: Math.random()",
      "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random"
    },
    {
      "title": "MDN: localStorage API",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API"
    }
  ]
},
{
  "id": "p020-debate-argument-organizer",
  "why": "Claim, evidence, warrant, rebuttal is the framework for actual debate preparation, and the two-column layout is a CSS-only lesson in flexbox. The thinking (short, structured, printable) is visible on one screen, which makes it a model of a focused single-page tool.",
  "starter": "Build the two-column layout with one side holding claim and evidence, the other holding warrant and rebuttal. Use flexbox with a header row per column, and render a list with an add-row and delete button. Add a print stylesheet that flows the right column under the left so the result fits on one page.",
  "references": [
    {
      "title": "MDN: Flexbox layout",
      "url": "https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Flexible_Boxes"
    }
  ]
},
{
  "id": "p021-multiplication-times-table-drill",
  "why": "A fast timed game loop with the DOM is the perfect playground for keyboard input, timers, and state. Adding adaptive resurfacing, where wrong answers come back more often, turns a flat drill into a real engine, and students genuinely want to replay it.",
  "starter": "Start with one prompt in the DOM, a single-letter answer field, and a 30-second timer. Track hits, misses, and a streak, and log every wrong fact into an array so the generator re-picks from it more often next round. Add a badge at milestones, then a small accuracy meter, and run the loop with setInterval.",
  "references": [
    {
      "title": "MDN: Canvas API",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API"
    },
    {
      "title": "MDN: setInterval and requestAnimationFrame",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/setInterval"
    }
  ]
},
{
  "id": "p022-fraction-visualizer-and-practice",
  "why": "Pie and bar models are the classic link from concrete to abstract in fraction work, and they draw beautifully on a Canvas. Generating a problem, then drawing the model next to the answer, is a tightly bounded scope with a visual payoff on every question.",
  "starter": "Choose the JS Canvas path first: draw two pie models, one for each fraction, by slicing circles with arc calls. Start with addition of like denominators, let the student type the answer, and show the combined model filled to the result as instant feedback.",
  "references": [
    {
      "title": "MDN: Canvas API",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API"
    },
    {
      "title": "Python: Turtle graphics",
      "url": "https://docs.python.org/3/library/turtle.html"
    }
  ]
},
{
  "id": "p023-geometry-proof-assistant",
  "why": "Validating each step of a two-column proof against a theorem list is a small but genuine logic engine, and it teaches students to check proofs instead of copying them. Flagging a halfway step is exactly the part a paper worksheet cannot do.",
  "starter": "Define a small theorem dictionary: vertical angles congruent, definition of midpoint, SSS, ASA, and a handful more. Enter one statement at a time, then have the student pick the reason from a dropdown. Look the reason up in the dictionary and flag any step whose reason does not match its statement.",
  "references": [
    {
      "title": "Flask documentation",
      "url": "https://flask.palletsprojects.com/en/latest/"
    }
  ]
},
{
  "id": "p024-spelling-bee-practice-app",
  "why": "Hearing a word, typing its spelling, and getting a phoneme breakdown with the definition plays to the strengths of the browser platform. The Speech API makes the audio free, and the personal miss list turns a five minute drill into a learning loop that keeps paying off between sessions.",
  "starter": "One page with a read button, a typing field, and a feedback zone. Play the word through the Web Speech API. On submit, compare the spelling, and on a miss show the phonetic split and definition, and push the word into a local miss list. Draw the next word from the miss list first.",
  "references": [
    {
      "title": "MDN: Web Speech API",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API"
    },
    {
      "title": "MDN: SpeechSynthesis",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis"
    }
  ]
},
{
  "id": "p025-sight-word-reader-k-2",
  "why": "The lowest-friction card and one of the most usable: big type, tap to hear a word, star the ones already mastered. It runs offline in any browser, so it works on the classroom wall, at a home kitchen table, or in a small-group session with no network at all.",
  "starter": "Put the first hundred Fry list words in a plain array and render fifteen at a time in large type, each with a star. Tap a word to play it through the Web Speech API and toggle its star, stored in localStorage. Add previous and next page controls and show mastered count for the current page.",
  "references": [
    {
      "title": "MDN: Web Speech API",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API"
    },
    {
      "title": "MDN: localStorage API",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API"
    }
  ]
},
{
  "id": "p026-phonics-blend-builder",
  "why": "Early readers struggle to see how onset and rime chunks combine. This build lets students drag cards, hear the blended sound, and get instant feedback when the combination is not a real word, turning phonics practice into a game.",
  "starter": "Start with a small deck of about twelve onset cards and eight rime cards in plain HTML and CSS. Wire one Web Audio oscillator tone per card so any drag plays sound. Demo first: drag /bl/ next to /ock/ and confirm a word forms and sounds.",
  "references": [
    {
      "title": "MDN Web Audio API",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API"
    },
    {
      "title": "MDN Drag and Drop API",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API"
    }
  ]
},
{
  "id": "p027-reading-comprehension-q-generator",
  "why": "Teachers spend hours writing comprehension questions that match different reading levels. Auto-generating literal, inferential, and evaluative questions from a pasted passage shows students how question design works and gives them practice at every level.",
  "starter": "Install spaCy and load the medium English model. First version: extract the first three sentences with noun phrases for literal questions. Demo a passage from a public domain story and show one question type per level before adding answer keys.",
  "references": [
    {
      "title": "spaCy Tutorials",
      "url": "https://spacy.io/usage"
    },
    {
      "title": "spaCy get core components",
      "url": "https://spacy.io/api/language#getters-setters"
    }
  ]
},
{
  "id": "p028-vocabulary-builder-w-etymology",
  "why": "Know a prefix or root and many words unlock. Showing the Etymonline entry next to a short definition and three example sentences turns vocabulary study into detective work that students remember far longer than flashcards.",
  "starter": "Scrape or download a small slice of Etymonline for one letter, such as K, as JSON. Build one Flask route that takes a word and returns definition, root, and breakdown. Demo with a word like benevolent so students see prefix, root, and suffix apart.",
  "references": [
    {
      "title": "Flask Quickstart",
      "url": "https://flask.palletsprojects.com/en/3.0.x/quickstart/"
    },
    {
      "title": "Etymonline dictionary home",
      "url": "https://www.etymonline.com/"
    }
  ]
},
{
  "id": "p029-spanish-french-verb-conjugator",
  "why": "Conjugation grids are the bedrock of Spanish and French fluency, yet rote drilling is slow. A rule-table conjugator with audio lets students see the whole pattern at once and hear it, which makes exceptions stand out and stick.",
  "starter": "Pick one language first. Store the regular -ar, -er, -ir (or -er, -ir) stem rules as a table in each language, and hardcode a dozen common irregulars. Render the present tense grid for ser and a regular verb as the demo.",
  "references": [
    {
      "title": "University of Leeds Spanish verbs",
      "url": "https://verbix.com/"
    },
    {
      "title": "MDN SpeechSynthesis API",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API"
    }
  ]
},
{
  "id": "p030-periodic-table-explorer",
  "why": "The periodic table is a wall poster for most students. A clickable explorer with animated Bohr models and a compare two elements mode turns it into a self-serve tool that makes patterns like valence and abundance visible.",
  "starter": "Start with a JSON file of the first eight elements: symbol, mass, electron config, abundance. Render the grid in plain CSS and open a side panel on click. Demo by comparing hydrogen and helium before building the Bohr animation.",
  "references": [
    {
      "title": "Chart.js documentation",
      "url": "https://www.chartjs.org/docs/latest/"
    },
    {
      "title": "PubChem periodic table data",
      "url": "https://pubchem.ncbi.nlm.nih.gov/periodic-table/"
    }
  ]
},
{
  "id": "p031-chemistry-equation-balancer",
  "why": "Balancing equations is where algebra silently enters the chemistry classroom. Seeing coefficients fall out of a linear system, plus oxidation states and a reaction type label, connects math and chemistry instead of leaving them as separate chores.",
  "starter": "Represent atoms as columns and half-reactions as rows of a matrix, then solve the integer system with numpy. First version handles two or three compounds only. Demo the classic H2 plus O2 to H2O balance before adding oxidation state annotations.",
  "references": [
    {
      "title": "NumPy linear algebra docs",
      "url": "https://numpy.org/doc/stable/reference/routines.linalg.html"
    },
    {
      "title": "AQA balancing equations guide",
      "url": "https://chem.libretexts.org/Bookshelves/Introductory_Chemistry"
    }
  ]
},
{
  "id": "p032-projectile-motion-simulator",
  "why": "Kids can recite the projectile formulas without imagining the path. An animated trajectory with angle, velocity, and gravity sliders, plus live position and velocity graphs, makes the physics visible and invites the classic 45 degree question.",
  "starter": "Work out s equals v t plus one half a t squared for x and y on paper using one second steps. Then plot the dots with JS Canvas and add a slider for launch angle. Demo how 45 degrees maximizes range with air drag off.",
  "references": [
    {
      "title": "Khan Academy projectile motion",
      "url": "https://www.khanacademy.org/science/physics"
    },
    {
      "title": "MDN Canvas API",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API"
    }
  ]
},
{
  "id": "p033-simple-circuit-diagram-builder",
  "why": "Shorts, series, and parallel are abstract until students can build them and watch the current go. A drag and drop SVG circuit builder that computes Kirchhoff values and flags a short circuit makes electricity errors safe to make.",
  "starter": "Draw four components, battery, resistor, LED, and wire segment, as inline SVG with drag handlers defined. Show one working series circuit with computed current on each branch. Add the short circuit warning before parallel branches.",
  "references": [
    {
      "title": "MDN SVG reference",
      "url": "https://developer.mozilla.org/en-US/docs/Web/SVG"
    },
    {
      "title": "Khan Academy circuit basics",
      "url": "https://www.khanacademy.org/science/physics"
    }
  ]
},
{
  "id": "p034-music-theory-interval-ear-training",
  "why": "Ear training is the most cited but hardest habit for musicians to build alone. A two-note interval quiz with a dropdown answer and a running accuracy score turns five minutes of practice into data the student can actually improve.",
  "starter": "Map the twelve equal-tempered intervals to frequencies, one chromatic table. Play two notes with the Web Audio API and let students pick from a dropdown of intervals, sharp and flat. Track raw accuracy in memory before adding chords.",
  "references": [
    {
      "title": "MDN OscillatorNode docs",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode"
    },
    {
      "title": "Open Music Theory intervals",
      "url": "https://westgato.musicalartistry.com/mth/ch02/"
    }
  ]
},
{
  "id": "p035-solar-system-scale-explorer",
  "why": "Most students cannot picture that the stations are tiny relative to the distances. Toggling a solar system view between distance scale and size scale, with a quick fact quiz on each planet, makes the enormity of scale land.",
  "starter": "Load planets plus diameter and orbital distance from a NASA json file. Build the size scale view first with circles at true relative diameters. Demo the two scale toggle before wiring the click for facts and moons.",
  "references": [
    {
      "title": "NASA planetary fact sheets",
      "url": "https://nssdc.gsfc.nasa.gov/planetary/factsheet/"
    },
    {
      "title": "Three.js official guide",
      "url": "https://threejs.org/docs/"
    }
  ]
},
{
  "id": "p036-anatomy-label-the-diagram-quiz",
  "why": "Anatomy class lives or dies on remembering where each structure goes, and clicking dots on a diagram is far closer to the real skill than crossword sheets. A scored label the diagram quiz with a reveal correct labels mode sizes for whole-class review.",
  "starter": "Get one clean SVG of a heart with hotspots defined as circles over each chamber and valve. Wire a click to reveal the label and update a score. Start with seven structures and add the brain diagram once the flow works.",
  "references": [
    {
      "title": "MDN image map and area",
      "url": "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/area"
    },
    {
      "title": "OpenStax Anatomy and Physiology",
      "url": "https://openstax.org/details/books/anatomy-and-physiology-2e"
    }
  ]
},
{
  "id": "p037-cell-biology-diagram-annotator",
  "why": "Students label textbooks passively, but building the annotations themselves, with a one line function note per organelle, is active recall in disguise. Exporting the finished diaphragm to a PNG gives each student a diagram they own.",
  "starter": "Load one cell image onto a Canvas and make text boxes draggable with mouse events. First version allows adding labels and typing function notes in memory, then add PNG export with canvas toBlob. Demo a phospholipid diagram with six organelles.",
  "references": [
    {
      "title": "MDN Canvas toBlob",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob"
    },
    {
      "title": "CK-12 cell structure",
      "url": "https://flexbooks.ck12.org/"
    }
  ]
},
{
  "id": "p038-history-timeline-builder",
  "why": "History is taught in textbook chunks that hide how events connect across decades. A shared timeline where students add their era with a date, image, and description lets the class see its own gaps and overlaps without a teacher marching in front.",
  "starter": "Try vis-timeline first, it ships pan, zoom, and grouping out of the box. Load ten events spanning a full course as a JSON seed. Demo a pan and zoom on that seed before letting students add their own events with dates.",
  "references": [
    {
      "title": "vis-timeline documentation",
      "url": "https://visjs.github.io/vis-timeline/"
    },
    {
      "title": "D3.js main site",
      "url": "https://d3js.org/"
    }
  ]
},
{
  "id": "p039-geography-flag-capital-quiz",
  "why": "Flag to country and country to flag is the fastest drilling exercise in geography, and an adaptive score with a five round streak mode converts rote drills into something students ask for again. Works as a warm up before any map unit.",
  "starter": "Load a 20 country dataset with flag URLs from a public flag API, and a one or two line fact per entry. Build the flag to country direction first with a text field answer, then add reverse mode before the streak timer.",
  "references": [
    {
      "title": "Rest Countries API",
      "url": "https://restcountries.com/"
    },
    {
      "title": "MDN fetch API",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API"
    }
  ]
},
{
  "id": "p040-art-history-style-classifier",
  "why": "Art history students name movements like Rococo and Impressionism from slides but rarely engage with real paintings. A small pre-trained CNN that scores each style with a confidence bar gives them a guessable oracle to argue with in class.",
  "starter": "Use a small pre-trained model from a library like Teachable Machine or a published ImageNet classifier via a Flask wrapper. Start with four movements that have distinct looks. Show the confidence bar plus a key artist blurb before adding more classes.",
  "references": [
    {
      "title": "Teachable Machine by Google",
      "url": "https://teachablemachine.withgoogle.com/"
    },
    {
      "title": "Flask deployment docs",
      "url": "https://flask.palletsprojects.com/en/3.0.x/deploying/"
    }
  ]
},
{
  "id": "p041-braille-text-converter",
  "why": "Braille is a perfect first dataset project: a fixed 6-dot cell, a small English to cell mapping table, and a printable output. Students watch an abstraction become a table, and the reverse direction, dots back to letters, teaches them to read the grid itself.",
  "starter": "Store the 26 letter grade-1 cells as an array of six dot patterns, one per letter. Build the English to grid direction first on a simple monospace layout. Demo the word hello rendered as braille cells before adding the dots back to text reader.",
  "references": [
    {
      "title": "NFB braille resource page",
      "url": "https://www.nfb.org/"
    },
    {
      "title": "MDN SVG reference",
      "url": "https://developer.mozilla.org/en-US/docs/Web/SVG"
    }
  ]
},
{
  "id": "p042-dyslexia-friendly-text-formatter",
  "why": "Accessibility tools are usually consumed, never built. Letting students paste text and tune letter spacing, line height, and a pale tint over OpenDyslexic type, live, shows why each choice exists. Copying out the styled HTML leaves them with a working pattern.",
  "starter": "Load the OpenDyslexic webfont, keep one textarea and one live preview div, and bind three sliders to CSS variables for letter-spacing, line-height, and background tint. Demo the before and after split view before adding the copy-styled-HTML button.",
  "references": [
    {
      "title": "OpenDyslexic project site",
      "url": "https://open-dyslexic.org/"
    },
    {
      "title": "MDN CSS font-face docs",
      "url": "https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face"
    }
  ]
},
{
  "id": "p043-sign-language-alphabet-reference",
  "why": "Fingerspelling is the on-ramp to sign language and the hardest part to practice alone. A 26-letter grid that plays a handshape clip on click, plus a random-order drill, turns a passive reference into a spaced practice loop that students actually repeat.",
  "starter": "Lay out the 26 letter grid with placeholder GIF or video files in one folder. Wire one click to play the clip for that letter and track the answer. Add the random-order practice drill and a simple streak counter before hunting for polished video sources.",
  "references": [
    {
      "title": "LifePrint ASL dictionary",
      "url": "https://asl-dictionary.lifeprint.com/"
    },
    {
      "title": "MDN HTML media elements",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement"
    }
  ]
},
{
  "id": "p044-accessibility-checker-for-slides",
  "why": "Most student decks ship with low-contrast text and no alt text, and creators never hear about it. A checker that reads a .pptx and prints a fix-it list with slide numbers teaches the accessibility standard by enforcing it, fully offline and free.",
  "starter": "Use python-pptx to walk every slide and shape: flag empty alt text and text runs whose color pair fails a contrast threshold. Emit one report file listing slide number, issue, and fix. Demo it on a deliberately bad sample deck first.",
  "references": [
    {
      "title": "python-pptx documentation",
      "url": "https://python-pptx.readthedocs.io/"
    },
    {
      "title": "W3C WCAG 2.1",
      "url": "https://www.w3.org/TR/WCAG21/"
    }
  ]
},
{
  "id": "p045-latex-math-notation-editor",
  "why": "Students typed math in words because formatting felt like a wall. Live KaTeX rendering, a click to copy the rendered image or the source, and a cheat-sheet sidebar turns notation from a hurdle into a fast skill they carry into real assignments.",
  "starter": "Add KaTeX from a CDN with one textarea and one preview div, rendering on each keystroke. Demo a fraction and a quadratic formula first. Then wire the copy-rendered and copy-source buttons before building the cheat-sheet sidebar with saved macros.",
  "references": [
    {
      "title": "KaTeX documentation",
      "url": "https://katex.org/docs/"
    },
    {
      "title": "Overleaf LaTeX crash course",
      "url": "https://www.overleaf.com/learn/latex/Learn_LaTeX"
    }
  ]
},
{
  "id": "p046-grammar-and-proofreading-aid",
  "why": "Peer editing is great but students only catch what they already know. Feeding one paragraph through a real language engine and showing each flagged issue with a one-click fix suggestion teaches students to trust, and then beat, the machine.",
  "starter": "Call the free LanguageTool API from a Flask endpoint with a rate limit for the class. Highlight matches in the pasted text and list each suggestion beside it. Demo one paragraph on purpose with four common errors before opening the suggestions.",
  "references": [
    {
      "title": "LanguageTool API docs",
      "url": "https://languagetool.org/http-api/"
    },
    {
      "title": "Flask quickstart",
      "url": "https://flask.palletsprojects.com/en/3.0.x/quickstart/"
    }
  ]
},
{
  "id": "p047-group-project-task-allocator",
  "why": "Group projects fail on logistics, not content. One student gets everything, one gets nothing. A simple allocator that takes names, skills, and a task list, then balances the load and prints a responsibility matrix, saves the week of unsolved arguments.",
  "starter": "Model members as objects with skills and tasks with an estimated weight. Round-robin assign tasks to the member with the lightest current load who has a matching skill. Demo a three-person team with six tasks before wiring the matrix view.",
  "references": [
    {
      "title": "React getting started",
      "url": "https://react.dev/learn"
    },
    {
      "title": "MDN localStorage",
      "url": "https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API"
    }
  ]
},
{
  "id": "p048-flashcard-cloze-fill-in-the-blank-builder",
  "why": "Cloze questions are the best bridge from passive reading to active recall, but making them by hand is slow. Paste a paragraph, watch the key terms highlight, and the class owns a spaced repetition deck built from text they actually read this week.",
  "starter": "Use a simple pos filter to pick content nouns and verbs from the pasted paragraph and mark them as holes. Render one cloze card with a reveal button first. Add the spaced repetition schedule, say SM-2 lite, after the cards feel worth reviewing.",
  "references": [
    {
      "title": "spaCy part of speech tutorial",
      "url": "https://spacy.io/usage/linguistic-features"
    },
    {
      "title": "Anki spaced repetition docs",
      "url": "https://docs.ankiweb.net/intervals.html"
    }
  ]
},
{
  "id": "p049-lab-report-template-generator",
  "why": "Families waste the first hour of every lab writing the same headings. A generator that takes a subject, a hypothesis, and results, then fills a Jinja2 template into a clean DOCX or PDF, keeps students focused on the science and still teaches the report structure.",
  "starter": "Write one Jinja2 DOCX template with the classic headings: question, hypothesis, materials, method, results, conclusion. Load a sample filled bio lab as the demo. Add the subject pick for bio, chem, phys once the export reads well.",
  "references": [
    {
      "title": "Jinja2 templates docs",
      "url": "https://jinja.palletsprojects.com/en/3.1.x/templates/"
    },
    {
      "title": "python-docx tutorial",
      "url": "https://python-docx.readthedocs.io/"
    }
  ]
},
{
  "id": "p050-school-event-permission-slip-builder",
  "why": "Every event becomes a night of formatting slips. A form that takes the date, location, cost, and chaperones and outputs a printable slip with a matching RSVP form turns admin work into a form to validate, and models good data validation on a real school document.",
  "starter": "Build the slip as one A4 sized HTML page with fields for date, location, and a signature line, then use a print to PDF path for export. Demo one filled field trip slip before adding the RSVP form and its simple count of attendees.",
  "references": [
    {
      "title": "Flask quickstart",
      "url": "https://flask.palletsprojects.com/en/3.0.x/quickstart/"
    },
    {
      "title": "ReportLab user guide",
      "url": "https://docs.reportlab.com/"
    }
  ]
}
];
