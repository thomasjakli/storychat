# Next update: English and German interface

Status: planned, 2026-10-30; no implementation yet. This accompanies character cover uploads in the next update and does not reopen deferred media generation.

## Confirmed requirements

- Provide English and German for the user interface.
- Default to English on a fresh device/browser profile, regardless of the operating system or browser language.
- Save the owner's choice per device, rather than in the account, story or server configuration.

## Proposed implementation

- Use shared message keys and complete English/German dictionaries in the existing buildless frontend. Avoid a framework or translation-service dependency for this scope.
- Offer an accessible language selector labelled English / Deutsch, available on the login screen and when signed in. Switching applies immediately without a reload, model request or loss of an unsent draft.
- Store only the validated locale code (`en` or `de`) in browser localStorage, using a dedicated preference key. Read it on startup before rendering. Missing, invalid or inaccessible storage falls back to English; if saving is blocked, keep the selection for the current page session.
- In browser delivery, per-device means per browser profile and application origin. Another browser/profile or cleared site storage starts in English. Browser-managed storage synchronization may vary; no server synchronization is implemented or promised. The preference survives logout because it contains no story/account data. Draft cleanup must not remove it.
- Set the document `lang` attribute and update page title, navigation, forms, placeholders, buttons, accessible names, dialogs, loading/empty/error states, install help and media-upload controls. Format displayed dates/numbers with the selected locale without changing stored values.
- Translate application errors through stable error codes and local fallback messages. Never display raw provider responses or introduce translated secrets/log content. Keep server/API codes, persisted enum values and CLI/operator documentation stable; frontend labels translate their presentation.
- Treat character names/definitions, personas, transcripts, memories, authored thoughts and user-written prompts as content: switching UI language does not translate or rewrite them, change story language, adjust writing controls or alter model instructions. German story text works with either UI language.
- Preserve safe text rendering and escape interpolation. Missing translation keys fall back to English; meaningful parity checks must catch missing German strings before release. Do not assemble translatable sentences from word fragments.

## Acceptance checks

1. Fresh profile starts in English even if the browser prefers German.
2. Selecting German updates all existing and subsequently opened screens/dialogs, including authentication, errors and upload controls; selecting English reverses it.
3. Selection persists across reload, logout/login and browser restart on that profile. Another independent profile retains its own language. Clearing storage restores English.
4. Invalid locale values and unavailable storage fail safely to English without blocking login/chat; current-session switching remains usable.
5. Changing language preserves drafts, story state, memories, writing controls, media associations and active-request polling; it performs no inference request.
6. German labels fit narrow Android layouts and the virtual keyboard; accessibility labels, document language and date formatting match selection. Verify actual Android Firefox separately from desktop checks.
7. Dictionary parity, dynamic errors and both-language owner journeys pass with synthetic/fake-provider data. No personal content or external translation service is used.

Implementation should share interfaces with cover-upload work so newly introduced strings ship in both languages. Android Experience owns dictionaries/selector/rendering; Quality tests parity, storage failure and device isolation; the coordinator reviews any new server error codes. This plan does not authorize a deployment change.


Implementation update (2026-10-31): active local-character/cover/localization scope implemented with synthetic verification; see project.md for evidence and pending Android acceptance. Earlier proposals describe the design baseline, not proof of device acceptance. External retrieval, private character trial and generation remain deferred.
