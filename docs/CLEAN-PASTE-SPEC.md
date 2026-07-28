# Clean Paste — Tool Spec

_Status: Respec'd after v1 revealed architectural bugs. Rebuild pending._

## 1. One-sentence definition

Clean Paste lets a user paste formatted text (from Word, Google Docs, email,
or a webpage), see exactly what formatting is present, and selectively choose
what to remove — leaving everything else untouched.

## 2. Who it's for

Anyone pasting content into a system that doesn't want Word/Docs formatting
along for the ride: bloggers, marketers, developers, students, anyone using a
CMS, email tool, or plain-text field.

## 3. The core user flow (this is the whole product — must work perfectly)

1. User opens the page. Sees one empty box with placeholder text and instructions.
2. User pastes content (click box, Cmd/Ctrl+V).
3. Box immediately shows the pasted content **with its original formatting
   visible** — bold looks bold, colored text looks colored, etc.
4. Below the box, a list of checkboxes appears — but **only for formatting
   that is actually present** in what was pasted. E.g. if there's no
   underlined text, no "Remove underline" checkbox appears.
5. User checks any combination of boxes.
6. The box content updates to reflect exactly the checked removals — nothing
   else changes.
7. User clicks "Copy clean text" — the current state of the box is copied to
   their clipboard as plain text.

That's it. That's the whole tool. Everything else is secondary.

## 4. In scope for v1

- Paste detection and rich display (bold, italic, underline, strikethrough,
  text color, highlight/background color, links, font size, font family)
- Individually removable: bold, italic, underline, strikethrough, links
- Removable with sub-options: colors (text color vs highlight, separately),
  font sizes (per unique size found), font families (per unique family found)
- Whitespace cleanup: trim trailing spaces, collapse multiple spaces, remove
  extra blank lines — **must preserve paragraph/list structure**, must NOT
  collapse the whole document into one block
- Strip visible HTML tags (for when literal `<span>` etc. appears as text,
  not as real formatting)
- **Grayed-out / disabled options for formatting NOT present in the paste** —
  every possible option always shows in the list. If it doesn't apply to the
  current paste, it's visible but disabled/grayed out rather than hidden
  entirely. This lets users see the full range of what the tool can do even
  on a plain-text paste, and doubles as product discovery.
- Copy to clipboard as plain text
- Clear button
- Reset to original button
- Word count
- "Original" vs "Modified" status indicator

## 5. Explicitly OUT of scope for v1 (do not build yet)

- Flash/highlight animation showing what changed — nice polish, **but not
  required for the tool to be useful**. Add back only after core logic is
  proven solid and bug-free.
- Undo/redo history beyond a single "reset to original"
- Drag-and-drop file upload
- Saving/history of past pastes
- Mobile-specific interactions beyond basic responsive layout

## 6. Architecture decision (this is what caused v1's bugs — read carefully)

**v1's mistake:** we tried to detect "what changed" after the fact by
matching text content between the original and modified versions. This was
fragile — it matched too broadly (whole paragraphs flashing instead of one
word) and re-triggered on unrelated changes.

**v2 approach — do the operation directly, once, correctly:**

- Keep `originalHTML` as the untouched source of truth (already correct in v1).
- On every checkbox change, rebuild the output by applying operations **directly
  to a fresh clone of `originalHTML`** — this part of v1 was already correct
  and should stay.
- Whitespace operations must NOT convert the DOM to `innerText` and back —
  that's what destroyed structure. Instead, **walk the DOM tree and modify
  text nodes in place**, leaving `<p>`, `<ul>`, `<li>`, `<br>` etc. untouched.
  This is the single most important fix.
- Do not attempt "flash what changed" via text-matching. If/when we add the
  flash animation back, the correct approach is to mark elements **at the
  moment we operate on them** (which we partially did) but only ever mark the
  single most specific element (e.g. the exact `<span>` with the color style)
  — never a parent container.

## 7. Detection logic requirements

- Detection must scan the **DOM structure** of `originalHTML`, not rendered
  `innerText`, to avoid encoding/whitespace-representation bugs (this caused
  the "blank lines not detected" and "tags not stripped" bugs in v1).
- **Every option always renders in the list.** If a given type of formatting
  is not present in the current paste, its checkbox is disabled (grayed out,
  not clickable) rather than removed from the DOM. This keeps the full
  toolset visible at all times — see §4 grayed-out requirement.
- Counts shown next to each *active* option must be human-meaningful (e.g.
  "3 words", "2 links") — never a raw, unexplained number. Disabled options
  show no count, or show "—".

## 8. Definition of done for v1

Clean Paste ships when ALL of the following are true:

- [ ] Every operation (bold, italic, underline, strikethrough, colors,
      highlights, links, font sizes, font families, HTML strip, whitespace)
      can be independently checked and unchecked with correct, isolated results
- [ ] Whitespace cleanup never collapses paragraph/list structure
- [ ] No false-positive options appear for clean plain text
- [ ] Reset to original always fully restores the original paste
- [ ] Copy to clipboard always matches exactly what's shown in the box
- [ ] Works correctly on a real Google Docs paste with mixed formatting
      (this is the standard test case — see test data below)
- [ ] Works correctly on a real Word-originated paste (Word's HTML export is
      messier than Google Docs — worth testing separately)
- [ ] No known bugs remaining from the BUG-01 through BUG-08 ticket list
- [ ] Full Playwright test suite passes (`npx playwright test`) with a test
      covering every operation, every button, and the standard test paste
      end-to-end

## 9. Standard test paste (use this for every manual test going forward)

Create this in Google Docs, format as described, copy, and paste into the
tool during testing:

```
Heading: Where does it come from? (formatted as Heading 2)

Contrary to popular belief, Lorem Ipsum is not simply random text. It has
roots in a piece of classical Latin literature from 45 BC, making it over
2000 years old. Richard McClintock, a Latin professor at Hampden-Sydney
College in Virginia, looked up one of the more [obscure Latin words,
consectetur] (underlined), from a [Lorem Ipsum passage, and going through]
(bold) the cites of the word in classical literature, discovered the
undoubtable source. Lorem Ipsum comes from sections 1.10.32 and 1.10.33 of
"de [Finibus Bonorum] (highlighted yellow) et Malorum" (The Extremes [of
Good and Evil) by Cicero, written in 45 BC. This] (hyperlinked to any URL)
book is a treatise on the [theory of ethics, very popular] (italic) during
the Renaissance.
```

This single paste covers: heading/font-size, bold, underline, highlight,
hyperlink, italic — every formatting type in one test.

## 10. Incremental build plan

Build and test one step at a time. Do not move to the next step until the
current one is manually tested AND has a passing Playwright test. Each step
should be its own small commit/push so we can roll back cleanly if something
breaks.

**Every step follows the same mini-loop:**
a) Build the feature → b) Confirm it manually in the browser → c) Write a
Playwright test for it → d) Run `npx playwright test` (the FULL suite, not
just the new test) → e) Only commit once everything passes.

This last part matters most — running the full suite after every step is
what catches regressions immediately instead of discovering them three
steps later.

**When starting a new chat for a specific step**, tell Claude which step
number you're on and paste this spec — Claude will know exactly what "done"
looks like for that step, including which test to write, without needing
the full history re-explained.

- ✅ Step 0 — Playwright setup. One-time only, before Step 1. Run the
      setup commands in TEXTMOP-PROJECT-PLAN.md §5a. Confirm
      `npx playwright test` runs (even with zero tests) before moving on.
- [ ] **Step 1 — Box shell.** Build the empty content box with correct
      styling, placeholder text, focus state, and paste-only behavior
      (typing blocked). No formatting logic yet — just confirm you can
      click in, paste plain text, and see it appear. Confirm layout/sizing
      looks right (min-height, max-height + scroll, spacing around it).
      **Test:** page loads, box exists, typing does nothing, pasting plain
      text shows it in the box.
- [ ] **Step 2 — Rich paste display.** Confirm that pasting *formatted*
      content (bold, italic, colored, etc. from Google Docs) displays with
      that formatting visibly intact in the box — no options/checkboxes
      yet, just confirm the box correctly shows rich content as-is.
      **Test:** simulate pasting HTML with a `<b>` tag, assert the bold
      element exists in the rendered box.
- [ ] **Step 3 — Status badge + word count + Clear button.** Add the
      Original/Modified badge (always shows "Original" for now since no
      edits are possible yet), live word count, and a working Clear button.
      **Test:** paste text, assert word count matches; click Clear, assert
      box is empty and badge/count reset.
- [ ] **Step 4 — Options panel shell + full grayed-out list.** Build the
      full static list of every possible cleanup option (Bold, Italic,
      Underline, Strikethrough, Links, Colors + subs, Font Sizes + subs,
      Font Families + subs, HTML tags, Whitespace x3) — all disabled/grayed
      out, no detection logic yet. Confirm the layout and grouping looks
      right before wiring up any real behavior.
      **Test:** assert every expected checkbox exists in the DOM and is
      disabled by default on page load.
- [ ] **Step 5 — Detection: enable options that apply.** Wire up real
      detection so that when a paste contains bold text, the Bold checkbox
      becomes enabled with a correct count; everything else stays grayed
      out. Test with the standard test paste (§9) — confirm exactly the
      right subset of options become active.
      **Test:** paste the standard test paste, assert Bold/Italic/
      Underline/Colors/Links/Font Sizes checkboxes are enabled and
      everything else (e.g. Strikethrough) stays disabled.
- [ ] **Step 6 — Single operation: Bold.** Implement ONLY the bold
      removal operation end to end (check the box → bold disappears from
      the box → uncheck → bold returns). Get this one fully correct before
      adding any other operation. This is the template every other
      operation will follow.
      **Test:** paste bold text, check Bold, assert no `<b>`/`<strong>`
      remains; uncheck, assert it's back.
- [ ] **Step 7 — Remaining simple operations.** Using the same pattern as
      Step 6, add Italic, Underline, Strikethrough, Links one at a time —
      write and pass the test for each individually before adding the next.
      **Test:** one test per operation, same check/assert/uncheck/assert
      pattern as Step 6. Plus one combined test: check two at once (e.g.
      Bold + Italic), assert both removed independently and correctly.
- [ ] **Step 8 — Colors (with sub-checkboxes).** Implement text color and
      highlight removal as a parent + 2 subs. Confirm parent
      checks/unchecks both subs, and unchecking one sub sets the parent to
      indeterminate.
      **Test:** check parent, assert both subs checked and both colors
      removed; uncheck one sub, assert parent goes indeterminate and only
      that one color type is restored.
- [ ] **Step 9 — Font sizes (with sub-checkboxes).** Detect unique sizes
      found in the paste, list each as a sub-checkbox under a parent, allow
      removing individually or all at once. Include heading tags
      (H1–H6) as part of this detection.
      **Test:** paste content with two font sizes, assert two sub-
      checkboxes appear with correct labels; check one, assert only that
      size is affected.
- [ ] **Step 10 — Font families (with sub-checkboxes).** Same pattern as
      Step 9 but for font-family.
      **Test:** same shape as Step 9's test, for font-family instead.
- [ ] **Step 11 — Strip visible HTML tags.** Handle the case where literal
      `<tag>` text appears in the pasted content itself (not real
      formatting) and can be stripped as plain text removal.
      **Test:** paste text containing a literal `<span>` as visible text,
      check the option, assert the tag text is gone.
- [ ] **Step 12 — Whitespace operations (DOM-safe).** Implement trim
      trailing spaces, collapse multiple spaces, and remove extra blank
      lines by walking text nodes directly — must NOT collapse paragraph/
      list structure. This is the step that broke in v1; test thoroughly
      against the standard test paste plus a bullet-list paste.
      **Test:** paste a bullet list with trailing spaces and extra blank
      lines, check each whitespace option, assert list structure
      (`<ul>`/`<li>`) still exists in the DOM after cleanup — this is the
      critical regression test that would have caught v1's bug.
- [ ] **Step 13 — Reset to original.** Wire up the reset button to fully
      restore original content and uncheck/re-disable all options correctly.
      **Test:** paste, check several boxes, click Reset, assert content and
      all checkbox states match the original pre-paste-modification state.
- [ ] **Step 14 — Copy to clipboard.** Confirm copied text always exactly
      matches what's currently shown in the box.
      **Test:** paste, check a couple options, click Copy, read clipboard
      content via Playwright's clipboard permissions, assert it matches
      the visible box text.
- [ ] **Step 15 — Full regression test.** Run through the entire Definition
      of Done checklist (§8) using both a Google Docs test paste and a Word
      test paste. Run the FULL Playwright suite one final time. Fix
      anything that fails before calling v1 done.
- [ ] **Step 16 (post-v1, optional polish) — Flash highlight.** Only after
      Step 15 passes cleanly. Mark only the single most specific leaf
      element being changed — never a parent container. Light manual
      smoke-test is sufficient; a full automated test isn't required for
      this purely cosmetic feature.

## 11. Open questions to resolve before coding starts

- [x] Flash highlight removed from v1 scope — confirmed, added back as
      optional Step 16 after everything else is solid.
- [x] "Reset to original" (single global reset, no per-step undo history)
      confirmed sufficient for v1.
- [x] Playwright chosen for automated testing. A test is written and the
      full suite must pass after every single build step, not just at the
      end — this is what actually prevents regressions.

