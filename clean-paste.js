// Clean Paste — single box, live updates, granular sub-checkboxes

const contentBox   = document.getElementById('content-box');
const wordCount    = document.getElementById('word-count');
const paneStatus   = document.getElementById('pane-status');
const resetBtn     = document.getElementById('reset-btn');
const copyBtn      = document.getElementById('copy-btn');
const clearBtn     = document.getElementById('clear-btn');
const optionsWrap  = document.getElementById('options-wrap');
const optionsPanel = document.getElementById('options-panel');
const noChangesMsg = document.getElementById('no-changes-msg');

let originalHTML = '';
let isModified   = false;

// ── Paste ──────────────────────────────────────────────────────────────────
contentBox.addEventListener('paste', (e) => {
  e.preventDefault();
  const html  = (e.clipboardData || window.clipboardData).getData('text/html');
  const plain = (e.clipboardData || window.clipboardData).getData('text/plain');

  if (html) {
    originalHTML = removeInvisibleJunk(html);
    contentBox.innerHTML = originalHTML;
  } else {
    contentBox.textContent = plain;
    originalHTML = contentBox.innerHTML;
  }

  isModified = false;
  setStatus('original');
  resetBtn.style.display = 'none';
  detectAndBuildOptions();
  updateWordCount();
  autoResizeBox();
});

// ── Remove truly invisible junk only (scripts, Office tags, empty spans) ──
function removeInvisibleJunk(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  d.querySelectorAll('script,style,meta,link,head').forEach(el => el.remove());
  d.querySelectorAll('*').forEach(el => {
    if (el.tagName && el.tagName.includes(':')) el.remove();
  });
  // Remove empty invisible spans (common in Google Docs exports)
  d.querySelectorAll('span').forEach(el => {
    if (!el.textContent.trim() && !el.children.length) el.remove();
  });
  return d.innerHTML;
}

// ── Apply all checked options and update content box ──────────────────────
function applyOptions() {
  const clone = document.createElement('div');
  clone.innerHTML = originalHTML;

  const on = (id) => {
    const el = document.getElementById(id);
    return el ? el.checked : false;
  };

  // Unwrap: keep text children, remove wrapping tag
  const unwrap = (sel) => clone.querySelectorAll(sel).forEach(el => {
    while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
    el.parentNode.removeChild(el);
  });

  // Remove specific CSS props from all styled elements
  const clearProp = (...props) => clone.querySelectorAll('[style]').forEach(el => {
    props.forEach(p => { try { el.style.removeProperty(p); } catch(e){} });
    if (!el.getAttribute('style') || !el.getAttribute('style').trim()) {
      el.removeAttribute('style');
    }
  });

  // ── Bold ──
  if (on('rm-bold')) {
    unwrap('b,strong');
    clearProp('font-weight');
    // Neutralise heading default bold by converting to div
    clone.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(el => {
      const div = document.createElement('div');
      div.style.fontWeight = 'normal';
      div.style.fontSize   = '1em';
      div.style.margin     = '0';
      while (el.firstChild) div.appendChild(el.firstChild);
      el.parentNode.replaceChild(div, el);
    });
  }

  // ── Italic ──
  if (on('rm-italic')) { unwrap('i,em'); clearProp('font-style'); }

  // ── Underline ──
  if (on('rm-under')) {
    unwrap('u');
    clone.querySelectorAll('[style]').forEach(el => {
      if (el.style.textDecoration.includes('underline')) {
        el.style.textDecoration = el.style.textDecoration.replace('underline','').trim();
        if (!el.getAttribute('style').trim()) el.removeAttribute('style');
      }
    });
  }

  // ── Strikethrough ──
  if (on('rm-strike')) {
    unwrap('s,strike');
    clone.querySelectorAll('[style]').forEach(el => {
      if (el.style.textDecoration.includes('line-through')) {
        el.style.textDecoration = el.style.textDecoration.replace('line-through','').trim();
        if (!el.getAttribute('style').trim()) el.removeAttribute('style');
      }
    });
  }

  // ── Text color (sub-checkbox) ──
  if (on('rm-text-color')) {
    clearProp('color');
    clone.querySelectorAll('[color]').forEach(el => el.removeAttribute('color'));
  }

  // ── Highlights / background color (sub-checkbox) ──
  if (on('rm-highlight')) {
    clearProp('background-color','background');
    clone.querySelectorAll('[bgcolor]').forEach(el => el.removeAttribute('bgcolor'));
  }

  // ── Font sizes — individual sub-checkboxes ──
  clone.querySelectorAll('[style*="font-size"],[size]').forEach(el => {
    const size = el.style.fontSize || '';
    const sizeAttr = el.getAttribute('size') || '';
    const safeId = 'rm-size-' + cssEscape(size || 'attr-'+sizeAttr);
    if (on(safeId)) {
      el.style.removeProperty('font-size');
      if (sizeAttr) el.removeAttribute('size');
      if (!el.getAttribute('style') || !el.getAttribute('style').trim()) el.removeAttribute('style');
    }
  });
  // Also handle h1-h6 font sizes if checked
  clone.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(el => {
    const tag = el.tagName.toLowerCase();
    if (on('rm-size-heading-'+tag)) {
      const div = document.createElement('div');
      div.style.fontSize = '1em';
      div.style.margin   = '0';
      while (el.firstChild) div.appendChild(el.firstChild);
      el.parentNode.replaceChild(div, el);
    }
  });

  // ── Font families — individual sub-checkboxes ──
  clone.querySelectorAll('[style*="font-family"],[face]').forEach(el => {
    const family = cleanFamilyName(el.style.fontFamily || el.getAttribute('face') || '');
    if (family && on('rm-font-' + cssEscape(family))) {
      el.style.removeProperty('font-family');
      if (el.getAttribute('face')) el.removeAttribute('face');
      if (!el.getAttribute('style') || !el.getAttribute('style').trim()) el.removeAttribute('style');
    }
  });

  // ── Links ──
  if (on('rm-links')) unwrap('a');

  // ── Strip visible HTML tags ──
  if (on('strip-html')) {
    const text = clone.innerText || clone.textContent || '';
    clone.innerHTML = '';
    clone.textContent = text;
  }

  // ── Whitespace ──
  if (on('trim-lines') || on('collapse-spaces') || on('extra-breaks')) {
    let text = clone.innerText || clone.textContent || '';
    if (on('trim-lines'))       text = text.split('\n').map(l => l.trimEnd()).join('\n');
    if (on('collapse-spaces'))  text = text.replace(/[ \t]+/g,' ');
    if (on('extra-breaks'))     text = text.replace(/\n{3,}/g,'\n\n');
    clone.innerHTML = '';
    clone.textContent = text;
  }

  // Check if anything actually changed
  const changed = clone.innerHTML !== originalHTML;
  contentBox.innerHTML = clone.innerHTML;

  if (changed) {
    setStatus('modified');
    resetBtn.style.display = 'block';
    isModified = true;
  } else {
    setStatus('original');
    resetBtn.style.display = 'none';
    isModified = false;
  }

  updateWordCount();
  autoResizeBox();
}

// ── Detect formatting and build option checkboxes ─────────────────────────
function detectAndBuildOptions() {
  const el = document.createElement('div');
  el.innerHTML = originalHTML;

  // Basic formatting counts
  const bold     = el.querySelectorAll('b,strong,[style*="bold"]').length;
  const italic   = el.querySelectorAll('i,em,[style*="italic"]').length;
  const under    = el.querySelectorAll('u,[style*="underline"]').length;
  const strike   = el.querySelectorAll('s,strike,[style*="line-through"]').length;
  const links    = el.querySelectorAll('a[href]').length;
  const visTags  = ((el.innerText||'').match(/<[a-z][^>]*>/gi)||[]).length;

  // Sub-detect: text colors vs highlights
  let textColorCount = 0, highlightCount = 0;
  el.querySelectorAll('[style]').forEach(node => {
    if (node.style.color && node.style.color !== 'rgb(0, 0, 0)' && node.style.color !== '') textColorCount++;
    if (node.style.backgroundColor && node.style.backgroundColor !== 'transparent' && node.style.backgroundColor !== '') highlightCount++;
    if (node.style.background && node.style.background !== 'transparent' && node.style.background !== '') highlightCount++;
  });
  el.querySelectorAll('[color]').forEach(() => textColorCount++);
  el.querySelectorAll('[bgcolor]').forEach(() => highlightCount++);

  // Font sizes — collect unique sizes and counts
  const fontSizes = {};
  el.querySelectorAll('[style*="font-size"]').forEach(node => {
    const s = node.style.fontSize;
    if (s) fontSizes[s] = (fontSizes[s]||0) + 1;
  });
  el.querySelectorAll('[size]').forEach(node => {
    const s = 'attr:' + node.getAttribute('size');
    fontSizes[s] = (fontSizes[s]||0) + 1;
  });
  // Headings as a size source
  const headings = {};
  el.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(node => {
    const tag = node.tagName.toLowerCase();
    headings[tag] = (headings[tag]||0) + 1;
  });

  // Font families — collect unique families and counts
  const fontFamilies = {};
  el.querySelectorAll('[style*="font-family"],[face]').forEach(node => {
    const raw = node.style.fontFamily || node.getAttribute('face') || '';
    const family = cleanFamilyName(raw);
    if (family) fontFamilies[family] = (fontFamilies[family]||0) + 1;
  });

  // Whitespace
  const text = el.innerText || el.textContent || '';
  const trailingSpaces = text.split('\n').filter(l => /\s+$/.test(l)).length;
  const multiSpaces    = (text.match(/[ \t]{2,}/g)||[]).length;
  const extraBreaks    = (text.match(/\n{3,}/g)||[]).length;

  // Build groups
  const groups = [];

  // Formatting group
  const fmt = [];
  if (bold)   fmt.push({ id:'rm-bold',   label:'Bold',          count: bold,   unit: bold===1?'instance':'instances' });
  if (italic) fmt.push({ id:'rm-italic', label:'Italic',        count: italic, unit: italic===1?'instance':'instances' });
  if (under)  fmt.push({ id:'rm-under',  label:'Underline',     count: under,  unit: under===1?'instance':'instances' });
  if (strike) fmt.push({ id:'rm-strike', label:'Strikethrough', count: strike, unit: strike===1?'instance':'instances' });
  if (links)  fmt.push({ id:'rm-links',  label:'Hyperlinks',    count: links,  unit: links===1?'link':'links' });

  // Colors with sub-options
  const colorTotal = textColorCount + highlightCount;
  if (colorTotal > 0) {
    const colorSubs = [];
    if (textColorCount) colorSubs.push({ id:'rm-text-color', label:'Text colors',           count: textColorCount, unit: textColorCount===1?'instance':'instances' });
    if (highlightCount) colorSubs.push({ id:'rm-highlight',  label:'Highlights & background colors', count: highlightCount, unit: highlightCount===1?'instance':'instances' });
    fmt.push({ id:'rm-colors', label:'Colors & highlights', count: colorTotal, unit: colorTotal===1?'instance':'instances', subs: colorSubs, parentOnly: true });
  }

  if (fmt.length) groups.push({ title: 'Formatting', items: fmt });

  // Font sizes group
  const sizeItems = [];
  Object.entries(fontSizes).forEach(([size, count]) => {
    const displaySize = size.startsWith('attr:') ? 'Size attribute ' + size.replace('attr:','') : size;
    sizeItems.push({ id: 'rm-size-' + cssEscape(size), label: displaySize, count, unit: count===1?'instance':'instances' });
  });
  Object.entries(headings).forEach(([tag, count]) => {
    const labels = {h1:'Heading 1 (H1)',h2:'Heading 2 (H2)',h3:'Heading 3 (H3)',h4:'Heading 4 (H4)',h5:'Heading 5 (H5)',h6:'Heading 6 (H6)'};
    sizeItems.push({ id: 'rm-size-heading-'+tag, label: labels[tag]||tag.toUpperCase(), count, unit: count===1?'instance':'instances' });
  });
  if (sizeItems.length) groups.push({ title: 'Font Sizes', items: sizeItems });

  // Font families group
  const familyItems = Object.entries(fontFamilies).map(([family, count]) => ({
    id: 'rm-font-' + cssEscape(family),
    label: family,
    count,
    unit: count===1?'instance':'instances'
  }));
  if (familyItems.length) groups.push({ title: 'Font Families', items: familyItems });

  // HTML group
  if (visTags) groups.push({ title: 'HTML', items: [{ id:'strip-html', label:'Visible HTML tags', count: visTags, unit: visTags===1?'tag':'tags' }] });

  // Whitespace group
  const wsItems = [];
  if (trailingSpaces) wsItems.push({ id:'trim-lines',      label:'Trailing spaces',    count: trailingSpaces, unit: trailingSpaces===1?'line':'lines' });
  if (multiSpaces)    wsItems.push({ id:'collapse-spaces', label:'Multiple spaces',    count: multiSpaces,    unit: multiSpaces===1?'instance':'instances' });
  if (extraBreaks)    wsItems.push({ id:'extra-breaks',    label:'Extra blank lines',  count: extraBreaks,    unit: extraBreaks===1?'found':'found' });
  if (wsItems.length) groups.push({ title: 'Whitespace', items: wsItems });

  // Render options
  optionsPanel.innerHTML = '';

  if (!groups.length) {
    noChangesMsg.style.display = 'block';
    optionsPanel.style.display = 'none';
    optionsWrap.style.display  = 'block';
    return;
  }

  noChangesMsg.style.display = 'none';
  optionsPanel.style.display = 'block';
  optionsWrap.style.display  = 'block';

  groups.forEach(g => {
    const groupEl = document.createElement('div');
    groupEl.className = 'opt-group';
    groupEl.innerHTML = `<p class="opt-group-title">${g.title}</p>`;

    g.items.forEach(item => {
      const row = buildOptionRow(item, false);
      groupEl.appendChild(row);

      // Sub-checkboxes
      if (item.subs && item.subs.length) {
        const subsWrap = document.createElement('div');
        subsWrap.className = 'opt-subs';
        item.subs.forEach(sub => {
          subsWrap.appendChild(buildOptionRow(sub, true));
        });
        groupEl.appendChild(subsWrap);
      }
    });

    optionsPanel.appendChild(groupEl);
  });

  // Attach change listeners
  optionsPanel.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', function() {
      // If a sub is checked, ensure parent is also checked (visual only)
      applyOptions();
    });
  });
}

function buildOptionRow(item, isSub) {
  const row = document.createElement('label');
  row.className = 'opt-row' + (isSub ? ' opt-sub-row' : '');
  if (item.parentOnly) {
    // Parent checkbox that just visually groups — checking it checks all subs
    row.innerHTML = `
      <input type="checkbox" id="${item.id}" class="opt-parent-cb" data-subs="${(item.subs||[]).map(s=>s.id).join(',')}">
      <span class="opt-label">${item.label}</span>
      <span class="opt-count">${item.count} ${item.unit}</span>
    `;
  } else {
    row.innerHTML = `
      <input type="checkbox" id="${item.id}">
      <span class="opt-label">${item.label}</span>
      <span class="opt-count">${item.count} ${item.unit}</span>
    `;
  }
  return row;
}

// ── Handle parent checkboxes toggling their subs ───────────────────────────
document.addEventListener('change', (e) => {
  if (e.target.classList.contains('opt-parent-cb')) {
    const subIds = (e.target.dataset.subs || '').split(',').filter(Boolean);
    subIds.forEach(id => {
      const sub = document.getElementById(id);
      if (sub) sub.checked = e.target.checked;
    });
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────
function cssEscape(str) {
  return str.replace(/[^a-zA-Z0-9-_]/g, c => '_' + c.charCodeAt(0) + '_');
}

function cleanFamilyName(raw) {
  if (!raw) return '';
  return raw.replace(/['"]/g,'').split(',')[0].trim();
}

function setStatus(status) {
  paneStatus.textContent = status === 'original' ? 'Original' : 'Modified';
  paneStatus.className = 'pane-status-badge pane-status-' + status;
}

function autoResizeBox() {
  const maxH = Math.floor(window.innerHeight * 0.6);
  contentBox.style.height = 'auto';
  const natural = contentBox.scrollHeight;
  contentBox.style.height = Math.min(Math.max(300, natural), maxH) + 'px';
  contentBox.style.overflowY = natural > maxH ? 'auto' : 'hidden';
}

function updateWordCount() {
  const text = (contentBox.innerText || contentBox.textContent || '').trim();
  const words = text ? text.split(/\s+/).length : 0;
  wordCount.textContent = words + ' words';
}

// ── Buttons ────────────────────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  contentBox.innerHTML = originalHTML;
  // Uncheck all options
  optionsPanel.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
  setStatus('original');
  resetBtn.style.display = 'none';
  isModified = false;
  updateWordCount();
  autoResizeBox();
});

copyBtn.addEventListener('click', async () => {
  const text = (contentBox.innerText || contentBox.textContent || '').trim();
  if (!text) return;
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  const orig = copyBtn.textContent;
  copyBtn.textContent = 'Copied!';
  setTimeout(() => copyBtn.textContent = orig, 1200);
});

clearBtn.addEventListener('click', () => {
  contentBox.innerHTML = '';
  originalHTML = '';
  isModified   = false;
  optionsWrap.style.display  = 'none';
  optionsPanel.innerHTML     = '';
  noChangesMsg.style.display = 'none';
  resetBtn.style.display     = 'none';
  contentBox.style.height    = '300px';
  contentBox.style.overflowY = 'hidden';
  setStatus('original');
  wordCount.textContent = '0 words';
});
