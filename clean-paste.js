// Clean Paste — Step 1: Box shell only.
// No formatting detection, no checkboxes yet. Just: box exists, typing is
// blocked, and paste inserts text at the cursor.

const box = document.getElementById('paste-box');

// Block typing entirely — this box is paste-only for now.
// We stop keydown for any key that would insert or delete text,
// but still allow copy (Cmd/Ctrl+C) and select-all (Cmd/Ctrl+A) to work
// since those don't modify content.
box.addEventListener('keydown', (e) => {
  const isCopy = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c';
  const isSelectAll = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a';
  if (isCopy || isSelectAll) return; // allow these
  e.preventDefault();
});

// Handle paste. For Step 1, we only insert plain text at the cursor —
// this is deliberately simple so it's testable (synthetic paste events
// don't trigger a browser's native default paste behavior, only real,
// trusted user pastes do).
//
// Step 2 will expand this to read the rich HTML from the clipboard
// (e.clipboardData.getData('text/html')) and store it as originalHTML.
box.addEventListener('paste', (e) => {
  e.preventDefault();

  const text = e.clipboardData.getData('text/plain');
  insertTextAtCursor(text);
});

function insertTextAtCursor(text) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const textNode = document.createTextNode(text);
  range.insertNode(textNode);

  // Move the cursor to just after the inserted text.
  range.setStartAfter(textNode);
  range.setEndAfter(textNode);
  selection.removeAllRanges();
  selection.addRange(range);
}
