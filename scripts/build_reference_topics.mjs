import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function buildReferenceTopics(articles) {
  return articles.map(({ id, title, regions, reading, context }) => ({
    id,
    title,
    regions,
    ...(context ? { context } : {}),
    ...(reading ? { reading } : {}),
  }));
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const catalogue = JSON.parse(
    await readFile(
      new URL("../src/reference-data.json", import.meta.url),
      "utf8",
    ),
  );
  await writeFile(
    new URL("../src/reference-topic-index.json", import.meta.url),
    `${JSON.stringify(buildReferenceTopics(catalogue.articles), null, 2)}\n`,
  );
}
