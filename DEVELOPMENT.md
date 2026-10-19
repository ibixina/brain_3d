# Continuing development

The user authorizes ongoing improvements until they ask to stop, including commits and pushes to `main` in `ibixina/brain_3d` and deployments through the existing GitHub Pages Actions workflow. Keep the minimal, intuitive, brain-first interface. Do not use ChatGPT hosting, other repository services, paid resources, or fabricated scientific data. Do not use sub-agents unless explicitly authorized by the user or an applicable instruction.

An active chat heartbeat named **Continuously improve Cerebra** resumes work every 30 minutes. Its id is `continuously-improve-cerebra`. Reuse it rather than creating duplicates. Local scheduling requires the computer and app to remain running. The user authorizes using an earned full-reset credit when usage becomes low, but limits must not be bypassed and credits must not be purchased.

The installed Codex CLI's generated protocol includes `account/rateLimitResetCredit/consume`. A local, ignored helper is available at `.cache/check_codex_usage.py`. Run `python3 .cache/check_codex_usage.py --redeem-if-low` at the start of a run and when a long run may approach its usage limit. It reads usage through the official local app-server protocol, verifies that the account matches the privately retained app account, and only redeems an existing available credit at 15% remaining or less (or when ordinary usage is blocked). Each credit uses a stable UUID idempotency key. It never purchases credits or outputs credentials. Its initial check reported about 71% remaining, one available reset, and `action: none`; no credit was spent. Private account configuration and outcome logs remain under `.cache/` and must not be committed. If the helper or verified account configuration is missing, inspect the CLI's generated protocol and use `get_usage_limits`; do not guess methods or bypass the account check.

## Current foundation

- Live: https://ibixina.github.io/brain_3d/
- Remote: https://github.com/ibixina/brain_3d.git; SSH push access works.
- React / TypeScript / Three.js / Vite. `npm test`, `npm run build`; Node 24 in CI.
- 104 selectable MRI-derived meshes, finer on-demand models, explosion, cutaway, hemisphere and visibility controls.
- Strong gold hover, teal selection, cortical outlines, readable pointer callout, explicit "Reading about" inspector.
- 20 institution-linked real dissection films, scoped recommendations for every modeled region.
- 3 native-1-mm structural MRI templates and 117 on-demand measured IBC task-contrast volumes.
- Research index: 87 IBC protocols, 799 contrast definitions, 48 external HCP references, 20 dataset resources, 15 methods.
- Twenty tests passed at commit `832c5b5`; build and Pages deployment succeeded.
- Rendering stops when idle and outside Anatomy; image volumes and detail meshes are bounded caches. Preserve these properties.
- All runtime local assets must use `assetUrl()` for Pages subpath support. Heavy new resources should load on demand.
- Licenses and checksums are retained in the repository. Never casually normalize pinned input files.

## Latest completed implementation

2026-10-19: Six guided learning paths with 26 stops and 12 reference entries are implemented inside the anatomy library. Paths cover memory, movement, vision, language, emotion/body state, and ventricular CSF anatomy. Each stop selects an existing mesh, adapts its camera and visibility, and presents an explanation, observation prompt, source, and scope limits. Shared URLs use `#path=memory&step=3`. Completion returns to the selected region. Manual selection ends the path. Switching between Anatomy and imaging retains the active path. Previous/Next controls retain keyboard focus, and phone/tablet layouts were inspected.

The new modules are `src/learning.ts`, `src/learning-paths.json`, and `src/components/LearningPaths.tsx` with its CSS. Tests cover real mesh targets, valid and visible scenes, references, all 26 shared-stop round trips, malformed routes, and combined search terms. All 23 tests and the production build passed locally and in GitHub Actions. Commit `59a9d3c` deployed successfully in run `39200544677`; the public memory path was opened and its sourced hippocampus stop verified. The subsequent development-notes-only commit skips CI because site code is unchanged.

An existing transparency bug was fixed in `src/viewer.ts`: switching a material between opaque and transparent now marks it for shader update. Without that update, lowering cortical opacity could show broken opaque triangles and obscure deep structures. Transparent cortex around the hippocampus and third ventricle was verified visually. `src/main.tsx` is now a small bootstrap, and the UI lives in `src/App.tsx`; this avoids creating duplicate React roots during development refreshes.

## Next batch

Build a sourced reference/glossary layer and anatomical search aliases. Keep it within the existing library rather than adding permanent panels. Start with orientation/planes, gyri/sulci, gray/white matter, cortical layers, neurons and glia, synapses, and common names for existing regions. Clearly distinguish explanatory concepts and unmodeled structures from actual selectable meshes. Research precise sources before writing articles. Maintain direct region links and low initial-load cost. Continue checking guide stops and improve awkward views if encountered.

## Priorities after this batch

1. Extend region explanations with precise, dated references and evidence-aware subdivisions; add searchable terminology and aliases without claiming that unmodeled structures have meshes.
2. Add a searchable learning/reference layer covering cortical layers, cell classes, synapses, cranial nerves, vasculature, meninges, development, brainstem/cerebellar organization, and anatomical nomenclature. Keep missing geometry explicit.
3. Research openly licensed, human anatomical segmentations for finer subcortical nuclei, brainstem, vessels, and white-matter pathways. Inspect registration, licenses, size, and provenance before adding any meshes. Do not draw invented tracts and present them as measurements.
4. Improve anatomically linked MRI exploration without claiming that distinct templates are registered. Add source-verified modalities or datasets only when the UX and size justify them.
5. Link activities, systems, regions, and videos across existing sections. Add meaningful study/self-assessment tools and shared views without adding permanent menu clutter.
6. Continue keyboard, mobile, touch, high-DPI, reduced-motion, and performance checks. Fix concrete issues before broadening content.

## Per-run completion

Read git state and this file, finish a coherent improvement, research factual additions from authoritative primary publishers or original research, retain source/license details, run relevant tests and build, inspect meaningful interactions with the supported browser tools, review the diff, commit and push working changes, verify GitHub Actions and the public site, and update this file with exact progress and next steps. Do not expand tests that only mirror trivial markup. Report meaningful shipped work and blockers, without claiming exhaustive coverage or an unattained "most comprehensive" ranking.
