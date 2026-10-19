# Third-party notices

## FreeSurfer reference anatomy

All or portions of this licensed product (such portions are the "Software") have been obtained under license from The General Hospital Corporation "MGH" and are subject to the terms and conditions reproduced in [public/licenses/freesurfer.txt](public/licenses/freesurfer.txt).

The fsaverage reference data, cortical surfaces, anatomical annotations, and aseg segmentation originate from FreeSurfer. This project contains **modified visualization derivatives**: coordinate-transformed, parcel-split surface meshes, resampled cortical geometry, and smoothed meshes extracted from segmentation volumes. They are not the original FreeSurfer files. Full source locations and input checksums appear in [public/models/atlas.json](public/models/atlas.json).

References:

- FreeSurfer: https://surfer.nmr.mgh.harvard.edu/
- Desikan et al. (2006). An automated labeling system for subdividing the human cerebral cortex on MRI scans into gyral based regions of interest. NeuroImage 31(3), 968–980. https://doi.org/10.1016/j.neuroimage.2006.01.021
- Fischl et al. (2002). Whole brain segmentation: automated labeling of neuroanatomical structures in the human brain. Neuron 33(3), 341–355. https://doi.org/10.1016/S0896-6273(02)00569-X

## Nilearn

The fsaverage5 files are distributed with Nilearn 0.12.1. The fsaverage6 archive location is documented in Nilearn's dataset loader. Copyright (c) The nilearn developers. The BSD license is reproduced in [public/licenses/nilearn.txt](public/licenses/nilearn.txt). https://github.com/nilearn/nilearn

## MNE testing data

The anatomical annotation and segmentation files are retrieved from the fsaverage subject in the MNE testing-data repository, pinned to commit `33ef2a6f6345a1adf8764f8f63725f0ed9e4bb92`. These remain FreeSurfer-derived data and are attributed and licensed accordingly. https://github.com/mne-tools/mne-testing-data

## Fonts

DM Sans and Manrope are bundled locally through Fontsource. Their SIL Open Font Licenses are reproduced in [public/licenses/dm-sans.txt](public/licenses/dm-sans.txt) and [public/licenses/manrope.txt](public/licenses/manrope.txt).

## Application dependencies

React, React DOM, Three.js, and Lucide are used under their package licenses. Their license files remain in the corresponding npm packages. No source institution, author, or contributor endorses this application.

## Linked teaching films

The dissection library links to original teaching films from the University of Utah Eccles Health Sciences Library (Neuroanatomy Video Lab, Suzanne Stensaas), UBC Faculty of Medicine (UBC Neuroanatomy Series, Claudia Krebs), and UTHealth Houston Neuroanatomy Online. Titles and source-channel attribution are retained; short descriptions and region mappings are curated for this app. All film rights remain with their respective creators and publishers.

- University of Utah catalogue: https://library.med.utah.edu/publishing/collection/neuroanatomy-video-lab-brain-dissections/
- UBC catalogue: https://www.neuroanatomy.ca/videos.html
- UTHealth laboratory teaching page: https://nba.uth.tmc.edu/neuroanatomy/L9/L9_index.html. This page embeds the original-channel film titled “Cranial Nerves and Vessels 2” (`lzm3K6nQNF0`, Neuroscience Online). The app uses a shortened display title, retains the exact metadata title, and links to the original film; no video, audio, thumbnail, or transcript is redistributed. No unverified presenter credit, duration, or timestamps are supplied.

## MNI / ICBM152 MRI templates

Copyright (C) 1993–2004 Louis Collins, McConnell Brain Imaging Centre, Montreal Neurological Institute, McGill University. The original permission and warranty notice is retained in [public/imaging/MNI-LICENSE.txt](public/imaging/MNI-LICENSE.txt). The T1-, T2-, and proton-density-weighted images are modified visualization derivatives of the ICBM152 nonlinear asymmetric 2009c templates: brain-masked, intensity-scaled, and packed at their 1 mm spatial sampling. They are population averages, not individual scans.

- Original atlas and references: https://www.bic.mni.mcgill.ca/ServicesAtlases/ICBM152NLin2009
- Fonov et al., methodology: https://doi.org/10.1016/j.neuroimage.2010.07.033

## Individual Brain Charting activation maps

Local maps are modified derivatives from public [NeuroVault collection 4438](https://neurovault.org/collections/4438/), provided by the IBC team. Public NeuroVault data are distributed under CC0 according to https://neurovault.org/FAQ. Original image IDs, source URLs, input checksums, native affine matrices, and derivative checksums are retained in [public/imaging/manifest.json](public/imaging/manifest.json). Derivatives are linearly resampled to 2 mm, brain-masked against the reference template, and quantized at 0.01 Z per integer unit. They are single-participant statistical maps; no group-level reanalysis was performed.

- Pinho, Amadon, Ruest, and colleagues (2018). Individual Brain Charting, a high-resolution fMRI dataset for cognitive mapping. Scientific Data 5, 180105. https://doi.org/10.1038/sdata.2018.105
- The retained IBC contrast-definition table originates from public_analysis_code, commit `2d9a6852bc7e3b164adef28b02b4d38d386c53ac`. Copyright (c) 2013–2023 The IBC developers. The Simplified BSD license is retained in [public/licenses/ibc-analysis-code.txt](public/licenses/ibc-analysis-code.txt).
- The protocol index compiles factual task names, ontology tags, and source links from https://individual-brain-charting.github.io/docs/tasks.html. Long protocol descriptions, task stimuli, and demonstration footage are not copied.

## Linked HCP research metadata

The research index retains factual metadata and direct links for 48 maps in [NeuroVault collection 457](https://neurovault.org/collections/457/). These are a different cohort from the local IBC maps. No HCP image volumes are redistributed. The collection's specific HCP registration and data-use requirements remain applicable. Cite Van Essen and colleagues, The WU-Minn Human Connectome Project: An overview (2013), https://doi.org/10.1016/j.neuroimage.2013.05.041.

## Linked reference literature

The reference catalogue contains original short educational summaries, factual anatomical terminology, and links to academic publishers and original studies. Source titles, evidence types, URLs, and checked dates are retained in `src/reference-data.json`. No textbook prose, figures, histology, or specialized lymphatic MRI assets are copied into the application. Source content retains its publisher's terms.

The linked OpenStax Anatomy and Physiology 2e chapter states a Creative Commons Attribution-NonCommercial-ShareAlike 4.0 license for its publisher content as checked October 19, 2026. This is a literature link; no OpenStax assets are redistributed. The original human/primate meningeal-lymphatic study is Absinta et al. (2017), eLife 6:e29738, https://doi.org/10.7554/eLife.29738. Its methods and images are not part of the bundled structural MRI templates.

Brainstem, cranial-nerve, and cerebellar notes link to UTHealth’s Neuroanatomy Online laboratory pages and Neuroscience Online chapters, including James Knierim’s cerebellum chapter (reviewed October 20, 2020). The cranial-nerve comparison contains original short factual summaries with row-level sources. Publisher prose, specimen photographs, diagrams, animations, and histological sections are not copied. These sources retain their publisher’s rights; linking does not grant redistribution rights or add their anatomical detail to the 3D meshes.
