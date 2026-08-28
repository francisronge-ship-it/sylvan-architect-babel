# July 2026 Deep-Audit Plan Disposition

The original files in this directory are preserved unchanged. Their drift
checks, paths, priorities, and executor instructions describe the 2026-07-05
checkout and must not be rerun.

| Plan | Live disposition on 2026-08-25 |
| --- | --- |
| 001 missing ledger helper | Superseded when the legacy ledger path was removed. |
| 002 typecheck | Done; `npm run typecheck` is part of `verify:all`. |
| 003 offline fixtures and tests | Done; provider-free fixtures and Node tests are the default gate. |
| 004 dependency security | Original advisory set is obsolete. Dependency auditing remains continuous work in the master roadmap. |
| 005 Vercel abuse controls | Rejected with the old Vercel surface; future hosting gets a new scoped security design. |
| 006 provenance completeness | Superseded by the current generation record, W17 evidence records, and benchmark provenance boundaries. Contract qualification remains active in the master roadmap. |
| 007 OpenAI background cancellation | Done and directly tested. |
| 008 Replay extraction | Done; Replay construction is Node-importable. File-size goals were never product acceptance criteria. |
| 009 relation classifier | Superseded by the completed Tier-1/Tier-2/Tier-3 renderer. |
| 010 Vercel parse logging | Superseded; the old logging path was removed. |
| 011 fixed-ledger registry | Superseded when the fixed ledger architecture was removed. |
| 012 AGENTS.md | Done and maintained as the repository contract. |

No file in this directory is an active TODO. Current unfinished work is in
[`ROADMAP.md`](../../../../ROADMAP.md).
