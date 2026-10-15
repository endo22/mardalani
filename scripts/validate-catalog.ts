import { destinations } from "../src/data/destinations";
import { attractionCatalogs } from "../src/data/attractions";
import { destinationTemplates } from "../src/data/templates";

const errors: string[] = [];
const allIds = new Map<string, string>();

for (const d of destinations) {
  const cats = attractionCatalogs[d.slug] ?? [];
  const tmpls = destinationTemplates[d.slug] ?? [];
  if (d.hasFullTemplate) {
    if (cats.length < 10) {
      errors.push(`${d.slug}: catalog too small (${cats.length})`);
    }
    if (tmpls.length < 2) errors.push(`${d.slug}: templates missing`);
  }
  const names = new Set(cats.map((a) => a.name.toLowerCase()));
  for (const a of cats) {
    if (allIds.has(a.id)) {
      errors.push(`duplicate id ${a.id} (${allIds.get(a.id)} vs ${d.slug})`);
    }
    allIds.set(a.id, d.slug);
  }
  for (const day of tmpls) {
    for (const act of day.activities) {
      if (!names.has(act.name.toLowerCase())) {
        errors.push(`${d.slug}: template activity not in catalog: ${act.name}`);
      }
    }
  }
}

const summary = {
  destinations: destinations.length,
  full: destinations.filter((d) => d.hasFullTemplate).map((d) => d.slug),
  attractionTotals: Object.fromEntries(
    Object.entries(attractionCatalogs).map(([k, v]) => [k, v.length]),
  ),
  templateDays: Object.fromEntries(
    Object.entries(destinationTemplates).map(([k, v]) => [k, v.length]),
  ),
  errors,
};

console.log(JSON.stringify(summary, null, 2));
if (errors.length) process.exit(1);
