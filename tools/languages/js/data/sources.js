/**
 * Where every number and every date on this site comes from.
 * A record points here with `stats[].source`. Keys, labels, and urls are copied
 * from the source list in tools/build/languages.md, so the two agree.
 *
 * Source [S27] of that document is an internal note about auditing the first
 * edition's links. It has no URL, so it is not a source a student can be sent
 * to, and it is not kept here. The note itself reads: link audit of the first
 * edition of `tools/build/languages.md`, 38 unique URLs, run 2026-10-26 with a
 * browser user agent following redirects, recorded in plan §14.
 */

export const SOURCES = {
  S1: {
    label: "Stack Overflow Developer Survey 2026, Technology chapter and data tables",
    url: "https://survey.stackoverflow.co/2026/technology",
    as_of: "2026-10",
    note: "Fielded 2026, published 2026-10-06; 30,903 respondents, 169 countries; languages question base n = 14,099. A second table for the same question is at https://survey.stackoverflow.co/2026/technology/data. That data page is licensed ODbL 1.0, so any number taken from it must carry credit: \"Stack Overflow Developer Survey 2026, data under ODbL 1.0\". The survey counts developers who answer it, not every person who writes code.",
  },
  S2: {
    label: "Python FAQ, \"Why is it called Python?\", which states the Monty Python's Flying Circus origin",
    url: "https://docs.python.org/3/faq/general.html",
    as_of: "2026-10-26",
    note: "",
  },
  S3: {
    label: "Chamberlin and Boyce, \"SEQUEL\" (1976), and the Wikipedia SQL overview",
    url: "https://doi.org/10.1145/800296.811515",
    as_of: "2026-10-26",
    note: "Chamberlin and Raymond F. Boyce, \"SEQUEL\", Proceedings of the 1976 ACM SIGFIDET Workshop on Data Description, Access and Control, article 22 (1976); and the SQL overview on Wikipedia, which dates the language's development at IBM to the early 1970s and records ANSI standardisation in 1986",
  },
  S4: {
    label: "Java version history (JDK 1.0 released 23 January 1996, announced 1995) and the Oracle Java language archive",
    url: "https://en.wikipedia.org/wiki/Java_version_history",
    as_of: "2026-10-26",
    note: "",
  },
  S5: {
    label: "GNU Bash manual preface (Brian Fox, 1989) and Chet Ramey, \"Introduction to the History of Shell Programming\", 1994",
    url: "https://www.gnu.org/software/bash/",
    as_of: "2026-10-26",
    note: "",
  },
  S6: {
    label: "Dennis M",
    url: "https://www.nokia.com/bell-labs/about/dennis-m-ritchie/chist.html",
    as_of: "2026-10-26",
    note: "Ritchie, \"The Development of the C Language\", 1992.  (the older bell-labs.com path now redirects here)",
  },
  S7: {
    label: "Bjarne Stroustrup, \"A History of C++: 1979-1991\" and his C++ FAQ",
    url: "https://www.stroustrup.com/hopl2.pdf",
    as_of: "2026-10-26",
    note: "",
  },
  S8: {
    label: "Microsoft press release of 26 June 2000 announcing C#, and ECMA-334 introduction",
    url: "https://news.microsoft.com/source/2000-06-26/microsoft-introduces-highly-productive-net-programming-language-c/",
    as_of: "2026-10-26",
    note: "",
  },
  S9: {
    label: "Go project: FAQ, the SPLASH 2012 article, and the Go 1 announcement of 28 March 2012",
    url: "https://go.dev/doc/faq",
    as_of: "2026-10-26",
    note: "",
  },
  S10: {
    label: "College Board AP Computer Science A course page, exam format, and Java Quick Reference",
    url: "https://apcentral.collegeboard.org/courses/ap-computer-science-a",
    as_of: "2026-10-26",
    note: "",
  },
  S11: {
    label: "W3C history pages: the 1989 WWW proposal and \"Some early ideas for HTML\"",
    url: "https://www.w3.org/History/1989/proposal.html",
    as_of: "2026-10-26",
    note: "",
  },
  S12: {
    label: "W3C CSS history and the CSS1 Recommendation press release of 17 December 1996",
    url: "https://www.w3.org/Style/CSS/history.html",
    as_of: "2026-10-26",
    note: "",
  },
  S13: {
    label: "Scratch credits (MIT Media Lab 2002, launch 2007, versions), MIT News of 14 May 2007 and 14 May 2013, Scratch Foundation about page for the 2019 transfer",
    url: "https://scratch.mit.edu/credits/",
    as_of: "2026-10-26",
    note: "",
  },
  S14: {
    label: "Scratch project player embed, the one documented embed form, tested on a live project",
    url: "https://scratch.mit.edu/projects/101283090/embed",
    as_of: "2026-10-26",
    note: "The Scratch wiki page on embedding was unreachable from this network on 2026-10-26 and is not cited",
  },
  S15: {
    label: "Brendan Eich interview, \"JavaScript creator ponders past, future\", InfoWorld; and Eich et al., \"JavaScript: The First 20 Years\", ACM HOPL 2019",
    url: "https://www.infoworld.com/article/2174329/javascript-creator-ponders-past-future.html",
    as_of: "2026-10-26",
    note: "",
  },
  S16: {
    label: "Microsoft \"Ten Years of TypeScript\", which dates the first preview to 1 October 2012",
    url: "https://devblogs.microsoft.com/typescript/ten-years-of-typescript/",
    as_of: "2026-10-26",
    note: "",
  },
  S17: {
    label: "Julia Language: the original paper and project history",
    url: "https://julialang.org/",
    as_of: "2026-10-26",
    note: "",
  },
  S18: {
    label: "Android Developers \"Android's Kotlin-first approach\", JetBrains \"Kotlin on Android",
    url: "https://developer.android.com/kotlin/first",
    as_of: "2026-10-26",
    note: "Now official\" (May 2017), Android Developers Blog \"Android's commitment to Kotlin\" (December 2019)",
  },
  S19: {
    label: "MathWorks, \"Company History\", 1984 founding and Cleve Moler",
    url: "https://www.mathworks.com/company/history/40-years/5.html",
    as_of: "2026-10-26",
    note: "This host returns 403 to automated clients and was read in a browser; Wikipedia's MathWorks page carries the same dates",
  },
  S20: {
    label: "PHP manual, \"History of PHP\"",
    url: "https://www.php.net/manual/en/history.php.php",
    as_of: "2026-10-26",
    note: "",
  },
  S21: {
    label: "W3Techs technology reports for WordPress and for server-side programming languages, October 2026",
    url: "https://w3techs.com/technologies/details/cm-wordpress",
    as_of: "2026-10-26",
    note: "",
  },
  S22: {
    label: "PowerShell Team blog: \"Monad Manifesto: the Origin of Windows PowerShell\", \"It's a Wrap! Windows PowerShell 1.0 Released!\" (14 November 2006), \"PowerShell on Linux and Open Source!\" (18 August 2016), and Microsoft Learn Monad Manifesto page",
    url: "https://devblogs.microsoft.com/powershell/monad-manifesto-the-origin-of-windows-powershell/",
    as_of: "2026-10-26",
    note: "",
  },
  S23: {
    label: "Ihaka and Gentleman, \"R: Past and Future History\"; R 1.0.0 release notice; Ihaka and Gentleman, \"R: A Language for Data Analysis and Graphics\", 1996",
    url: "https://cran.r-project.org/doc/html/interface98-paper/paper_2.html",
    as_of: "2026-10-26",
    note: "",
  },
  S24: {
    label: "Ruby official history page and Matsumoto interviews",
    url: "https://www.ruby-lang.org/en/about/",
    as_of: "2026-10-26",
    note: "",
  },
  S25: {
    label: "Rust 1.0 announcement (April 2015) and The Rust Programming Language",
    url: "https://doc.rust-lang.org/book/",
    as_of: "2026-10-26",
    note: "",
  },
  S26: {
    label: "Swift documentation and Apple's 2015 open-source announcement",
    url: "https://docs.swift.org/swift-book/",
    as_of: "2026-10-26",
    note: "",
  },
};
