(() => {
  const hits = [];
  document.querySelectorAll('img').forEach(im => {
    if ((im.src || '').includes('false')) hits.push('img: ' + im.src.slice(0, 80));
  });
  document.querySelectorAll('div,span').forEach(e => {
    const cs = getComputedStyle(e);
    if ((cs.maskImage || '').includes('false') || (cs.backgroundImage || '').includes('false'))
      hits.push('css: ' + (cs.maskImage || cs.backgroundImage).slice(0, 80));
  });
  return hits.length ? JSON.stringify(hits) : 'nessun riferimento nel DOM attuale';
})()