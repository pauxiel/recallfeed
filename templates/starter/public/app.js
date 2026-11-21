// The starter's page: read the feed from the API on this same address and draw it.
//
// Cards are drawn with textContent, never as HTML, so nothing in a note can inject markup or script. The
// _headers file adds a Content-Security-Policy that would block it anyway.

const PAGE_SIZE = 10;

const list = document.getElementById("feed");
const status = document.getElementById("status");
const more = document.getElementById("more");

let cursor = null;
let loading = false;

async function load() {
  if (loading) return;
  loading = true;
  more.hidden = true;
  status.textContent = "loading…";
  try {
    const url = new URL("/feed", window.location.origin);
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (cursor !== null) url.searchParams.set("cursor", cursor);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const page = await response.json();

    for (const card of page.items) {
      const item = document.createElement("li");
      const label = document.createElement("small");
      label.textContent = card.cardType;
      const text = document.createElement("p");
      text.textContent = card.content;
      item.append(label, text);
      list.append(item);
    }

    cursor = page.nextCursor;
    more.hidden = cursor === null;
    status.textContent = list.children.length === 0 ? "No published notes yet. Run the seed script." : cursor === null ? "end of feed" : "";
  } catch {
    status.textContent = "The feed could not be loaded. Try again in a moment.";
    more.hidden = cursor === null && list.children.length > 0;
  } finally {
    loading = false;
  }
}

more.addEventListener("click", load);
void load();
