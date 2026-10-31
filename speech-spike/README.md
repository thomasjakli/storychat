# Local speech feasibility prototype

Experimental standalone owner-authenticated page at `/speech-spike/`; not connected to the chat composer pending real-device acceptance. Chat messages are never submitted here. The current candidate is Transformers.js3.8.1 (Apache-2.0) and multilingual Whisper tiny quantized (MIT), pinned model revision `ff4177021cc41f7db950912b73ea4fdf7d01d8e7`. See bundled license notices. Model download manifest is `assets.json`; the pack is approximately63.1MiB including runtime. Download size is not runtime memory.

## Packaging

`node speech-spike/prepare-assets.mjs <destination>` downloads only manifest-selected runtime/model files from official npm/Hugging Face sources. Runtime archive SRI and all extracted/model SHA256+bytecounts are checked. Model source URLs use the pinned revision. At runtime all files are served by this instance; remote model loading is disabled and engine fetch rejects non-origin/non-speech asset paths. Files are not source-controlled; Docker prepares the pack during build. No private recordings or speech artifacts belong in Git.

## Verified desktop evidence, 2026-10-31

An original synthetic English fixture was generated locally with Windows SAPI (no microphone), saying: “The blue lantern is beside the window. Please open the garden gate.” The in-app Chromium browser ran the actual bundled WASM engine, single CPU thread, q8: model loaded in1233ms; first transcription2128ms, exactly matching that sentence. After stopping the isolated Storychat server, the already-loaded engine transcribed the same fixture identically in1485ms. This establishes warmed local inference without a running Storychat server for that sample, not a complete network-egress audit, fresh offline launch, German accuracy, or Android compatibility. No live ChatGPT request or private microphone capture occurred.

## Owner device gate

Required targets: the owner's Android device in both Firefox and Chrome, tested separately. General Android device compatibility remains unproven.

1. Deploy the tested image, sign into Storychat normally, then open `/speech-spike/` on the same origin.
2. Select English/German interface, tap Download, observe approximately63.1MiB pack consent/progress, then Load. Each browser/profile has its own cache. Do not clear ordinary site data to remove the model; use Remove model.
3. Tap Record, speak an original5–10-second sentence in the selected recognition language, then Stop. Maximum recording15seconds; model startup120seconds and transcription60seconds are hard bounds. Review/correct text; no automatic sending. Record load/transcription times shown.
4. Repeat five times in both English and German in each browser. Proposed usability target:10-second speech clip transcribed within10seconds after Stop with responsive UI and no crash. Report actual results rather than assume this threshold met.
5. After page/model are ready, disable phone networking and repeat a short recording. Verify locally before restoring network. This is warmed recognition, not offline login or story generation.
6. Deny microphone permission, cancel, background/lock the phone, return, and verify capture stops and requires deliberate reload/start. Test remove/re-download and browser restart/cache eviction. Test ordinary tabs and available home-screen launch modes separately.
7. Watch accuracy, silent/noisy-input hallucinations, heat, battery and memory pressure. If unusable, report failure; there is no cloud/server fallback. Typing remains available in Storychat.

Audio lives only in bounded memory, released on stop/cancel/visibility/pagehide; original bytes are not persisted by this page. Review textarea content is not saved. Runtime/model cache contains static public model assets only. Microphone/audio lifecycle and stale async outcomes have deterministic fake-controller tests, but real hardware permissions/background behavior still need the owner. Browser/OS memory erasure and speech-provider behavior outside this app are not promised.

