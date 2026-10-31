# Narration and local speech prototype release

Narration: single-star spans render as fictional narration in chat/openings; original text and source IDs are preserved. The localized composer/revision toolbar wraps selection or inserts paired stars. Escaped/unmatched/double stars are literal; no arbitrary HTML/Markdown execution. Context distinguishes unspoken thoughts, intentions and observed completed events. This is a narrative convention, not a new state-extraction channel. Existing histories gain styling without rewriting stored text. Native Android selection/keyboard and undo remain device checks.

Local STT: isolated feasibility surface at `/speech-spike/` after normal Storychat login. It is deliberately not a production composer microphone yet. Model/runtime files are pinned, checksummed and bundled at image build; browser download is explicit. No external runtime fetch, audio upload, server recognition or remote fallback. Reviewed text remains in the prototype; copy it manually only if wanted. Runtime/source inspection and deterministic tests do not establish Android performance or network privacy.

## Upgrade and rollback

Record old image digest and back up private state using existing recovery instructions. Re-pull published latest (or pin release digest) and recreate the existing stack, retaining all volumes/environment. No new volume, sign-in or ingress change required. The image is larger because it contains the prototype speech pack. No data schema migration in this update. For rollback select the prior tested digest and recreate retaining volumes; do not delete story/media/provider/key storage. Remove the optional speech cache through the prototype before rolling back if desired. Ordinary backup/restore recovery procedures still apply.

## Owner narration checks in Firefox and Chrome Android

On the selected device, type `Hello. *I open the door.*` and verify differentiation, then select text and tap Mark as narration. Test no selection, emoji, multiline selection, maximum-length rejection, language switching and latest-turn edit. Verify raw stars remain when editing/exporting and the draft survives background/reload. Review contrast, 48px controls and keyboard focus. No send should occur from the formatting button. Live model convention quality is separate from deterministic state integrity.

## Owner STT gate

In each browser independently, log in then open `/speech-spike/`. Download the local model, load recognizer, choose recognition English/German. Record a short original sentence (5–10 seconds), stop and inspect editable result and timing. Repeat five clips, then test15seconds, silence/noise, cancellation and microphone denial. Note browser version, model load/transcription time, corrections needed, crashes/UI responsiveness and thermal symptoms. Proposed initial target:10-second clip transcribed within10seconds after stop; this is a proposed usability gate, not a verified result.

After the recognizer is loaded, disable networking and repeat recognition; this tests warm offline inference, not offline app startup/login. Restore networking to continue normal story use. Inspect basic traffic for unexpected destinations; a full no-audio-upload assertion also needs code/network review, not just success offline. Hide/lock/navigate away while recording and verify microphone indicator stops; return must not auto-record or insert late results. Test normal tabs and home-screen launch in both browsers, cache removal/re-download and separate browser storage. Do not use private speech for initial tests.

Report results separately for Firefox EN/DE and Chrome EN/DE. Until both pass, composer STT integration remains gated. Failure leaves typing available and must never trigger a cloud fallback.


Desktop feasibility evidence (2026-10-31): original synthetic English SAPI fixture transcribed exactly as “The blue lantern is beside the window. Please open the garden gate.” Pinned WASM model loaded1233ms, first transcription2128ms. With the preview server then stopped, the already-loaded engine produced the same transcript in1485ms. This establishes warm inference without that server; it is not a comprehensive network audit, fresh offline app startup, real microphone test or Android/German acceptance. Audio fixture and screenshot evidence stay in ignored analysis/data.
