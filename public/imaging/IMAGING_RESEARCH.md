# Brain scans and activity maps: research compilation

Research snapshot: October 18, 2026. This is a curated educational compilation with complete coverage of the specific snapshots listed below. It is not a systematic review of every neuroimaging paper or an exhaustive collection of every human scan.

## What can be explored locally

- **Three anatomical MRI sequences**: T1-weighted, T2-weighted, and proton-density-weighted ICBM152 nonlinear asymmetric 2009c population templates. The source combines 152 participants; it is not an individual person's MRI. Spatial sampling is retained at 1 mm. The data are brain-masked and intensity-scaled for display.
- **117 measured task-contrast Z maps**: one example of every distinct contrast for participant sub-01 in [IBC NeuroVault collection 4438](https://neurovault.org/collections/4438/), using the earliest image ID when uploads repeat. These span 12 paradigms. They are single-participant examples, not group averages or comprehensive measurements of how everyone performs an everyday activity.
- **Linked slice navigation**: axial, coronal, and sagittal MRI views share crosshairs in MNI coordinates. Left is left on axial and coronal images. The sagittal view runs posterior-to-anterior from left to right.
- **Real statistical overlays**: both positive and negative contrasts are retained. Warm colors represent A greater than B; cool colors represent B greater than A. The display threshold and overlay opacity are adjustable.

A high Z statistic is not a percentage of brain activation. The default |Z| ≥ 3 display threshold is a visualization choice and is not a corrected inferential threshold. No multiple-comparison correction or cluster inference is performed in this viewer. An uncolored region is not necessarily inactive. Maps compare conditions and can include visual, response, attention, and other components of an experiment.

BOLD fMRI measures a physiological response related to blood oxygenation, rather than recording individual neuronal spikes. Task differences do not establish that a region uniquely implements a mental process. No raw 4D BOLD time series, temporal animation, clinical interpretation, patient upload, or individual diagnosis is included.

## Spatial processing and performance

MRI kept at 1 mm, brain-masked and scaled to uint8. Z maps linearly resampled to the shared 2 mm grid, brain-masked, and quantized at 0.01 Z per int16 unit. No inferential threshold is applied to stored maps.

The coordinate grid for maps is 97 × 115 × 97 voxels with origin [-96, -132, -78] mm and spacing [2, 2, 2] mm. X increases toward right, Y toward anterior, and Z toward superior. Data are stored with X varying fastest. Source affine matrices, native shapes, direct URLs, file sizes, and SHA-256 checksums appear in [the image manifest](./manifest.json) and the source-input checksum file in the repository.

During drawing, the nearest 2 mm statistical voxel is sampled onto the 1 mm structural background. The anatomical background is the ICBM152 2009c template; the IBC maps are in generic MNI space. Sharing coordinates does not remove template differences or individual variation. Overlay alignment is approximate. No registration to the separate FreeSurfer 3D surface is claimed. Source contrasts are labelled using the IBC definition table; this resolves reversed reading/listening prose in two image metadata records. Motor averages mean the other movement conditions; category averages mean the other stimulus categories.

The imaging interface is loaded only when its section is opened. Individual image volumes load on demand, with four decoded volumes retained in memory. Slices are drawn only when image data, coordinates, or display controls change. The 3D render loop pauses while the imaging section is active. All imagery is bundled locally; external providers are contacted only when the user follows source links. Native gzip decompression is required for the imaging viewer.

## Research coverage

| Compilation | Count | Meaning |
| --- | ---: | --- |
| Local structural sequences | 3 | Population MRI templates, not three participants |
| Local activation examples | 117 | Distinct contrasts from IBC participant sub-01 |
| IBC paradigms represented by local maps | 12 | First-release task families |
| Documented IBC protocols | 87 | All protocol sections on the task-page snapshot |
| IBC contrast-definition rows | 799 | All rows in the checked public TSV; not all locally bundled maps |
| Archived HCP map references | 48 | 47 Z maps plus one T map from a separate 486-person cohort |
| Imaging and recording method families | 15 | Guides; only explicitly marked examples are local |
| Dataset and repository resources | 20 | Source links with access notes |

The 87 protocol entries and 799 contrast rows come from related but different snapshots. Some protocol variants share definitions, and some protocols have no matching row in the table. In particular, seven generic Preference rows are not repeated under the four stimulus-specific Preference protocols. Each row remains available in the full contrast index. A protocol is an experimental procedure, not necessarily a single everyday activity.

HCP reference maps are linked from [NeuroVault collection 457](https://neurovault.org/collections/457/); they are **not** the local IBC examples, even where task names overlap. The HCP collection states specific access and use terms. No HCP map volumes, participant-level HCP data, or other access-controlled imaging were downloaded. External releases and provider requirements may change.

## Imaging and recording methods

| Method | Measures / use | Limitation | Source |
| --- | --- | --- | --- |
| T1-weighted MRI | Tissue contrast weighted by longitudinal relaxation. Structural boundaries and cortical anatomy. | Image brightness is not a quantitative T1 measurement. | [Source](https://bids-specification.readthedocs.io/en/stable/modality-specific-files/magnetic-resonance-imaging-data.html) |
| T2-weighted MRI | Tissue contrast weighted by transverse relaxation. Complementary tissue and fluid contrast. | Contrast depends on acquisition settings. | [Source](https://bids-specification.readthedocs.io/en/stable/modality-specific-files/magnetic-resonance-imaging-data.html) |
| Proton-density MRI | Contrast influenced by mobile proton density. Complementary structural contrast. | Weighted brightness is not an absolute water measurement. | [Source](https://bids-specification.readthedocs.io/en/stable/modality-specific-files/magnetic-resonance-imaging-data.html) |
| FLAIR MRI | Fluid-attenuated inversion-recovery contrast. Viewing tissue with suppressed cerebrospinal-fluid signal. | Different sequence parameters change the appearance. | [Source](https://bids-specification.readthedocs.io/en/stable/modality-specific-files/magnetic-resonance-imaging-data.html) |
| Diffusion MRI / DTI | Water diffusion weighted in different directions. Diffusion models and estimated white-matter pathways. | Tractography estimates pathways; it does not trace individual axons. | [Source](https://www.humanconnectome.org/hcp-protocols) |
| Task & resting-state fMRI | BOLD changes associated with blood oxygenation. Task contrasts and statistical relationships between time series. | An indirect, delayed physiological signal; not a direct recording of neuron firing. | [Source](https://doi.org/10.1038/35084005) |
| ASL perfusion MRI | Magnetically labeled arterial blood used to estimate perfusion. Cerebral blood-flow measurements. | Different from BOLD activation and sensitive to transit timing. | [Source](https://bids-specification.readthedocs.io/en/stable/modality-specific-files/magnetic-resonance-imaging-data.html) |
| Susceptibility-sensitive MRI | Contrast influenced by local magnetic susceptibility. Venous and susceptibility-related tissue features. | Appearance depends on sequence and processing. | [Source](https://studyforrest.org/data.html) |
| MR angiography / venography | MR contrast emphasizing blood vessels. Arterial or venous anatomy. | Not equivalent to neural activation. | [Source](https://www.openfmri.org/dataset/ds000224/) |
| MR spectroscopy | Resonance spectra associated with metabolites. Chemical measurements within sampled tissue volumes. | Spectra require modeling; they are not a neuron-by-neuron chemical map. | [Source](https://bids-specification.readthedocs.io/en/stable/modality-specific-files/magnetic-resonance-spectroscopy.html) |
| Computed tomography | X-ray attenuation reconstructed as cross-sectional images. Head, bone, and tissue assessment. | Uses ionizing radiation; no CT volume is bundled here. | [Source](https://www.nibib.nih.gov/science-education/science-topics/computed-tomography-ct) |
| PET / SPECT | Distribution of an administered radioactive tracer. Tracer-dependent metabolism, perfusion, or molecular targets. | Different tracers measure different processes; not a universal activity score. | [Source](https://www.nibib.nih.gov/science-education/science-topics/nuclear-medicine) |
| EEG / intracranial EEG | Electrical potentials recorded using electrodes. Tracking fast changes in neural population signals. | Sensor recordings require a model to infer sources; intracranial coverage is limited. | [Source](https://www.nimh.nih.gov/research/research-conducted-at-nimh/research-areas/research-support-services/meg) |
| Magnetoencephalography | Magnetic fields produced by neural electrical currents. Fast brain responses and source modeling. | Source localization depends on measurement and modeling assumptions. | [Source](https://www.nimh.nih.gov/research/research-conducted-at-nimh/research-areas/research-support-services/meg) |
| Functional near-infrared spectroscopy | Optical measurements related to hemoglobin and oxygenation. Functional measurements near the cortical surface. | Superficial physiology and limited depth affect interpretation. | [Source](https://www.nibib.nih.gov/science-education/science-topics/optical-imaging) |

## Dataset and repository directory

| Resource | Scope | Access | Local content | Source |
| --- | --- | --- | --- | --- |
| MNI / ICBM152 | Population MRI templates for anatomical coordinates and comparison. | Open files | Selected derivative or metadata | [Provider](https://www.bic.mni.mcgill.ca/ServicesAtlases/ICBM152NLin2009) |
| Individual Brain Charting | Dense repeated measurements across many cognitive tasks. The local example maps come from its first statistical-map release. | Open files | Selected derivative or metadata | [Provider](https://individual-brain-charting.github.io/docs/) |
| NeuroVault | Researcher-shared statistical images with per-map provenance and available metadata. | Public collections; check collection terms | Selected derivative or metadata | [Provider](https://neurovault.org/) |
| OpenNeuro | BIDS-organized research datasets covering multiple imaging and recording methods. | Open files; dataset-specific licenses | External link | [Provider](https://openneuro.org/) |
| HCP Young Adult | Multimodal human connectome data and seven widely used task paradigms. Group maps are linked separately. | Registration and data-use terms | External link | [Provider](https://www.humanconnectome.org/study/hcp-young-adult) |
| HCP Development | Developmental structural and functional imaging using lifespan-adapted connectome protocols. | Provider access process | External link | [Provider](https://www.humanconnectome.org/study/hcp-lifespan-development) |
| HCP Aging / AABC | Lifespan connectome research focused on mature and older adulthood. | Provider access process | External link | [Provider](https://www.humanconnectome.org/study/hcp-lifespan-aging) |
| Developing Human Connectome Project | Early-life structural, diffusion, and functional imaging releases. | Registration and provider terms | External link | [Provider](https://www.developingconnectome.org/data-release/) |
| Cam-CAN | Adult lifespan data combining cognitive measures, MRI, and MEG. | Provider access process | External link | [Provider](https://opendata.mrc-cbu.cam.ac.uk/projects/camcan/) |
| OASIS | Structural and multimodal imaging resources for aging and Alzheimer research. | Application and collection-specific terms | External link | [Provider](https://www.oasis-brains.org/) |
| ADNI | Longitudinal neuroimaging and clinical biomarker research on cognitive aging and dementia. | Approved research access | External link | [Provider](https://adni.loni.usc.edu/data-samples/adni-data/) |
| UK Biobank imaging | Population imaging linked to longitudinal health, genetic, and lifestyle information. | Controlled research access | External link | [Provider](https://www.ukbiobank.ac.uk/about-our-data/types-of-data/imaging-data/) |
| Natural Scenes Dataset | Repeated high-resolution measurements during viewing and recognition of natural scenes. | Data-access agreement | External link | [Provider](https://naturalscenesdataset.org/) |
| THINGS | A shared object-image framework with multiple neural and behavioral datasets. | Dataset-specific open releases | External link | [Provider](https://things-initiative.org/) |
| BOLD5000 | Brain responses to thousands of natural and object images. | Published data releases | External link | [Provider](https://bold5000-dataset.github.io/website/) |
| StudyForrest | Movie, audio, music, localizer, and structural imaging with stimulus annotations. | Release-specific terms | External link | [Provider](https://studyforrest.org/data.html) |
| Narratives | Spoken-story listening datasets for studying natural language comprehension. | Open dataset | External link | [Provider](https://github.com/snastase/narratives) |
| Courtois NeuroMod | Repeated measurements during tasks, stories, movies, and video game play. | Mixed open and registered access | External link | [Provider](https://docs.cneuromod.ca/) |
| Midnight Scan Club | Intensive structural, task, and resting-state measurements in individual participants. | Open dataset | External link | [Provider](https://openneuro.org/datasets/ds000224) |
| Neurosynth | Term-based synthesis of published coordinate reports. These are meta-analytic associations, not direct task recordings. | Public maps and data | External link | [Provider](https://neurosynth.org/) |

Access notes are for discovery, not a grant of permission. No account was created and no provider agreement was accepted on the user's behalf. Dataset licenses and access rules must be read at the provider before reuse.

## Complete documented protocol index

Each linked protocol provides its experimental procedure, conditions, contrasts, and available demonstrations. Domains below are factual ontology tags, displayed with spaces for readability. Raw contrast definitions are downloadable as [TSV](./ibc-contrasts.tsv) and the full compilation as [JSON](./protocols.json).

| Protocol | Selected domains | Contrast rows matched to this name | Original documentation |
| --- | --- | ---: | --- |
| ArchiStandard | visual word recognition, auditory sentence comprehension, visual sentence comprehension, vertical checkerboard | 23 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#archistandard) |
| ArchiSpatial | saccadic eye movement, visual tool recognition, visual object recognition, grasping | 7 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#archispatial) |
| ArchiSocial | visual imagery, animacy perception, voice perception, auditory sentence recognition | 13 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#archisocial) |
| ArchiEmotional | gender perception, visual representation, emotional expression, visual face recognition | 14 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#archiemotional) |
| HcpEmotion | visual shape recognition, emotional expression, shape perception, visual orientation | 4 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#hcpemotion) |
| HcpGambling | reward processing, punishment processing | 4 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#hcpgambling) |
| HcpMotor | left toe response execution, left hand response execution, response selection, right hand response execution | 11 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#hcpmotor) |
| HcpLanguage | auditory sentence recognition, narrative comprehension, auditory arithmetic processing | 4 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#hcplanguage) |
| HcpRelational | visual shape recognition, relational comparison, visual pattern recognition, shape perception | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#hcprelational) |
| HcpSocial | animacy perception, animacy decision, motion detection, shape perception | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#hcpsocial) |
| HcpWm | face maintenance, visual buffer, visual tool recognition, updating | 14 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#hcpwm) |
| RSVPLanguage | recognition, visual string recognition, visual word recognition, visual pseudoword recognition | 19 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#rsvplanguage) |
| RestingState | restingstate | 0 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#restingstate) |
| MTTWE | past time, spatial localization, east cardinal-direction judgment, temporal cognition | 19 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#mttwe) |
| MTTNS | past time, spatial localization, temporal cognition, spatial working memory | 19 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#mttns) |
| PreferenceFood | confidence judgment, food cue reactivity, visual representation, subjective food value | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#preferencefood) |
| PreferencePaintings | confidence judgment, visual representation, incentive salience, judgment | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#preferencepaintings) |
| PreferenceFaces | confidence judgment, visual representation, judgment, incentive salience | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#preferencefaces) |
| PreferenceHouses | confidence judgment, visual representation, incentive salience, judgment | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#preferencehouses) |
| TheoryOfMind | theory of mind, narrative comprehension, semantic processing | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#theoryofmind) |
| EmotionalPain | imagined emotional pain, empathy, narrative comprehension, imagined physical pain | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#emotionalpain) |
| PainMovie | imagined emotional pain, empathy, theory of mind, visual attention | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#painmovie) |
| VSTM | visual shape recognition, visual buffer, visual working memory, maintenance | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#vstm) |
| Enumeration | enumeration, visual buffer, shape perception, visual working memory | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#enumeration) |
| Self | self-reference effect, recognition, episodic memory, visual word recognition | 11 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#self) |
| Bang | audiovisual perception, speech processing, speech perception, action perception | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#bang) |
| Clips | naturalistic stimulation | 0 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#clips) |
| WedgeClock | upper-right vision, lower-left vision, color perception, lower-right vision | 8 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#wedgeclock) |
| WedgeAnti | upper-right vision, lower-left vision, color perception, lower-right vision | 8 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#wedgeanti) |
| ContRing | visual color discrimination, color perception, far peripheral vision, foveal vision | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#contring) |
| ExpRing | far peripheral vision, color perception, foveal vision, mid peripheral vision | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#expring) |
| Raiders | naturalistic stimulation | 0 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#raiders) |
| Lec2 | inhibition, visual word recognition, word maintenance, combinatorial semantics | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#lec2) |
| Audi | animacy perception, voice perception, auditory sentence recognition, speech processing | 25 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#audi) |
| Visu | animacy perception, food cue reactivity, visual string recognition, facial recognition | 16 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#visu) |
| Lec1 | visual string recognition, visual word recognition, visual pseudoword recognition, syntactic parsing | 6 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#lec1) |
| MVEB | visual buffer, visual working memory, visual attention, maintenance | 11 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#mveb) |
| MVIS | visual buffer, visual working memory, visual attention, spatial working memory | 12 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#mvis) |
| Moto | visual word recognition, saccadic eye movement, word maintenance | 9 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#moto) |
| MCSE | visual localization, visual search, salience, upper-right vision | 9 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#mcse) |
| Audio | animacy perception, voice perception, auditory sentence recognition, auditory working memory | 19 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#audio) |
| Attention | saccadic eye movement, spatial attention, selective attention | 10 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#attention) |
| StopSignal | visual shape recognition, shape perception, proactive control | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#stopsignal) |
| TwoByTwo | visual perception, cue switch | 10 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#twobytwo) |
| Discount | decision making, selective control, incentive salience | 2 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#discount) |
| SelectiveStopSignal | visual shape recognition, shape perception, proactive control | 8 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#selectivestopsignal) |
| Stroop | conflict detection, visual perception, color perception, proactive control | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#stroop) |
| ColumbiaCards | reward processing, risk processing, risk aversion | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#columbiacards) |
| DotPatterns | visual shape recognition, visual pattern recognition, shape perception, visual attention | 11 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#dotpatterns) |
| WardAndAllport | goal hierarchy, visual perception, working memory, search depth | 10 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#wardandallport) |
| LePetitPrince | naturalistic stimulation | 0 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#lepetitprince) |
| LPPLocalizer | voice perception, auditory sentence recognition, speech processing, listening | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#lpplocalizer) |
| BiologicalMotion1 | biological motion, visual representation, motion detection, spatial attention | 10 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#biologicalmotion1) |
| BiologicalMotion2 | biological motion, visual representation, motion detection, visual orientation | 10 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#biologicalmotion2) |
| MathLanguage | visual imagery, auditory sentence recognition, visual word recognition, auditory sentence comprehension | 30 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#mathlanguage) |
| SpatialNavigation | spatial localization, visual search, navigation, spatial memory | 9 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#spatialnavigation) |
| GoodBadUgly | naturalistic stimulation | 0 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#goodbadugly) |
| EmoMem | negative emotion, imagination, positive emotion, visual cue | 6 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#emomem) |
| EmoReco | gender perception, negative emotion, emotional expression, visual face recognition | 10 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#emoreco) |
| StopNogo | shape perception, color perception, proactive control, color recognition | 7 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#stopnogo) |
| Catell | visual form discrimination, oddball detection | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#catell) |
| FingerTapping | motor control, motor planning, decision making | 6 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#fingertapping) |
| VSTMC | saccadic eye movement, visual working memory, visual attention | 10 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#vstmc) |
| RewProc | risk processing, loss aversion, risk aversion, upper-right vision | 17 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#rewproc) |
| NARPS | loss aversion, risk processing, risk aversion, reward anticipation | 8 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#narps) |
| FaceBody | face maintenance, word maintenance, visual pseudoword recognition, facial age recognition | 15 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#facebody) |
| Scene | visual search, salience, upper-right vision, visual scene perception | 11 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#scene) |
| BreathHolding | self monitoring, breath holding | 4 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#breathholding) |
| Checkerboard | visual attention, visual perception, central fixation | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#checkerboard) |
| FingerTap | visual attention, central fixation | 3 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#fingertap) |
| ItemRecognition | visual shape recognition, visual buffer, visual working memory, visual attention | 17 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#itemrecognition) |
| VisualSearch | visual search, visual buffer, visual pattern recognition, visual working memory | 22 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#visualsearch) |
| MonkeyKingdom | naturalistic stimulation | 0 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#monkeykingdom) |
| Color | visual working memory, color perception | 4 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#color) |
| Motion | visual localization, motion detection, random motion, coherent motion | 11 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#motion) |
| OptimismBias | self-reference effect, episodic memory, negative emotion, past time | 7 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#optimismbias) |
| MovieAomic | naturalistic stimulation | 0 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#movieaomic) |
| HarririAomic | visual shape recognition, emotional expression, shape perception, facial expression | 5 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#harririaomic) |
| FacesAomic | face maintenance, negative emotion, gender perception, emotional expression | 17 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#facesaomic) |
| StroopAomic | conflict detection, gender perception, visual word recognition, visual face recognition | 12 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#stroopaomic) |
| WMAomic | visual buffer, visual working memory, visual attention, visual orientation | 5 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#wmaomic) |
| LocalizerAbstraction | facial recognition, visual word recognition, visual pseudoword recognition, visual object recognition | 17 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#localizerabstraction) |
| Abstraction | animacy perception, visual shape recognition, facial recognition, visual representation | 46 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#abstraction) |
| MDTB | motor control, visual word recognition, object maintenance, visual form discrimination | 20 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#mdtb) |
| Emotion | negative emotion, visual scene perception, emotional self-evaluation, visual perception | 4 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#emotion) |
| MultiModal | auditory working memory, localization, visual face recognition, object maintenance | 39 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#multimodal) |
| Mario | motor control, reward processing, spatial attention, potential monetary reward | 11 | [Protocol](https://individual-brain-charting.github.io/docs/tasks.html#mario) |

## Local map inventory

All local maps are Z statistics from IBC participant sub-01. Session identifiers are retained from the source. The collection includes session-specific maps and fixed-effects combinations across phase-encoding directions; no additional pooling is performed here. No participant identity was sought or inferred. The source page and filename remain available for audit.

| Task | Contrast | Session | Original map |
| --- | --- | --- | --- |
| ArchiStandard | left-right_button_press | ses-00 | [100831](https://neurovault.org/images/100831/) |
| ArchiStandard | reading-listening | ses-00 | [100833](https://neurovault.org/images/100833/) |
| ArchiStandard | motor-cognitive | ses-00 | [100835](https://neurovault.org/images/100835/) |
| ArchiStandard | reading-checkerboard | ses-00 | [100837](https://neurovault.org/images/100837/) |
| ArchiStandard | computation-sentences | ses-00 | [100839](https://neurovault.org/images/100839/) |
| ArchiStandard | horizontal-vertical | ses-00 | [100841](https://neurovault.org/images/100841/) |
| ArchiStandard | audio_left_button_press | ses-00 | [100843](https://neurovault.org/images/100843/) |
| ArchiStandard | audio_right_button_press | ses-00 | [100845](https://neurovault.org/images/100845/) |
| ArchiStandard | video_left_button_press | ses-00 | [100847](https://neurovault.org/images/100847/) |
| ArchiStandard | video_right_button_press | ses-00 | [100849](https://neurovault.org/images/100849/) |
| ArchiStandard | right-left_button_press | ses-00 | [100851](https://neurovault.org/images/100851/) |
| ArchiStandard | listening-reading | ses-00 | [100853](https://neurovault.org/images/100853/) |
| ArchiStandard | cognitive-motor | ses-00 | [100855](https://neurovault.org/images/100855/) |
| ArchiStandard | vertical-horizontal | ses-00 | [100857](https://neurovault.org/images/100857/) |
| ArchiStandard | horizontal_checkerboard | ses-00 | [100859](https://neurovault.org/images/100859/) |
| ArchiStandard | vertical_checkerboard | ses-00 | [100861](https://neurovault.org/images/100861/) |
| ArchiStandard | audio_sentence | ses-00 | [100863](https://neurovault.org/images/100863/) |
| ArchiStandard | video_sentence | ses-00 | [100865](https://neurovault.org/images/100865/) |
| ArchiStandard | audio_computation | ses-00 | [100867](https://neurovault.org/images/100867/) |
| ArchiStandard | video_computation | ses-00 | [100869](https://neurovault.org/images/100869/) |
| ArchiStandard | sentences | ses-00 | [100871](https://neurovault.org/images/100871/) |
| ArchiStandard | computation | ses-00 | [100873](https://neurovault.org/images/100873/) |
| ArchiStandard | sentences-computation | ses-00 | [100875](https://neurovault.org/images/100875/) |
| ArchiSpatial | saccades | ses-00 | [100877](https://neurovault.org/images/100877/) |
| ArchiSpatial | hand-side | ses-00 | [100879](https://neurovault.org/images/100879/) |
| ArchiSpatial | grasp-orientation | ses-00 | [100881](https://neurovault.org/images/100881/) |
| ArchiSpatial | rotation_side | ses-00 | [100883](https://neurovault.org/images/100883/) |
| ArchiSpatial | object_orientation | ses-00 | [100885](https://neurovault.org/images/100885/) |
| ArchiSpatial | rotation_hand | ses-00 | [100887](https://neurovault.org/images/100887/) |
| ArchiSpatial | object_grasp | ses-00 | [100889](https://neurovault.org/images/100889/) |
| ArchiSocial | triangle_mental-random | ses-00 | [100891](https://neurovault.org/images/100891/) |
| ArchiSocial | false_belief-mechanistic_audio | ses-00 | [100893](https://neurovault.org/images/100893/) |
| ArchiSocial | triangle_random | ses-00 | [100895](https://neurovault.org/images/100895/) |
| ArchiSocial | mechanistic_audio | ses-00 | [100897](https://neurovault.org/images/100897/) |
| ArchiSocial | mechanistic_video | ses-00 | [100899](https://neurovault.org/images/100899/) |
| ArchiSocial | non_speech_sound | ses-00 | [100901](https://neurovault.org/images/100901/) |
| ArchiSocial | false_belief-mechanistic_video | ses-00 | [100903](https://neurovault.org/images/100903/) |
| ArchiSocial | speech-non_speech | ses-00 | [100905](https://neurovault.org/images/100905/) |
| ArchiSocial | triangle_mental | ses-00 | [100907](https://neurovault.org/images/100907/) |
| ArchiSocial | false_belief_audio | ses-00 | [100909](https://neurovault.org/images/100909/) |
| ArchiSocial | false_belief_video | ses-00 | [100911](https://neurovault.org/images/100911/) |
| ArchiSocial | speech_sound | ses-00 | [100913](https://neurovault.org/images/100913/) |
| ArchiEmotional | expression_gender-control | ses-07 | [100915](https://neurovault.org/images/100915/) |
| ArchiEmotional | expression_intention-gender | ses-07 | [100916](https://neurovault.org/images/100916/) |
| ArchiEmotional | face_gender-control | ses-07 | [100917](https://neurovault.org/images/100917/) |
| ArchiEmotional | face_trusty-gender | ses-07 | [100918](https://neurovault.org/images/100918/) |
| ArchiEmotional | face_gender | ses-07 | [100919](https://neurovault.org/images/100919/) |
| ArchiEmotional | face_control | ses-07 | [100920](https://neurovault.org/images/100920/) |
| ArchiEmotional | face_trusty | ses-07 | [100921](https://neurovault.org/images/100921/) |
| ArchiEmotional | expression_intention | ses-07 | [100922](https://neurovault.org/images/100922/) |
| ArchiEmotional | expression_gender | ses-07 | [100923](https://neurovault.org/images/100923/) |
| ArchiEmotional | expression_control | ses-07 | [100924](https://neurovault.org/images/100924/) |
| ArchiEmotional | trusty_and_intention-control | ses-07 | [100925](https://neurovault.org/images/100925/) |
| ArchiEmotional | trusty_and_intention-gender | ses-07 | [100926](https://neurovault.org/images/100926/) |
| ArchiEmotional | face_trusty-control | ses-07 | [100927](https://neurovault.org/images/100927/) |
| ArchiEmotional | expression_intention-control | ses-07 | [100928](https://neurovault.org/images/100928/) |
| HcpLanguage | story-math | ses-03 | [100929](https://neurovault.org/images/100929/) |
| HcpLanguage | math | ses-03 | [100930](https://neurovault.org/images/100930/) |
| HcpLanguage | math-story | ses-03 | [100931](https://neurovault.org/images/100931/) |
| HcpLanguage | story | ses-03 | [100932](https://neurovault.org/images/100932/) |
| HcpSocial | mental-random | ses-04 | [100933](https://neurovault.org/images/100933/) |
| HcpSocial | random | ses-04 | [100934](https://neurovault.org/images/100934/) |
| HcpSocial | mental | ses-04 | [100935](https://neurovault.org/images/100935/) |
| HcpGambling | punishment-reward | ses-03 | [100936](https://neurovault.org/images/100936/) |
| HcpGambling | reward | ses-03 | [100937](https://neurovault.org/images/100937/) |
| HcpGambling | punishment | ses-03 | [100938](https://neurovault.org/images/100938/) |
| HcpGambling | reward-punishment | ses-03 | [100939](https://neurovault.org/images/100939/) |
| HcpMotor | left_hand-avg | ses-03 | [100940](https://neurovault.org/images/100940/) |
| HcpMotor | right_hand-avg | ses-03 | [100941](https://neurovault.org/images/100941/) |
| HcpMotor | left_foot-avg | ses-03 | [100942](https://neurovault.org/images/100942/) |
| HcpMotor | right_foot-avg | ses-03 | [100943](https://neurovault.org/images/100943/) |
| HcpMotor | tongue-avg | ses-03 | [100944](https://neurovault.org/images/100944/) |
| HcpMotor | left_hand | ses-03 | [100945](https://neurovault.org/images/100945/) |
| HcpMotor | right_hand | ses-03 | [100946](https://neurovault.org/images/100946/) |
| HcpMotor | left_foot | ses-03 | [100947](https://neurovault.org/images/100947/) |
| HcpMotor | right_foot | ses-03 | [100948](https://neurovault.org/images/100948/) |
| HcpMotor | tongue | ses-03 | [100949](https://neurovault.org/images/100949/) |
| HcpMotor | cue | ses-03 | [100950](https://neurovault.org/images/100950/) |
| HcpEmotion | shape | ses-03 | [100951](https://neurovault.org/images/100951/) |
| HcpEmotion | face-shape | ses-03 | [100952](https://neurovault.org/images/100952/) |
| HcpEmotion | face | ses-03 | [100953](https://neurovault.org/images/100953/) |
| HcpEmotion | shape-face | ses-03 | [100954](https://neurovault.org/images/100954/) |
| HcpRelational | relational-match | ses-04 | [100955](https://neurovault.org/images/100955/) |
| HcpRelational | match | ses-04 | [100956](https://neurovault.org/images/100956/) |
| HcpRelational | relational | ses-04 | [100957](https://neurovault.org/images/100957/) |
| HcpWm | 2back-0back | ses-04 | [100958](https://neurovault.org/images/100958/) |
| HcpWm | body-avg | ses-04 | [100959](https://neurovault.org/images/100959/) |
| HcpWm | face-avg | ses-04 | [100960](https://neurovault.org/images/100960/) |
| HcpWm | place-avg | ses-04 | [100961](https://neurovault.org/images/100961/) |
| HcpWm | tools-avg | ses-04 | [100962](https://neurovault.org/images/100962/) |
| HcpWm | 0back-2back | ses-04 | [100963](https://neurovault.org/images/100963/) |
| HcpWm | 0back_body | ses-04 | [100964](https://neurovault.org/images/100964/) |
| HcpWm | 2back_body | ses-04 | [100965](https://neurovault.org/images/100965/) |
| HcpWm | 0back_face | ses-04 | [100966](https://neurovault.org/images/100966/) |
| HcpWm | 2back_face | ses-04 | [100967](https://neurovault.org/images/100967/) |
| HcpWm | 0back_tools | ses-04 | [100968](https://neurovault.org/images/100968/) |
| HcpWm | 2back_tools | ses-04 | [100969](https://neurovault.org/images/100969/) |
| HcpWm | 0back_place | ses-04 | [100970](https://neurovault.org/images/100970/) |
| HcpWm | 2back_place | ses-04 | [100971](https://neurovault.org/images/100971/) |
| RSVPLanguage | complex-simple | ses-05 | [100972](https://neurovault.org/images/100972/) |
| RSVPLanguage | sentence-jabberwocky | ses-05 | [100973](https://neurovault.org/images/100973/) |
| RSVPLanguage | sentence-word | ses-05 | [100974](https://neurovault.org/images/100974/) |
| RSVPLanguage | word-consonant_string | ses-05 | [100975](https://neurovault.org/images/100975/) |
| RSVPLanguage | jabberwocky-pseudo | ses-05 | [100976](https://neurovault.org/images/100976/) |
| RSVPLanguage | word-pseudo | ses-05 | [100977](https://neurovault.org/images/100977/) |
| RSVPLanguage | pseudo-consonant_string | ses-05 | [100978](https://neurovault.org/images/100978/) |
| RSVPLanguage | consonant_string | ses-05 | [100979](https://neurovault.org/images/100979/) |
| RSVPLanguage | complex | ses-05 | [100980](https://neurovault.org/images/100980/) |
| RSVPLanguage | simple | ses-05 | [100981](https://neurovault.org/images/100981/) |
| RSVPLanguage | jabberwocky | ses-05 | [100982](https://neurovault.org/images/100982/) |
| RSVPLanguage | word_list | ses-05 | [100983](https://neurovault.org/images/100983/) |
| RSVPLanguage | pseudoword_list | ses-05 | [100984](https://neurovault.org/images/100984/) |
| RSVPLanguage | sentence-consonant_string | ses-05 | [100985](https://neurovault.org/images/100985/) |
| RSVPLanguage | simple-consonant_string | ses-05 | [100986](https://neurovault.org/images/100986/) |
| RSVPLanguage | complex-consonant_string | ses-05 | [100987](https://neurovault.org/images/100987/) |
| RSVPLanguage | sentence-pseudo | ses-05 | [100988](https://neurovault.org/images/100988/) |
| RSVPLanguage | probe | ses-05 | [100989](https://neurovault.org/images/100989/) |

## Source snapshots and reproducibility

The exact contrast file is retained in the project. Its repository commit at research time is 2d9a6852bc7e3b164adef28b02b4d38d386c53ac. Recorded snapshot hashes:

- [https://individual-brain-charting.github.io/docs/tasks.html](https://individual-brain-charting.github.io/docs/tasks.html) — SHA-256: fec5a8b420ed98a0aa927a0e8d40e4ed8325e98315b1f890843a4e9b572523d9
- [https://raw.githubusercontent.com/individual-brain-charting/public_analysis_code/master/ibc_data/all_contrasts.tsv](https://raw.githubusercontent.com/individual-brain-charting/public_analysis_code/master/ibc_data/all_contrasts.tsv) — SHA-256: 0da184e637959ae79a0c712b2a1f02ca97875c210fdb8bfc25a7246434600135
- [https://neurovault.org/api/collections/457/images/?format=json&limit=100](https://neurovault.org/api/collections/457/images/?format=json&limit=100) — SHA-256: 578946f6e2a24b7032d9d88fdca2f4cb52141cb292984b8311ab5fbd9cbd736f

Use a Python virtual environment with scripts/requirements.txt and run scripts/build_imaging.py to reproduce image assets from the retained source selection. Source checksums are validated on subsequent builds. Node.js can regenerate these notes with scripts/build_research_notes.mjs. This app does not automatically ingest future releases.

## Primary methods and interpretation references

- [BOLD physiology](https://doi.org/10.1038/35084005)
- [Interpreting task activation](https://doi.org/10.1016/j.tics.2005.12.004)
- [IBC first-release methods](https://doi.org/10.1038/sdata.2018.105)
- [IBC second-release methods](https://doi.org/10.1038/s41597-020-00670-4)
- [IBC fifth-release methods](https://doi.org/10.1038/s41597-026-06869-1)
- [HCP task protocols](https://www.humanconnectome.org/hcp-protocols-ya-task-fmri)
- [HCP contrast definitions](https://wiki.humanconnectome.org/docs/Task%20fMRI%20Contrasts.html)
- [NeuroVault data license](https://neurovault.org/FAQ)
- [Fonov et al.: template methodology](https://doi.org/10.1016/j.neuroimage.2010.07.033)
- [OpenNeuro IBC source-data release and CC0 declaration](https://openneuro.org/datasets/ds000244/versions/1.0.0)

## Attribution and reuse

ICBM templates: Copyright (C) 1993–2004 Louis Collins, McConnell Brain Imaging Centre, Montreal Neurological Institute, McGill University. The original permission and warranty notice is retained in public/imaging/MNI-LICENSE.txt. Source templates were modified as described above.

IBC: Pinho, Amadon, Ruest, and colleagues, Individual Brain Charting, a high-resolution fMRI dataset for cognitive mapping, Scientific Data 5, 180105 (2018), DOI 10.1038/sdata.2018.105. Maps originate from NeuroVault collection 4438; NeuroVault's public-data CC0 statement is linked above. The selection is modified for compact display. The definition table is retained from the public IBC analysis-code repository; its BSD license and notices are in public/licenses/ibc-analysis-code.txt. The protocol index retains factual names, tags, and source links, rather than copying long protocol descriptions.

HCP: The WU-Minn Human Connectome Project: An overview, Van Essen and colleagues (2013), DOI 10.1016/j.neuroimage.2013.05.041. Only factual metadata and external links are compiled. No affiliation or endorsement by any institution or dataset author is implied.
