import { infoFor, regions } from "./data.ts";
import type { Region } from "./data.ts";

export type AnatomicalTerm = {
  name: string;
  aliases: string[];
  keys: string[];
  hemisphere?: string;
  note: string;
  source: string;
};
const textbook = "https://nba.uth.tmc.edu/neuroscience/";
export const anatomicalTerms: AnatomicalTerm[] = [
  {
    name: "Heschl’s gyrus",
    aliases: [
      "Heschl",
      "Heschls",
      "Heschls gyrus",
      "Heschl gyrus",
      "primary auditory cortex",
      "A1",
    ],
    keys: ["transversetemporal"],
    note: "The transverse temporal parcel corresponds to Heschl’s gyrus. Primary auditory cortex occupies only part of this variable anatomy.",
    source: textbook + "s2/chapter01.html",
  },
  {
    name: "Broca’s area",
    aliases: ["Broca", "Brocas", "Brocas area", "Broca area"],
    keys: ["parsopercularis", "parstriangularis"],
    hemisphere: "left",
    note: "These left inferior frontal parcels are anatomical landmarks for the classical Broca territory. They do not define its exact functional or cellular borders.",
    source: textbook + "s4/chapter08.html",
  },
  {
    name: "Primary motor cortex",
    aliases: ["primary motor cortex", "M1"],
    keys: ["precentral", "paracentral"],
    note: "Motor cortex lies mainly in the precentral gyrus and anterior paracentral lobule. These full parcels include territory beyond M1.",
    source: textbook + "s3/chapter03.html",
  },
  {
    name: "Primary somatosensory cortex",
    aliases: ["primary somatosensory cortex", "primary sensory cortex", "S1"],
    keys: ["postcentral", "paracentral"],
    note: "The postcentral gyrus and posterior paracentral lobule contain primary somatosensory territory. This atlas does not separate its cytoarchitectonic areas.",
    source: textbook + "s2/chapter01.html",
  },
  {
    name: "Primary visual cortex",
    aliases: [
      "primary visual cortex",
      "V1",
      "striate cortex",
      "calcarine cortex",
    ],
    keys: ["pericalcarine"],
    note: "The pericalcarine parcel is an anatomical guide to V1 around the calcarine sulcus. It is not an individually measured functional V1 map.",
    source: textbook + "s2/chapter15.html",
  },
  {
    name: "Dorsal striatum",
    aliases: ["dorsal striatum", "neostriatum"],
    keys: ["caudate-nucleus", "putamen"],
    note: "The caudate and putamen form the dorsal striatum. Select either existing mesh; there is no separate combined striatal mesh.",
    source: textbook + "s3/chapter04.html",
  },
  {
    name: "Ventral striatum",
    aliases: ["ventral striatum"],
    keys: ["nucleus-accumbens"],
    note: "The nucleus accumbens is a major component of the ventral striatum. The whole ventral striatum is not separately segmented here.",
    source: textbook + "s3/chapter04.html",
  },
  {
    name: "Lentiform nucleus",
    aliases: ["lentiform", "lenticular nucleus"],
    keys: ["putamen", "globus-pallidus"],
    note: "Lentiform (lenticular) nucleus groups the putamen and globus pallidus. They remain separate meshes in this atlas.",
    source: textbook + "s3/chapter04.html",
  },
  {
    name: "Pallidum",
    aliases: ["pallidum", "GPe", "GPi"],
    keys: ["globus-pallidus"],
    note: "The pallidal label combines internal and external segments. GPi and GPe cannot be selected individually.",
    source: textbook + "s3/chapter04.html",
  },
  {
    name: "Inferior frontal gyrus",
    aliases: ["inferior frontal gyrus", "IFG"],
    keys: ["parsopercularis", "parstriangularis", "parsorbitalis"],
    note: "This gyrus is represented by three anatomical parcels: pars opercularis, pars triangularis, and pars orbitalis, in each hemisphere.",
    source: "https://surfer.nmr.mgh.harvard.edu/fswiki/CorticalParcellation",
  },
  {
    name: "Hypothalamus · composite context",
    aliases: ["hypothalamus", "hypothalamic region"],
    keys: ["ventral-diencephalon"],
    note: "Only the broader ventral-diencephalon label is available. It includes hypothalamic and neighboring territories; it does not separately segment the hypothalamus or its nuclei.",
    source: "https://surfer.nmr.mgh.harvard.edu/fswiki/SubcorticalSegmentation",
  },
];

export function normalizeSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
const termsFor = (region: Region) =>
  anatomicalTerms.filter(
    (term) =>
      term.keys.includes(region.key) &&
      (!term.hemisphere || term.hemisphere === region.hemisphere),
  );
const index = regions.map((region) => ({
  region,
  text: normalizeSearch(
    [
      region.name,
      region.hemisphere,
      region.group,
      region.key,
      region.hemisphere === "left"
        ? "lh"
        : region.hemisphere === "right"
          ? "rh"
          : "midline",
      ...infoFor(region).functions,
      ...termsFor(region).flatMap((term) => [term.name, ...term.aliases]),
    ].join(" "),
  ),
}));

export function searchRegions(query: string): Region[] {
  const terms = normalizeSearch(query).split(" ").filter(Boolean);
  return index
    .filter(({ text }) => terms.every((term) => text.includes(term)))
    .map(({ region }) => region);
}
export function matchedAnatomicalTerms(query: string) {
  const text = ` ${normalizeSearch(query)} `;
  return anatomicalTerms.filter((term) =>
    term.aliases.some((alias) => text.includes(` ${normalizeSearch(alias)} `)),
  );
}
