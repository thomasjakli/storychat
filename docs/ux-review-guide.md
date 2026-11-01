# UX branch owner review

Branch: ux/reading-first. Implemented and locally verified; owner mobile review pending. Not merged, not deployed, no latest update.

## Preview isolation

The preview uses original synthetic content, fake inference and its own persistent data/media/password/port. It must never mount production provider/key storage. Default address http://127.0.0.1:8796 is local to the Windows PC; a phone cannot reach that loopback address. An existing owner-approved route can be configured later without automatically changing tunnels/DNS/firewalls.

Access: http://127.0.0.1:8796/ on the host PC, password `synthetic-preview-password`. See [preview launcher and retained data](ux-preview.md) for exact restart instructions. Keep retained test data for delayed review. A running process is not guaranteed to survive session completion, PC sleep/reboot or process cleanup; restart instructions are required. No live ChatGPT quality claim is made from fake responses.

## Mobile review checklist (later owner session)

- English/German, normal and large text: conversation reading space, compact generation, thought actions discoverability, no filter/primary-button contrast regression.
- Read an older passage, change size and visit Settings/memory/source then return. Confirm same story/passage, draft and browser back/reload behavior. New replies must not pull an older reader to the bottom.
- Open/close thought menu with touch/keyboard, inspect source and return, replace/delete on a synthetic story, and observe explicit generation loading/cancel/error. No inference should happen on browsing or opening menus.
- Write long character/persona/new-story drafts; close/reopen/reload; restore/discard deliberately. Review partial-save feedback.
- Search/sort stories and filter characters; distinguish persona/context, start a new story versus resume/choose existing.
- Import native character/persona items: thumbnail/type/draft warning/new-copy consequence. Exercise picture-containing notebook restore only in isolated storage.
- Keyboard/focus/TalkBack: named dialogs, modal containment, source return, active navigation and background updates. Record what was actually tested.
- Background/reconnect/restart, including unsent drafts and uncertain request states.

## Feedback and merge gate

Report browser/device, language/text size, screen/action, expected/actual behavior and screenshot if useful. Owner feedback and explicit merge approval are required; elapsed time is not approval. Agents can finish tests/review first and leave a draft PR, reproducible preview and known limitations. Production rollout remains a separate action.

## Verified branch changes and limits

Native thought/story/detail disclosures, compact navigation/composer, in-chat reading controls, story routes/anchors, story search/recency/persona previews, consistent drafts/discard, progressive filters, known tag/category suggestions, thumbnail/status import previews, server-advertised transfer limits and accessible source/dialog handling implemented. Existing storage/model contracts preserved.

Synthetic backend test covers a media-containing export/import above8MiB. Final Windows suite: 114 application tests passed, 2 Linux-only skipped; 61 adapter tests passed, 1 Linux-only skipped. Rendered review found and fixed reading-anchor overwrite after navigation, German sort clipping and generic editor wording. Actual browser anchor matched the exact message and offset after Settings/Back/reload. Character draft close/reopen retained exact entered text with restored notice.

Rendered screens inspected:360EN library/chat/menu/editor;390EN large-text chat/menu;390DE default chat/settings/filters;360DE large text and library cards;1280EN import preview with validated picture/type/ready label/new-copy explanation. Final review also covered 360DE minimum-size chat, 1280EN minimum-size long chat, 390DE failed generation and 360DE failure recovery. Following-latest status growth now scrolls after layout to the actual document end, with all recovery actions above the composer; older readers are preserved. German mobile navigation wraps within the viewport. Final fresh-load review confirms installation help remains in Device after deferred library initialization. No real Android, TalkBack or installed-app acceptance claimed.

Known bounded behavior: filter suggestions use first100character summaries; framing remains focal-point sliders, not a freeform crop editor. Native disclosure menus are intentional; they do not implement desktop-style arrow-key menu semantics. Fake preview replies are deliberately synthetic and do not establish live writing quality. Browser storage clearing removes local drafts/preferences/anchors.

## Branch verification and review handoff (2026-11-01)

[Implementation commit](https://github.com/thomasjakli/storychat/commit/cc2e10bde207b02583b260cbb30192e03747ef49), [draft PR #1](https://github.com/thomasjakli/storychat/pull/1). [Branch CI](https://github.com/thomasjakli/storychat/actions/runs/41353042266) and [PR CI](https://github.com/thomasjakli/storychat/actions/runs/41353076067) passed: Linux 116 application tests and 62 adapter tests, zero skips, parameterized Compose, amd64 build and actual container lifecycle/recovery checks including isolated restore. Publish job skipped; latest unchanged. No branch image was published.

Preview was responding on loopback8796 at handoff; retained synthetic data is present. Its process can stop with session cleanup, sleep or reboot. Restart with the launcher in ux-preview.md. Phone route is deferred at owner request. Branch remains unmerged and draft pending owner mobile feedback and explicit merge approval.
