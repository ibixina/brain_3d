export const researchDate = "2026-10-18";
const mri =
  "https://bids-specification.readthedocs.io/en/stable/modality-specific-files/magnetic-resonance-imaging-data.html";
const nuclear =
  "https://www.nibib.nih.gov/science-education/science-topics/nuclear-medicine";
export const modalities = [
  {
    id: "t1",
    name: "T1-weighted MRI",
    kind: "Anatomy",
    measures: "Tissue contrast weighted by longitudinal relaxation.",
    use: "Structural boundaries and cortical anatomy.",
    limit: "Image brightness is not a quantitative T1 measurement.",
    source: mri,
    local: true,
  },
  {
    id: "t2",
    name: "T2-weighted MRI",
    kind: "Anatomy",
    measures: "Tissue contrast weighted by transverse relaxation.",
    use: "Complementary tissue and fluid contrast.",
    limit: "Contrast depends on acquisition settings.",
    source: mri,
    local: true,
  },
  {
    id: "pd",
    name: "Proton-density MRI",
    kind: "Anatomy",
    measures: "Contrast influenced by mobile proton density.",
    use: "Complementary structural contrast.",
    limit: "Weighted brightness is not an absolute water measurement.",
    source: mri,
    local: true,
  },
  {
    id: "flair",
    name: "FLAIR MRI",
    kind: "Anatomy",
    measures: "Fluid-attenuated inversion-recovery contrast.",
    use: "Viewing tissue with suppressed cerebrospinal-fluid signal.",
    limit: "Different sequence parameters change the appearance.",
    source: mri,
    local: false,
  },
  {
    id: "diffusion",
    name: "Diffusion MRI / DTI",
    kind: "Microstructure",
    measures: "Water diffusion weighted in different directions.",
    use: "Diffusion models and estimated white-matter pathways.",
    limit:
      "Tractography estimates pathways; it does not trace individual axons.",
    source: "https://www.humanconnectome.org/hcp-protocols",
    local: false,
  },
  {
    id: "bold",
    name: "Task & resting-state fMRI",
    kind: "Function",
    measures: "BOLD changes associated with blood oxygenation.",
    use: "Task contrasts and statistical relationships between time series.",
    limit:
      "An indirect, delayed physiological signal; not a direct recording of neuron firing.",
    source: "https://doi.org/10.1038/35084005",
    local: true,
  },
  {
    id: "asl",
    name: "ASL perfusion MRI",
    kind: "Perfusion",
    measures: "Magnetically labeled arterial blood used to estimate perfusion.",
    use: "Cerebral blood-flow measurements.",
    limit: "Different from BOLD activation and sensitive to transit timing.",
    source: mri,
    local: false,
  },
  {
    id: "swi",
    name: "Susceptibility-sensitive MRI",
    kind: "Anatomy",
    measures: "Contrast influenced by local magnetic susceptibility.",
    use: "Venous and susceptibility-related tissue features.",
    limit: "Appearance depends on sequence and processing.",
    source: "https://studyforrest.org/data.html",
    local: false,
  },
  {
    id: "mra",
    name: "MR angiography / venography",
    kind: "Vessels",
    measures: "MR contrast emphasizing blood vessels.",
    use: "Arterial or venous anatomy.",
    limit: "Not equivalent to neural activation.",
    source: "https://www.openfmri.org/dataset/ds000224/",
    local: false,
  },
  {
    id: "mrs",
    name: "MR spectroscopy",
    kind: "Chemistry",
    measures: "Resonance spectra associated with metabolites.",
    use: "Chemical measurements within sampled tissue volumes.",
    limit:
      "Spectra require modeling; they are not a neuron-by-neuron chemical map.",
    source:
      "https://bids-specification.readthedocs.io/en/stable/modality-specific-files/magnetic-resonance-spectroscopy.html",
    local: false,
  },
  {
    id: "ct",
    name: "Computed tomography",
    kind: "Anatomy",
    measures: "X-ray attenuation reconstructed as cross-sectional images.",
    use: "Head, bone, and tissue assessment.",
    limit: "Uses ionizing radiation; no CT volume is bundled here.",
    source:
      "https://www.nibib.nih.gov/science-education/science-topics/computed-tomography-ct",
    local: false,
  },
  {
    id: "pet",
    name: "PET / SPECT",
    kind: "Molecular",
    measures: "Distribution of an administered radioactive tracer.",
    use: "Tracer-dependent metabolism, perfusion, or molecular targets.",
    limit:
      "Different tracers measure different processes; not a universal activity score.",
    source: nuclear,
    local: false,
  },
  {
    id: "eeg",
    name: "EEG / intracranial EEG",
    kind: "Electrophysiology",
    measures: "Electrical potentials recorded using electrodes.",
    use: "Tracking fast changes in neural population signals.",
    limit:
      "Sensor recordings require a model to infer sources; intracranial coverage is limited.",
    source:
      "https://www.nimh.nih.gov/research/research-conducted-at-nimh/research-areas/research-support-services/meg",
    local: false,
  },
  {
    id: "meg",
    name: "Magnetoencephalography",
    kind: "Electrophysiology",
    measures: "Magnetic fields produced by neural electrical currents.",
    use: "Fast brain responses and source modeling.",
    limit:
      "Source localization depends on measurement and modeling assumptions.",
    source:
      "https://www.nimh.nih.gov/research/research-conducted-at-nimh/research-areas/research-support-services/meg",
    local: false,
  },
  {
    id: "fnirs",
    name: "Functional near-infrared spectroscopy",
    kind: "Function",
    measures: "Optical measurements related to hemoglobin and oxygenation.",
    use: "Functional measurements near the cortical surface.",
    limit: "Superficial physiology and limited depth affect interpretation.",
    source:
      "https://www.nibib.nih.gov/science-education/science-topics/optical-imaging",
    local: false,
  },
];
export const datasets = [
  {
    name: "MNI / ICBM152",
    category: "Reference anatomy",
    modalities: ["T1", "T2", "PD"],
    description:
      "Population MRI templates for anatomical coordinates and comparison.",
    access: "Open files",
    url: "https://www.bic.mni.mcgill.ca/ServicesAtlases/ICBM152NLin2009",
    local: true,
  },
  {
    name: "Individual Brain Charting",
    category: "Task mapping",
    modalities: ["MRI", "fMRI", "DWI"],
    description:
      "Dense repeated measurements across many cognitive tasks. The local example maps come from its first statistical-map release.",
    access: "Open files",
    url: "https://individual-brain-charting.github.io/docs/",
    local: true,
  },
  {
    name: "NeuroVault",
    category: "Statistical maps",
    modalities: ["fMRI", "PET", "Atlases"],
    description:
      "Researcher-shared statistical images with per-map provenance and available metadata.",
    access: "Public collections; check collection terms",
    url: "https://neurovault.org/",
    local: true,
  },
  {
    name: "OpenNeuro",
    category: "Data repository",
    modalities: ["MRI", "PET", "EEG", "MEG", "iEEG", "NIRS"],
    description:
      "BIDS-organized research datasets covering multiple imaging and recording methods.",
    access: "Open files; dataset-specific licenses",
    url: "https://openneuro.org/",
    local: false,
  },
  {
    name: "HCP Young Adult",
    category: "Connectomics",
    modalities: ["MRI", "fMRI", "DWI", "MEG"],
    description:
      "Multimodal human connectome data and seven widely used task paradigms. Group maps are linked separately.",
    access: "Registration and data-use terms",
    url: "https://www.humanconnectome.org/study/hcp-young-adult",
    local: false,
  },
  {
    name: "HCP Development",
    category: "Development",
    modalities: ["MRI", "fMRI", "DWI"],
    description:
      "Developmental structural and functional imaging using lifespan-adapted connectome protocols.",
    access: "Provider access process",
    url: "https://www.humanconnectome.org/study/hcp-lifespan-development",
    local: false,
  },
  {
    name: "HCP Aging / AABC",
    category: "Aging",
    modalities: ["MRI", "fMRI", "DWI"],
    description:
      "Lifespan connectome research focused on mature and older adulthood.",
    access: "Provider access process",
    url: "https://www.humanconnectome.org/study/hcp-lifespan-aging",
    local: false,
  },
  {
    name: "Developing Human Connectome Project",
    category: "Development",
    modalities: ["MRI", "fMRI", "DWI"],
    description:
      "Early-life structural, diffusion, and functional imaging releases.",
    access: "Registration and provider terms",
    url: "https://www.developingconnectome.org/data-release/",
    local: false,
  },
  {
    name: "Cam-CAN",
    category: "Aging",
    modalities: ["MRI", "fMRI", "DWI", "MEG"],
    description:
      "Adult lifespan data combining cognitive measures, MRI, and MEG.",
    access: "Provider access process",
    url: "https://opendata.mrc-cbu.cam.ac.uk/projects/camcan/",
    local: false,
  },
  {
    name: "OASIS",
    category: "Aging & disease",
    modalities: ["MRI", "PET"],
    description:
      "Structural and multimodal imaging resources for aging and Alzheimer research.",
    access: "Application and collection-specific terms",
    url: "https://www.oasis-brains.org/",
    local: false,
  },
  {
    name: "ADNI",
    category: "Aging & disease",
    modalities: ["MRI", "PET"],
    description:
      "Longitudinal neuroimaging and clinical biomarker research on cognitive aging and dementia.",
    access: "Approved research access",
    url: "https://adni.loni.usc.edu/data-samples/adni-data/",
    local: false,
  },
  {
    name: "UK Biobank imaging",
    category: "Population imaging",
    modalities: ["MRI", "fMRI", "DWI"],
    description:
      "Population imaging linked to longitudinal health, genetic, and lifestyle information.",
    access: "Controlled research access",
    url: "https://www.ukbiobank.ac.uk/about-our-data/types-of-data/imaging-data/",
    local: false,
  },
  {
    name: "Natural Scenes Dataset",
    category: "Naturalistic vision",
    modalities: ["MRI", "fMRI"],
    description:
      "Repeated high-resolution measurements during viewing and recognition of natural scenes.",
    access: "Data-access agreement",
    url: "https://naturalscenesdataset.org/",
    local: false,
  },
  {
    name: "THINGS",
    category: "Object perception",
    modalities: ["fMRI", "EEG", "MEG"],
    description:
      "A shared object-image framework with multiple neural and behavioral datasets.",
    access: "Dataset-specific open releases",
    url: "https://things-initiative.org/",
    local: false,
  },
  {
    name: "BOLD5000",
    category: "Naturalistic vision",
    modalities: ["fMRI"],
    description: "Brain responses to thousands of natural and object images.",
    access: "Published data releases",
    url: "https://bold5000-dataset.github.io/website/",
    local: false,
  },
  {
    name: "StudyForrest",
    category: "Naturalistic stimulation",
    modalities: ["MRI", "fMRI", "DWI"],
    description:
      "Movie, audio, music, localizer, and structural imaging with stimulus annotations.",
    access: "Release-specific terms",
    url: "https://studyforrest.org/data.html",
    local: false,
  },
  {
    name: "Narratives",
    category: "Naturalistic language",
    modalities: ["fMRI"],
    description:
      "Spoken-story listening datasets for studying natural language comprehension.",
    access: "Open dataset",
    url: "https://github.com/snastase/narratives",
    local: false,
  },
  {
    name: "Courtois NeuroMod",
    category: "Dense sampling",
    modalities: ["MRI", "fMRI", "EEG"],
    description:
      "Repeated measurements during tasks, stories, movies, and video game play.",
    access: "Mixed open and registered access",
    url: "https://docs.cneuromod.ca/",
    local: false,
  },
  {
    name: "Midnight Scan Club",
    category: "Dense sampling",
    modalities: ["MRI", "fMRI", "MRA", "MRV"],
    description:
      "Intensive structural, task, and resting-state measurements in individual participants.",
    access: "Open dataset",
    url: "https://openneuro.org/datasets/ds000224",
    local: false,
  },
  {
    name: "Neurosynth",
    category: "Meta-analysis",
    modalities: ["fMRI meta-analysis"],
    description:
      "Term-based synthesis of published coordinate reports. These are meta-analytic associations, not direct task recordings.",
    access: "Public maps and data",
    url: "https://neurosynth.org/",
    local: false,
  },
];
export const interpretationSources = [
  { name: "BOLD physiology", url: "https://doi.org/10.1038/35084005" },
  {
    name: "Interpreting task activation",
    url: "https://doi.org/10.1016/j.tics.2005.12.004",
  },
  {
    name: "IBC first-release methods",
    url: "https://doi.org/10.1038/sdata.2018.105",
  },
  {
    name: "IBC second-release methods",
    url: "https://doi.org/10.1038/s41597-020-00670-4",
  },
  {
    name: "IBC fifth-release methods",
    url: "https://doi.org/10.1038/s41597-026-06869-1",
  },
  {
    name: "HCP task protocols",
    url: "https://www.humanconnectome.org/hcp-protocols-ya-task-fmri",
  },
  {
    name: "HCP contrast definitions",
    url: "https://wiki.humanconnectome.org/docs/Task%20fMRI%20Contrasts.html",
  },
  { name: "NeuroVault data license", url: "https://neurovault.org/FAQ" },
];
