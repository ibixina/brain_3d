# Cerebra

An interactive human brain atlas built with React, TypeScript, Three.js, and Vite. Geometry, image volumes, and fonts are bundled with the site. Exploration runs in the browser without accounts, API keys, or external dataset API requests.

**Live atlas:** https://ibixina.github.io/brain_3d/

## Run

Requires Node.js 22.18 or later; the deployment workflow uses Node.js 24.

```sh
npm install
npm run dev
```

Open the Local URL printed by Vite. To generate a static production build:

```sh
npm run build
npm run preview
```

The output is `dist/`. The geometry is included in this repository, so Python is **not** needed to run or build the app.

## GitHub Pages

Pushing to `main` runs `.github/workflows/deploy-pages.yml`: install locked dependencies, run the tests, build, and deploy `dist/` to GitHub Pages. The repository's Pages publishing source must be **GitHub Actions**. No deployment secrets are required; the workflow uses GitHub's scoped token.

The workflow reads the site's base path from GitHub Pages, including `/brain_3d/` for this repository. Asset requests and downloads respect that path. Shared views use URL fragments and work without server routing rules. To preview the same project path locally:

```sh
npm run build -- --base=/brain_3d/
npm run preview -- --base=/brain_3d/
```

Open `/brain_3d/` on the preview server. A normal `npm run dev` or `npm run build` continues to use `/`.

## Explore

The brain occupies the full canvas. There are no permanent sidebars: the search icon in the bottom dock opens the searchable anatomy library, and selecting a region opens a focused inspector. Closing the inspector restores the unobstructed view. On narrow screens it becomes a compact sheet below the model. Tissue colors are the default; **View → Surface color** enables anatomical group colors.

- Drag to rotate; scroll or pinch to zoom; right drag or use two fingers to pan.
- Click the model or search the anatomy library by structure, hemisphere, or function.
- Structure-list choices, related-region links, and shared region URLs restore a view suited to the target: the matching hemisphere, medial or inferior camera where useful, and transparent cortex around deep structures. Buried parcels and enclosed compartments open in isolation using their real detail meshes. These are viewing presets, not additional anatomy.
- Hover to highlight a part in gold and see its name, hemisphere, anatomical group, and a short description. The selected part stays teal, matching the **Reading about** panel; cortical parcel boundaries are outlined. Hover labels clear during dragging, and slow rotation pauses while inspecting a part.
- Use **Isolate & inspect** to load a finer anatomical surface for the selected region.
- Use **Reveal** beneath the region name to restore its viewing preset after rotating, hiding groups, or changing cutaways. **Whole brain**, leaving isolation, and closing details restore both hemispheres and the default visibility settings.
- Use **Explode** and the separation slider to separate visible lobes or individual parcels.
- Use the eye controls to show or hide anatomical groups.
- The **View** control includes hemispheres, cortical opacity, section planes, labels, natural tissue colors, and slow rotation.
- Anatomy and Connections tabs provide additional context. Related-region links are curated relationships, not a measured connectome.
- Save regions in browser storage, copy region links, or export a PNG of the model.
- Keyboard: Ctrl/Cmd K searches, E toggles explosion, L toggles labels, R resets. In structure search, Enter opens a single match and Down focuses the first result. Selecting a structure focuses its heading; closing details returns focus to the library button. Escape closes an open library or settings panel, then clears the selected region. Library and region-detail tabs support Left/Right, Home, and End.

## Guided learning paths

Choose **Explore guided learning paths** on the opening view, or **Learning paths** inside the anatomy library. Six paths cover memory and learning, movement, vision, language, emotion and bodily state, and ventricles and CSF. Their 26 stops use real existing meshes, adapt the camera and visibility, and connect a short explanation with a precise source and an observation prompt.

Use Previous and Next to navigate, the path name to choose another path, and the close control to return to free exploration. The existing Anatomy, Connections, Videos, and finer-model controls remain available. Each stop has a shareable URL such as `#path=memory&step=3`. Keyboard navigation retains focus on the step controls. Deep and buried targets use transparent cortex or isolation; these are display choices, not measured activity.

These are curated educational sequences, not measured fiber pathways, temporal signal animations, or exhaustive systems maps. Each path explains absent geometry and composite labels. References include authored UTHealth Neuroscience Online chapters, neuroscience textbooks, and research models; scope and source details are available under **What this path shows**. Data and citations are maintained in `src/learning-paths.json`.

## Reference notes and anatomical names

The anatomy library's **Reference** tab contains 21 searchable notes on anatomical directions, section planes, folds, gray and white matter, cortical layers, neurons, glia, myelin, synapses, human cell diversity, atlas boundaries, functional names, meninges, CSF circulation, blood–brain interfaces, arterial supply, venous/lymphatic drainage, brainstem organization, cranial nerves, and cerebellar gross anatomy and circuitry. Articles link directly to available 3D regions and related topics, identify their sources and evidence type, and state what is not modeled. Shared links use fragments such as `#reference=cortical-layers`. A reference temporarily replaces the region inspector so reading uses one panel. The full catalogue and its styles load on demand, approximately 16 kB gzipped together.

Twenty-one contextual exploration links connect notes to existing guided paths, structural MRI, and original institutional specimen films. Each link states its scope: a structural template does not measure CSF flow, a gross dissection cannot resolve barrier-cell junctions, and an anatomy path is not a flow simulation. Views opened from a note offer **Back to reference note**. The `from` parameter preserves that context across reload, path steps, MRI sequence changes, and copied links. Manual region selection and reset clear it. Deep reference targets reopen with transparent cortex; ventricular targets hide deep gray structures for visibility.

The brainstem note compares three levels and their landmarks. The cranial-nerve note compares all twelve conventional nerves, selected roles, and central relationships, with a source link for each row. **Jump to comparison** moves reading and keyboard focus directly to the table. Table text participates in reference search, so terms such as `parotid` find the relevant note. The Anatomy tab of brainstem and cerebellar regions offers compact **Read deeper** links; the main canvas gains no permanent controls. Named nuclei, individual nerves, lobules, and cellular circuits remain explicitly unsegmented.

Structure search combines terms and recognizes ten terminology groups including Heschl's gyrus, Broca's area, M1, S1, V1, dorsal and ventral striatum, lentiform nucleus, pallidum, and inferior frontal gyrus. For example, `left Heschl's gyrus` finds the left transverse temporal parcel. Source-linked search notes explain approximate or composite mappings; aliases do not imply exact functional boundaries or create additional meshes. The search index is built once, and search results are cached between unrelated UI updates.

Original summaries and source metadata are maintained in `src/reference-data.json`; search mappings are in `src/anatomical-search.ts`. Sources checked October 19, 2026 include UTHealth's authored textbook chapters, Purves et al., FreeSurfer documentation, the original human tissue studies by Langseth et al. (2021) and Siletti et al. (2023), Allen Institute dataset documentation, authored chapters from Basic Neurochemistry and The Cerebral Circulation, UTHealth anatomy laboratories, OpenStax, and Absinta et al.’s original human/marmoset MRI and histology study (2017). Source text, figures, cellular datasets, and the specialized lymphatic MRI are not redistributed. These are introductory curated notes, not exhaustive or automatically updated reviews.

## Brain scans and activity maps

Use the top section switch to move between **Anatomy**, **Brain scans**, and **Activations**.

- **Brain scans:** real T1, T2, and proton-density ICBM152 population templates, with linked axial/coronal/sagittal slices, crosshairs, slice coordinates, and display contrast. Structural sampling is retained at 1 mm.
- **Activations:** 117 measured Z maps spanning 12 paradigms from IBC participant sub-01, with the comparison conditions, source, session, and statistic clearly identified. Adjust threshold, direction, and opacity; select or drag within an image to move linked crosshairs. The map is a static experimental contrast, not a live recording.
- **Research index:** 15 imaging/recording method families, 20 dataset resources, all 87 protocols in the IBC task-page snapshot, all 799 contrast definitions in its checked public table, and 48 externally linked HCP maps (47 Z maps and one T map). The HCP sample and terms are distinct from the local IBC examples.
- Exportable research notes, JSON, TSV, and image provenance are available in the index. Full methodology, scope, references, and the map inventory are in [IMAGING_RESEARCH.md](IMAGING_RESEARCH.md).

Warm and cool colors indicate opposite directions of an A-versus-B contrast. Z is not a percentage of brain activity. Display thresholding is not multiple-comparison correction. A separate MNI population template provides the approximate anatomical background; no registration to the 3D surface model is claimed. Most directory entries link to provider data rather than bundling additional scans. Access notes do not grant permission to use external datasets.

The imaging code and images are loaded only when requested. The 3D render loop pauses outside Anatomy, and the viewer retains at most four decoded image volumes. The 117 compact statistical volumes total approximately 35 MB on disk, with only the selected map fetched. Native browser gzip decompression is required. No raw 4D BOLD time series, patient data, accounts, external APIs, or tracking are used during local exploration.

To reproduce the image assets from the retained public-source selection, create the Python environment described below and run `.venv/bin/python scripts/build_imaging.py`. Inputs are validated against `scripts/imaging-checksums.json`. Regenerate research notes with `node scripts/build_research_notes.mjs`.

## Dissection videos

Select any modeled region and open its **Videos** tab, or choose **Dissections** at the top for the searchable film library. The film icon opens the same library on phones. The collection includes 21 lessons from the [University of Utah Neuroanatomy Video Lab](https://library.med.utah.edu/publishing/collection/neuroanatomy-video-lab-brain-dissections/), [UBC Neuroanatomy](https://www.neuroanatomy.ca/videos.html), and [UTHealth Neuroanatomy Online](https://nba.uth.tmc.edu/neuroanatomy/L9/L9_index.html). UTHealth’s laboratory directly links the added cranial-nerve and vessel dissection; it appears as a system-level recommendation for the brainstem.

Each film has an original short description, institution credit, format label, direct watch link, and publisher catalogue link. Utah durations are approximate values from the catalogue; unverified durations are omitted. The films use real human specimens and may combine specimen demonstrations with sections, models, diagrams, and clinical examples.

Region recommendations distinguish **Structure focus**, **System focus**, and **Broader context**. Small cortical parcels, composite labels, and geometric callosal segments are not presented as exact video matches. Each of the 104 regions has relevant recommendations, and the Videos tab stays selected when moving between regions.

The film library supports anatomical search, topic filters, and institution filters. Search handles names such as “nucleus accumbens” even when the matching lesson is called “Basal Ganglia.” The catalogue and mapping are maintained in `src/video-data.json` and `src/videos.ts`.

Institutional links and the original 20 YouTube titles/channel names were checked through YouTube oEmbed metadata on October 18, 2026; the added UTHealth film was checked October 19. Per-film metadata dates override the catalogue default, and the interface reports both dates. No duration is assumed for the new film. Full playback and timestamps were not audited. Films open at the beginning on the original channels. Availability or access requirements can change. Video players, thumbnails, and external media are not loaded with the atlas, so the 3D scene keeps its existing rendering behavior.

## Coverage and scientific limits

The atlas contains **104 selectable meshes**:

| Group                                           |                  Count |
| ----------------------------------------------- | ---------------------: |
| Desikan–Killiany cortical parcels               | 68 (34 per hemisphere) |
| Deep gray matter and medial temporal structures |                     16 |
| Cerebellar cortex                               |                      2 |
| Brainstem                                       |                      1 |
| Ventricular compartments and choroid plexus     |                      8 |
| Selected white matter compartments              |                      9 |

The cortical overview uses the FreeSurfer `fsaverage5` pial surface. Cortical detail uses `fsaverage6`, with approximately four times the sampling density. Annotation labels follow the nested vertex indexing of the fsaverage meshes. Complete triangles are assigned to one parcel by vertex-label majority, with first-vertex tie breaking. The medial wall and unknown labels are excluded. Parcel edges therefore reflect the displayed mesh sampling rather than exact histological borders.

Subcortical geometry is extracted from the FreeSurfer `fsaverage` `aseg.mgz` volume, with a Gaussian smoothing sigma of 0.65 voxels and a 0.45 marching-cubes threshold. Overview sampling is coarser for larger labels; detail sampling is one voxel. These choices support interactive viewing and may soften small anatomical features. The display coordinates are `[R, S, -A]` from FreeSurfer surface RAS. The pial and aseg data share the same fsaverage anatomical coordinate frame.

The model does **not** contain all brain knowledge. Most individual nuclei, cortical layers, neurons, vessels, cranial nerves, fiber pathways, cellular and molecular data, diseases, and recent research findings are not modeled. Listed internal subdivisions are educational notes, not separately segmented meshes. The ventral diencephalon is a composite imaging label. Corpus callosum segments are geometric atlas partitions. Anatomical and functional boundaries vary between people and atlases.

The text is a curated introduction to established concepts. Links to original dataset documentation, textbooks, Allen Brain Map, the Human Connectome Project, and live PubMed searches support further exploration. Collections retain their own checked dates (October 18–19, 2026); new research is not automatically ingested. This is an educational reference, not a clinical or diagnostic tool.

## Performance

- The default scene submits **83,547 triangles**. Hidden groups are excluded from rendering and picking.
- The initial geometry payload is approximately **2.92 MB**, stored as gzip and decoded with the browser's native `DecompressionStream`. A raw binary fallback supports browsers without that API.
- Detail models load only for the region being inspected, including automatically isolated buried targets; six detail geometries are retained in memory.
- Rendering stops when the view settles, resumes on interaction, and pauses when the document is hidden. Slow rotation renders continuously when enabled.
- GPU pixel ratio is capped at 1.75. Normals and sulcal shading are precomputed, and buffer arrays are read without JSON geometry parsing.
- Fonts are bundled locally. There are no analytics or external network requests until a user follows a reference link.

These are implementation characteristics, not a guarantee of a frame rate on every device. A WebGL 2 capable browser with hardware acceleration is required for the 3D model; the anatomy library remains available if rendering fails.

## Validation

```sh
npm test
npm run build
```

The asset tests validate unique bilateral coverage, binary offsets and sizes, every vertex and triangle index, unit normals, left/right orientation, compressed payload integrity, all 104 detail files, detail sampling density, the default scene budget, and source checksum records. Video tests also verify coverage across all 104 regions, scoped match labels, institution provenance, search behavior, and combined filters. Imaging tests validate all 120 image volumes, checksums, grid orientation, signed statistics and peaks, catalogue counts, crosshair coordinate mapping, and overlay thresholds.

Browser checks cover model loading, direct selection, search, explosion, isolation, related structures, visibility controls, section settings, saving, dialogs, and responsive layout.

## Reproduce the meshes

The committed assets are ready to use. To regenerate them, use Python 3.12 or later in a separate virtual environment:

```sh
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements.txt
.venv/bin/python scripts/build_atlas.py
npm test
```

Downloaded scientific inputs are cached under `.cache/atlas/`, which is ignored. Upstream files, URLs, and SHA-256 checksums are listed in `public/models/atlas.json`. MNE data is pinned to a specific commit and Nilearn to release 0.12.1. The fsaverage6 archive is fetched from the OSF URL documented by Nilearn; the input checksums are checked before conversion, making upstream changes detectable. The binary layout of each mesh is little-endian float32 positions, float32 normals, float32 shading, then uint32 triangle indices. Buffer lengths are recorded in the manifest.

## Sources and licenses

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The mesh geometry is a modified visualization derivative of FreeSurfer reference data. No affiliation or endorsement by any of the source institutions is implied.
