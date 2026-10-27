/**
 * The fixed words of the interface: the header, the buttons, the section
 * titles. The switcher changes these and nothing else. What a language *is*
 * lives in a record, and stays English in this version (decision 8).
 *
 * Shape: one key, then the string in each language.
 *
 * The Chinese strings were signed off on 2026-10-27 by a reader who reads
 * Chinese, at the owner's colleague, which is the gate in plan §12 (V8). That
 * review covers chrome only: what a language *is* stays English in this
 * version (decision 8), and each page says so once.
 *
 * The language picker needs no key here. A language is called by its own name
 * in every language.
 */

export const LANG_KEY = "lang";

export const CHROME = {
  "site.name": { en: "Languages", zh: "编程语言" },
  "site.tagline": { en: "What each one is for", zh: "每种语言的用途" },

  "nav.index": { en: "All languages", zh: "全部语言" },
  "nav.glossary": { en: "Glossary", zh: "术语表" },
  "nav.about": { en: "About", zh: "关于" },
  "nav.language": { en: "Language", zh: "语言" },

  "index.core.title": { en: "Start here", zh: "从这里开始" },
  "index.core.body": {
    en: "Eight languages a school or a first project meets often.",
    zh: "学校或第一个项目最常遇到的八种语言。",
  },
  "index.extended.title": { en: "Worth knowing later", zh: "以后值得了解" },
  "index.extended.body": {
    en: "Fourteen more. Each page stands on its own.",
    zh: "还有十四种。每个页面都可以单独阅读。",
  },

  // e03s01 (2026-10-28): the index filter. Chinese below is zh pending V8 -
  // a draft for the M6 pass with the owner's colleague (non-engineer reader).
  // Do not treat those strings as signed until that pass is logged.
  "filter.label": { en: "Type", zh: "类型" },
  "filter.all": { en: "All", zh: "全部" },
  "filter.kind.blocks": { en: "Blocks, not text", zh: "拼积木，不是打字" },
  "filter.kind.web": { en: "Web", zh: "网页" },
  "filter.kind.general": { en: "Everyday", zh: "日常" },
  "filter.kind.systems": { en: "Systems", zh: "系统" },
  "filter.kind.data": { en: "Data", zh: "数据" },
  "filter.kind.terminal": { en: "Terminal", zh: "终端" },
  "filter.none": { en: "Nothing here yet. Clear the filter to see all of them.", zh: "这里现在没有。清除过滤器就能看到全部。" },

  "page.reads": { en: "What it reads like", zh: "读起来像什么" },
  "page.category": { en: "What kind it is", zh: "它属于哪一类" },
  "page.makes": { en: "What it builds", zh: "它能建造什么" },
  "page.difficulty": { en: "How it feels to learn", zh: "学起来的感受" },
  "page.history": { en: "Where it came from", zh: "它的来历" },
  "page.stats": { en: "How many people use it", zh: "有多少人在用" },
  "page.links": { en: "Learn more", zh: "进一步了解" },
  "page.terms": { en: "Words on this page", zh: "本页的词汇" },
  "page.next": { en: "Learn next", zh: "接着学什么" },
  "page.prereqs": { en: "Know this first", zh: "需要先会" },

  "demo.title": { en: "See it", zh: "看例子" },
  "demo.code": { en: "The code", zh: "代码" },
  "demo.output": { en: "What it prints", zh: "它输出的内容" },
  "demo.output_note": {
    en: "Written by hand from running this code. This page runs nothing.",
    zh: "这段输出是运行上述代码后手工记录的。本页面不运行任何代码。",
  },
  "demo.copy": { en: "Copy code", zh: "复制代码" },
  "demo.copied": { en: "Copied", zh: "已复制" },
  "demo.copy_fail": {
    en: "Copy failed. Select the code instead.",
    zh: "复制失败。请手动选择代码。",
  },
  "demo.run_out": {
    en: "Open a page that runs it",
    zh: "打开一个可以运行的页面",
  },

  "glossary.title": { en: "Glossary", zh: "术语表" },
  "glossary.body": {
    en: "Every word these pages use, in one place.",
    zh: "这些页面用到的每个词，都在这里。",
  },
  "glossary.filter": { en: "Filter words", zh: "筛选词汇" },
  "glossary.empty": { en: "No word matches.", zh: "没有匹配的词汇。" },
  "glossary.source": { en: "Source", zh: "来源" },

  "notfound.title": { en: "No page here", zh: "没有这个页面" },
  "notfound.body": {
    en: "That address matches no language and no word.",
    zh: "这个地址不对应任何语言，也不对应任何词汇。",
  },
  "notfound.link": { en: "Go to all languages", zh: "查看全部语言" },

  "about.title": { en: "About this site", zh: "关于本站" },
  "about.body": {
    en: "These pages grow from a written table of twenty-two languages. Every figure names its source and the date it was measured. No example runs on your machine. Each output was written by hand after running the code here.",
    zh: "这些页面来自一份二十两种语言的书面表格。每个数字都注明数据来源和测量日期。任何示例都不会在你的电脑上运行。每段输出都是在本地运行代码后手工记录的。",
  },

  "content.lang_note": {
    en: "Language pages are in English in this version.",
    zh: "在本版本中，语言页面为英文。",
  },

  "footer.updated": { en: "Built 2026-10-26", zh: "建于 2026-10-26" },
  "footer.sources": {
    en: "Every figure names its source and its date.",
    zh: "每个数字都注明来源和日期。",
  },
  "footer.note": {
    en: "The survey counts those who answer it. It misses the rest.",
    zh: "这项调查只统计回答它的人。其他人没有被统计。",
  },
};
