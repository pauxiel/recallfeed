# Contributing to RecallFeed

This is the working agreement for changing this repository. It is interim: the steering
documents name `docs/setup.md` as the canonical onboarding document, and that file does not
exist yet. Until it does, this file covers setup and workflow.

`tasks/todo.md` is authoritative for what is planned and what state each task is in.
The approved specifications in `.kiro/specs/` and the steering documents in `.kiro/steering/`
are authoritative for design. Do not change them to make a task easier.

## Setup

You need the Node version in `.nvmrc` (currently 22.23.3; `package.json` allows
`^22.13.0 || >=24.0.0`) and the pnpm version pinned in `package.json` (`packageManager`).

```sh
pnpm install --frozen-lockfile
pnpm lint && pnpm build && pnpm typecheck && pnpm test
```

Always install from the lockfile inside the checkout you are working in. Do not symlink or
share `node_modules` between checkouts. A shared or restored `node_modules` is not proof that
dependencies match the lockfile.

### Database integration tests

`pnpm test` runs without a database, and the database-backed suites **skip**. A green
`pnpm test` is unit-only and is not full validation. Run the integration suite and read the
skipped count:

```sh
pnpm --filter @recallfeed/database db:test:up          # needs a container runtime, for example Colima
pnpm --filter @recallfeed/database test:integration    # prints 0 skipped when the database is used
pnpm --filter @recallfeed/database db:test:down        # discards the disposable data
```

Details, the reset safeguards, and limits are in `packages/database/README.md`.

**Run one database integration at a time.** The Compose project name (`recallfeed-test`) and the
proxy port (`127.0.0.1:4444`) are fixed, so every checkout of this repository addresses the same
database service. A separate Git workspace does not give you a separate database. Do not reset,
recreate, or stop a database that another session may be using. Parallel databases would need a
distinct Compose project name, proxy port, and matching driver configuration for each checkout;
that is not built.

## Branches and workspaces

- Use **one dedicated branch and one isolated workspace per approved phase or meaningful
  milestone**. Keep the existing phase numbering. Gate 2 Phase 1 is complete; do not start a
  new "Phase 1".
- Branch names use a prefix: `phase/<milestone>` for planned phase work (for example
  `phase/gate2-phase2-markdown-slice`), and `feat/`, `fix/`, `docs/`, `chore/` otherwise.
- Never rewrite `main` history to adopt this workflow. New branches start from the approved
  `main` commit. Existing commits stay as they are.

### Optional: Treehouse

[Treehouse](https://github.com/kunchenguid/treehouse) gives each branch its own directory.
It is optional. Contributors and judges can use ordinary `git worktree`, a plain clone, or a
single checkout. Nothing in the build or the tests depends on it.

Before acquiring a workspace, confirm the starting commit. `--base main` picks whichever of
local and remote `main` is further ahead, and prefers remote if they diverge.

```sh
git fetch origin
git rev-parse main origin/main            # confirm the approved base; stop if they differ unexpectedly
treehouse get --lease --base main -b <branch> --lease-holder <name> --json
```

Record the returned path and lease id. Then, before editing:

```sh
git rev-parse --show-toplevel             # must be the new directory, not the primary checkout
git rev-parse HEAD                        # must equal the approved base commit
pnpm install --frozen-lockfile            # inside the new directory
```

Every command must actually run in the new directory. A `cd` in one shell call does not carry to
the next, so set the working directory on each call.

Do not automatically copy `.env*`, `.dev.vars`, credentials, private notes, `node_modules`, or
build output into a workspace. The disposable test database defaults need no secrets, and the
scripts read the process environment, not an `.env.test` file. `treehouse.toml` sets only
`base_branch`. Treehouse lifecycle hooks are user-level and are not relied on here, so perform
and check required setup explicitly.

## Commits

- Make small, conventional commits, one per coherent change: `feat:`, `fix:`, `docs:`,
  `chore:`, `test:`, `refactor:`. Use the imperative mood.
- Put a change's tests and documentation in the same commit as the change when they belong
  together.
- There is no commit quota. One task may take several commits, and several small related
  changes may share one. Do not split files arbitrarily to raise the count.
- Do not add an agent co-author trailer.
- Run the relevant checks before committing. Never commit secrets, `.env` files, or
  `.dev.vars`. `.kiro/` is always committed and never ignored.

## Recording state in `tasks/todo.md`

Keep `tasks/todo.md` authoritative, and keep these five states separate:

| State | Meaning | Evidence to record |
|---|---|---|
| Implemented | the change is committed | commit SHA |
| Self-tested | the author ran the checks | exact commands, versions, results, skipped counts |
| Independently reviewed | someone other than the author checked it | reviewer, date, verdict, commit reviewed |
| Pushed | the commit is on the remote | remote, branch, SHA read back from the server |
| Merged | the branch tip is contained in `main` | the merge or fast-forward commit |

Running your own tests is self-testing, not review. A passing unit-only run is not integration
validation. Record skipped tests.

## Review, push, and merge

- Submit a review request in `.kiro/reviews/requests/` at each approved boundary, then stop.
  It must name the workspace directory, branch, and commit it describes. See
  `.kiro/reviews/README.md`.
- A push or a merge needs explicit approval unless it was already authorized for that exact
  scope. Approval of a review is not approval to push.
- Push with a plain `git push`. Never force-push. Before pushing, confirm the destination,
  that the working tree is clean, that HEAD is the reviewed commit, and that the push is a
  fast-forward of the remote branch.
- Preserve atomic history. Integrate with a merge commit or a fast-forward. **Do not
  squash-merge by default.** A merge commit is the recommended phase boundary.

## After an approved merge

Clean up only after the work is integrated and delivered, in this order:

1. Confirm the branch tip is in `main`: `git merge-base --is-ancestor <branch> main`.
2. Confirm required remote delivery: `git ls-remote origin refs/heads/main` returns the expected SHA.
3. In the workspace, confirm `git status --porcelain` is empty, and that any local artifact
   you need (logs, evidence, review requests) is committed or copied somewhere safe.
4. Stop only this workspace's own processes. Do not stop a shared database that another
   session may be using.
5. Return that exact workspace **without force**: `treehouse return <path>`. This detaches the
   directory and leaves the branch.
6. Delete the merged branch only after it is no longer checked out anywhere:
   `git branch -d <branch>`. Use the safe `-d`, which refuses to delete unmerged work.

Never discard unfinished work, force a cleanup, or rewrite `main` to make cleanup succeed. If a
step fails, stop and find out why.

## Optional supervisor notifications

`.kiro/hooks/scripts/notify-firstmate.sh` sends a review request to a local supervisor inbox.
It is optional and does nothing unless you configure it, so building and testing never need it.
Configure it locally by exporting `FM_HOME`, or by putting `FM_HOME=<path>` in
`${XDG_CONFIG_HOME:-$HOME/.config}/recallfeed/firstmate.env`. That file is outside the repository.
Never commit a personal path or credential. The script identifies the actual workspace, branch,
and commit it ran in, and checks that the review request is committed. `--dry-run` prints the
notification without sending it.
