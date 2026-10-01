# From the litter box

Notes filed here from the KittyChat Café's litter box by `litterbox/sort.py`. Each ends with the file it came
from. Edit them freely: the sorter only adds, and never files a note that is already here.

## Waiting on Charlotte

### 1 October 2026: branches that never reached main

- **`claude/grocery-app-html-push-27p0bw`** (5 September) can go. It was written for the single bookmarked
  page (`data/artifact-url.txt`), before each week got its own page, and it now conflicts in four files. Its
  idea is kept below. *— litterbox/2026-10-01-branches-grocery.md*

- **`claude/meal-planning-app-reorganize-pddufg`** is on `main` in other commits: the protein library and the
  plain week were rebuilt on 28 September, and the built page is ignored. CLAUDE.md says to delete it with
  `claude/trusting-tesla-a9rmyl` once the Kitchen work is done, not before. *— litterbox/2026-10-01-branches-grocery.md*

## Ideas not built

### 1 October 2026: branches that never reached main

- **A drift check before republishing**, from `claude/grocery-app-html-push-27p0bw`: read the published page
  back, strip the publish skeleton, and compare it with what the build makes, so a change that exists only on
  the live page (the shopping icons, d89307a) is never published over without a word. Its
  `scripts/sync-artifact.mjs` also reversed the data injection to prove the template rebuilds the page byte
  for byte. *— litterbox/2026-10-01-branches-grocery.md*
