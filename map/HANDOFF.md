# Network map handoff

Newest entry first. Spec: `specs/product/NETWORK_MAP_LATEST.md`.

## 2026-11-14: label changes

Asked by Paul: Home server and Minecraft server subtitles read "Linux";
Macbook Pro's service is "Voice assistant"; the AI machines' service reads
"Local AI model server", and Home desktop has the same service added.
Test bench's service is "Hardware Testing" and Minecraft server's is
"School Minecraft world".

## 2026-11-14: real services for Home server and Mini PC

**Asked:** look at what runs on the home server (over ssh) and add it to its
zoom. Mini PC runs Audiobooth and Jellyfin.

**Built:** Home server now lists 13 services, read from `docker ps` and
`systemctl` (read only, nothing on the server was changed). Mini PC lists
Jellyfin, Audiobookshelf and Exit node. A machine with more than four services
shows three chips and a "+N more" chip on the map; the panel lists all.

**Decided, and why:**

- Each service has a one-line plain description of what the software is.
  Notes are still `[Paul]`.
- Left out helper containers (databases, Redis, Tika, Gotenberg, the Immich
  machine learning worker) and system daemons.
- Left out the `mihomo` proxy service on purpose. Paul to decide.
- Vaultwarden was removed from the page (Paul, 2026-11-14).
- The Mini PC service is Audiobookshelf. Audiobooth is the client app Paul
  and his wife use to reach it, so it is not listed as a service.

## 2026-11-13: first round of changes

**Asked:** treat minecraft-server as on the tailnet, drop the tailnet tag from
panels, rename four machines, lowercase the top bar, remove the hint line,
and zoom out when clicking beside the About, History or Contact card.

**Built:** all of the above. The `tailnet` field and the dotted "not
connected" line are gone, since every machine is on the tailnet. A machine
can now have an optional `tag`, shown in italics after its name (Spark has
"On loan"). Machine ids in the address (`#laptop`, `#itx-box`,
`#ai-workstation`) were left as they were.

## 2026-11-13: first build

**Asked:** an interactive network map at `/map/` showing how Tailscale joins
Paul's computers, what runs on each, with zoom in and out, and tabs for
About, History, Contact and contrapaul.com.

**Built:**

- `/map/` page: nine computers plus the tailnet hub, grouped by role, each a
  code-drawn SVG picture. A pulse travels along each network line. Machines
  lift and glow on hover, on keyboard focus and while open.
- Zoom: pick a machine to fly in and open its panel (purpose, specs,
  services, notes, photos). Pick a service to fly in further. Escape, the
  Zoom out link or a click on the background goes back one level.
- Tabs: About, History and Contact open as views in the page, and the map
  pulls back behind them. contrapaul.com is a plain link.
- Contact form posts to the new `POST /api/contact` (Resend, honeypot, five
  messages an hour per address).
- Separate layouts for tall and wide screens. Light and dark themes.

**Decided, and why:**

- Nicknames only, no hostnames, addresses or ports, because the page is
  public (Paul's choice). A test fails if an address or port gets into
  `js/data.js`.
- The nicknames and the role each machine is filed under are my guesses.
  Change them in `js/data.js`.
- System fonts and no libraries, so nothing is fetched from another host.
- The hub picture is a generic mesh, not the Tailscale logo.
- `sendEmail` in `functions/api/_lib/email.ts` now takes an optional sender
  and reply-to and returns whether Resend accepted the message. The two
  Blood Bowl callers are unchanged.

**For Paul to fill in:**

- `js/data.js`: purpose, specs, services, notes and photos per machine.
  Every `[Paul]` is a gap.
- `index.html`: the About, History and Contact text.
- Cloudflare Pages: set `CONTACT_TO` (the inbox). Optional `CONTACT_FROM`.

**Not verified:**

- A real email send. Locally the endpoint answers 400 for a bad address, 200
  for the honeypot and 503 because `CONTACT_TO` is not set.
- Safari, Firefox and a real phone. Checked only in the app's browser pane
  at desktop size and at 375 by 812.
- The photo zoom, because no machine has photos yet.
- Nothing is committed or deployed.
