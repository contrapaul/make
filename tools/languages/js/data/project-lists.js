/**
 * e03s03t01: which projects on the sibling site each language page links to.
 * Generated from the sibling's PROJECTS array - do not edit by hand.
 * test/xlink.test.mjs re-derives this file from the sibling data and fails on
 * drift, so a change on the sibling side cannot silently stale these rows.
 *
 * Selection (owner decision 2026-10-28): from the records tagged with a
 * language, Part 1 first (the widest playing field), then Parts 2/3 in
 * catalogue order, cap three names. count is the total the reader is told,
 * not the cap. Languages without a sibling tag (type, terminal, data science,
 * blocks, etc.) have no entry at all: the footer is omitted.
 */

export const LIST = {
  html: { tags: ["html"], count: 23, projects: [
    { id: "p002-2048-puzzle", name: "2048 Puzzle" },
    { id: "p004-random-password-generator", name: "Random Password Generator" },
    { id: "p009-typing-speed-test", name: "Typing Speed Test" }
  ] },
  css: { tags: ["css"], count: 9, projects: [
    { id: "p002-2048-puzzle", name: "2048 Puzzle" },
    { id: "p009-typing-speed-test", name: "Typing Speed Test" },
    { id: "p042-personal-portfolio-site", name: "Personal Portfolio Site" }
  ] },
  javascript: { tags: ["js", "node"], count: 89, projects: [
    { id: "p002-2048-puzzle", name: "2048 Puzzle" },
    { id: "p004-random-password-generator", name: "Random Password Generator" },
    { id: "p006-markdown-html-blog", name: "Markdown → HTML Blog" }
  ] },
  python: { tags: ["python"], count: 86, projects: [
    { id: "p001-snake-pong-breakout", name: "Snake / Pong / Breakout" },
    { id: "p003-text-adventure-engine", name: "Text Adventure Engine" },
    { id: "p005-color-palette-extractor", name: "Color Palette Extractor" }
  ] },
  sql: { tags: ["sql"], count: 3, projects: [
    { id: "p016-url-shortener", name: "URL Shortener" },
    { id: "p005-iep-504-goal-tracker", name: "IEP / 504 Goal Tracker" },
    { id: "p006-attendance-quick-entry-csv", name: "Attendance Quick-Entry + CSV" }
  ] },
  java: { tags: ["java"], count: 1, projects: [
    { id: "p021-chatbot-rule-based", name: "Chatbot (Rule-Based)" }
  ] },
  bash: { tags: ["bash"], count: 4, projects: [
    { id: "p018-bulk-image-resizer", name: "Bulk Image Resizer" },
    { id: "p033-cron-style-job-scheduler-mini", name: "Cron-Style Job Scheduler (mini)" },
    { id: "p041-log-file-parser-and-alert", name: "Log File Parser & Alert" }
  ] },
  c: { tags: ["c"], count: 4, projects: [
    { id: "p019-conway-s-game-of-life", name: "Conway's Game of Life" },
    { id: "p032-image-ascii-art", name: "Image → ASCII Art" },
    { id: "p044-minesweeper", name: "Minesweeper" }
  ] },
  cpp: { tags: ["cpp"], count: 2, projects: [
    { id: "p013-sudoku-solver-generator", name: "Sudoku Solver / Generator" },
    { id: "p006-connect-four", name: "Connect Four" }
  ] },
  csharp: { tags: ["csharp"], count: 4, projects: [
    { id: "p012-pomodoro-timer-gui", name: "Pomodoro Timer (GUI)" },
    { id: "p030-word-frequency-counter", name: "Word Frequency Counter" },
    { id: "p020-pdf-text-extractor", name: "PDF Text Extractor" }
  ] },
  go: { tags: ["go"], count: 6, projects: [
    { id: "p011-file-duplicate-finder", name: "File Duplicate Finder" },
    { id: "p023-git-commit-message-linter", name: "Git Commit Message Linter" },
    { id: "p029-todo-api-cli-client", name: "Todo API + CLI Client" }
  ] },
  ruby: { tags: ["ruby"], count: 1, projects: [
    { id: "p020-recipe-manager-cli", name: "Recipe Manager CLI" }
  ] },
  rust: { tags: ["rust"], count: 4, projects: [
    { id: "p007-expense-tracker-cli", name: "Expense Tracker CLI" },
    { id: "p023-git-commit-message-linter", name: "Git Commit Message Linter" },
    { id: "p035-file-encryption-decryption", name: "File Encryption / Decryption" }
  ] },
};
