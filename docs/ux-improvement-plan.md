# Reading-first UX improvement plan

Recorded 2026-11-01 following the owner-authorized assessment. Implementation now exists on `ux/reading-first`; the findings below retain the assessment record. See [verification and owner review](ux-review-guide.md). Owner mobile acceptance and explicit merge approval remain pending.

## Evidence and scope

Two independent roles reviewed navigation/editor flows and accessibility/recovery source. The coordinator inspected an isolated fake-provider instance with original synthetic content at 360px English, 390px German and 1280px English. Screens included story list, chat, thought generation pending, settings, filters, character details and related-story selection. No production conversations, infrastructure or application code were changed. Real Android keyboard, lifecycle and screen-reader behavior were not tested.

The existing visual direction and readable speech/narration distinction should be retained. Improve hierarchy, reading space, navigation continuity and recovery before introducing cosmetic redesign or new product scope.

## Findings and planned changes

| Priority | Finding and evidence | Planned outcome |
| --- | --- | --- |
| High | Thought Replace/Delete/Source controls and generation explanations compete with reading; visible in mobile/desktop review. Sources are repeated in memory. | One accessible contextual actions menu per thought; group sources and keep memory inspection available. Compact, optional generation action with clear busy/cancel/error states. |
| High | Source review: stories lack story-specific routes; opening a story scrolls to the composer. Settings-only font controls interrupt reading. | Stable story URLs, per-story reading-position restoration, browser back/reload recovery and in-chat reading preferences. Preserve unsent drafts and distinguish following-latest from reading older content. |
| High | Source review: character/new-story forms reset and lack persona-equivalent draft persistence. | Consistent autosave/restored-draft feedback/discard across editors. Explain partial saves when multi-step creation fails. |
| High | Source review: notebook import UI rejects over 8 MiB although media-aware exports may be larger. | Align client/server format and size limits or provide an explicit compatible restore flow. Exercise an isolated picture-heavy export/import above 8 MiB. Keep bounds, validation and atomic rollback. |
| Medium | Mobile branding/navigation/headings and full filters push results below initial viewport. | Compact recurring headers and headings; visible search/sort, optional advanced filters, known category/tag choices rather than unexplained exact-match text. Retain filter counts/reset feedback. |
| Medium | Character/persona detail pages expose many competing actions; Settings retains a second legacy library manager. | Prioritize Start/Continue or Use persona plus Edit. Group administrative actions and consolidate canonical management/editor flows. Clarify whether Continue opens a story or a chooser. |
| Medium | Source review: story cards lack search, recency, persona identity and last-message previews. | Searchable recent-first story list with useful identity/preview cues; independent story contexts remain explicit. |
| Medium | Source review: item preview shows text and picture-presence notice, but no thumbnail or actionable draft status. | Preview picture, item type, ready/draft state, missing definition and new-copy consequence; offer Edit after draft import. |
| Medium | Source review: source jumps close inspector without target focus/return; repeated Source names lack context. Dialog headings are not programmatically linked; mobile modal background containment is incomplete. | Labelled source targets/viewer and return path, specific accessible source names, named dialogs, consistent containment and focus restoration. Verify rather than infer keyboard/TalkBack behavior. |
| Medium | Source review: screen switching lacks deliberate focus/active navigation semantics; polling replaces descendants and may remove focused controls. | Deliberate destination orientation, active navigation semantics and keyed updates or focus restoration during refresh. No surprise jumps for background updates. |
| Medium | Settings mixes reading, legacy management, transfer/install and destructive cleanup; notices can be global and technical. | Group Reading, Device, Backup/transfer and Storage maintenance. Contextual actionable feedback distinguishes uncertain request status from confirmed failure without unsafe retries. |
| Lower | Definition/provenance/framing terminology exposes implementation concepts. | Clear behavior/personality guidance, collapsed provenance, understandable picture framing and restrained counters. Preserve original data and exact transfer semantics. |

Source-backed findings are not all reproduced interaction defects. Validate each condition before fixing; adjust scope when evidence disproves an assumption. Accessibility suggestions do not establish conformance.

## Delivery sequence

1. Reading/navigation: thought menus, compact generation/header/composer layout, contextual text size, stable routes and reading anchors.
2. Trust/recovery: drafts, partial-save feedback, import compatibility/preview, source navigation and modal focus.
3. Discovery/consistency: canonical editors/settings, story search/recency/persona cues, progressive filters, framing/copy improvements.

Agree UI state, route, draft-storage and import-preview contracts before parallel work. Assign distinct ownership; the coordinator integrates shared files. Use Android Experience Developer, UX and Accessibility Reviewer, independent Quality/Continuity Tester, and Security/Story roles where recovery or snapshot contracts are affected. Do not weaken source evidence, story isolation, permissions, idempotency or supported provider access to simplify UI.

## Acceptance and evidence

- Chat prioritizes text with no permanent wall of administrative actions; every moved action remains discoverable and keyboard accessible.
- Browser back/reload/settings return to the same story and passage; drafts remain intact. New replies do not pull an older reader to the bottom.
- Closing/reopening/reloading long character, persona and story forms preserves drafts or presents explicit discard behavior.
- Supported exports, including pictures above 8 MiB, work through the documented import path; malformed/oversized inputs still fail safely without partial writes.
- Import previews show picture/type/status and clearly add a new copy. Existing library records and story snapshots are not overwritten.
- Focus does not remain inside hidden panels or disappear on polling; source inspection offers a reliable return path. Modal semantics and active navigation are coherent.
- Review English/German at 360px, 390px and desktop; min/default/max chat size, long stories/labels, empty/loading/disabled/error states, prior mobile filter alignment and primary-button contrast regressions.
- Separate automated and viewport evidence from real Android Firefox/Chrome, keyboard, background/reconnect and assistive-technology checks.

## Owner-approved branch and review workflow

Implement this substantial update on a separate branch, proposed `ux/reading-first`; do not merge into master or update production/latest before owner feedback and explicit merge approval. A draft PR is appropriate after implementation and automated review, but is not approval to merge. Do not force-push or rewrite unrelated work.

Run an isolated locally hosted test instance for the owner, with synthetic content, fake inference and separate data/media/password/port. Never mount production provider/key storage. Do not change external infrastructure. Determine an already authorized device-accessible route with the owner when needed; loopback alone does not establish phone accessibility.

The owner will perform final mobile review later, not necessarily when development finishes. Continue agent implementation and independent review first; then leave the branch unmerged with a reproducible preview launcher, exact launch/access instructions, test evidence, known limitations and a feedback checklist. State whether the preview is actually running and that process lifetime is not guaranteed after the session/PC ends. Preserve test data and restart instructions for delayed review. No automatic merge or production rollout based on elapsed time.

After owner feedback, resolve issues and repeat relevant checks. Merge, publish latest and deployment remain separate owner-authorized steps. Branch CI may verify code/container without publishing; a branch test image is optional only if explicitly authorized and must not replace latest.

## Agreed branch implementation contracts (2026-11-01)

Routes: #story/:id joins existing character/persona/settings routes. Save per-story reading anchor (message ID + viewport offset, following-latest flag) in browser-local versioned storage; restore after rendering and leave drafts independent. Expose window.StoryUX helpers for accessible action disclosure, editor draft persistence and dialog naming only when cross-module sharing is needed; library agent coordinates exact functions with core UI owner. Keep semantic native details/disclosure for action menus rather than bespoke ARIA menu unless keyboard behavior is fully implemented.

Drafts: per type/record versioned keys, original text retained; success clears only matching draft, explicit Discard clears editor draft. Async callbacks guarded by story/session/editor epoch. Source inspection focuses target and provides return to memory; background updates preserve focused action when possible.

Notebook client uses server-advertised transfer limits (new GET /api/transfer-limits) rather than divergent8MiB; server validation remains authoritative. POST /api/items/preview may return validated thumbnail data URL and ready/draft metadata; never execute imported HTML or fetch remote media. Story library summary may add lastActivity,lastMessage (bounded preview) and persona name without leaking full private contexts. No persistence schema change needed for UX.

Ownership: core Android owns public/app.js,index.html,style.css,i18n.js; library developer owns public/explorer.js,personas.js, optional new public/ux-library.js and its tests, coordinating hooks with core; security owns app/server.mjs,store summary only if necessary, media preview helper, preview launcher/scripts and backend tests. Coordinator owns branch/CI/docs/integration and independent review. Review final container runtime allowlists for newfiles.
