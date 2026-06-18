// Clean Paste — output mirrors original on paste, checkboxes modify progressively

const inputBox     = document.getElementById('input-box');
const outputBox    = document.getElementById('output-box');
const inputCount   = document.getElementById('input-count');
const outputCount  = document.getElementById('output-count');
const copyBtn      = document.getElementById('copy-btn');
const clearBtn     = document.getElementById('clear-btn');
const optionsPanel = document.getElementById('options-panel');
const noChangesMsg = document.getElementById('no-changes-msg');

// Store the original pasted DOM so we always apply checkboxes fresh from source
let originalHTML = '';

// ── Paste ──────────────────────────────────────────────────────────────────
inputBox.addEventListener('paste', (e) => {
  e.preventDefault();

  const html  = (e.clipboardData || window.clipboardData).getData('text/html');
  const plain = (e.clipboardData || window.clipboardData).getData('text/plain');

  if (html) {
    // Clean only truly invisible/junk stuff from the HTML before displaying
    originalHTML = cleanInvisibleJunk(html);
    inputBox.innerHTML = originalHTML;
  } else {
    originalHTML = '';
    inputBox.textContent = plain;
  }

  detectAndBuildOptions();
  renderOutput();
});

inputBox.addEventListener('input', () => {
  // If user types directly (no paste), just sync
  originalHTML = inputBox.innerHTML;
  detectAndBuildOptions();
  renderOutput();
});

// ── Strip only invisible junk — keep all visual formatting ─────────────────
function cleanInvisibleJunk(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  // Remove truly invisible elements only
  tmp.querySelectorAll('script, style, meta, link, head, xml, o\\:p').forEach(el => el.remove());
  // Remove empty invisible spans that carry no text
  tmp.querySelectorAll('span:empty, div:empty').forEach(el => el.remove());
  return tmp.innerHTML;
}

// ── Apply checked options on top of original and extract text ─────────────
function renderOutput() {
  // Start from a fresh clone of the original pasted DOM
  const clone = document.createElement('div');
  clone.innerHTML = originalHTML || inputBox.innerHTML;

  const get = (id) => {
    const el = document.getElementById(id);
    return el ? el.checked : false;
  };

  // Helper: unwrap element (keep children, remove the tag)
  const unwrap = (sel) => clone.querySelectorAll(sel).forEach(el => {
    while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
    el.remove();
  });

  // Helper: remove a specific CSS property from all styled elements
  const removeStyleProp = (prop) => {
    clone.querySelectorAll('[style]').forEach(el => {
      try {
        el.style.removeProperty(prop);
        // Also handle camelCase variant
        el.style[prop] = '';
      } catch(e) {}
      if (!el.getAttribute('style') || el.getAttribute('style').trim() === '') {
        el.removeAttribute('style');
      }
    });
  };

  // Apply each checked option
  if (get('rm-bold'))     { unwrap('b, strong'); removeStyleProp('font-weight'); }
  if (get('rm-italic'))   { unwrap('i, em');     removeStyleProp('font-style'); }
  if (get('rm-under'))    { unwrap('u');          removeStyleProp('text-decoration'); }
  if (get('rm-strike'))   { unwrap('s, strike');  }
  if (get('rm-color'))    { removeStyleProp('color'); removeStyleProp('background-color'); removeStyleProp('background'); }
  if (get('rm-fontsize')) { removeStyleProp('font-size'); clone.querySelectorAll('[size]').forEach(el => el.removeAttribute('size')); }
  if (get('rm-fontface')) { removeStyleProp('font-family'); clone.querySelectorAll('[face]').forEach(el => el.removeAttribute('face')); }
  if (get('rm-links'))    { unwrap('a'); }
  if (get('strip-html'))  {
    // Replace entire content with plain text stripping all tags
    clone.innerHTML = clone.innerText || clone.textContent;
  }

  // Extract structured text preserving bullets and line breaks
  let text = extractStructuredText(clone);

  // Whitespace options
  if (get('trim-lines'))       text = text.split('\n').map(l => l.trimEnd()).join('\n');
  if (get('collapse-spaces'))  text = text.replace(/[ \t]+/g, ' ');
  if (get('extra-breaks'))     text = text.replace(/\n{3,}/g, '\n\n');

  // Trim leading/trailing blank lines
  text = text.replace(/^\n+/, '').replace(/\n+$/, '');

  outputBox.value = text;
  autoResize();
  updateCounts(inputBox.innerText || '', text);
}

// ── Extract plain text, preserving list structure and paragraphs ───────────
function extractStructuredText(el) {
  let text = '';

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();
    const blockTags = ['p','div','h1','h2','h3','h4','h5','h6','blockquote','pre','tr'];
    const isBlock = blockTags.includes(tag);
    const isLi    = tag === 'li';
    const isList  = tag === 'ul' || tag === 'ol';

    if (tag === 'br') { text += '\n'; return; }
    if (isBlock && text.length && !text.endsWith('\n')) text += '\n';

    if (isLi) {
      const depth = getListDepth(node);
      if (text.length && !text.endsWith('\n')) text += '\n';
      text += '  '.repeat(depth) + '• ';
    }

    node.childNodes.forEach(walk);

    if (isBlock && !text.endsWith('\n')) text += '\n';
    if (isList  && !text.endsWith('\n\n')) text += '\n';
  }

  walk(el);
  return text;
}

function getListDepth(li) {
  let depth = 0;
  let el = li.parentElement;
  while (el) {
    const t = el.tagName ? el.tagName.toLowerCase() : '';
    if (t === 'ul' || t === 'ol') depth++;
    el = el.parentElement;
  }
  return Math.max(0, depth - 1);
}

// ── Detect what's in the pasted content and build option checkboxes ────────
function detectAndBuildOptions() {
  const el = document.createElement('div');
  el.innerHTML = originalHTML || inputBox.innerHTML;
  const rawText = el.innerText || el.textContent || '';

  const d = {
    bold:     el.querySelectorAll('b, strong, [style*="bold"]').length,
    italic:   el.querySelectorAll('i, em, [style*="italic"]').length,
    under:    el.querySelectorAll('u, [style*="underline"]').length,
    strike:   el.querySelectorAll('s, strike, [style*="line-through"]').length,
    color:    el.querySelectorAll('[style*="color"], [style*="background"]').length,
    fontsize: el.querySelectorAll('[style*="font-size"], [size]').length,
    fontface: el.querySelectorAll('[style*="font-family"], [face]').length,
    links:    el.querySelectorAll('a[href]').length,
    visibleTags: (rawText.match(/<[a-z][^>]*>/gi) || []).length,
    trailingSpaces: rawText.split('\n').filter(l => / +$/.test(l)).length,
    multiSpaces:    (rawText.match(/[ \t]{2,}/g) || []).length,
    extraBreaks:    (rawText.match(/\n{3,}/g) || []).length,
  };

  const groups = [];

  const fmt = [];
  if (d.bold)     fmt.push({ id:'rm-bold',     label:'Remove bold',                count: d.bold });
  if (d.italic)   fmt.push({ id:'rm-italic',   label:'Remove italic',              count: d.italic });
  if (d.under)    fmt.push({ id:'rm-under',    label:'Remove underline',           count: d.under });
  if (d.strike)   fmt.push({ id:'rm-strike',   label:'Remove strikethrough',       count: d.strike });
  if (d.color)    fmt.push({ id:'rm-color',    label:'Remove colors & highlights', count: d.color });
  if (d.fontsize) fmt.push({ id:'rm-fontsize', label:'Remove font sizes',          count: d.fontsize });
  if (d.fontface) fmt.push({ id:'rm-fontface', label:'Remove font families',       count: d.fontface });
  if (d.links)    fmt.push({ id:'rm-links',    label:'Remove hyperlinks',          count: d.links });
  if (fmt.length) groups.push({ title: 'Formatting', items: fmt });

  const htmlItems = [];
  if (d.visibleTags) htmlItems.push({ id:'strip-html', label:'Strip visible HTML tags', count: d.visibleTags });
  if (htmlItems.length) groups.push({ title: 'HTML', items: htmlItems });

  const ws = [];
  if (d.trailingSpaces) ws.push({ id:'trim-lines',      label:'Trim trailing spaces',    count: d.trailingSpaces + ' lines' });
  if (d.multiSpaces)    ws.push({ id:'collapse-spaces', label:'Collapse multiple spaces', count: d.multiSpaces + ' found' });
  if (d.extraBreaks)    ws.push({ id:'extra-breaks',    label:'Remove extra blank lines', count: d.extraBreaks + ' found' });
  if (ws.length) groups.push({ title: 'Whitespace', items: ws });

  if (!groups.length) {
    noChangesMsg.style.display = 'block';
    optionsPanel.style.display = 'none';
    return;
  }

  noChangesMsg.style.display = 'none';
  optionsPanel.style.display = 'block';
  optionsPanel.innerHTML = '';

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

  // Attach listeners to all new checkboxes
  optionsPanel.querySelectorAll('input[type=checkbox]').forEach(cb =>
    cb.addEventListener('change', renderOutput)
  );
}

function autoResize() {
  outputBox.style.height = 'auto';
  const maxH = window.innerHeight * 0.55;
  const newH = Math.min(Math.max(280, outputBox.scrollHeight), maxH);
  outputBox.style.height = newH + 'px';
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
  outputBox.value    = '';
  originalHTML       = '';
  optionsPanel.innerHTML = '';
  optionsPanel.style.display  = 'none';
  noChangesMsg.style.display  = 'none';
  outputBox.style.height = '280px';
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
