// Clean Paste — smart detection, retain structure, apply only relevant options

const inputBox  = document.getElementById('input-box');
const outputBox = document.getElementById('output-box');
const inputCount  = document.getElementById('input-count');
const outputCount = document.getElementById('output-count');
const copyBtn  = document.getElementById('copy-btn');
const clearBtn = document.getElementById('clear-btn');
const optionsPanel = document.getElementById('options-panel');
const noChangesMsg = document.getElementById('no-changes-msg');

let richHtml = ''; // store original pasted HTML

// ── Paste handler ──────────────────────────────────────────────────────────
inputBox.addEventListener('paste', (e) => {
  e.preventDefault();
  richHtml = (e.clipboardData || window.clipboardData).getData('text/html');
  const plain = (e.clipboardData || window.clipboardData).getData('text/plain');

  if (richHtml) {
    inputBox.innerHTML = sanitizeForDisplay(richHtml);
  } else {
    inputBox.textContent = plain;
    richHtml = '';
  }

  detectAndRender();
});

inputBox.addEventListener('input', detectAndRender);

// ── Sanitize HTML for left pane display (keep visual formatting, remove scripts) ──
function sanitizeForDisplay(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  tmp.querySelectorAll('script,style,meta,link').forEach(el => el.remove());
  return tmp.innerHTML;
}

// ── Extract plain text preserving structure ────────────────────────────────
function extractStructuredText(el) {
  let text = '';
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();

    if (tag === 'br') { text += '\n'; return; }

    const isBlock = ['p','div','h1','h2','h3','h4','h5','h6',
                     'blockquote','pre','tr','li','ul','ol'].includes(tag);
    const isList  = ['ul','ol'].includes(tag);
    const isLi    = tag === 'li';

    if (isBlock && text.length && !text.endsWith('\n')) text += '\n';

    if (isLi) {
      // preserve bullet indent
      const depth = getLiDepth(node);
      text += '  '.repeat(depth) + '• ';
    }

    node.childNodes.forEach(walk);

    if (isBlock && !text.endsWith('\n')) text += '\n';
    if (isList  && !text.endsWith('\n\n')) text += '\n';
  }
  walk(el);
  return text.replace(/^\n+/, '').replace(/\n+$/, '');
}

function getLiDepth(li) {
  let depth = 0, el = li.parentElement;
  while (el) {
    if (el.tagName && ['ul','ol'].includes(el.tagName.toLowerCase())) depth++;
    el = el.parentElement;
  }
  return Math.max(0, depth - 1);
}

// ── Detection ──────────────────────────────────────────────────────────────
function detect(el, rawText) {
  const html = el.innerHTML;

  // Count visible HTML tags in the raw text content
  const visibleTags = (rawText.match(/<[a-z][^>]*>/gi) || []).length;

  // Count formatting elements
  const hasBold   = el.querySelectorAll('b,strong,[style*="bold"]').length;
  const hasItalic = el.querySelectorAll('i,em,[style*="italic"]').length;
  const hasColor  = el.querySelectorAll('[style*="color"],[style*="background"]').length;
  const hasLinks  = el.querySelectorAll('a').length;
  const hasUnder  = el.querySelectorAll('u,[style*="underline"]').length;
  const hasStrike = el.querySelectorAll('s,strike,[style*="line-through"]').length;
  const hasFontSize = el.querySelectorAll('[style*="font-size"],[size]').length;
  const hasFontFace = el.querySelectorAll('[style*="font-family"],[face]').length;

  // Whitespace
  const lines = rawText.split('\n');
  const trailingSpaces = lines.filter(l => / +$/.test(l)).length;
  const multiSpaces    = (rawText.match(/[ \t]{2,}/g) || []).length;
  const extraBreaks    = (rawText.match(/\n{3,}/g) || []).length;

  return {
    visibleTags, hasBold, hasItalic, hasColor, hasLinks,
    hasUnder, hasStrike, hasFontSize, hasFontFace,
    trailingSpaces, multiSpaces, extraBreaks,
    hasAnyFormatting: hasBold+hasItalic+hasColor+hasLinks+hasUnder+hasStrike+hasFontSize+hasFontFace > 0,
    hasAnyWhitespace: trailingSpaces+multiSpaces+extraBreaks > 0,
  };
}

// ── Build options UI based on what's detected ─────────────────────────────
function buildOptions(d) {
  optionsPanel.innerHTML = '';

  const groups = [];

  // Formatting group
  const fmtItems = [];
  if (d.hasBold)     fmtItems.push({ id:'rm-bold',     label:'Remove bold',           count: d.hasBold });
  if (d.hasItalic)   fmtItems.push({ id:'rm-italic',   label:'Remove italic',         count: d.hasItalic });
  if (d.hasUnder)    fmtItems.push({ id:'rm-under',    label:'Remove underline',      count: d.hasUnder });
  if (d.hasStrike)   fmtItems.push({ id:'rm-strike',   label:'Remove strikethrough',  count: d.hasStrike });
  if (d.hasColor)    fmtItems.push({ id:'rm-color',    label:'Remove colors & highlights', count: d.hasColor });
  if (d.hasFontSize) fmtItems.push({ id:'rm-fontsize', label:'Remove font sizes',     count: d.hasFontSize });
  if (d.hasFontFace) fmtItems.push({ id:'rm-fontface', label:'Remove font families',  count: d.hasFontFace });
  if (d.hasLinks)    fmtItems.push({ id:'rm-links',    label:'Remove hyperlinks',     count: d.hasLinks });
  if (fmtItems.length) groups.push({ title: 'Formatting', items: fmtItems });

  // HTML group
  const htmlItems = [];
  if (d.visibleTags) htmlItems.push({ id:'strip-html', label:'Strip visible HTML tags', count: d.visibleTags });
  if (htmlItems.length) groups.push({ title: 'HTML', items: htmlItems });

  // Whitespace group
  const wsItems = [];
  if (d.trailingSpaces) wsItems.push({ id:'trim-lines',      label:'Trim trailing spaces',   count: d.trailingSpaces + ' lines' });
  if (d.multiSpaces)    wsItems.push({ id:'collapse-spaces', label:'Collapse multiple spaces', count: d.multiSpaces + ' found' });
  if (d.extraBreaks)    wsItems.push({ id:'extra-breaks',    label:'Remove extra blank lines', count: d.extraBreaks + ' found' });
  if (wsItems.length) groups.push({ title: 'Whitespace', items: wsItems });

  if (!groups.length) {
    noChangesMsg.style.display = 'block';
    optionsPanel.style.display = 'none';
    return;
  }

  noChangesMsg.style.display = 'none';
  optionsPanel.style.display = 'block';

  groups.forEach(g => {
    const groupEl = document.createElement('div');
    groupEl.className = 'opt-group';
    groupEl.innerHTML = `<p class="opt-group-title">${g.title}</p>`;
    g.items.forEach(item => {
      const row = document.createElement('label');
      row.className = 'opt-row';
      row.innerHTML = `
        <input type="checkbox" id="${item.id}" />
        <span class="opt-label">${item.label}</span>
        <span class="opt-count">${item.count}</span>
      `;
      groupEl.appendChild(row);
    });
    optionsPanel.appendChild(groupEl);
  });

  // Re-attach change listeners
  optionsPanel.querySelectorAll('input[type=checkbox]').forEach(cb =>
    cb.addEventListener('change', applyAndRender)
  );
}

// ── Apply selected options and update output ───────────────────────────────
function applyAndRender() {
  const clone = inputBox.cloneNode(true);

  const get = (id) => {
    const el = document.getElementById(id);
    return el ? el.checked : false;
  };

  // Remove formatting elements but keep text
  const unwrap = (sel) => clone.querySelectorAll(sel).forEach(el => {
    while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
    el.remove();
  });

  const removeStyle = (prop) => clone.querySelectorAll('[style]').forEach(el => {
    el.style[prop] = '';
    if (!el.getAttribute('style').trim()) el.removeAttribute('style');
  });

  if (get('rm-bold'))     { unwrap('b,strong'); removeStyle('fontWeight'); }
  if (get('rm-italic'))   { unwrap('i,em');     removeStyle('fontStyle'); }
  if (get('rm-under'))    { unwrap('u');         removeStyle('textDecoration'); }
  if (get('rm-strike'))   { unwrap('s,strike');  }
  if (get('rm-color'))    { removeStyle('color'); removeStyle('backgroundColor'); }
  if (get('rm-fontsize')) { removeStyle('fontSize'); clone.querySelectorAll('[size]').forEach(el => el.removeAttribute('size')); }
  if (get('rm-fontface')) { removeStyle('fontFamily'); clone.querySelectorAll('[face]').forEach(el => el.removeAttribute('face')); }
  if (get('rm-links'))    { unwrap('a'); }

  // Extract structured text
  let text = extractStructuredText(clone);

  // Strip visible HTML tags
  if (get('strip-html')) text = text.replace(/<[^>]*>/g, '');

  // Whitespace options
  if (get('trim-lines'))      text = text.split('\n').map(l => l.trimEnd()).join('\n');
  if (get('collapse-spaces')) text = text.replace(/[ \t]+/g, ' ');
  if (get('extra-breaks'))    text = text.replace(/\n{3,}/g, '\n\n');

  outputBox.value = text;
  autoResize();
  updateCounts(inputBox.innerText, text);
}

function detectAndRender() {
  const rawText = inputBox.innerText || '';
  const d = detect(inputBox, rawText);
  buildOptions(d);
  applyAndRender();
}

function autoResize() {
  outputBox.style.height = 'auto';
  const maxH = window.innerHeight * 0.55;
  outputBox.style.height = Math.min(Math.max(260, outputBox.scrollHeight), maxH) + 'px';
  outputBox.style.overflowY = outputBox.scrollHeight > maxH ? 'auto' : 'hidden';
}

function countWords(str) {
  const t = (str || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

function updateCounts(input, output) {
  inputCount.textContent  = countWords(input)  + ' words';
  outputCount.textContent = countWords(output) + ' words';
}

clearBtn.addEventListener('click', () => {
  inputBox.innerHTML = '';
  outputBox.value = '';
  richHtml = '';
  optionsPanel.innerHTML = '';
  optionsPanel.style.display = 'none';
  noChangesMsg.style.display = 'none';
  outputBox.style.height = '260px';
  updateCounts('', '');
});

copyBtn.addEventListener('click', async () => {
  if (!outputBox.value) return;
  try { await navigator.clipboard.writeText(outputBox.value); }
  catch { outputBox.select(); document.execCommand('copy'); }
  const orig = copyBtn.textContent;
  copyBtn.textContent = 'Copied!';
  setTimeout(() => (copyBtn.textContent = orig), 1200);
});
