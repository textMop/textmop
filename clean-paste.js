// Clean Paste — strip formatting, show rich preview, auto-resize output

const inputBox = document.getElementById('input-box');
const outputBox = document.getElementById('output-box');
const inputCount = document.getElementById('input-count');
const outputCount = document.getElementById('output-count');
const copyBtn = document.getElementById('copy-btn');
const clearBtn = document.getElementById('clear-btn');

const optTrimLines     = document.getElementById('opt-trim-lines');
const optCollapseSpaces = document.getElementById('opt-collapse-spaces');
const optCollapseBreaks = document.getElementById('opt-collapse-breaks');
const optStripHtml     = document.getElementById('opt-strip-html');

// On paste: keep rich HTML in the left pane so the user sees formatting,
// but derive plain text for the right pane.
inputBox.addEventListener('paste', (e) => {
  e.preventDefault();

  const html  = (e.clipboardData || window.clipboardData).getData('text/html');
  const plain = (e.clipboardData || window.clipboardData).getData('text/plain');

  if (html) {
    // Insert rich HTML so bold/colors/underlines are visible in the left pane
    inputBox.innerHTML = html;
  } else {
    // Fallback: just plain text
    inputBox.textContent = plain;
  }

  updateOutput();
});

// Re-run cleaning whenever the user types in the box or toggles an option
inputBox.addEventListener('input', updateOutput);
[optTrimLines, optCollapseSpaces, optCollapseBreaks, optStripHtml].forEach((el) =>
  el.addEventListener('change', updateOutput)
);

clearBtn.addEventListener('click', () => {
  inputBox.innerHTML = '';
  outputBox.value = '';
  autoResize();
  updateCounts('', '');
});

copyBtn.addEventListener('click', async () => {
  if (!outputBox.value) return;
  try {
    await navigator.clipboard.writeText(outputBox.value);
  } catch {
    outputBox.select();
    document.execCommand('copy');
  }
  const orig = copyBtn.textContent;
  copyBtn.textContent = 'Copied!';
  setTimeout(() => (copyBtn.textContent = orig), 1200);
});

function getPlainText(el) {
  // Walk the DOM tree and extract text, preserving line breaks
  let text = '';
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      const block = ['p','div','br','li','h1','h2','h3','h4','h5','h6','tr','blockquote'];
      if (tag === 'br') {
        text += '\n';
      } else {
        if (block.includes(tag) && text.length && !text.endsWith('\n')) {
          text += '\n';
        }
        node.childNodes.forEach(walk);
        if (block.includes(tag) && !text.endsWith('\n')) {
          text += '\n';
        }
      }
    }
  }
  walk(el);
  return text;
}

function stripHtmlTags(str) {
  return str.replace(/<[^>]*>/g, '');
}

function updateOutput() {
  // Get plain text from the rich left pane
  let text = getPlainText(inputBox);

  // Optionally strip visible HTML tags (e.g. <span>, <b> typed as text)
  if (optStripHtml.checked) {
    text = stripHtmlTags(text);
  }

  if (optTrimLines.checked) {
    text = text.split('\n').map((l) => l.trim()).join('\n');
  }

  if (optCollapseSpaces.checked) {
    text = text.replace(/[ \t]+/g, ' ');
  }

  if (optCollapseBreaks.checked) {
    text = text.replace(/\n{3,}/g, '\n\n');
  }

  // Trim leading/trailing blank lines
  text = text.replace(/^\n+/, '').replace(/\n+$/, '');

  outputBox.value = text;
  autoResize();
  updateCounts(inputBox.innerText, text);
}

function autoResize() {
  // Make output textarea grow to fit its content
  outputBox.style.height = 'auto';
  outputBox.style.height = Math.max(220, outputBox.scrollHeight) + 'px';
}

function countWords(str) {
  const t = str.trim();
  return t ? t.split(/\s+/).length : 0;
}

function updateCounts(input, output) {
  inputCount.textContent  = countWords(input) + ' words';
  outputCount.textContent = countWords(output) + ' words';
}

updateOutput();