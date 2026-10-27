# Programming Languages Reference — Source Table for the Language Site

**Purpose:** research notes for `tools/languages/`. The build plan is
`tools/build/languageplan.md`. This file is an input to that build, not reader-facing copy.
Site copy is written to the reading standard in plan §8, and 100 % of the sentences below were
rewritten before shipping. Do not paste from here.

**Revision:** 2026-10-26, second edition. The first edition was drafted without web access. Every
number, date, name, and link in this edition was checked against the sources listed at the
bottom and carries a retrieval date. Corrections against the first edition are itemised in
§ Changes.

**How to read the Survey column:** `n` = 14,099 respondents who answered the languages question.
Use share = percent of those respondents who reported using the language in the past year. Both
figures are 2026 [S1]. A share is a property of the surveyed population, not of all programmers.

**Owner input still required:** the difficulty note per language. Plan §6.3 assigns those by hand,
not by a model. The Core and Extended membership below was approved by the owner on 2026-10-26,
as was adding PowerShell to Extended.

---

## The Table

Tier `Core` = a high-school student can act on it this term. Tier `Extended` = reference
knowledge at this age. Ordering: Core first in learning order, then Extended alphabetically.
There is no rank here. Do not render a number in front of a language name.

### Core (8)

| Language | What it does | Used for | Demo sketch (plan §9.2: code plus recorded output, no runtime) | History, difficulty, fit | Survey 2026 | Links |
|---|---|---|---|---|---|---|
| **Scratch** | Snap coloured blocks together to make a story or a game run. No typing, no syntax. | First coding experience, ages about 8 to 16. School CS introduction. | A still image of a 6-block script that says hello and moves on key press, plus a link out. Embedding the Scratch editor is not supported; only single projects embed, as a player [S14]. | Started 2002 at the MIT Media Lab by the Lifelong Kindergarten group led by Mitchel Resnick; publicly launched 15 May 2007; Scratch 2.0 in May 2013; Scratch 3.0 in January 2019 [S13]. Based on Logo and Squeak. Run by the Scratch Foundation, a nonprofit, since 2019, not by MIT [S13]. Easiest entry point on this page. | not in the survey's language list | [scratch.mit.edu](https://scratch.mit.edu/) · [Scratch Foundation](https://www.scratchfoundation.org/) · [educator page](https://www.scratchfoundation.org/learn/for-educators) |
| **HTML** | Marks what is on a page: heading, paragraph, image, link, table. Structure, not logic. | Every web page. Email templates. App store descriptions. | A 10-line page with a heading, a list, and one link, next to what the browser shows for it. | Proposed by Tim Berners-Lee at CERN in March 1989, with the proposal reformulated with Robert Cailliau in late 1990; HTML first described publicly in 1991 [S11]. Not Turing-complete. Not a programming language. Lowest barrier of the text languages. | 58.2 % for HTML/CSS combined (#3) [S1] | [MDN HTML](https://developer.mozilla.org/en-US/docs/Web/HTML) |
| **CSS** | Says how a page looks: colour, font, spacing, position, animation. | Web design. Layouts that change size on a phone. Themes. | The same 10-line page twice: once plain, once with 8 rules applied. Two recorded outputs side by side. | First proposed by Håkon Wium Lie in 1994 at CERN; CSS 1 became a W3C Recommendation on 17 December 1996 [S12]. Pairs with HTML. Not a programming language. Deceptively hard: the rules are few, the interactions are not. | 58.2 % combined with HTML (#3) [S1] | [MDN CSS](https://developer.mozilla.org/en-US/docs/Web/CSS) |
| **JavaScript** | Runs inside the browser. Reacts to clicks, changes the page, asks a server for data. | Interactive web pages and web apps. Also servers through Node.js. | A button that counts clicks. Show the code and the text the page prints. Note in the plan that no live run happens here. | Written by Brendan Eich at Netscape in 1995. Eich has described the first prototype as about ten days of work [S15]. Named Mocha, then LiveScript, then JavaScript in early December 1995, when Netscape and Sun signed a licensing agreement; it was meant as a companion scripting language for Java, and it is a separate language [S15]. Most used language in the survey for the twelfth year running [S1]. | 62.0 % (#1) [S1] | [MDN JavaScript guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide) · [javascript.info](https://javascript.info/) |
| **TypeScript** | JavaScript plus types. A type labels what kind of value a name holds, so a mistake shows before you run anything. | Large web apps, and any team that wants errors caught while typing. | The same small snippet as plain JavaScript with one silent bug, then as TypeScript with the exact compiler message recorded. | Unveiled by Microsoft on 1 October 2012, led by Anders Hejlsberg, who also worked on Turbo Pascal, Delphi, and C# [S16]. TypeScript code is turned into JavaScript by a free tool that runs on Windows, macOS, and Linux. Study JavaScript first, or the "why" is invisible. | 43.8 % (#6) [S1] | [TypeScript handbook](https://www.typescriptlang.org/docs/handbook/intro.html) |
| **Python** | A general language that reads close to English. Fewest symbols per idea of the mainstream languages here. | Data analysis, machine learning, scripting, web backends, teaching. | Six lines: a list of grades, the average, and a text bar chart. Include the printed output. | First public release in February 1991 by Guido van Rossum. Named after the television show, not the snake [S2]. The most desired language in the 2026 survey: 33.4 % of respondents who did not use it want to learn it [S1]. Chosen by most school boards that name a first language. Easiest text language to read; the vocabulary is large later. | 58.0 % (#4), most desired (33.4 %) [S1] | [python.org tutorial](https://docs.python.org/3/tutorial/) · [Automate the Boring Stuff](https://automatetheboringstuff.com/) |
| **SQL** | Asks a database for rows that match a rule. You say what you want, not how to fetch it. | Anything with stored records: accounts, catalogues, results, analytics. | Eight fictional students in a table. One query with `WHERE` and `ORDER BY`, and the rows it returns as text. No install for a first taste. | Designed at IBM in the early 1970s by Donald Chamberlin and Raymond Boyce, building on E. F. Codd's 1970 relational model; first published as "SEQUEL" in 1976, and renamed SQL because SEQUEL was already a trademark of another company [S3]. Many dialects: PostgreSQL, MySQL, SQLite, and BigQuery do not behave identically. Second most used language in 2026, and the first year it passed HTML/CSS [S1]. | 58.4 % (#2), second most desired (32.0 %) [S1] | [SQLBolt](https://sqlbolt.com/) · [PostgreSQL tutorial](https://www.postgresql.org/docs/current/tutorial.html) |
| **Java** | Compiled to bytecode, then run by a virtual machine, so one build runs on many machines. Objects everywhere. | Enterprise backends, Android (historically), large teaching courses, Minecraft (original). | A class `Animal` with two subclasses that each answer `speak()` differently, plus the printed output. | First released as Java 1.0 on 23 January 1996 by Sun Microsystems, where James Gosling led the work; Oracle owns Sun's assets from 2010 [S4]. AP Computer Science A uses Java, gives students a Java Quick Reference sheet, and is now a fully digital exam taken in the Bluebook app [S10]. More ceremony than Python: expect type declarations before results. | 27.6 % (#7) [S1] | [Oracle Java tutorial](https://docs.oracle.com/javase/tutorial/) · [AP Computer Science A](https://apcentral.collegeboard.org/courses/ap-computer-science-a) |

### Extended (14)

| Language | What it does | Used for | Demo sketch (see rule above) | History, difficulty, fit | Survey 2026 | Links |
|---|---|---|---|---|---|---|
| **Bash** | The language of the terminal. Moves files, repeats commands, joins small tools into a pipeline. | Server administration, build scripts, automation on Linux and macOS. | A 6-line script that renames a folder of photos by date, with the terminal transcript before and after. | Written by Brian Fox for the GNU Project, first public release 1989; the name is a pun on Stephen Bourne, whose shell it replaced in Version 7 Unix (1978 or 1979; sources disagree on the year) [S5]. Chet Ramey has maintained it since 1992 [S5]. Bash is a program you install or already have, not a language you download. | 51.3 % (#5) as Bash / shell; PowerShell is separate at 24.6 % [S1] | [GNU Bash manual](https://www.gnu.org/software/bash/manual/) |
| **C** | Talks close to the machine. Few built-in features; you manage memory yourself. | Operating system kernels, embedded chips, compilers. | A 15-line program that reverses a string, plus the compile step and the run step written out as a transcript. | Written by Dennis Ritchie at Bell Labs, first implemented in 1972-73 to develop Unix [S6]. Syntax ancestor of C++, C#, Java, and JavaScript. Small language, unforgiving errors. Learn it once to understand the others, not first. | 21.8 % (#11) [S1] | [Learn-C.org](https://www.learn-c.org/) · [CS50](https://cs50.harvard.edu/x/) |
| **C++** | C with classes, templates, and a very large standard library. Still your job to manage memory. | Game engines, browser internals, finance systems, robotics. | A short class that holds a game piece position and moves it, with the printed result. | Bjarne Stroustrup began work at Bell Labs in 1979 on a version of C he called "C with Classes". It was renamed C++ in late 1983 and first released commercially in 1985 [S7]. Steeper than Python or Java, and the widest language here. Shown best as "how the software you use gets built". | 24.3 % (#10) [S1] | [LearnCPP](https://www.learncpp.com/) |
| **C#** | Microsoft's language for the .NET platform. Objects, managed memory, strong tools. | Windows apps, Unity games, web backends (ASP.NET). | A console program that reads a name and prints a greeting, plus the output. Do not demo Unity: it needs the editor. | Announced by Microsoft on 26 June 2000; the first widely distributed implementation shipped in July 2000, and .NET Framework 1.0 followed in February 2002. Principal inventors: Anders Hejlsberg, Scott Wiltamuth, and Peter Golde [S8]. The name uses a sharp symbol, not a hash. Free tools now run on macOS and Linux as well as Windows. | 27.1 % (#8) [S1] | [Microsoft C# guide](https://learn.microsoft.com/en-us/dotnet/csharp/) |
| **Go** | Deliberately simple: no classes, no inheritance. Runs many small tasks at once with goroutines, its unit of concurrent work. | Cloud services, command line tools, network servers. | A 20-line web server that answers with a name from the URL, with the terminal transcript and the browser text. | Designed at Google from late 2007 by Robert Griesemer, Rob Pike, and Ken Thompson; announced publicly in November 2009; version 1, the first supported stable release, on 28 March 2012 [S9]. Easy to read, and the language rewards simple code. | 16.5 % (#14) [S1] | [A Tour of Go](https://go.dev/tour/) · [Go by Example](https://gobyexample.com/) |
| **Julia** | Numeric and scientific computing, written like a script, running close to C speed. | Computational science, modelling, finance research. | Solve three equations at once and print the answer. | Created by Jeff Bezanson, Stefan Karpinski, Viral Shah, and Alan Edelman, with the first release in 2012 [S17]. Positioned as a faster open alternative to MATLAB. Niche at school age; relevant to a student heading into engineering or physics. | 1.5 % [S1] | [julialang.org](https://julialang.org/) · [Julia manual](https://docs.julialang.org/en/v1/) |
| **Kotlin** | Runs on the Java virtual machine and reads shorter than Java, with absence of value handled by the type system. | The main language for Android apps since 2017-2019. Also servers. | One line of Kotlin data class next to the twelve lines of Java it replaces, with the same printed output. | Created at JetBrains, announced in 2011. Google made it a first-class Android language at I/O in 2017 and said Android development would become "increasingly Kotlin-first" at I/O in 2019 [S18]. Read it as Java's modern relative, not a rival. | 10.8 % [S1] | [kotlinlang.org docs](https://kotlinlang.org/docs/home.html) · [Android basics course](https://developer.android.com/courses/android-basics-compose/course) |
| **MATLAB** | Matrix mathematics as the default way to write code. Built-in plots and solvers. | Engineering coursework, control systems, signal processing. | Plot a damped sine wave, and show the figure the code produces. | Cleve Moler wrote the first version in the late 1970s; MathWorks, founded by Jack Little, Cleve Moler, and Steve Bangert in 1984, commercialised it [S19]. Costs money unless a school licence covers it, which is the honest note for a student. Many engineering majors meet it in a first or second course. | 3.6 % [S1] | [MATLAB Onramp (free)](https://matlabacademy.mathworks.com/) |
| **PHP** | Runs on the web server and builds the page before the browser sees it. Handles forms, logins, and database calls. | WordPress, and a large share of the served web. | A short script that reads a form field and prints a greeting, next to the HTML the server actually sends. | Rasmus Lerdorf wrote the first version in 1994 as a set of tools to track visitors to his own page, announced as Personal Home Page Tools on 8 June 1995. Zeev Suraski and Andi Gutmans rewrote it in 1997 as PHP 3, which made the name a recursive acronym for "PHP: Hypertext Preprocessor" [S20]. Used by roughly seven in ten websites whose server-side language is known (69.2 %, October 2026) [S21]. A server language with a free local copy for practice. | 17.7 % (#13) [S1] | [php.net manual](https://www.php.net/manual/en/) · [Laravel docs](https://laravel.com/framework/docs) |
| **PowerShell** | The terminal language for Windows, now also on macOS and Linux. Works on objects, not on lines of text. | Windows administration, Azure, automation of anything with a .NET interface. | Five commands that list running processes, sort them, and keep the top three, with the recorded table. | Began as Jeffrey Snover's "Monad" design manifesto in 2002, was renamed Windows PowerShell in April 2006, and shipped as version 1.0 on 14 November 2006. Open-sourced with Linux support on 18 August 2016 [S22]. Missing from the first edition of this table, which is why it is called out here. | 24.6 % (#9) [S1] | [PowerShell docs](https://learn.microsoft.com/en-us/powershell/) |
| **R** | Built by statisticians for data. Strong plots, huge package collection. | Research papers, public health dashboards, data journalism. | Three lines that read a small table of weather rows and draw one scatter chart. Show the chart as a file, not as a live run. | Robert Gentleman and Ross Ihaka placed the first binaries on the Statlib server with an announcement in August 1993 at the University of Auckland; version 1.0.0 arrived in 1995 [S23]. Reads oddly at first. Relevant to a student in AP or IB statistics, and to anyone heading to a data degree. | 4.5 % [S1] | [R for Data Science (free book)](https://r4ds.had.co.nz/) · [Posit docs](https://docs.posit.co/) |
| **Ruby** | Optimised for how a programmer reads and enjoys code. The Rails framework made small teams fast. | Web apps, prototyping, automation. | A three-line Rails-style query that reads as a sentence, plus the rows it returns. | Created by Yukihiro "Matz" Matsumoto, first released in 1995 in Japan [S24]. Ruby on Rails, by David Heinemeier Hansson in 2004, drove its popularity. Smaller job market than JavaScript or Python. Good for learning how a web framework is arranged. | 5.8 % [S1] | [Try Ruby](https://try.ruby-lang.org/) · [Rails guides](https://guides.rubyonrails.org/) |
| **Rust** | Systems speed with the compiler refusing code that leaves memory unsafe. The refusals are the lesson. | OS components including Linux kernel modules, browser parts, WebAssembly, command line tools. | The same small program in C with a buffer problem pointed out in a comment, then in Rust with the recorded compiler refusal. | Created by Graydon Hoare while at Mozilla; version 1.0 announced 15 May 2015 [S25]. Of the twenty most used languages in 2026 it has the highest share of people who used it and want to keep using it (67.4 %). Two small languages with far fewer users score higher, so "most admired overall" is not a fair sentence to write [S1]. Steepest learning curve in this table. | 18.0 % (#12) [S1] | [The Rust Book](https://doc.rust-lang.org/book/) · [rust-lang.org/learn](https://www.rust-lang.org/learn) |
| **Swift** | Apple's language for apps on iPhone, iPad, Mac, Watch, and TV. Playgrounds show results as you type. | iOS and macOS apps. Some servers. Replaced Objective-C as the default. | A view with a label and a button that increments a counter, next to a still of the preview canvas. | Created at Apple, led by Chris Lattner, announced at WWDC in June 2014 and opened as free software in December 2015 [S26]. Needs an Apple machine to build a real app, which is the practical barrier for a school. | 5.9 % [S1] | [The Swift Book (free)](https://docs.swift.org/swift-book/) |

---

## Facts that were wrong in the first edition

Verified 2026-10-26 against the sources below. Each row is a claim the first edition made and
web access then corrected, replaced, or dropped.

| Language | First edition said | Correct | Source |
|---|---|---|---|
| Bash | row cut off mid-sentence at "Originates from" | written from scratch: GNU Project, Brian Fox, 1989, maintained by Chet Ramey since 1992 | [S5] |
| MATLAB / Julia | one row, "MATLAB: Cleve Moler, 1970s; commercial via MathWorks. Julia: Jeff Bezanson et al., MIT, 2012" | two languages, two rows, each with its own authors and dates | [S17] [S19] |
| Java | "Created by James Gosling at Sun Microsystems, 1995" and "AP Computer Science A has used Java as its exam language since 2003" | Java 1.0 released 23 January 1996; the 2003 date is unverified, so drop the year and cite the course page instead. The exam is fully digital in Bluebook and supplies a Java Quick Reference | [S4] [S10] |
| PHP | "Created by Rasmus Lerdorf, 1994" and "WordPress (≈ 43 % of the web)" | the 1995 announcement is the citable event; WordPress runs on 39.6 % of all websites and 58.3 % of sites with a known CMS as of October 2026, and it is declining | [S20] [S21] |
| Rust | "Voted most admired language on Stack Overflow for 8+ years running" | the survey reports an admired share, not a vote, and in 2026 Elm (94.1 %) and Odin (82.4 %) score higher on small user bases. Rust is highest among the twenty most used, at 67.4 % | [S1] |
| C# | "Designed by Anders Hejlsberg, released 2000. Microsoft's answer to Java" | three principal inventors, announced 26 June 2000, .NET Framework 1.0 in February 2002. The Java-rival framing is opinion and is out | [S8] |
| Kotlin | "Google's preferred language for Android development" and a link to `developer.android.com/courses/pathways/kotlin`, which is a 404 | JetBrains made it in 2011; Google gave it first-class Android support in 2017 and the Kotlin-first statement in 2019. Link the Android Basics with Compose course instead | [S18] |
| C++ | "Also by Bjarne Stroustrup, Bell Labs, 1979-85" | began 1979 as "C with Classes", renamed in late 1983, first released 1985. The stray "Also" was copy-paste residue from the C row | [S7] |
| Scratch | "Embed the actual Scratch editor (it runs in-browser via iframe)" | documented embeds are for single projects as a player, not for the editor. Link out and show a still | [S14] |
| Python | "The default first language in most AP CS / IB CS courses today" | AP Computer Science A is Java. AP Computer Science Principles is not tied to one language, and IB does not fix one either. Say that many introductory courses choose Python | [S10] |
| Ruby | "Created by Yukihiro 'Matz' Matsumoto, Japan, 1995" with GitHub and Shopify as evidence | kept, and Rails dated 2004 by David Heinemeier Hansson. The claim that specific companies run on it was dropped rather than sourced | [S24] |
| R | "Created by Ross Ihaka and Robert Gentleman, University of Auckland, 1993" | kept; the August 1993 Statlib announcement is the date, with version 1.0.0 in 1995 | [S23] |
| PowerShell | absent, though it was then the ninth most used language | added to Extended: 24.6 % use in 2026 [S1] | [S22] |

The first edition's category labels, plain-language descriptions, and demo ideas survived review.
Its links did not: of 38 unique URLs, 3 returned 404 (`developer.android.com/courses/pathways/kotlin`,
`en.scratch-wiki.info/wiki/Scratch_Educator_Guide`, `posit.co/docs/`), 1 blocked bots with 403
(`realpython.com`, dropped), and 4 landed somewhere other than the named page (`mode.com/sql-tutorial`
now redirects to thoughtspot.com, `laravel.com/docs` moves to `/framework/docs`,
`en.cppreference.com/w/` to the site root, and the Swift Playgrounds App Store link geo-redirects,
so it cannot be validated automatically and was dropped in favour of The Swift Book) [S27].

---

## Sources

Cited as `[Sn]`. Every URL was retrieved 2026-10-26. When the build writes these into
`js/data/sources.js`, keep this id, the label, the url, and the `as_of` date together.

- **[S1]** Stack Overflow Developer Survey 2026, Technology chapter and data tables. Fielded 2026, published 2026-10-06; 30,903 respondents, 169 countries; languages question base n = 14,099. https://survey.stackoverflow.co/2026/technology and https://survey.stackoverflow.co/2026/technology/data
- **[S2]** Python FAQ, "Why is it called Python?", which states the Monty Python's Flying Circus origin. https://docs.python.org/3/faq/general.html
- **[S3]** Donald D. Chamberlin and Raymond F. Boyce, "SEQUEL", Proceedings of the 1976 ACM SIGFIDET Workshop on Data Description, Access and Control, article 22 (1976); and the SQL overview on Wikipedia, which dates the language's development at IBM to the early 1970s and records ANSI standardisation in 1986. https://doi.org/10.1145/800296.811515 and https://en.wikipedia.org/wiki/SQL
- **[S4]** Java version history (JDK 1.0 released 23 January 1996, announced 1995) and the Oracle Java language archive. https://en.wikipedia.org/wiki/Java_version_history and https://en.wikipedia.org/wiki/Java_(programming_language)
- **[S5]** GNU Bash manual preface (Brian Fox, 1989) and Chet Ramey, "Introduction to the History of Shell Programming", 1994. https://www.gnu.org/software/bash/ and https://tiswww.case.edu/php/chet/bash/rose94.pdf
- **[S6]** Dennis M. Ritchie, "The Development of the C Language", 1992. https://www.nokia.com/bell-labs/about/dennis-m-ritchie/chist.html (the older bell-labs.com path now redirects here)
- **[S7]** Bjarne Stroustrup, "A History of C++: 1979-1991" and his C++ FAQ. https://www.stroustrup.com/hopl2.pdf and https://www.stroustrup.com/bs_faq.html
- **[S8]** Microsoft press release of 26 June 2000 announcing C#, and ECMA-334 introduction. https://news.microsoft.com/source/2000-06-26/microsoft-introduces-highly-productive-net-programming-language-c/ and https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/introduction
- **[S9]** Go project: FAQ, the SPLASH 2012 article, and the Go 1 announcement of 28 March 2012. https://go.dev/doc/faq and https://go.dev/blog/go1
- **[S10]** College Board AP Computer Science A course page, exam format, and Java Quick Reference. https://apcentral.collegeboard.org/courses/ap-computer-science-a
- **[S11]** W3C history pages: the 1989 WWW proposal and "Some early ideas for HTML". https://www.w3.org/History/1989/proposal.html and https://www.w3.org/MarkUp/historical
- **[S12]** W3C CSS history and the CSS1 Recommendation press release of 17 December 1996. https://www.w3.org/Style/CSS/history.html and https://www.w3.org/press-releases/1996/css1-rec/
- **[S13]** Scratch credits (MIT Media Lab 2002, launch 2007, versions), MIT News of 14 May 2007 and 14 May 2013, Scratch Foundation about page for the 2019 transfer. https://scratch.mit.edu/credits/ and https://www.scratchfoundation.org/
- **[S14]** Scratch project player embed, the one documented embed form, tested on a live project. https://scratch.mit.edu/projects/101283090/embed. The Scratch wiki page on embedding was unreachable from this network on 2026-10-26 and is not cited.
- **[S15]** Brendan Eich interview, "JavaScript creator ponders past, future", InfoWorld; and Eich et al., "JavaScript: The First 20 Years", ACM HOPL 2019. https://www.infoworld.com/article/2174329/javascript-creator-ponders-past-future.html and https://wirfs-brock.com/allen/jshopl.pdf
- **[S16]** Microsoft "Ten Years of TypeScript", which dates the first preview to 1 October 2012. https://devblogs.microsoft.com/typescript/ten-years-of-typescript/
- **[S17]** Julia Language: the original paper and project history. https://julialang.org/
- **[S18]** Android Developers "Android's Kotlin-first approach", JetBrains "Kotlin on Android. Now official" (May 2017), Android Developers Blog "Android's commitment to Kotlin" (December 2019). https://developer.android.com/kotlin/first and https://android-developers.googleblog.com/2019/12/androids-commitment-to-kotlin.html
- **[S19]** MathWorks, "Company History", 1984 founding and Cleve Moler. https://www.mathworks.com/company/history/40-years/5.html. This host returns 403 to automated clients and was read in a browser; Wikipedia's MathWorks page carries the same dates. https://en.wikipedia.org/wiki/MathWorks
- **[S20]** PHP manual, "History of PHP". https://www.php.net/manual/en/history.php.php
- **[S21]** W3Techs technology reports for WordPress and for server-side programming languages, October 2026. https://w3techs.com/technologies/details/cm-wordpress and https://w3techs.com/technologies/details/pl-php
- **[S22]** PowerShell Team blog: "Monad Manifesto: the Origin of Windows PowerShell", "It's a Wrap! Windows PowerShell 1.0 Released!" (14 November 2006), "PowerShell on Linux and Open Source!" (18 August 2016), and Microsoft Learn Monad Manifesto page. https://devblogs.microsoft.com/powershell/monad-manifesto-the-origin-of-windows-powershell/ and https://devblogs.microsoft.com/powershell/powershell-on-linux-and-open-source-2/
- **[S23]** Ihaka and Gentleman, "R: Past and Future History"; R 1.0.0 release notice; Ihaka and Gentleman, "R: A Language for Data Analysis and Graphics", 1996. https://cran.r-project.org/doc/html/interface98-paper/paper_2.html and https://developer.r-project.org/R-release-1.0.0.txt
- **[S24]** Ruby official history page and Matsumoto interviews. https://www.ruby-lang.org/en/about/
- **[S25]** Rust team, "Announcing Rust 1.0", 15 May 2015. https://blog.rust-lang.org/2015-05-15/Rust-1.0/
- **[S26]** Swift documentation and Apple's 2015 open-source announcement. https://docs.swift.org/swift-book/
- **[S27]** Link audit of the first edition of this file, 38 unique URLs, run 2026-10-26 with a browser user agent following redirects. Recorded in plan §14.

### Hosts that reject automated checks

Six hosts in the list above answer a scripted request with 403 or a sign-in redirect while serving
a browser normally. They are valid references and are exempt in `links.test.mjs`, each with a
comment naming the reason: `www.w3.org` (all paths), `www.mathworks.com`, `www.ibm.com/docs`,
`dl.acm.org`, `realpython.com`, and `developer.android.com` (302 to a Google sign-in for a
cookie-less client). Every other URL in this file returned 200 on 2026-10-26.

---

## Changes

Second edition, 2026-10-26.

1. Row 20 (Bash) existed only as a fragment. Written in full, from the GNU project's own history.
2. Row 17 held two languages. Split into MATLAB and Julia. 20 rows became 21, and then 22 with PowerShell added.
3. Added a Tier column and split the single table into Core (8) and Extended (14). The first edition's ordering claimed to be "how a beginner would encounter them" but ranked nothing and explained nothing.
4. Added the Survey column, dated and sourced. Deleted the untraceable superlatives: "the single most in-demand language for web work" and "most admired 8+ years running".
5. Corrected dates and names: Java 1.0 (1996), C# (three inventors, announced June 2000, .NET 1.0 February 2002), Kotlin (2011, JetBrains), PHP (1995 announcement), Scratch (2002 start, 2007 launch, 2019 Foundation), C++ (1979, renamed 1983, released 1985), Go (late 2007, Go 1 in 2012), R (1993 announcement, 1.0.0 in 1995), WordPress (39.6 % of all websites, October 2026).
6. Replaced the dead and drifting links, dropped `realpython.com` (bot-blocked) and the App Store deep link (geo-redirected, so not machine-checkable), and added a `Sources` section with retrieval dates. The first edition had no citations at all.
7. Removed every sentence addressed to the site owner instead of a reader, and dropped the claim that the cells "double as copy you can adapt". They do not. Plan §8 governs copy.
8. Rewrote the demo column to fit the L1 contract in plan §9.2: no auto-running cell, no ggplot live run, no embedded third-party editor, and no scratch-editor iframe, which Scratch does not support.
9. Fixed the two style facts that were wrong about the first edition itself: it has 4 em dashes, not "60+", and its 19 middots all sit inside the reference-link column, where they are legal data separators.
10. Kept: the eight column ideas, the plain-language descriptions, and the judgement that this is a useful catalogue to trim rather than to widen.
