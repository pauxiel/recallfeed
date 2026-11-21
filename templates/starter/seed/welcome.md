## What this app is

**This is a RecallFeed app.** You import notes, they become cards, and the feed brings them back in an order you choose. This page reads the feed from the shared API; nothing in the shared packages was changed to build it.

## How a note becomes cards

**Each section of a Markdown file becomes one note, and each note becomes an `original` card.** A note with a quotation also gets a highlight card:

> The best way to remember something is to meet it again.

## Make it yours

**Change `wrangler.toml`, replace `public/`, and add your own notes.** The visibility, the ordering and the card types are all settings. Your app and the other RecallFeed apps run the same backend code.
