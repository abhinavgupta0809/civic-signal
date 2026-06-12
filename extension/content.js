// Injected on demand via chrome.scripting.executeScript({ files: ["content.js"] }).
// The IIFE's return value becomes `result.result` in the popup.
(() => {
  const MAX_CHARS = 6000;

  function pickArticleText() {
    const article = document.querySelector("article");
    if (article && article.innerText && article.innerText.trim().length > 200) {
      return article.innerText;
    }
    const main = document.querySelector("main");
    if (main && main.innerText && main.innerText.trim().length > 200) {
      return main.innerText;
    }
    // Last resort: full body. Many sites still produce reasonable text this way.
    return document.body ? document.body.innerText : "";
  }

  const raw = pickArticleText() || "";
  const text = raw
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_CHARS);

  return {
    title: (document.title || "").trim(),
    url: location.href,
    domain: location.hostname,
    text,
    length: text.length,
  };
})();
