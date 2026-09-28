// Upload a test bg image via DataTransfer into the bg image input
(async () => {
  const fs = require('fs');
  const path = require('path');
  const { execSync } = require('child_process');

  const b64 = fs.readFileSync('download/e2e-candy/test-bg-upload.png').toString('base64');
  const js = `
    (async () => {
      const inputs = [...document.querySelectorAll('input[type=file]')];
      // the bg slot input lives inside the 'Immagine sfondo' field row
      const row = [...document.querySelectorAll('span')].find(x => x.textContent.trim() === 'Immagine sfondo');
      const container = row.closest('div').parentElement.parentElement;
      const input = container.querySelector('input[type=file]');
      if (!input) return 'input-not-found among ' + inputs.length;
      const res = await fetch('data:image/png;base64,${b64}');
      const blob = await res.blob();
      const file = new File([blob], 'test-bg.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return 'uploaded';
    })()
  `;
  const out = execSync(`agent-browser eval "${js.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { encoding: 'utf8', timeout: 30000 });
  console.log(out);
})();
