(() => {
  const all = Array.from(document.querySelectorAll('div'));
  const withBgImg = all.filter(e => (getComputedStyle(e).backgroundImage || '').includes('data:image'));
  return JSON.stringify({
    count: withBgImg.length,
    first: withBgImg[0] ? {
      w: withBgImg[0].getBoundingClientRect().width,
      h: withBgImg[0].getBoundingClientRect().height,
      size: getComputedStyle(withBgImg[0]).backgroundSize,
      snippet: getComputedStyle(withBgImg[0]).backgroundImage.slice(0, 50),
    } : null,
  });
})()