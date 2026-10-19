import { readFileSync, writeFileSync } from "node:fs";
import {
  datasets,
  modalities,
  interpretationSources,
} from "../src/imaging-resources.ts";
const root = new URL("../", import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL("public/imaging/manifest.json", root)),
);
const index = JSON.parse(
  readFileSync(new URL("public/imaging/protocols.json", root)),
);
const link = (name, url) => `[${name}](${url})`;
const notes = (assetRoot) => `# Brain scans and activity maps: research compilation

Research snapshot: October 18, 2026. This is a curated educational compilation with complete coverage of the specific snapshots listed below. It is not a systematic review of every neuroimaging paper or an exhaustive collection of every human scan.

## What can be explored locally

- **Three anatomical MRI sequences**: T1-weighted, T2-weighted, and proton-density-weighted ICBM152 nonlinear asymmetric 2009c population templates. The source combines 152 participants; it is not an individual person's MRI. Spatial sampling is retained at 1 mm. The data are brain-masked and intensity-scaled for display.
- **117 measured task-contrast Z maps**: one example of every distinct contrast for participant sub-01 in ${link("IBC NeuroVault collection 4438", "https://neurovault.org/collections/4438/")}, using the earliest image ID when uploads repeat. These span 12 paradigms. They are single-participant examples, not group averages or comprehensive measurements of how everyone performs an everyday activity.
- **Linked slice navigation**: axial, coronal, and sagittal MRI views share crosshairs in MNI coordinates. Left is left on axial and coronal images. The sagittal view runs posterior-to-anterior from left to right.
- **Real statistical overlays**: both positive and negative contrasts are retained. Warm colors represent A greater than B; cool colors represent B greater than A. The display threshold and overlay opacity are adjustable.

A high Z statistic is not a percentage of brain activation. The default |Z| ≥ 3 display threshold is a visualization choice and is not a corrected inferential threshold. No multiple-comparison correction or cluster inference is performed in this viewer. An uncolored region is not necessarily inactive. Maps compare conditions and can include visual, response, attention, and other components of an experiment.

BOLD fMRI measures a physiological response related to blood oxygenation, rather than recording individual neuronal spikes. Task differences do not establish that a region uniquely implements a mental process. No raw 4D BOLD time series, temporal animation, clinical interpretation, patient upload, or individual diagnosis is included.

## Spatial processing and performance

${manifest.processing}

The coordinate grid for maps is ${manifest.grid.shape.join(" × ")} voxels with origin [${manifest.grid.origin.join(", ")}] mm and spacing [2, 2, 2] mm. X increases toward right, Y toward anterior, and Z toward superior. Data are stored with X varying fastest. Source affine matrices, native shapes, direct URLs, file sizes, and SHA-256 checksums appear in ${link("the image manifest", `${assetRoot}/manifest.json`)} and the source-input checksum file in the repository.

During drawing, the nearest 2 mm statistical voxel is sampled onto the 1 mm structural background. The anatomical background is the ICBM152 2009c template; the IBC maps are in generic MNI space. Sharing coordinates does not remove template differences or individual variation. Overlay alignment is approximate. No registration to the separate FreeSurfer 3D surface is claimed. Source contrasts are labelled using the IBC definition table; this resolves reversed reading/listening prose in two image metadata records. Motor averages mean the other movement conditions; category averages mean the other stimulus categories.

The imaging interface is loaded only when its section is opened. Individual image volumes load on demand, with four decoded volumes retained in memory. Slices are drawn only when image data, coordinates, or display controls change. The 3D render loop pauses while the imaging section is active. All imagery is bundled locally; external providers are contacted only when the user follows source links. Native gzip decompression is required for the imaging viewer.

## Research coverage

| Compilation | Count | Meaning |
| --- | ---: | --- |
| Local structural sequences | 3 | Population MRI templates, not three participants |
| Local activation examples | 117 | Distinct contrasts from IBC participant sub-01 |
| IBC paradigms represented by local maps | 12 | First-release task families |
| Documented IBC protocols | ${index.protocols.length} | All protocol sections on the task-page snapshot |
| IBC contrast-definition rows | ${index.contrasts.length} | All rows in the checked public TSV; not all locally bundled maps |
| Archived HCP map references | ${index.hcp.length} | 47 Z maps plus one T map from a separate 486-person cohort |
| Imaging and recording method families | ${modalities.length} | Guides; only explicitly marked examples are local |
| Dataset and repository resources | ${datasets.length} | Source links with access notes |

The 87 protocol entries and 799 contrast rows come from related but different snapshots. Some protocol variants share definitions, and some protocols have no matching row in the table. In particular, seven generic Preference rows are not repeated under the four stimulus-specific Preference protocols. Each row remains available in the full contrast index. A protocol is an experimental procedure, not necessarily a single everyday activity.

HCP reference maps are linked from ${link("NeuroVault collection 457", "https://neurovault.org/collections/457/")}; they are **not** the local IBC examples, even where task names overlap. The HCP collection states specific access and use terms. No HCP map volumes, participant-level HCP data, or other access-controlled imaging were downloaded. External releases and provider requirements may change.

## Imaging and recording methods

| Method | Measures / use | Limitation | Source |
| --- | --- | --- | --- |
${modalities.map((m) => `| ${m.name} | ${m.measures} ${m.use} | ${m.limit} | ${link("Source", m.source)} |`).join("\n")}

## Dataset and repository directory

| Resource | Scope | Access | Local content | Source |
| --- | --- | --- | --- | --- |
${datasets.map((d) => `| ${d.name} | ${d.description} | ${d.access} | ${d.local ? "Selected derivative or metadata" : "External link"} | ${link("Provider", d.url)} |`).join("\n")}

Access notes are for discovery, not a grant of permission. No account was created and no provider agreement was accepted on the user's behalf. Dataset licenses and access rules must be read at the provider before reuse.

## Complete documented protocol index

Each linked protocol provides its experimental procedure, conditions, contrasts, and available demonstrations. Domains below are factual ontology tags, displayed with spaces for readability. Raw contrast definitions are downloadable as ${link("TSV", `${assetRoot}/ibc-contrasts.tsv`)} and the full compilation as ${link("JSON", `${assetRoot}/protocols.json`)}.

| Protocol | Selected domains | Contrast rows matched to this name | Original documentation |
| --- | --- | ---: | --- |
${index.protocols.map((p) => `| ${p.title} | ${p.domains.slice(0, 4).join(", ")} | ${p.contrasts.length} | ${link("Protocol", p.source)} |`).join("\n")}

## Local map inventory

All local maps are Z statistics from IBC participant sub-01. Session identifiers are retained from the source. The collection includes session-specific maps and fixed-effects combinations across phase-encoding directions; no additional pooling is performed here. No participant identity was sought or inferred. The source page and filename remain available for audit.

| Task | Contrast | Session | Original map |
| --- | --- | --- | --- |
${manifest.maps.map((m) => `| ${m.task} | ${m.contrast} | ${m.session} | ${link(String(m.imageId), m.source)} |`).join("\n")}

## Source snapshots and reproducibility

The exact contrast file is retained in the project. Its repository commit at research time is ${index.contrastCodeCommit}. Recorded snapshot hashes:

${index.sources.map((s) => `- ${link(s.url, s.url)} — SHA-256: ${s.sha256}`).join("\n")}

Use a Python virtual environment with scripts/requirements.txt and run scripts/build_imaging.py to reproduce image assets from the retained source selection. Source checksums are validated on subsequent builds. Node.js can regenerate these notes with scripts/build_research_notes.mjs. This app does not automatically ingest future releases.

## Primary methods and interpretation references

${interpretationSources.map((s) => `- ${link(s.name, s.url)}`).join("\n")}
- ${link("Fonov et al.: template methodology", "https://doi.org/10.1016/j.neuroimage.2010.07.033")}
- ${link("OpenNeuro IBC source-data release and CC0 declaration", "https://openneuro.org/datasets/ds000244/versions/1.0.0")}

## Attribution and reuse

ICBM templates: Copyright (C) 1993–2004 Louis Collins, McConnell Brain Imaging Centre, Montreal Neurological Institute, McGill University. The original permission and warranty notice is retained in public/imaging/MNI-LICENSE.txt. Source templates were modified as described above.

IBC: Pinho, Amadon, Ruest, and colleagues, Individual Brain Charting, a high-resolution fMRI dataset for cognitive mapping, Scientific Data 5, 180105 (2018), DOI 10.1038/sdata.2018.105. Maps originate from NeuroVault collection 4438; NeuroVault's public-data CC0 statement is linked above. The selection is modified for compact display. The definition table is retained from the public IBC analysis-code repository; its BSD license and notices are in public/licenses/ibc-analysis-code.txt. The protocol index retains factual names, tags, and source links, rather than copying long protocol descriptions.

HCP: The WU-Minn Human Connectome Project: An overview, Van Essen and colleagues (2013), DOI 10.1016/j.neuroimage.2013.05.041. Only factual metadata and external links are compiled. No affiliation or endorsement by any institution or dataset author is implied.
`;
writeFileSync(new URL("IMAGING_RESEARCH.md", root), notes("public/imaging"));
writeFileSync(new URL("public/imaging/IMAGING_RESEARCH.md", root), notes("."));
console.log(
  `Wrote research notes: ${index.protocols.length} protocols, ${index.contrasts.length} definitions, ${manifest.maps.length} local maps.`,
);
