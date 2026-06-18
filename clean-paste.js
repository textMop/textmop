// Clean Paste — strip formatting from pasted text

const inputBox = document.getElementById('input-box');
const outputBox = document.getElementById('output-box');
const inputCount = document.getElementById('input-count');
const outputCount = document.getElementById('output-count');
const copyBtn = document.getElementById('copy-btn');
const clearBtn = document.getElementById('clear-btn');

const optTrimLines = document.getElementById('opt-trim-lines');
const optCollapseSpaces = document.getElementById('opt-collapse-spaces');
const optCollapseBreaks = document.getElementById('opt-collapse-breaks');

// Strip formatting on paste — insert plain text only
inputBox.addEventListener('paste', (e) => {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text/plain');
  document.execCommand('insertText', false, text);
});

// Re-run cleaning whenever the input changes or options change
inputBox.addEventListener('input', updateOutput);
[optTrimLines, optCollapseSpaces, optCollapseBreaks].forEach((el) =>
  el.addEventListener('change', updateOutput)
);

clearBtn.addEventListener('click', () => {
  inputBox.textContent = '';
  updateOutput();
});

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(outputBox.value);
    const original = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(() => (copyBtn.textContent = original), 1200);
  } catch (err) {
    outputBox.select();
    document.execCommand('copy');
  }
});

function updateOutput() {
  let text = inputBox.innerText;

  if (optTrimLines.checked) {
    text = text
      .split('\n')
      .map((line) => line.trim())
      .join('\n');
  }

  if (optCollapseSpaces.checked) {
    text = text.replace(/[ \t]+/g, ' ');
  }

  if (optCollapseBreaks.checked) {
    text = text.replace(/\n{2,}/g, '\n');
  }

  outputBox.value = text;
  inputCount.textContent = countWords(inputBox.innerText) + ' words';
  outputCount.textContent = countWords(text) + ' words';
}

function countWords(str) {
  const trimmed = str.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

// Initialize counts on load
updateOutput();
