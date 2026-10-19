# Continuing development

The user authorizes ongoing improvements until they ask to stop, including commits and pushes to `main` in `ibixina/brain_3d` and deployments through the existing GitHub Pages Actions workflow. Keep the minimal, intuitive, brain-first interface. Do not use ChatGPT hosting, other repository services, paid resources, or fabricated scientific data. Do not use sub-agents unless explicitly authorized by the user or an applicable instruction.

An active chat heartbeat named **Continuously improve Cerebra** resumes work every 30 minutes. Its id is `continuously-improve-cerebra`. Reuse it rather than creating duplicates. Local scheduling requires the computer and app to remain running. The user authorizes using an earned full-reset credit when usage becomes low, but limits must not be bypassed and credits must not be purchased.

The installed Codex CLI's generated protocol includes `account/rateLimitResetCredit/consume`. A local, ignored helper is available at `.cache/check_codex_usage.py`. Run `python3 .cache/check_codex_usage.py --redeem-if-low` at the start of a run and when a long run may approach its usage limit. It reads usage through the official local app-server protocol, verifies that the account matches the privately retained app account, and only redeems an existing available credit at 15% remaining or less (or when ordinary usage is blocked). Retried attempts reuse a persisted UUID idempotency key; an explicitly ineligible attempt may be tried later as a new attempt. It never purchases credits or outputs credentials. Seven simulated RPC scenarios checked healthy usage, read-only mode, no available credit, account mismatch, eligible usage, interrupted-request retry, and a later attempt after ineligibility. Real checks reported about 71% remaining, one available reset, and `action: none`; no real credit was spent. Private account configuration and outcome logs remain under `.cache/` and must not be committed. If the helper or verified account configuration is missing, inspect the CLI's generated protocol and use `get_usage_limits`; do not guess methods or bypass the account check.

## Current foundation

- Live: https://ibixina.github.io/brain_3d/
- Remote: https://github.com/ibixina/brain_3d.git; SSH push access works.
- React / TypeScript / Three.js / Vite. `npm test`, `npm run build`; Node 24 in CI.
- 104 selectable MRI-derived meshes, finer on-demand models, explosion, cutaway, hemisphere and visibility controls.
- Strong gold hover, teal selection, cortical outlines, readable pointer callout, explicit "Reading about" inspector.
- 20 institution-linked real dissection films, scoped recommendations for every modeled region.
- 3 native-1-mm structural MRI templates and 117 on-demand measured IBC task-contrast volumes.
- Research index: 87 IBC protocols, 799 contrast definitions, 48 external HCP references, 20 dataset resources, 15 methods.
- Twenty-seven tests pass locally, including the new reference and alias checks; the previous live site passed its build and Pages deployment.
- Rendering stops when idle and outside Anatomy; image volumes and detail meshes are bounded caches. Preserve these properties.
- All runtime local assets must use `assetUrl()` for Pages subpath support. Heavy new resources should load on demand.
- Licenses and checksums are retained in the repository. Never casually normalize pinned input files.

## Latest completed implementation

2026-10-19 (reference batch): Added 12 sourced, searchable reference notes in the existing anatomy library, covering directions, section planes, folds, gray/white matter, cortical layers, neurons, glia, myelin, synapses, human cell diversity, atlas boundaries, and functional names. Each note includes explicit model limits, links to actual meshes, related topics, precise source links and evidence types, and a checked date. References use shareable `#reference=ID` routes, with copied-link feedback and graceful unknown-note handling. The existing region inspector is hidden while reading a reference and restored on close, keeping one reading panel. Links from region Anatomy notes explain model resolution and absent cellular detail.

`src/reference-data.json` contains original summaries and provenance; `src/reference.ts` searches the catalogue; `src/components/ReferenceLibrary.tsx` and its CSS are lazy loaded. The reference JS and CSS total about 7.9 kB gzip, fetched only on opening Reference. No third-party text, images, cells, geometry, or new scientific datasets are redistributed. The default geometry, caches, idle rendering behavior, and image loading remain unchanged.

`src/anatomical-search.ts` adds ten sourced terminology mappings: Heschl, Broca, M1, S1, V1, dorsal/ventral striatum, lentiform nucleus, pallidum, and inferior frontal gyrus. Search now combines terms, normalizes punctuation and accents, and respects hemisphere restrictions. Approximate/composite aliases explain their limits in source-linked search notes. The index is constructed once; region results are memoized across unrelated UI updates. A search for `left Heschl’s gyrus` resolves to the real left transverse temporal parcel; Broca maps to classical left inferior frontal landmarks without claiming exact functional borders.

Keyboard fixes: Ctrl/Cmd K always restores structure search even after another library tab; Escape works inside inputs and closes a panel before clearing the selected region/path; reset closes panels. Library tabs have connected tabpanel semantics and support ArrowLeft/Right, Home, and End. Article links focus the heading, while keyboard tab switching retains tab focus. Returning from an article restores search focus.

Sources checked October 19, 2026: authored UTHealth Neuroscience Online chapters (overview, cells, action-potential propagation, transmitter release, CNS synapses, language; motor/visual/basal-ganglia chapters for aliases), Purves' cortical-structure chapter (2001), FreeSurfer's cortical parcellation documentation, Langseth et al.'s original human cortical mapping study (2021; DOI `10.1038/s42003-021-02517-z`), Siletti et al.'s adult human transcriptomic study (2023; DOI `10.1126/science.add7046`), and Allen Institute's human cell-atlas documentation. Some direct NCBI Bookshelf pages returned bot checks; their indexed publisher excerpts supported the foundational lamination/myelin facts. Source figures and prose were not copied. Cell taxonomies are described as study-specific, and human/mouse and atlas/functional/cellular measurements remain distinct.

Validation: all 27 Node tests pass, including real alias targets, hemisphere constraints, combined search, valid reference/mesh links, and retained sources. Production build passes. Browser checks covered shared-route reload, reference search, copying, article-to-model links, deep hippocampus visibility, single-panel reading, Ctrl K, Escape, keyboard tab focus, mobile article scrolling and source access at 390×844; browser error logs were empty. Deployment verification follows the push.

Previous batch remains implemented: six guided paths with 26 stops and 12 reference entries, route sharing, adaptive camera/visibility, observation prompts and scope notes. Commit `59a9d3c` deployed in run `39200544677`. The transparency shader update and React bootstrap split remain intact.

## Next batch

Expand the reference layer with meninges/CSF and barriers, cranial nerves, arterial and venous supply, brain development, and brainstem/cerebellar internal organization. Research precise academic/original sources before adding summaries, keep absent geometry explicit, and add useful links to existing MRI, guided paths, and dissection lessons. Consider a small contextual return link from a model opened by an article so readers can resume the exact note. Keep the default canvas free of new permanent controls.

## Priorities after this batch

1. Extend region explanations with precise, dated references and evidence-aware subdivisions; add searchable terminology and aliases without claiming that unmodeled structures have meshes.
2. Add a searchable learning/reference layer covering cortical layers, cell classes, synapses, cranial nerves, vasculature, meninges, development, brainstem/cerebellar organization, and anatomical nomenclature. Keep missing geometry explicit.
3. Research openly licensed, human anatomical segmentations for finer subcortical nuclei, brainstem, vessels, and white-matter pathways. Inspect registration, licenses, size, and provenance before adding any meshes. Do not draw invented tracts and present them as measurements.
4. Improve anatomically linked MRI exploration without claiming that distinct templates are registered. Add source-verified modalities or datasets only when the UX and size justify them.
5. Link activities, systems, regions, and videos across existing sections. Add meaningful study/self-assessment tools and shared views without adding permanent menu clutter.
6. Continue keyboard, mobile, touch, high-DPI, reduced-motion, and performance checks. Fix concrete issues before broadening content.

## Per-run completion

Read git state and this file, finish a coherent improvement, research factual additions from authoritative primary publishers or original research, retain source/license details, run relevant tests and build, inspect meaningful interactions with the supported browser tools, review the diff, commit and push working changes, verify GitHub Actions and the public site, and update this file with exact progress and next steps. Do not expand tests that only mirror trivial markup. Report meaningful shipped work and blockers, without claiming exhaustive coverage or an unattained "most comprehensive" ranking.
