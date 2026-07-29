# TextMop — Project Plan

_Last updated: July 28, 2026_

## 1. What TextMop Is

TextMop is a collection of free, browser-based utility tools that help people clean up
and reformat text and images. Every tool runs 100% client-side — nothing pasted or
uploaded ever touches a server. That privacy angle is the brand's core promise and
differentiator against competitors like EditPad, TextCleaner, and iLoveIMG.

**Revenue model:** display ads, "Buy Me a Coffee" donations, and eventually a paid
ad-free bundle subscription (~$7.99/mo or $60/yr).

**Target:** $500–$5,000/month within 12–24 months. Realistic goal for the first
3 months of active building: a genuinely solid, bug-free Clean Paste tool, 2-3
additional tools, and the basic trust/SEO infrastructure Google expects from a
real site.

---

## 2. What's Already Done (Infrastructure)

- ✅ Domain: textmop.com (Porkbun)
- ✅ Email: textmop@proton.me (Proton Mail)
- ✅ GitHub repo: github.com/textMop/textmop
- ✅ Hosting: Netlify, auto-deploys on every git push
- ✅ SSL: auto-provisioned via Netlify/Let's Encrypt
- ✅ Homepage (index.html) — live, tool cards grid, sweep animation
- 🔄 Clean Paste tool — being rebuilt step-by-step per CLEAN-PASTE-SPEC.md;
  Step 1 (box shell) complete and fully tested, Step 2 (rich paste display) next

None of this needs to be redone. We're only revisiting the *tool logic*, not
the foundation.

---

## 3. Time Budget

Target pace: **3–5 hours/week**, ~3 month runway = **40–60 hours total**.

Rough allocation:

| Area | Hours |
|---|---|
| Playwright setup (one-time) | 1–2 |
| Clean Paste — rebuild + polish + tests | 10–15 |
| Tool #2 (TBD, likely Remove Extra Spaces or Case Converter) + tests | 5–7 |
| Tool #3 + tests | 5–7 |
| Mobile responsiveness pass (all pages) | 3–5 |
| SEO & trust essentials (see §6) | 5–8 |
| Buy Me a Coffee + AdSense setup | 1–2 |
| Testing & bug fixing buffer | 5–8 |
| Blog — first 2-3 posts | 6–10 |

This is a guide, not a contract — we'll adjust as we go.

---

## 4. Working Process Going Forward

To avoid the "bug fixing in circles" problem, every tool follows this sequence:

1. **Spec first.** Before writing code, write a short spec doc answering:
   what does this tool do, what's explicitly out of scope for v1, what does
   "done" look like.
2. **Simple architecture first.** Prefer direct, boring solutions over clever
   ones. (e.g. apply an operation directly to the DOM once, rather than
   snapshotting + diffing + re-matching by text content — that pattern caused
   most of Clean Paste's bugs.)
3. **Build the core loop, test it manually, THEN add polish** (like the flash
   highlight animation). Polish that isn't core to the tool working should
   never block shipping the tool itself.
4. **One markdown spec file per tool**, so a fresh Claude chat can pick up
   exactly where we left off without losing context. Store these in the repo
   under a `/docs` folder so they're versioned with the code.
5. **At the start of any new step's chat**, paste in the current
   TEXTMOP-PROJECT-PLAN.md, the relevant tool spec, and the current state of
   whatever files are being worked on. This keeps a fresh Claude chat working
   from what's actually in the repo rather than assuming prior chat output
   was saved correctly.

---

## 5. Tool Roadmap

### Phase 1 — Text tools (current focus)
- 🔄 Clean Paste — strip/selectively remove formatting from pasted content
- ⬜ Remove Extra Spaces — standalone, simpler version of whitespace cleanup
- ⬜ Case Converter — upper/lower/title/sentence case
- ⬜ Word & Character Counter

### Phase 2 — More text tools
- ⬜ Remove duplicate lines
- ⬜ Sort lines alphabetically
- ⬜ Find & replace
- ⬜ Strip HTML tags (standalone tool, separate from Clean Paste's checkbox)
- ⬜ Remove invisible/AI watermark characters
- ⬜ Markdown stripper

### Phase 3 — Image tools
- ⬜ Privacy-first image resizer
- ⬜ Image cropper
- ⬜ Image format converter
- ⬜ Image compressor

### Phase 4 — Monetization layer
- ⬜ Premium ad-free plan
- ⬜ Embeddable widgets

### Phase 5 — Growth
- ⬜ AI output cleaner (ChatGPT/Claude paste cleanup)
- ⬜ Blog for SEO

**Decision:** we are NOT starting Tool #2 until Clean Paste is fully spec-tested
and bug-free. One tool done properly beats four tools half-working.

---

---

## 5a. Testing Strategy

To stop the "fix one bug, break another" loop we hit with Clean Paste v1,
every tool gets automated tests from Step 1 onward — not bolted on at the
end.

**Tooling: Playwright.**
Chosen because it drives a real browser (Chromium/Firefox/WebKit), which
matters for these tools since almost every bug we hit was about real DOM/
clipboard/paste behavior that unit tests alone wouldn't catch. Playwright
can simulate clipboard paste events, click checkboxes, and assert on
rendered HTML — exactly what we need.

**Setup (one-time, do this before Step 1 of Clean Paste rebuild):**

```bash
cd ~/Desktop/textMop
npm init -y
npm install -D @playwright/test
npx playwright install
```

This creates a `tests/` folder and a `playwright.config.js`. Commit both to
the repo. Node/npm is only used for the test tooling — the actual site
remains plain HTML/CSS/JS with no build step, so this doesn't change
deployment at all.

**Workflow — applies to every future step of every tool:**

1. Build the feature (per the tool's spec doc).
2. Manually test it in the browser to confirm it works.
3. Write a Playwright test that automates that same manual check.
4. Run the **full test suite** (not just the new test) — confirms the new
   feature didn't break anything built previously.
5. Only commit/push once the full suite passes.

```bash
npx playwright test          # run all tests headless
npx playwright test --ui     # run with visual UI (great for debugging)
```

**What gets a test:**
- Every checkbox operation (e.g. "checking Bold removes bold, unchecking
  restores it")
- Every detection rule (e.g. "pasting bold text enables the Bold checkbox
  with the correct count")
- Every button (Copy, Clear, Reset)
- At least one full end-to-end test using the standard test paste covering
  multiple operations together

**What doesn't need a test:**
- Pure visual/CSS polish (spacing, colors) — verify manually
- The Step 16 flash highlight animation (optional post-v1 polish) — light
  manual smoke-test is enough

**Cross-browser paste simulation note (learned in Step 1):** don't rely on
real OS clipboard permissions in tests (`context.grantPermissions(['clipboard-
read', 'clipboard-write'])`) — Firefox and WebKit don't support those
permission names reliably. Instead, dispatch a synthetic `ClipboardEvent`
with a `DataTransfer` payload, and force `clipboardData` onto the event with
`Object.defineProperty()` rather than passing it through the constructor's
options object — Firefox doesn't reliably honor `clipboardData` passed that
way, even though Chromium and WebKit do. This pattern should be reused for
all future paste-related tests (Step 2 onward).

Test files live in `tests/`, one file per tool, e.g. `tests/clean-paste.spec.js`.
This grows into a full regression suite automatically as more tools are built.

---

## 6. SEO & Trust Essentials (not yet started)

Google (and users) trust sites more when these basics exist. None of these
are built yet — planned for after Clean Paste is solid:

- ⬜ Favicon (browser tab icon)
- ⬜ About page — who's behind TextMop, why it exists
- ⬜ Contact page or contact email visible in footer
- ⬜ Privacy Policy page (important — we make privacy claims, should back it up formally)
- ⬜ 404 error page
- ⬜ `sitemap.xml`
- ⬜ `robots.txt`
- ⬜ Meta descriptions on every page (mostly done, verify per page)
- ⬜ Open Graph tags (so links look good when shared on social media)
- ⬜ Google Search Console submission
- ⬜ Google Analytics or privacy-friendly alternative (Plausible/Fathom) —
  worth discussing given the privacy-first brand; Google Analytics is a bit
  ironic for a privacy-focused site

---

## 7. Mobile Responsiveness

Not yet audited. 50-60% of web traffic is mobile — this needs a dedicated
pass before launch is "real." Plan: once Clean Paste is functionally solid,
spend a session just testing and fixing every page at phone width (375px)
and tablet width (768px).

---

## 8. Blog Plan (SEO growth engine)

You mentioned not loving writing — that's fine, this is a good use case for
AI-assisted drafting. Plan:

- Blog lives at textmop.com/blog
- Each post targets one specific long-tail search term
  (e.g. "how to remove formatting when pasting into WordPress")
- I draft, you review/edit for voice and accuracy, we publish
- Start with 2-3 posts tied directly to Clean Paste, expand as new tools launch
- Not started yet — after Phase 1 tools are solid

---

## 9. Open Questions / Decisions Needed

- [ ] Analytics: Google Analytics vs a privacy-friendly alternative?
- [x] Should Clean Paste v1 ship without the flash highlight animation, and
      add it back later as pure polish once the core logic is bulletproof?
      — confirmed yes, deferred to Step 16.
- [x] Confirm: are we OK with Clean Paste "resetting" cleanly rather than
      supporting undo/redo history? — confirmed, simpler, sufficient for v1.

---

## 10. Session Log

| Date | What we worked on | Outcome |
|---|---|---|
| Session 1 | Domain, email, GitHub, Netlify setup, homepage, Clean Paste v1 | Site live at textmop.com |
| Session 2 | Clean Paste refinements — rich preview, granular checkboxes, flash highlight | Multiple bugs found, decided to respec |
| Session 3 | Wrote project plan + Clean Paste spec, decided to rebuild Clean Paste step-by-step, added Playwright testing strategy | Two spec docs created; flash highlight deferred to post-v1; added grayed-out disabled options requirement; broke build into 16 incremental steps, each with its own Playwright test run against the full suite before committing |
| Session 4 | Playwright setup (Step 0): installed @playwright/test, downloaded browsers, generated playwright.config.js + tests/ folder, confirmed sample suite passes (6/6). Also fixed an exposed GitHub token (removed from git remote/package.json, revoked, set up secure per-repo token auth via macOS Keychain), added node_modules/test-results to .gitignore | Step 0 complete — ready to begin Clean Paste rebuild Step 1 |
| Session 5 | Clean Paste Step 1 (box shell): built the empty paste-only content box using the existing design-system classes (`.tool-wrap`, `.tool-app`, `.text-box`, etc.) instead of one-off styles; added `clean-paste.html` header/footer to match site nav; fixed two pre-existing `styles.css` bugs found while wiring things up (a duplicate `.wrap` class that was breaking site-wide header/footer layout, and an orphaned selector-less CSS rule left over from v1); added an explicit `paste` event handler in `clean-paste.js` (previously relied on untestable native browser default paste behavior); wrote and passed 4 Playwright tests across Chromium/Firefox/WebKit — hit and resolved two cross-browser test issues (clipboard permission API differences, and Firefox not honoring `clipboardData` passed through the `ClipboardEvent` constructor) | Step 1 complete, 12/12 tests passing, committed and pushed — ready for Step 2 (rich paste display) |

_(Add a row each session so future chats have full context fast.)_
