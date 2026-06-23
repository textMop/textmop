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

// ── Block freeform typing — only allow paste ───────────────────────────────
contentBox.addEventListener('keydown', (e) => {
  const allowed = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'];
  if (e.metaKey || e.ctrlKey) return;
  if (allowed.includes(e.key)) return;
  e.preventDefault();
});

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

  setStatus('original');
  resetBtn.classList.remove('visible');
  detectAndBuildOptions();
  updateWordCount();
  autoResizeBox();
});

// ── Remove truly invisible junk only ──────────────────────────────────────
function removeInvisibleJunk(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  d.querySelectorAll('script,style,meta,link,head').forEach(el => el.remove());
  d.querySelectorAll('*').forEach(el => {
    if (el.tagName && el.tagName.includes(':')) el.remove();
  });
  d.querySelectorAll('span').forEach(el => {
    if (!el.textContent.trim() && !el.children.length) el.remove();
  });
  return d.innerHTML;
}

// ── Get checkbox state ─────────────────────────────────────────────────────
function on(id) {
  const el = document.getElementById(id);
  return el ? el.checked : false;
}

// ── Apply all checked options to a clone and update content box ───────────
function applyOptions() {
  const clone = document.createElement('div');
  clone.innerHTML = originalHTML;

  // Helper: wrap element's children in a flash span, then remove the tag
  // This way the flash marker survives the unwrap
  const flashUnwrap = (sel) => {
    clone.querySelectorAll(sel).forEach(el => {
      const flash = document.createElement('span');
      flash.setAttribute('data-flash', '1');
      while (el.firstChild) flash.appendChild(el.firstChild);
      el.parentNode.replaceChild(flash, el);
    });
  };

  // Helper: mark element itself for flash then remove a style prop
  const flashClearProp = (sel, ...props) => {
    clone.querySelectorAll(sel).forEach(el => {
      let affected = false;
      props.forEach(p => {
        if (el.style.getPropertyValue(p)) {
          el.style.removeProperty(p);
          affected = true;
        }
      });
      if (affected) el.setAttribute('data-flash', '1');
      if (!el.getAttribute('style') || !el.getAttribute('style').trim()) {
        el.removeAttribute('style');
      }
    });
  };

  // ── Bold ──
  if (on('rm-bold')) {
    flashUnwrap('b,strong');
    flashClearProp('[style*="font-weight"]', 'font-weight');
    clone.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(el => {
      el.style.fontWeight = 'normal';
      el.setAttribute('data-flash', '1');
    });
  }

  // ── Italic ──
  if (on('rm-italic')) {
    flashUnwrap('i,em');
    flashClearProp('[style*="italic"]', 'font-style');
  }

  // ── Underline ──
  if (on('rm-under')) {
    flashUnwrap('u');
    clone.querySelectorAll('[style]').forEach(el => {
      if (el.style.textDecoration && el.style.textDecoration.includes('underline')) {
        el.style.textDecoration = el.style.textDecoration.replace('underline','').trim();
        el.setAttribute('data-flash', '1');
        if (!el.getAttribute('style').trim()) el.removeAttribute('style');
      }
    });
  }

  // ── Strikethrough ──
  if (on('rm-strike')) {
    flashUnwrap('s,strike');
    clone.querySelectorAll('[style]').forEach(el => {
      if (el.style.textDecoration && el.style.textDecoration.includes('line-through')) {
        el.style.textDecoration = el.style.textDecoration.replace('line-through','').trim();
        el.setAttribute('data-flash', '1');
        if (!el.getAttribute('style').trim()) el.removeAttribute('style');
      }
    });
  }

  // ── Text color ──
  if (on('rm-text-color')) {
    clone.querySelectorAll('[style]').forEach(el => {
      const c = el.style.color;
      if (c && c !== 'rgb(0, 0, 0)' && c !== 'black' && c !== '') {
        el.style.removeProperty('color');
        el.setAttribute('data-flash', '1');
        if (!el.getAttribute('style').trim()) el.removeAttribute('style');
      }
    });
    clone.querySelectorAll('[color]').forEach(el => {
      el.removeAttribute('color');
      el.setAttribute('data-flash', '1');
    });
  }

  // ── Highlights / background colors ──
  if (on('rm-highlight')) {
    clone.querySelectorAll('[style]').forEach(el => {
      const bg = el.style.backgroundColor || el.style.background;
      if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)' && bg !== '') {
        el.style.removeProperty('background-color');
        el.style.removeProperty('background');
        el.setAttribute('data-flash', '1');
        if (!el.getAttribute('style').trim()) el.removeAttribute('style');
      }
    });
    clone.querySelectorAll('[bgcolor]').forEach(el => {
      el.removeAttribute('bgcolor');
      el.setAttribute('data-flash', '1');
    });
  }

  // ── Hyperlinks ──
  if (on('rm-links')) flashUnwrap('a');

  // ── Font sizes ──
  clone.querySelectorAll('[style]').forEach(el => {
    const size = el.style.fontSize;
    if (size && on('rm-size-' + cssEscape(size))) {
      el.style.removeProperty('font-size');
      el.setAttribute('data-flash', '1');
      if (!el.getAttribute('style').trim()) el.removeAttribute('style');
    }
  });
  clone.querySelectorAll('[size]').forEach(el => {
    const s = el.getAttribute('size');
    if (s && on('rm-size-attr-' + s)) {
      el.removeAttribute('size');
      el.setAttribute('data-flash', '1');
    }
  });
  clone.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(el => {
    const tag = el.tagName.toLowerCase();
    if (on('rm-size-heading-' + tag)) {
      const div = document.createElement('div');
      div.setAttribute('data-flash', '1');
      div.style.fontSize   = '1em';
      div.style.margin     = '0';
      div.style.fontWeight = 'normal';
      while (el.firstChild) div.appendChild(el.firstChild);
      el.parentNode.replaceChild(div, el);
    }
  });

  // ── Font families ──
  clone.querySelectorAll('[style]').forEach(el => {
    const family = cleanFamilyName(el.style.fontFamily || '');
    if (family && on('rm-font-' + cssEscape(family))) {
      el.style.removeProperty('font-family');
      el.setAttribute('data-flash', '1');
      if (!el.getAttribute('style').trim()) el.removeAttribute('style');
    }
  });
  clone.querySelectorAll('[face]').forEach(el => {
    const family = cleanFamilyName(el.getAttribute('face') || '');
    if (family && on('rm-font-' + cssEscape(family))) {
      el.removeAttribute('face');
      el.setAttribute('data-flash', '1');
    }
  });

  // ── Visible HTML tags ──
  if (on('strip-html')) {
    const text = clone.innerText || clone.textContent || '';
    clone.innerHTML = '';
    clone.textContent = text;
  }

  // ── Whitespace ──
  if (on('trim-lines') || on('collapse-spaces') || on('extra-breaks')) {
    let text = clone.innerText || clone.textContent || '';
    if (on('trim-lines'))      text = text.split('\n').map(l => l.trimEnd()).join('\n');
    if (on('collapse-spaces')) text = text.replace(/[ \t]+/g,' ');
    if (on('extra-breaks'))    text = text.replace(/\n{3,}/g,'\n\n');
    clone.innerHTML = '';
    clone.textContent = text;
  }

  const changed = clone.innerHTML !== originalHTML;
  contentBox.innerHTML = clone.innerHTML;

  // Trigger flash on marked elements now they are in the live DOM
  contentBox.querySelectorAll('[data-flash]').forEach(el => {
    el.removeAttribute('data-flash');
    el.classList.remove('flash-changed');
    void el.offsetWidth; // force reflow so animation retriggers if already playing
    el.classList.add('flash-changed');
    el.addEventListener('animationend', () => el.classList.remove('flash-changed'), { once: true });
  });

  setStatus(changed ? 'modified' : 'original');
  changed ? resetBtn.classList.add('visible') : resetBtn.classList.remove('visible');
  updateWordCount();
  autoResizeBox();
}

// ── Handle parent checkbox → sync subs first, then apply ──────────────────
function handleCheckboxChange(e) {
  const cb = e.target;

  // If this is a parent, sync its subs to match
  const subIds = (cb.dataset.subs || '').split(',').filter(Boolean);
  if (subIds.length) {
    subIds.forEach(id => {
      const sub = document.getElementById(id);
      if (sub) sub.checked = cb.checked;
    });
  }

  // If this is a sub, update parent indeterminate state
  const parentId = cb.dataset.parent;
  if (parentId) {
    const parent = document.getElementById(parentId);
    if (parent) {
      const siblingIds = (parent.dataset.subs || '').split(',').filter(Boolean);
      const siblings = siblingIds.map(id => document.getElementById(id)).filter(Boolean);
      const checkedCount = siblings.filter(s => s.checked).length;
      if (checkedCount === 0) {
        parent.checked = false;
        parent.indeterminate = false;
      } else if (checkedCount === siblings.length) {
        parent.checked = true;
        parent.indeterminate = false;
      } else {
        parent.checked = false;
        parent.indeterminate = true;
      }
    }
  }

  applyOptions();
}

// ── Detect formatting and build option checkboxes ─────────────────────────
function detectAndBuildOptions() {
  const el = document.createElement('div');
  el.innerHTML = originalHTML;
  const text = el.innerText || el.textContent || '';

  // Formatting
  const bold   = el.querySelectorAll('b,strong,[style*="bold"]').length;
  const italic = el.querySelectorAll('i,em,[style*="italic"]').length;
  const under  = el.querySelectorAll('u,[style*="underline"]').length;
  const strike = el.querySelectorAll('s,strike,[style*="line-through"]').length;
  const links  = el.querySelectorAll('a[href]').length;

  // Colors
  let textColorCount = 0, highlightCount = 0;
  el.querySelectorAll('[style]').forEach(node => {
    const c = node.style.color;
    const bg = node.style.backgroundColor || node.style.background;
    if (c && c !== 'rgb(0, 0, 0)' && c !== 'black' && c !== '') textColorCount++;
    if (bg && bg !== 'transparent' && bg !== '' && bg !== 'rgba(0, 0, 0, 0)') highlightCount++;
  });
  el.querySelectorAll('[color]').forEach(() => textColorCount++);
  el.querySelectorAll('[bgcolor]').forEach(() => highlightCount++);

  // Font sizes — unique sizes with counts
  const fontSizes = {};
  el.querySelectorAll('[style]').forEach(node => {
    const s = node.style.fontSize;
    if (s) fontSizes[s] = (fontSizes[s]||0) + 1;
  });
  el.querySelectorAll('[size]').forEach(node => {
    const s = 'attr:' + node.getAttribute('size');
    fontSizes[s] = (fontSizes[s]||0) + 1;
  });
  const headings = {};
  el.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(node => {
    const tag = node.tagName.toLowerCase();
    headings[tag] = (headings[tag]||0) + 1;
  });

  // Font families — unique families (no counts shown)
  const fontFamilies = {};
  el.querySelectorAll('[style]').forEach(node => {
    const family = cleanFamilyName(node.style.fontFamily || '');
    if (family) fontFamilies[family] = (fontFamilies[family]||0) + 1;
  });
  el.querySelectorAll('[face]').forEach(node => {
    const family = cleanFamilyName(node.getAttribute('face') || '');
    if (family) fontFamilies[family] = (fontFamilies[family]||0) + 1;
  });

  // Visible HTML
  const visTags = (text.match(/<[a-z][^>]*>/gi)||[]).length;

  // Whitespace
  const trailingSpaces = text.split('\n').filter(l => /\s+$/.test(l)).length;
  const multiSpaces    = (text.match(/[ \t]{2,}/g)||[]).length;
  const extraBreaks    = (text.match(/\n{3,}/g)||[]).length;

  // Build groups
  const groups = [];

  // ── Formatting group ──
  const fmtItems = [];
  if (bold)   fmtItems.push({ id:'rm-bold',   label:'Bold',          badge: plural(bold,'word') });
  if (italic) fmtItems.push({ id:'rm-italic', label:'Italic',        badge: plural(italic,'word') });
  if (under)  fmtItems.push({ id:'rm-under',  label:'Underline',     badge: plural(under,'word') });
  if (strike) fmtItems.push({ id:'rm-strike', label:'Strikethrough', badge: plural(strike,'word') });
  if (links)  fmtItems.push({ id:'rm-links',  label:'Hyperlinks',    badge: plural(links,'link') });

  const colorTotal = textColorCount + highlightCount;
  if (colorTotal > 0) {
    const colorSubs = [];
    if (textColorCount) colorSubs.push({ id:'rm-text-color', label:'Text colors',                badge: plural(textColorCount,'element') });
    if (highlightCount) colorSubs.push({ id:'rm-highlight',  label:'Highlights & backgrounds',   badge: plural(highlightCount,'element') });
    fmtItems.push({
      id: 'rm-colors',
      label: 'Colors & highlights',
      badge: plural(colorTotal,'element'),
      subs: colorSubs,
    });
  }

  if (fmtItems.length) groups.push({ title:'Formatting', items:fmtItems });

  // ── Font Sizes group ──
  const sizeSubItems = [];
  Object.entries(fontSizes).forEach(([size, count]) => {
    const isAttr = size.startsWith('attr:');
    const displaySize = isAttr ? 'Size ' + size.replace('attr:','') : size;
    const id = isAttr ? 'rm-size-attr-' + size.replace('attr:','') : 'rm-size-' + cssEscape(size);
    sizeSubItems.push({ id, label: displaySize, badge: plural(count,'paragraph') });
  });
  const headingLabels = {h1:'Heading 1',h2:'Heading 2',h3:'Heading 3',h4:'Heading 4',h5:'Heading 5',h6:'Heading 6'};
  Object.entries(headings).forEach(([tag, count]) => {
    sizeSubItems.push({
      id: 'rm-size-heading-' + tag,
      label: headingLabels[tag] + ' (' + tag.toUpperCase() + ')',
      badge: plural(count,'heading')
    });
  });
  if (sizeSubItems.length) {
    groups.push({
      title: 'Font Sizes',
      items: [{
        id: 'rm-all-sizes',
        label: 'All font sizes',
        badge: plural(sizeSubItems.length,'size'),
        subs: sizeSubItems,
      }]
    });
  }

  // ── Font Families group ──
  const familySubItems = Object.keys(fontFamilies).map(family => ({
    id: 'rm-font-' + cssEscape(family),
    label: family,
    badge: null, // no count for families — name is the info
  }));
  if (familySubItems.length) {
    groups.push({
      title: 'Font Families',
      items: [{
        id: 'rm-all-fonts',
        label: 'All font families',
        badge: familySubItems.length === 1 ? '1 family' : familySubItems.length + ' families',
        subs: familySubItems,
      }]
    });
  }

  // ── HTML group ──
  if (visTags) {
    groups.push({ title:'HTML', items:[{
      id:'strip-html', label:'Strip visible HTML tags', badge: plural(visTags,'tag')
    }]});
  }

  // ── Whitespace group ──
  const wsItems = [];
  if (trailingSpaces) wsItems.push({ id:'trim-lines',      label:'Trailing spaces',    badge: plural(trailingSpaces,'line') });
  if (multiSpaces)    wsItems.push({ id:'collapse-spaces', label:'Multiple spaces',    badge: plural(multiSpaces,'found') });
  if (extraBreaks)    wsItems.push({ id:'extra-breaks',    label:'Extra blank lines',  badge: plural(extraBreaks,'found') });
  if (wsItems.length) groups.push({ title:'Whitespace', items:wsItems });

  // ── Render ──
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
      const subIds = (item.subs || []).map(s => s.id).join(',');
      groupEl.appendChild(makeRow(item, false, '', subIds));

      if (item.subs && item.subs.length) {
        const subsWrap = document.createElement('div');
        subsWrap.className = 'opt-subs';
        item.subs.forEach(sub => {
          subsWrap.appendChild(makeRow(sub, true, item.id, ''));
        });
        groupEl.appendChild(subsWrap);
      }
    });

    optionsPanel.appendChild(groupEl);
  });

  // Attach listeners
  optionsPanel.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', handleCheckboxChange);
  });
}

function makeRow(item, isSub, parentId, subIds) {
  const row = document.createElement('label');
  row.className = 'opt-row' + (isSub ? ' opt-sub-row' : '');
  const dataParent = parentId ? `data-parent="${parentId}"` : '';
  const dataSubs   = subIds   ? `data-subs="${subIds}"`     : '';
  const badge      = item.badge ? `<span class="opt-count">${item.badge}</span>` : '';
  row.innerHTML = `
    <input type="checkbox" id="${item.id}" ${dataParent} ${dataSubs}>
    <span class="opt-label">${item.label}</span>
    ${badge}
  `;
  return row;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function plural(n, unit) {
  if (unit === 'found') return n > 1 ? n + ' found' : '1 found';
  return n === 1 ? '1 ' + unit : n + ' ' + unit + 's';
}

function cssEscape(str) {
  return str.replace(/[^a-zA-Z0-9-_]/g, c => '_' + c.charCodeAt(0) + '_');
}

function cleanFamilyName(raw) {
  if (!raw) return '';
  return raw.replace(/['"]/g,'').split(',')[0].trim();
}

function setStatus(status) {
  paneStatus.textContent = status === 'original' ? 'Original' : 'Modified';
  paneStatus.className   = 'pane-status-badge pane-status-' + status;
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
  wordCount.textContent = (text ? text.split(/\s+/).length : 0) + ' words';
}

// ── Buttons ────────────────────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  contentBox.innerHTML = originalHTML;
  optionsPanel.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.checked = false;
    cb.indeterminate = false;
  });
  setStatus('original');
  resetBtn.classList.remove('visible');
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
  contentBox.innerHTML   = '';
  originalHTML           = '';
  optionsWrap.style.display  = 'none';
  optionsPanel.innerHTML     = '';
  noChangesMsg.style.display = 'none';
  resetBtn.classList.remove('visible');
  contentBox.style.height    = '300px';
  contentBox.style.overflowY = 'hidden';
  setStatus('original');
  wordCount.textContent = '0 words';
});