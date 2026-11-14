# RecallFeed Project Skills

This directory contains project-local Kiro skills used during RecallFeed development.

## Installed Skills

### 1. planning-and-task-breakdown
Decomposes work into small, verifiable tasks with explicit acceptance criteria.

**Source:** Addy Osmani's agent-skills repository  
**URL:** https://github.com/addyosmani/agent-skills  
**License:** MIT  
**Author:** Addy Osmani

### 2. incremental-implementation
Delivers changes incrementally in thin, verifiable slices.

**Source:** Addy Osmani's agent-skills repository  
**URL:** https://github.com/addyosmani/agent-skills  
**License:** MIT  
**Author:** Addy Osmani

### 3. spec-driven-development
Creates specifications before coding.

**Source:** Addy Osmani's agent-skills repository  
**URL:** https://github.com/addyosmani/agent-skills  
**License:** MIT  
**Author:** Addy Osmani

## License and provenance

These three skills are third-party material, copied from Addy Osmani's
[agent-skills](https://github.com/addyosmani/agent-skills) repository, which is
licensed under the MIT License, `Copyright (c) 2025 Addy Osmani`.

The complete original license and copyright notice is kept unmodified, byte for
byte, in [`LICENSE-agent-skills`](./LICENSE-agent-skills) (git blob SHA
`d67778ada6b9cda6227e9130da182c13e73c8b2e`, upstream `LICENSE` on `main`, checked
2026-11-14). It must stay with any copy of these skills.

Each local `SKILL.md` was checked byte for byte against the upstream history on
2026-11-14 (current upstream `main` is commit
`39b723ceebf81474d0557c1fecd01eddab585563`). All three are unmodified copies:

| Skill | Identical to upstream commit | Relation to current upstream `main` |
|---|---|---|
| `incremental-implementation` | `cda4542ade0f3c532494b9a48837eb01d39925f1` (2026-09-07) | Same as `main`. |
| `planning-and-task-breakdown` | `8300e1bbe77a9f1610a0e9da624593c3d5dea020` (2026-08-28) | Older. Upstream later added a `Source spec:` line (2026-10-31). |
| `spec-driven-development` | `0004999461827d22fd3513d647fa7e7f72d6bf9c` (2026-10-15) | Older. Upstream later added "Spec Evolution" material (2026-10-31, 2026-11-07). |

This repository's own license (root `LICENSE`, MIT, `Copyright (c) 2026 pauxiel`)
covers RecallFeed's original work and does not replace Addy Osmani's copyright in
these skills.

## Usage

These skills are loaded automatically by Kiro when operating in this workspace. They guide the agent's planning, implementation, and specification processes during RecallFeed development.
