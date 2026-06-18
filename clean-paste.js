// Clean Paste
// Left pane:  shows original rich HTML (bold, colors, links visible)
// Right pane: starts as identical rich copy — checkboxes remove things visually
// Copy button: copies right pane as plain text

const inputBox     = document.getElementById('input-box');
const outputBox    = document.getElementById('output-box');
const inputCount   = document.getElementById('input-count');
const outputCount  = document.getElementById('output-count');
const copyBtn      = document.getElementById('copy-btn');
const clearBtn     = document.getElementById('clear-btn');
const optionsPanel = document.getElementById('options-panel');
const noChangesMsg = document.getElementById('no-changes-msg');

let originalHTML = ''; // clean snapshot of pasted HTML

// ── Paste ──────────────────────────────────────────────────────────────────
inputBox.addEventListener('paste', (e) => {
  e.preventDefault();
  const html  = (e.clipboardData || window.clipboardData).getData('text/html');
  const plain = (e.clipboardData || window.clipboardData).getData('text/plain');

  if (html) {
    originalHTML = removeInvisibleJunk(html);
    inputBox.innerHTML = originalHTML;
  } else {
    inputBox.textContent = plain;
    originalHTML = inputBox.innerHTML;
  }

  detectAndBuildOptions();
  renderOutput();
});

// ── Strip only truly invisible junk from pasted HTML ──────────────────────
function removeInvisibleJunk(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  d.querySelectorAll('script,style,meta,link,head').forEach(el => el.remove());
  // Remove Word/Office namespace tags
  d.querySelectorAll('*').forEach(el => {
    if (el.tagName && el.tagName.includes(':')) el.remove();
  });
  return d.innerHTML;
}

// ── Render output: start from original, apply checked options ─────────────
function renderOutput() {
  const clone = document.createElement('div');
  clone.innerHTML = originalHTML || inputBox.innerHTML;

  const checked = (id) => {
    const el = document.getElementById(id);
    return el && el.checked;
  };

  // Unwrap: keep text children, remove the wrapping tag
  const unwrap = (sel) => {
    clone.querySelectorAll(sel).forEach(el => {
      const parent = el.parentNode;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    });
  };

  // Remove a CSS property from all elements
  const clearProp = (...props) => {
    clone.querySelectorAll('[style]').forEach(el => {
      props.forEach(p => el.style.removeProperty(p));
      if (!el.getAttribute('style').trim()) el.removeAttribute('style');
    });
  };

  if (checked('rm-bold')) {
    unwrap('b, strong');
    clearProp('font-weight');
  }
  if (checked('rm-italic')) {
    unwrap('i, em');
    clearProp('font-style');
  }
  if (checked('rm-under')) {
    unwrap('u');
    // only remove underline from text-decoration, not others
    clone.querySelectorAll('[style*="underline"]').forEach(el => {
      el.style.textDecoration = el.style.textDecoration.replace('underline','').trim() || null;
      if (!el.getAttribute('style').trim()) el.removeAttribute('style');
    });
  }
  if (checked('rm-strike')) {
    unwrap('s, strike');
    clone.querySelectorAll('[style*="line-through"]').forEach(el => {
      el.style.textDecoration = el.style.textDecoration.replace('line-through','').trim() || null;
      if (!el.getAttribute('style').trim()) el.removeAttribute('style');
    });
  }
  if (checked('rm-color')) {
    clearProp('color', 'background-color', 'background');
    clone.querySelectorAll('[bgcolor]').forEach(el => el.removeAttribute('bgcolor'));
    clone.querySelectorAll('[color]').forEach(el => el.removeAttribute('color'));
  }
  if (checked('rm-fontsize')) {
    clearProp('font-size');
    clone.querySelectorAll('[size]').forEach(el => el.removeAttribute('size'));
    // Unwrap heading tags, replace with p
    clone.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(el => {
      const p = document.createElement('p');
      while (el.firstChild) p.appendChild(el.firstChild);
      el.parentNode.replaceChild(p, el);
    });
  }
  if (checked('rm-fontface')) {
    clearProp('font-family');
    clone.querySelectorAll('[face]').forEach(el => el.removeAttribute('face'));
  }
  if (checked('rm-links')) {
    unwrap('a');
  }
  if (checked('strip-html')) {
    // Replace all remaining tags with plain text
    const text = clone.innerText || clone.textContent;
    clone.innerHTML = '';
    clone.textContent = text;
  }

  // Whitespace — work on innerText
  if (checked('trim-lines') || checked('collapse-spaces') || checked('extra-breaks')) {
    let text = clone.innerText || clone.textContent || '';
    if (checked('trim-lines'))      text = text.split('\n').map(l => l.trimEnd()).join('\n');
    if (checked('collapse-spaces')) text = text.replace(/[ \t]+/g, ' ');
    if (checked('extra-breaks'))    text = text.replace(/\n{3,}/g, '\n\n');
    clone.innerHTML = '';
    clone.textContent = text;
  }

  outputBox.innerHTML = clone.innerHTML;
  syncHeight();
  updateCounts();
}

// ── Make both panes the same height ───────────────────────────────────────
function syncHeight() {
  const maxH = Math.floor(window.innerHeight * 0.55);
  const minH = 280;
  [inputBox, outputBox].forEach(el => {
    el.style.height = 'auto';
    const natural = el.scrollHeight;
    el.style.height = Math.min(Math.max(minH, natural), maxH) + 'px';
    el.style.overflowY = natural > maxH ? 'auto' : 'hidden';
  });
}

// ── Detect what's in the paste and build option checkboxes ────────────────
function detectAndBuildOptions() {
  const el = document.createElement('div');
  el.innerHTML = originalHTML || inputBox.innerHTML;

  const d = {
    bold:     el.querySelectorAll('b,strong,[style*="bold"]').length,
    italic:   el.querySelectorAll('i,em,[style*="italic"]').length,
    under:    el.querySelectorAll('u,[style*="underline"]').length,
    strike:   el.querySelectorAll('s,strike,[style*="line-through"]').length,
    color:    el.querySelectorAll('[style*="color"],[style*="background"],[color],[bgcolor]').length,
    fontsize: el.querySelectorAll('[style*="font-size"],[size],h1,h2,h3,h4,h5,h6').length,
    fontface: el.querySelectorAll('[style*="font-family"],[face]').length,
    links:    el.querySelectorAll('a[href]').length,
    visibleTags: ((el.innerText||'').match(/<[a-z][^>]*>/gi)||[]).length,
    trailingSpaces: (el.innerText||'').split('\n').filter(l=>/\s+$/.test(l)).length,
    multiSpaces:   ((el.innerText||'').match(/[ \t]{2,}/g)||[]).length,
    extraBreaks:   ((el.innerText||'').match(/\n{3,}/g)||[]).length,
  };

  const groups = [];
  const fmt = [];
  if (d.bold)     fmt.push({id:'rm-bold',     label:'Remove bold',                count:d.bold});
  if (d.italic)   fmt.push({id:'rm-italic',   label:'Remove italic',              count:d.italic});
  if (d.under)    fmt.push({id:'rm-under',    label:'Remove underline',           count:d.under});
  if (d.strike)   fmt.push({id:'rm-strike',   label:'Remove strikethrough',       count:d.strike});
  if (d.color)    fmt.push({id:'rm-color',    label:'Remove colors & highlights', count:d.color});
  if (d.fontsize) fmt.push({id:'rm-fontsize', label:'Remove font sizes',          count:d.fontsize});
  if (d.fontface) fmt.push({id:'rm-fontface', label:'Remove font families',       count:d.fontface});
  if (d.links)    fmt.push({id:'rm-links',    label:'Remove hyperlinks',          count:d.links});
  if (fmt.length) groups.push({title:'Formatting', items:fmt});

  const htmlItems = [];
  if (d.visibleTags) htmlItems.push({id:'strip-html', label:'Strip visible HTML tags', count:d.visibleTags});
  if (htmlItems.length) groups.push({title:'HTML', items:htmlItems});

  const ws = [];
  if (d.trailingSpaces) ws.push({id:'trim-lines',      label:'Trim trailing spaces',    count:d.trailingSpaces+' lines'});
  if (d.multiSpaces)    ws.push({id:'collapse-spaces', label:'Collapse multiple spaces', count:d.multiSpaces+' found'});
  if (d.extraBreaks)    ws.push({id:'extra-breaks',    label:'Remove extra blank lines', count:d.extraBreaks+' found'});
  if (ws.length) groups.push({title:'Whitespace', items:ws});

  optionsPanel.innerHTML = '';

  if (!groups.length) {
    noChangesMsg.style.display = 'block';
    optionsPanel.style.display = 'none';
    return;
  }

  noChangesMsg.style.display = 'none';
  optionsPanel.style.display = 'block';

  groups.forEach(g => {
    const wrap = document.createElement('div');
    wrap.className = 'opt-group';
    wrap.innerHTML = `<p class="opt-group-title">${g.title}</p>`;
    g.items.forEach(item => {
      const lbl = document.createElement('label');
      lbl.className = 'opt-row';
      lbl.innerHTML = `
        <input type="checkbox" id="${item.id}">
        <span class="opt-label">${item.label}</span>
        <span class="opt-count">${item.count}</span>
      `;
      wrap.appendChild(lbl);
    });
    optionsPanel.appendChild(wrap);
  });

  optionsPanel.querySelectorAll('input[type=checkbox]').forEach(cb =>
    cb.addEventListener('change', renderOutput)
  );
}

// ── Copy output as plain text ──────────────────────────────────────────────
copyBtn.addEventListener('click', async () => {
  const text = outputBox.innerText || outputBox.textContent || '';
  if (!text.trim()) return;
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
  inputBox.innerHTML  = '';
  outputBox.innerHTML = '';
  originalHTML = '';
  optionsPanel.innerHTML = '';
  optionsPanel.style.display  = 'none';
  noChangesMsg.style.display  = 'none';
  [inputBox, outputBox].forEach(el => el.style.height = '280px');
  updateCounts();
});

function countWords(str) {
  const t = (str||'').trim();
  return t ? t.split(/\s+/).length : 0;
}

function updateCounts() {
  inputCount.textContent  = countWords(inputBox.innerText)  + ' words';
  outputCount.textContent = countWords(outputBox.innerText) + ' words';
}
