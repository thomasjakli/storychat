# Device-local chat font size

Status: implemented, local/Linux/container verification and rendered review passed; published, 2026-10-31.

## Confirmed behavior

Let the owner adjust chat message text size for comfortable longer reading. Save preference per browser/device profile, like interface language. Never resize interface labels, controls, navigation, memory-panel text or other UI typography. No provider requests, server preference or story-state change.

## Proposed interaction and implementation

Use accessible Decrease text size / Increase text size buttons and Reset to default, grouped under Chat text size in Settings. Optionally expose the same compact controls from chat reading preferences; avoid crowding the composer. Localize labels in English/German. Use five bounded steps, proposed85%,100%,115%,130%,150%, default100%; settle final range through visual testing. No exact numeric entry needed. Announce selected relative size; disable decrement/increment at bounds with readable contrast.

Apply a dedicated CSS custom property scoped to message-body content only, never the page root or a shared UI container. Cover user/assistant dialogue, narration, opening/intro bodies and future chronological thought-block bodies consistently. Speaker names, thought/intro labels, timestamps, action buttons, composer input, memory inspection and import previews retain their existing sizes. Existing browser zoom and accessibility text settings remain functional; do not disable text adjustment. Allow line height to scale naturally and avoid fixed-height message bodies.

Use a separate versioned localStorage key with a strict allowed-value set. Apply the valid preference before rendering messages; unknown/corrupt/missing values fall back to default. If storage is unavailable, adjustment still works for the current page session. Persist through reload/logout/relogin; clearing site data resets it. Preferences are independent across browser profiles, not guaranteed hardware-wide or synchronized between Firefox/Chrome. Do not include in character/persona/story exports or provider context. Language changes and story navigation must preserve it.

Adjusting text size preserves raw text, narration delimiters/source references, unsent drafts, focused controls and story state. Preserve reading position as closely as possible using a visible message/text anchor; stay at bottom only when already following latest content. Never jump an earlier reader to the newest message or cause inference. Handle long German words, multiline narration, mixed paragraphs and concurrent incoming content.

## Acceptance

Test bounded controls/reset, saved reload, invalid/blocked storage, language switching and independent profiles; verify computed UI sizes remain unchanged while message bodies resize. Verify no new API/inference call or story mutation. Inspect original synthetic long conversations EN/DE at360px,390px and desktop at minimum/default/maximum sizes, including narration/intro/future thought panels, touch targets, overflow and scroll anchoring. Real Android Firefox/Chrome owner checks remain separate. No production change during planning.

Implementation decision2026-10-31: five proposed steps adopted, default100%, key storychat.chatTextSize.v1, Settings controls with live status; scoped to message bodies, not composer or labels. Final rendered review required.
