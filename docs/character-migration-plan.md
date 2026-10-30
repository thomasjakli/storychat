# Next update: character fields and private migration trial

Status: planning only, 2026-10-30. Extend the character-upload and English/German interface update. No private character or story has been imported, and no deployment change is made by this plan.

## Confirmed additions

- Separate **Intro / Einführung** from **Opening scene / Eröffnung** in the character editor.
- Display the intro at the beginning of a new chat in a distinct, subdued narrative style, followed by the opening scene. Preserve the distinction from ordinary dialogue.
- Provide a character gender selector.
- Use the owner's selected character as a private first migration trial, including its uploaded cover, before migrating additional characters and their stories.

Screenshots establish the requested fields and visual distinction, not another application's internal memory or prompt behavior. They do not authorize copying third-party assets or text into public source, fixtures or documentation. Public examples must remain original synthetic content.

## Proposed field and rendering contract

| Field | Purpose and behavior |
| --- | --- |
| Name | Character identity, preserved as entered |
| Gender | Optional explicit metadata: unspecified, woman, man, nonbinary/other with optional self-description; localized labels over stable stored values. Exact labels are a proposal. Do not infer gender from the cover, name or appearance; do not infer pronouns from gender |
| Definition | Personality, background, appearance and boundaries; independent of intro and opening |
| Intro | Short authored introduction/premise. Render as an introductory narrative block before the opening, with an accessible type label and readable contrast in both themes/languages supported by the app. Subdued does not mean inaccessible low contrast |
| Opening scene | Initial authored scene and any opening dialogue, preserving paragraphs and permitted emphasis. It remains distinct from intro and does not trigger an inference request on creation |
| Cover | Managed private uploaded asset, with the preview/crop/versioning behavior in the media plan |

Treat intro as a typed authored block, not an ordinary user message, model reasoning or an automatically extracted thought/memory. Fictional thoughts may share a visual treatment, but retain their distinct semantic label. Include the intro and opening as story background in bounded model context, with source identity where used as evidence; do not convert their display into synthetic completed events or relationship updates. No arbitrary HTML, scripts or remote-resource markup is accepted. Safe minimal emphasis/paragraph rendering is sufficient; HTML authoring shown in a reference screenshot is not requested functionality.

Snapshot all character fields and cover references when starting a story. Later library edits must not rewrite that story's original intro, opening, gender or cover. Existing definitions migrate with empty intro and unspecified gender; preserve the existing opening field and existing transcripts exactly. Do not insert an intro retroactively into existing stories. Keep duplication, archive, export/import and lossless backup validation compatible through an explicit schema migration.

Proposed limits: intro 4,000 characters; opening 12,000 characters to accommodate longer authored scenes, with client/server limits aligned. Verify request-body, export and context budgets before implementation. Show counters and useful validation errors; never silently truncate imported text. Longer content needs an explicit decision or a lossless alternate import path.

## Private one-character trial

1. Deliver upload support, new fields, localized controls and migrations using synthetic fixtures first.
2. Prepare the chosen character only in private runtime or ignored local analysis storage. Keep screenshots, attribution, character text, image binaries and any story transcript outside Git, image builds and ordinary logs. Do not use them as bundled defaults.
3. Review a field-mapping preview with the owner: name, gender, definition, intro, opening and cover. Preserve original German text regardless of selected interface language. Mark absent/unknown fields as unknown rather than inventing a definition, age or hidden background from screenshots.
4. The supplied image is a screenshot with application chrome. Prefer a clean original image if available; offer an owner-controlled crop/preview rather than publishing or silently editing the screenshot. Artwork containing another depicted figure remains cover artwork; it does not automatically create another chat participant.
5. Start a fresh private test story. Verify intro appears once, before the opening, in the distinct narrative style; no duplicated opening and no generation until the owner sends a message. Verify cover display/crop, gender persistence, paragraph/emphasis handling, both UI languages, reload/restart and export/restore.
6. After owner acceptance, consider additional characters. Existing-story migration is a separate follow-up: requires an available export/transcript and explicit mapping of roles, ordering, timestamps, source references and fictional time. Images of partial conversations cannot establish a complete conversation history or hidden memory state. Do not fabricate missing turns or claim continuity from a newly created character alone.

## Acceptance and scope boundaries

- Older definitions/stories load unchanged; new fields survive edit/duplicate/archive, restart, snapshotting and backup/restore.
- Intro, opening, dialogue and authored thoughts remain distinguishable in display and stored meaning. Source inspection and memory rules still work.
- English/German labels and validation translate; authored story text does not. Gender and language are independent and no pronouns are inferred.
- Oversized, malformed or HTML-bearing inputs fail safely or render as escaped text; no silent truncation or active markup.
- Android Firefox checks cover upload/crop, long-opening readability, keyboard behavior and intro rendering. Desktop tests remain separate evidence.
- The actual character trial is owner-run/private; ordinary tests use synthetic characters. No mass migration, production overwrite, model request or media generation is authorized by this planning entry.

Message-based image/video generation stays shelved pending provider discussion. This trial does not add voice selection, public character publication, multi-character stories, tags or arbitrary HTML simply because those controls appear in reference material.


Implementation update (2026-10-31): active local-character/cover/localization scope implemented with synthetic verification; see project.md for evidence and pending Android acceptance. Earlier proposals describe the design baseline, not proof of device acceptance. External retrieval, private character trial and generation remain deferred.
