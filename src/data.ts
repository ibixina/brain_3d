import manifest from "./atlas-manifest.json" with { type: "json" };

export type Region = {
  id: string;
  key: string;
  name: string;
  hemisphere: string;
  group: string;
  color: string;
  kind: string;
  source: string;
  offset: number;
  vertices: number;
  triangles: number;
  center: number[];
  detail: { url: string; vertices: number; triangles: number };
};
export const regions = manifest.parts as Region[];
export const groupColors = manifest.groups as Record<string, string>;
export const groups = Object.keys(groupColors);
export const atlas = manifest;
export type Info = {
  summary: string;
  functions: string[];
  anatomy: string;
  subdivisions: string[];
  connections: string[];
  context: string;
  source: string;
};
const ut = "https://nba.uth.tmc.edu/neuroscience/";
const motor = ut + "s3/chapter03.html";
const memory = ut + "s4/chapter05.html";
const amygdala = ut + "s4/chapter06.html";
const basal = ut + "s3/chapter04.html";
const cerebellum = ut + "s3/chapter05.html";
const general = "https://www.ncbi.nlm.nih.gov/books/NBK10915/";
const subcorticalReferences: Record<string, string> = {
  hippocampus: memory,
  amygdala,
  "ventral-diencephalon":
    "https://surfer.nmr.mgh.harvard.edu/fswiki/SubcorticalSegmentation",
  "caudate-nucleus": basal,
  putamen: basal,
  "globus-pallidus": basal,
  "nucleus-accumbens": basal,
  "cerebellar-cortex": cerebellum,
  "cerebellar-white-matter": cerebellum,
};
const cortical: Record<string, [string, string[], string, string[]]> = {
  bankssts: [
    "The banks lining the superior temporal sulcus sit between the superior and middle temporal gyri. This association territory participates in the interpretation of complex social and sensory information.",
    ["Social perception", "Audiovisual integration", "Biological motion"],
    "On the lateral temporal surface, along both sides of the superior temporal sulcus.",
    ["superiortemporal", "middletemporal", "inferiorparietal"],
  ],
  caudalanteriorcingulate: [
    "The caudal anterior cingulate links information about effort and behavioral demands with the selection of actions. Its contributions overlap with wider control, motor, and salience networks.",
    ["Action selection", "Performance monitoring", "Effort allocation"],
    "The posterior portion of the anterior cingulate on the medial hemisphere, above the corpus callosum.",
    ["precentral", "superiorfrontal", "rostralanteriorcingulate"],
  ],
  caudalmiddlefrontal: [
    "This posterior part of the middle frontal gyrus is an association region involved in organizing behavior. It lies near premotor territories and participates in distributed executive networks.",
    ["Cognitive control", "Working memory", "Motor planning"],
    "The lateral frontal surface, anterior to the precentral sulcus.",
    ["precentral", "rostralmiddlefrontal", "superiorparietal"],
  ],
  cuneus: [
    "The cuneus is a wedge of medial occipital cortex. Its lower border adjoins the calcarine sulcus, around which early visual representations are organized.",
    ["Visual processing", "Visuospatial processing"],
    "Between the parieto-occipital sulcus and the calcarine sulcus on the medial surface.",
    ["pericalcarine", "lingual", "precuneus"],
  ],
  entorhinal: [
    "The entorhinal cortex is a major interface between association cortex and the hippocampal formation. It contributes to the representation of space, events, and memory.",
    ["Memory encoding", "Spatial representation", "Hippocampal communication"],
    "Medial temporal cortex, anterior to and continuous with the parahippocampal region.",
    ["hippocampus", "parahippocampal", "temporalpole"],
  ],
  frontalpole: [
    "The frontal pole occupies the most anterior part of the cerebral cortex. It participates in coordinating higher order goals and considering possibilities beyond the immediate task.",
    ["Prospective thinking", "Goal coordination", "Complex decision making"],
    "At the anterior tip of the frontal lobe.",
    ["rostralmiddlefrontal", "superiorfrontal", "medialorbitofrontal"],
  ],
  fusiform: [
    "The fusiform gyrus is part of ventral temporal association cortex. Different portions contribute to representing complex visual forms, including faces, objects, and written words.",
    ["Visual recognition", "Face processing", "Reading networks"],
    "On the inferior temporal surface, between the collateral and occipitotemporal sulci.",
    ["inferiortemporal", "lingual", "parahippocampal"],
  ],
  inferiorparietal: [
    "The inferior parietal lobule integrates information across sensory and association systems. Its functional organization differs across subregions and hemispheres.",
    [
      "Multisensory integration",
      "Attention",
      "Language and numerical cognition",
    ],
    "The lower lateral parietal surface, behind the postcentral region and above the temporal lobe.",
    ["supramarginal", "superiorparietal", "middletemporal"],
  ],
  inferiortemporal: [
    "The inferior temporal gyrus forms part of the ventral visual pathway. It contributes to recognizing and distinguishing objects using complex visual features.",
    ["Object recognition", "Visual categorization", "Visual memory"],
    "The lower lateral temporal surface, extending toward the inferior surface.",
    ["fusiform", "middletemporal", "lateraloccipital"],
  ],
  insula: [
    "The insula integrates signals about the internal state of the body with sensory, emotional, and cognitive information. Anterior and posterior portions have different patterns of organization.",
    ["Interoception", "Taste and visceral sensation", "Salience processing"],
    "Deep within the lateral sulcus, covered by the frontal, parietal, and temporal opercula.",
    ["rostralanteriorcingulate", "superiortemporal", "parsopercularis"],
  ],
  isthmuscingulate: [
    "The isthmus is the narrow posterior transition between cingulate and parahippocampal cortex. It forms part of a broader medial network associated with memory and spatial context.",
    ["Contextual memory", "Spatial orientation", "Medial network integration"],
    "Behind and below the splenium of the corpus callosum, on the medial hemisphere.",
    ["posteriorcingulate", "parahippocampal", "precuneus"],
  ],
  lateraloccipital: [
    "The lateral occipital cortex is a broad atlas parcel covering visual association territory. It contributes to processing shapes and the organization of visible objects.",
    ["Shape perception", "Object processing", "Visual integration"],
    "On the lateral surface of the occipital lobe.",
    ["inferiortemporal", "cuneus", "lingual"],
  ],
  lateralorbitofrontal: [
    "The lateral orbitofrontal cortex participates in using outcomes to adjust behavior. Its function depends on interactions with sensory, limbic, and other prefrontal regions.",
    ["Outcome evaluation", "Behavioral updating", "Decision making"],
    "The lateral part of the inferior frontal surface, above the orbit.",
    ["medialorbitofrontal", "parsorbitalis", "amygdala"],
  ],
  lingual: [
    "The lingual gyrus is medial occipitotemporal cortex associated with vision. It contains early and associative visual territory and contributes to processing complex visual patterns.",
    ["Visual processing", "Pattern analysis", "Visual memory networks"],
    "Below the calcarine sulcus and above the collateral sulcus on the medial inferior surface.",
    ["pericalcarine", "fusiform", "cuneus"],
  ],
  medialorbitofrontal: [
    "The medial orbitofrontal cortex participates in evaluating outcomes and representing value. It is embedded in wider circuits connecting internal state, memory, and choice.",
    ["Value representation", "Reward evaluation", "Affective decision making"],
    "The medial inferior surface of the frontal lobe.",
    ["lateralorbitofrontal", "rostralanteriorcingulate", "amygdala"],
  ],
  middletemporal: [
    "The middle temporal gyrus is a broad association region. Different parts contribute to semantic knowledge, language, and the interpretation of complex sensory events.",
    ["Semantic processing", "Language networks", "Multimodal association"],
    "Between the superior and inferior temporal sulci on the lateral surface.",
    ["superiortemporal", "inferiortemporal", "inferiorparietal"],
  ],
  paracentral: [
    "The paracentral lobule continues the precentral and postcentral gyri onto the medial surface. It includes motor and sensory representations associated particularly with the lower limb.",
    ["Lower limb motor control", "Somatic sensation"],
    "On the superior medial hemisphere, straddling the medial end of the central sulcus.",
    ["precentral", "postcentral", "superiorfrontal"],
  ],
  parahippocampal: [
    "The parahippocampal gyrus provides a cortical interface to medial temporal memory systems. Posterior portions are associated with scenes and contextual information.",
    ["Contextual memory", "Scene processing", "Memory system communication"],
    "On the medial inferior temporal surface, adjacent to the hippocampal formation.",
    ["hippocampus", "entorhinal", "isthmuscingulate"],
  ],
  parsopercularis: [
    "The pars opercularis is the posterior portion of the inferior frontal gyrus. In the language dominant hemisphere it contributes to speech and language networks; it also participates in action related processing.",
    ["Speech and language networks", "Action processing", "Cognitive control"],
    "Immediately anterior to the lower precentral region, above the lateral sulcus.",
    ["parstriangularis", "precentral", "superiortemporal"],
  ],
  parsorbitalis: [
    "The pars orbitalis is the inferior anterior portion of the inferior frontal gyrus. It participates in association networks involved in semantic and affective processing.",
    ["Semantic processing", "Affective integration", "Controlled retrieval"],
    "The ventral part of the inferior frontal gyrus, near the orbital surface.",
    ["parstriangularis", "lateralorbitofrontal", "temporalpole"],
  ],
  parstriangularis: [
    "The pars triangularis occupies the middle portion of the inferior frontal gyrus. It contributes to selecting and combining information in language and broader cognitive control networks.",
    ["Language processing", "Semantic selection", "Cognitive control"],
    "Between the ascending and horizontal rami of the lateral sulcus.",
    ["parsopercularis", "parsorbitalis", "superiortemporal"],
  ],
  pericalcarine: [
    "Pericalcarine cortex follows the calcarine sulcus and overlaps much of primary visual cortex. Visual input is represented in an ordered map of the opposite visual field.",
    ["Early visual processing", "Retinotopic representation"],
    "Along the upper and lower banks of the calcarine sulcus on the medial occipital surface.",
    ["cuneus", "lingual", "thalamus"],
  ],
  postcentral: [
    "The postcentral gyrus contains much of primary somatosensory cortex. It receives information about the opposite side of the body, organized in a somatotopic map.",
    ["Touch", "Proprioception", "Somatic sensory discrimination"],
    "Immediately posterior to the central sulcus.",
    ["precentral", "superiorparietal", "thalamus"],
  ],
  posteriorcingulate: [
    "The posterior cingulate participates in distributed networks associated with internally directed cognition. It interacts with memory and association regions rather than serving a single isolated function.",
    [
      "Autobiographical memory",
      "Internally directed cognition",
      "Context integration",
    ],
    "Medial cortex above and behind the posterior corpus callosum.",
    ["precuneus", "isthmuscingulate", "parahippocampal"],
  ],
  precentral: [
    "The precentral gyrus contains much of primary motor cortex. It helps generate and coordinate voluntary movement through descending pathways and interactions with other motor systems.",
    ["Voluntary movement", "Motor output", "Movement parameter control"],
    "Immediately anterior to the central sulcus, extending from the lateral to the medial surface.",
    ["postcentral", "paracentral", "caudalmiddlefrontal"],
  ],
  precuneus: [
    "The precuneus is a medial parietal association region. Different portions participate in visuospatial processing, memory related cognition, and large scale association networks.",
    [
      "Visuospatial cognition",
      "Episodic memory networks",
      "Self related processing",
    ],
    "Between the marginal ramus of the cingulate sulcus and the parieto-occipital sulcus.",
    ["posteriorcingulate", "superiorparietal", "cuneus"],
  ],
  rostralanteriorcingulate: [
    "The rostral anterior cingulate participates in interactions between emotion, autonomic state, and behavior. Its functional organization varies across its subregions.",
    ["Affective processing", "Autonomic integration", "Behavior regulation"],
    "The anterior medial cortex curving around the front of the corpus callosum.",
    ["caudalanteriorcingulate", "medialorbitofrontal", "insula"],
  ],
  rostralmiddlefrontal: [
    "The rostral middle frontal gyrus forms a large part of lateral prefrontal association cortex. It participates in maintaining goals and using information to guide flexible behavior.",
    ["Working memory", "Planning", "Executive control"],
    "The anterior portion of the middle frontal gyrus on the lateral frontal surface.",
    ["caudalmiddlefrontal", "superiorfrontal", "frontalpole"],
  ],
  superiorfrontal: [
    "The superior frontal gyrus spans lateral and medial frontal territories. Its large extent includes regions involved in executive operations and higher order motor control.",
    ["Executive processing", "Working memory", "Motor planning"],
    "The upper frontal surface, extending onto the medial hemisphere.",
    ["rostralmiddlefrontal", "caudalmiddlefrontal", "paracentral"],
  ],
  superiorparietal: [
    "The superior parietal lobule integrates information about the body and surrounding space. It supports the transformation of sensory information into coordinated actions.",
    ["Spatial attention", "Sensorimotor integration", "Visually guided action"],
    "The dorsal parietal surface, behind the postcentral gyrus and above the intraparietal sulcus.",
    ["postcentral", "precuneus", "inferiorparietal"],
  ],
  superiortemporal: [
    "The superior temporal gyrus spans auditory and association territory. Different portions support auditory processing and language related operations.",
    ["Auditory processing", "Speech perception", "Language networks"],
    "The upper lateral temporal surface, below the lateral sulcus.",
    ["transversetemporal", "bankssts", "middletemporal"],
  ],
  supramarginal: [
    "The supramarginal gyrus is part of the inferior parietal lobule. It participates in integrating sensory information and in networks supporting phonological and action related processing.",
    ["Phonological processing", "Sensorimotor integration", "Attention"],
    "Curving around the posterior end of the lateral sulcus.",
    ["inferiorparietal", "postcentral", "superiortemporal"],
  ],
  temporalpole: [
    "The temporal pole is the anterior end of the temporal lobe. It participates in integrating semantic, social, and emotionally relevant information.",
    ["Semantic integration", "Social cognition", "Affective association"],
    "The most anterior temporal cortex, extending across lateral, medial, and inferior surfaces.",
    ["entorhinal", "superiortemporal", "amygdala"],
  ],
  transversetemporal: [
    "The transverse temporal gyrus, also called Heschl’s gyrus, contains much of primary auditory cortex. Its exact shape and number vary between people and hemispheres.",
    ["Early auditory processing", "Frequency representation"],
    "On the superior temporal plane, inside the lateral sulcus.",
    ["superiortemporal", "insula", "thalamus"],
  ],
};
const subcortical: Record<
  string,
  [string, string[], string, string[], string[]]
> = {
  thalamus: [
    "The thalamus is a collection of nuclei linking the cortex with sensory, motor, and association systems. Its nuclei have distinct connections and contribute to attention and brain state.",
    [
      "Sensory and motor relay",
      "Cortical communication",
      "Sleep and wake regulation",
    ],
    "Paired diencephalic structures bordering the third ventricle, above the brainstem. The source thalamus-proper label excludes the geniculate bodies.",
    [
      "Anterior nuclear group",
      "Medial and lateral nuclear groups",
      "Pulvinar · not separately segmented",
    ],
    ["precentral", "postcentral", "pericalcarine"],
  ],
  "caudate-nucleus": [
    "The caudate is a curved component of the striatum. It participates in basal ganglia circuits that contribute to selecting actions and learning associations between actions and outcomes.",
    ["Action selection", "Associative learning", "Goal directed behavior"],
    "A C shaped nucleus following the lateral ventricle, with a head, body, and tail.",
    ["Head", "Body", "Tail"],
    ["putamen", "globus-pallidus", "thalamus"],
  ],
  putamen: [
    "The putamen is a major input component of the basal ganglia. It receives cortical signals and participates in circuits involved in movement and learning.",
    ["Motor circuit processing", "Skill learning", "Action selection"],
    "Lateral to the globus pallidus, beneath the insular cortex.",
    [
      "Dorsal striatal territory",
      "Sensorimotor territories · functional subdivisions",
    ],
    ["caudate-nucleus", "globus-pallidus", "precentral"],
  ],
  "globus-pallidus": [
    "The globus pallidus is a basal ganglia structure with internal and external segments. It helps regulate activity flowing through motor and other cortico-basal ganglia loops.",
    ["Basal ganglia output", "Motor regulation", "Action circuit processing"],
    "Medial to the putamen and lateral to the internal capsule.",
    ["External segment · GPe", "Internal segment · GPi"],
    ["putamen", "thalamus", "caudate-nucleus"],
  ],
  hippocampus: [
    "The hippocampus is a curved medial temporal structure essential to forming and organizing episodic memories. It interacts closely with surrounding cortical regions and participates in spatial representation.",
    [
      "Episodic memory",
      "Spatial representation",
      "Memory consolidation networks",
    ],
    "Within the medial temporal lobe, adjacent to the inferior horn of the lateral ventricle.",
    [
      "CA fields · CA1, CA2, CA3",
      "Dentate gyrus",
      "Subiculum · formation boundary varies by atlas",
    ],
    ["entorhinal", "parahippocampal", "amygdala"],
  ],
  amygdala: [
    "The amygdala is a group of medial temporal nuclei involved in learning about biologically significant events. It interacts with memory, sensory, autonomic, and decision systems.",
    [
      "Emotional learning",
      "Salience evaluation",
      "Autonomic and behavioral responses",
    ],
    "Anterior to the hippocampus, deep within the medial temporal lobe.",
    ["Basolateral nuclear complex", "Centromedial nuclei", "Cortical nuclei"],
    ["hippocampus", "medialorbitofrontal", "temporalpole"],
  ],
  "nucleus-accumbens": [
    "The nucleus accumbens forms part of the ventral striatum. It integrates inputs relevant to motivation and contributes to reinforcement learning and the selection of behavior.",
    ["Motivation", "Reinforcement learning", "Reward related behavior"],
    "In the basal forebrain, near the junction of the caudate and putamen.",
    ["Core", "Shell"],
    ["caudate-nucleus", "amygdala", "medialorbitofrontal"],
  ],
  "ventral-diencephalon": [
    "This FreeSurfer segmentation combines several structures in the ventral diencephalic area. It is a composite imaging label and should not be interpreted as a single nucleus or functional unit.",
    ["Composite anatomical label", "Homeostatic and motor systems represented"],
    "Ventral to the thalamus; includes portions of the hypothalamic and adjacent subthalamic region.",
    [
      "Hypothalamic region",
      "Subthalamic region",
      "Adjacent ventral structures · composite label",
    ],
    ["thalamus", "brainstem", "amygdala"],
  ],
  brainstem: [
    "The brainstem connects the forebrain with the spinal cord and cerebellum. Its nuclei and pathways support sensory and motor signaling, arousal, and vital autonomic functions.",
    [
      "Autonomic regulation",
      "Sensory and motor pathways",
      "Arousal and sleep systems",
    ],
    "Inferior to the diencephalon and anterior to the cerebellum.",
    ["Midbrain", "Pons", "Medulla oblongata"],
    ["thalamus", "cerebellar-cortex", "fourth-ventricle"],
  ],
  "cerebellar-cortex": [
    "The cerebellar cortex is a highly folded sheet involved in coordinating movement and learning from error. Cerebellar circuits also participate in cognitive and affective functions.",
    ["Movement coordination", "Balance and posture", "Motor learning"],
    "In the posterior cranial fossa, behind the brainstem and below the occipital lobes.",
    [
      "Anterior lobe",
      "Posterior lobe",
      "Flocculonodular lobe · lobules not separately segmented",
    ],
    ["brainstem", "thalamus", "precentral"],
  ],
  "cerebral-white-matter": [
    "Cerebral white matter contains axons and supporting glial cells connecting cortical and deep structures. This model shows the segmented compartment, rather than individual fiber bundles.",
    [
      "Communication between brain regions",
      "Interhemispheric communication",
      "Cortical and subcortical signaling",
    ],
    "Deep to the cerebral cortex, surrounding the ventricles and deep nuclei.",
    [
      "Association pathways",
      "Commissural pathways",
      "Projection pathways · fibers not reconstructed",
    ],
    ["superiorfrontal", "thalamus", "precentral"],
  ],
  "cerebellar-white-matter": [
    "Cerebellar white matter carries axons between the cortex, deep cerebellar nuclei, and cerebellar peduncles. Its branching internal arrangement is often called the arbor vitae.",
    ["Cerebellar communication", "Cortical input and output pathways"],
    "Within the cerebellum, deep to its cortical sheet.",
    ["Arbor vitae", "Peduncular connections · not individually segmented"],
    ["cerebellar-cortex", "brainstem", "thalamus"],
  ],
  "lateral-ventricle": [
    "The lateral ventricles are paired cerebrospinal fluid filled cavities within the cerebral hemispheres. They communicate with the third ventricle through the interventricular foramina.",
    ["CSF compartment", "Connection to the third ventricle"],
    "Within each cerebral hemisphere, following a curved course through the forebrain.",
    ["Frontal horn", "Body and atrium", "Occipital and temporal horns"],
    ["third-ventricle", "choroid-plexus", "caudate-nucleus"],
  ],
  "inferior-lateral-ventricle": [
    "The inferior horn is the temporal extension of a lateral ventricle. FreeSurfer labels it separately from the main ventricular compartment.",
    ["CSF compartment", "Temporal ventricular extension"],
    "Within the temporal lobe, adjacent to the hippocampus.",
    ["Temporal horn"],
    ["lateral-ventricle", "hippocampus", "choroid-plexus"],
  ],
  "third-ventricle": [
    "The third ventricle is a narrow midline cerebrospinal fluid cavity. It connects the paired lateral ventricles with the cerebral aqueduct leading to the fourth ventricle.",
    ["CSF passage", "Diencephalic ventricular compartment"],
    "Between the left and right diencephalon, bounded in part by the thalami.",
    ["Midline cavity", "Ventricular recesses · not separately labeled"],
    ["lateral-ventricle", "fourth-ventricle", "thalamus"],
  ],
  "fourth-ventricle": [
    "The fourth ventricle is a cerebrospinal fluid cavity between the brainstem and cerebellum. Its apertures connect the ventricular system with the subarachnoid space.",
    ["CSF passage", "Communication with subarachnoid spaces"],
    "Posterior to the pons and upper medulla, anterior to the cerebellum.",
    [
      "Ventricular floor",
      "Ventricular roof",
      "Median and lateral apertures · not resolved",
    ],
    ["third-ventricle", "brainstem", "cerebellar-cortex"],
  ],
  "choroid-plexus": [
    "The choroid plexus is specialized vascular and epithelial tissue in the ventricles. It produces much of the cerebrospinal fluid and contributes to the blood–CSF barrier.",
    ["CSF production", "Blood–CSF barrier"],
    "Within parts of the ventricular system; this label represents plexus in the lateral ventricle.",
    ["Vascular core", "Choroid epithelial layer · not resolved"],
    ["lateral-ventricle", "inferior-lateral-ventricle", "third-ventricle"],
  ],
};
export function infoFor(region: Region): Info {
  const c = cortical[region.key];
  if (c)
    return {
      summary: c[0],
      functions: c[1],
      anatomy: c[2],
      subdivisions: [
        "Atlas parcel of the cerebral cortex",
        "Pial boundary shown; cortical layers are not individually modeled",
        "Finer functional subdivisions do not necessarily follow gyral borders",
      ],
      connections: c[3],
      context:
        "Functions reflect distributed networks. Atlas boundaries describe anatomy and do not establish a one-to-one mapping between a region and a behavior.",
      source: ["entorhinal", "parahippocampal", "isthmuscingulate"].includes(
        region.key,
      )
        ? memory
        : ["precentral", "paracentral", "caudalmiddlefrontal"].includes(
              region.key,
            )
          ? motor
          : general,
    };
  const s = subcortical[region.key];
  if (s)
    return {
      summary: s[0],
      functions: s[1],
      anatomy: s[2],
      subdivisions: s[3],
      connections: s[4],
      context:
        "Subdivisions listed here describe internal anatomy. They are not individually segmented in this reference mesh. Individual anatomy and functional organization vary.",
      source: subcorticalReferences[region.key] ?? general,
    };
  return {
    summary:
      "The corpus callosum is the largest cerebral commissure, containing axons connecting the two hemispheres. This mesh represents one of five geometrically defined FreeSurfer callosal segments.",
    functions: [
      "Interhemispheric communication",
      "Integration across cerebral hemispheres",
    ],
    anatomy: "Midline white matter arching above the ventricular system.",
    subdivisions: [
      "Rostrum and genu",
      "Body",
      "Isthmus and splenium · geometric atlas segments differ from these divisions",
    ],
    connections: [
      "cerebral-white-matter",
      "superiorfrontal",
      "posteriorcingulate",
    ],
    context:
      "These five atlas segments divide the callosum geometrically. They do not reconstruct the individual fibers or their cortical endpoints.",
    source: general,
  };
}
export const hemisphereLabel = (h: string) =>
  h === "midline" ? "Midline" : `${h[0].toUpperCase() + h.slice(1)} hemisphere`;
export const relatedRegions = (region: Region) =>
  infoFor(region)
    .connections.map(
      (key) =>
        regions.find(
          (p) =>
            p.key === key &&
            (p.hemisphere === region.hemisphere || p.hemisphere === "midline"),
        ) || regions.find((p) => p.key === key),
    )
    .filter((p): p is Region => !!p);
export const sources = [
  {
    title: "FreeSurfer reference anatomy",
    label: "MODEL & SEGMENTATION",
    text: "fsaverage pial surfaces, Desikan–Killiany cortical labels, and aseg volumetric segmentation. Anatomical reference, not an individual patient scan.",
    url: "https://surfer.nmr.mgh.harvard.edu/fswiki/CorticalParcellation",
  },
  {
    title: "Nilearn surface datasets",
    label: "GEOMETRY",
    text: "fsaverage5 for the overview and fsaverage6 for close inspection. The detailed cortical meshes contain approximately four times as many faces.",
    url: "https://nilearn.github.io/stable/modules/generated/nilearn.datasets.fetch_surf_fsaverage.html",
  },
  {
    title: "Neuroscience Online",
    label: "FUNCTION & ANATOMY",
    text: "An academic neuroscience textbook from UTHealth Houston. Chapters on motor systems, basal ganglia, the cerebellum, and memory.",
    url: ut,
  },
  {
    title: "Neuroscience · NCBI Bookshelf",
    label: "FOUNDATIONS",
    text: "Purves and colleagues, 2nd edition (2001). Foundational anatomy and physiology; this is not a live review of the research literature.",
    url: general,
  },
  {
    title: "Allen Brain Map",
    label: "EXPLORE FURTHER",
    text: "External reference for brain atlases, cell types, and gene expression. These cellular and molecular datasets are not embedded in this model.",
    url: "https://portal.brain-map.org/",
  },
  {
    title: "Human Connectome Project",
    label: "EXPLORE FURTHER",
    text: "External imaging and connectivity datasets. This app does not represent a measured connectome or reconstruct individual axonal pathways.",
    url: "https://www.humanconnectome.org/study/hcp-young-adult",
  },
  {
    title: "University of Utah dissection films",
    label: "REAL SPECIMEN VIDEOS",
    text: "Neuroanatomy Video Lab teaching films by Suzanne Stensaas, including human specimens and anatomical sections.",
    url: "https://library.med.utah.edu/publishing/collection/neuroanatomy-video-lab-brain-dissections/",
  },
  {
    title: "UBC Neuroanatomy Series",
    label: "REAL SPECIMEN VIDEOS",
    text: "University of British Columbia laboratory teaching videos covering cortical, deep, brainstem, and cerebellar anatomy.",
    url: "https://www.neuroanatomy.ca/videos.html",
  },
];
