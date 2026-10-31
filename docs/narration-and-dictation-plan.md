# Planned update: narration formatting and speech input

Status: planning only, 2026-10-31. Owner requests starred narrative text and client-side chat input by voice. Interpret “Text to Speech Input” as speech-to-text dictation, not reading replies aloud; confirm this interpretation before implementation if owner intended playback. No implementation, provider activity or production changes in this planning task.

## 1. Dialogue and narration

Use presentation plus a bounded story convention. Single-star paired nonempty spans such as `Hello. *She opens the window.*` render slightly italicized with the same readable contrast. Support user/assistant messages and opening scenes, retaining the separate Intro label. Preserve exact source text in persistence, context, revisions, export/restore and source inspection; old paired stars gain styling without data migration.

Use a small linear parser and safe text nodes/spans, not HTML or a general Markdown renderer. Preserve paragraphs. Escaped stars (`\*`), unmatched/empty pairs and double-star runs remain literal; no nested syntax or bold interpretation. Explicitly test multiline spans and literal arithmetic/asterisks. Narration formatting is optional and must never affect permissions.

Composer toolbar: localized “Mark as narration” button with >=48px target. Wrap selected text, or insert two stars and position caret between when no selection. Capture selection before toolbar focus changes, restore focus and preserve draft. Optional unwrapping only for an exactly wrapped selection; otherwise simple wrapping. Enforce existing total character limit including markers without truncation. Test emoji/surrogates, multiline selections, native undo and Android keyboard behavior. Reuse in latest-turn editor if feasible. Never auto-send or request inference.

### Semantic boundary

Starred text means fictional non-dialogue: action, setting, description or explicitly authored inner thought. It cannot reliably distinguish these categories. Give the model this convention, but do not introduce a typed-memory migration or derive state mechanically from spans. Observable actions may support existing validated source-linked extraction; private thoughts must not automatically become another character's knowledge. Beliefs, intentions and completed events remain distinct. Formatting does not itself advance fictional time, complete promises or change relationships. Fictional thoughts are narrative content, never model reasoning. Model adherence remains a quality target, not a guarantee.

## 2. Voice dictation into the composer

Prefer progressive enhancement and preserve keyboard input. Browser JavaScript being client-side does not guarantee audio stays on the device: browser recognition can use a remote service. No app audio upload, server speech provider, billed service or automatic fallback is proposed.

Current research: MDN compatibility data marks stable Chrome Android speech recognition support, but Firefox Android as preview. On-device recognition APIs (`processLocally`, language-pack availability/install) are not supported on Chrome Android in that data. Therefore neither the owner's Firefox support nor strictly local/offline recognition can be promised. Feature detection alone is not proof that microphone/service recognition works. Recheck at implementation time and test actual devices.

Sources: [MDN usage guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API), [MDN browser compatibility data](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/SpeechRecognition.json).

Proposed UX: retain normal textarea and explain Android keyboard microphone dictation as a fallback. That is an OS/keyboard feature outside app control; language, network and privacy behavior depend on the keyboard/provider. Offer an in-app microphone only where browser recognition is supported and verified. Disclose that the browser speech service may process audio remotely before enabling that route; do not label it local/offline. If local-only recognition becomes required, treat it as a separate feasibility decision rather than silently switching services.

One explicit tap starts a bounded dictation session; show listening, stop/cancel and recoverable errors. No background listening or automatic restart. Choose recognition language separately (English/German, default initially UI language with explicit override); changing UI locale does not translate drafts. Keep interim text separate from committed draft; append/replace at captured selection only after final recognition, preserving intervening typing rather than overwriting it. Stop on story switch/logout/page hide/send; discard stale callbacks using session/story IDs. Never send a message automatically. Handle denial, no microphone, unavailable language/network/service, interruption and unsupported browser while retaining typed input. Audio is not persisted by the application; final text uses existing private draft persistence. Service retention cannot be asserted on behalf of browsers.

## Delivery and acceptance

1. Implement narration parser/rendering and selection toolbar independently of speech support.
2. Add bounded prompt convention and tests retaining existing state-validation/source-isolation behavior.
3. Add speech controller behind capability detection with a deterministic fake recognition API; unsupported browsers get keyboard-dictation help.
4. Verify actual browser/device capability before offering a supported in-app mic. Do not mark Firefox dictation complete based on desktop Chrome or mocked API.

Acceptance: safe mixed-text rendering, literal/escaped markers, original-text roundtrip, source continuity, draft/revision preservation, selection/caret and length-boundary handling; dictation final/interim/error/cancel races, no automatic inference/send/retry, permissions and unsupported fallback; EN/DE accessibility and 360/390px screenshot review plus desktop. Real Android Firefox keyboard selection/dictation and any optional Chrome recognition checks remain owner-device gates.

Roles: Story/Memory owns narrative/context convention and evidence tests; Android Experience owns safe rendering/toolbar/dictation and bilingual accessibility; Security reviews microphone consent/browser-service disclosure and no audio persistence; Quality independently checks syntax, race/failure cases, snapshots and device evidence; Model Integration ensures no provider/auth changes or unexpected inference. Agree file ownership before implementation. Open decision: whether optional browser-managed remote recognition is acceptable; until settled implement no remote speech fallback and make no local-only promise.

## Owner preference update: local recognition (2026-10-31)

Phone-local recognition is strongly preferred. The browser-service suggestion above is superseded by the [local speech feasibility plan](local-speech-plan.md): evaluate pinned same-origin WASM/model inference in a browser Worker, with no automatic cloud or server fallback. Stable Android Firefox performance and offline model readiness must be proven on a real device before claiming support. Dictation is separate from reply read-aloud; narration formatting may proceed independently.

## Planned readability refinement (owner request, 2026-10-31)

Paired single-star narration must render as a separate paragraph-like block even when authored inline. Example raw input `Hallo. *Sie stellt die Tasse ab.* Wie geht es dir?` displays speech, then narration, then speech on separate paragraphs, with modest space before/after narration. This extends the existing italic/gray presentation; it is not implemented by this planning entry.

Use safe block-level layout within the message container (for example dedicated text and narration blocks), not injected HTML. Preserve raw stored text, source references, exports, selection wrapping and prompt semantics. If narration already begins on a new line, reuse that boundary rather than inserting an empty paragraph. Following speech always starts a new paragraph; consecutive narrative spans remain distinct with restrained spacing. Avoid leading/trailing blank paragraphs when narration begins/ends the message. Preserve intentional internal line breaks, including multiline narration. Literal escaped stars, empty/unmatched delimiters and double-star runs retain their existing behavior. All surfaces using the renderer, including user/assistant messages and authored openings, should behave consistently.

Acceptance: inline speech/narration/speech, leading/trailing narration, adjacent spans, existing newlines/blank lines, multiline text and literal stars; unchanged raw-text roundtrip and zero inference/state changes. Inspect EN/DE360px/390px/desktop for paragraph spacing and long replies; real Android remains separately verified. Dedicated chronological thought blocks remain explicitly typed content; stars alone do not identify a passage as private thought.

Readability refinement implementation2026-10-31: safe narration spans now display as paragraph-like blocks with modest margins; surrounding newline boundaries trimmed for layout only. Parser/raw persistence unchanged. Local narration tests pass; release visual/device evidence recorded in thought-reading-update.md.
