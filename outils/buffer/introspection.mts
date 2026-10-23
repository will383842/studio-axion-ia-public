/**
 * LOT R1 — RELEVÉ DU SCHÉMA GRAPHQL DE BUFFER (LECTURE SEULE, GRATUIT).
 *
 * Envoie UNE requête d'introspection standard (`query { __schema … }`) à https://api.buffer.com et écrit le schéma dans
 * `docs/buffer/schema-2026-10.json`. Aucune mutation, aucune lecture de compte : le fichier ne contient que la
 * description du schéma (types, champs, arguments), jamais une clé ni un identifiant réel.
 *
 * Usage (racine du dépôt), la clé chargée dans l'environnement du SEUL processus, jamais affichée :
 *   BUFFER_API_KEY=… pnpm exec tsx outils/buffer/introspection.mts
 * Option `--resume` : affiche seulement les types utiles au lot R1 (Post, Channel, Organization, createPost…).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
const SORTIE = join(RACINE, "docs", "buffer", "schema-2026-10.json");

const INTROSPECTION = `query Introspection {
  __schema {
    queryType { name }
    mutationType { name }
    types {
      kind name description
      fields(includeDeprecated: true) {
        name description isDeprecated deprecationReason
        args { name description type { ...Ref } defaultValue }
        type { ...Ref }
      }
      inputFields { name description type { ...Ref } defaultValue }
      enumValues(includeDeprecated: true) { name description isDeprecated }
      possibleTypes { name }
      interfaces { name }
    }
  }
}
fragment Ref on __Type { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } } }`;

const cle = process.env.BUFFER_API_KEY?.trim();
if (!cle) {
  console.error("BUFFER_API_KEY absente de l'environnement : rien n'est lu.");
  process.exit(2);
}

const r = await fetch("https://api.buffer.com", {
  method: "POST",
  headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${cle}` },
  body: JSON.stringify({ query: INTROSPECTION }),
  signal: AbortSignal.timeout(30_000),
});
if (!r.ok) {
  // Jamais la clé ni la réponse brute (elle pourrait la reprendre) : le code HTTP seulement.
  console.error(`Buffer a répondu ${r.status}.`);
  process.exit(1);
}
const corps = (await r.json()) as { data?: { __schema?: unknown }; errors?: { message?: string }[] };
if (!corps.data?.__schema) {
  console.error(`Introspection refusée : ${(corps.errors ?? []).map((e) => e.message).join(" ; ").replaceAll(cle, "****")}`);
  process.exit(1);
}
mkdirSync(dirname(SORTIE), { recursive: true });
const contenu = JSON.stringify({ _note: "Schéma GraphQL de https://api.buffer.com relevé par introspection (lecture seule) le " + new Date().toISOString().slice(0, 10) + ". Aucune donnée de compte.", ...corps.data }, null, 1);
if (contenu.includes(cle)) throw new Error("La clé apparaît dans le schéma : rien n'est écrit.");
writeFileSync(SORTIE, contenu + "\n");
console.log(`Schéma écrit : ${SORTIE}`);

if (process.argv.includes("--resume")) {
  type Ref = { kind: string; name: string | null; ofType?: Ref | null };
  const nomType = (t: Ref): string => (t.kind === "NON_NULL" ? `${nomType(t.ofType!)}!` : t.kind === "LIST" ? `[${nomType(t.ofType!)}]` : String(t.name));
  const s = corps.data.__schema as { types: { name: string; kind: string; fields?: { name: string; args: { name: string; type: Ref }[]; type: Ref }[] | null; inputFields?: { name: string; type: Ref }[] | null; enumValues?: { name: string }[] | null; possibleTypes?: { name: string }[] | null }[] };
  const utiles = /^(Query|Mutation|Post|Channel|Organization|Account|CreatePost|PostInput|Assets|Video|Image|PostStatus|ShareMode|Service|Metadata|.*Payload|.*Error|.*Input|.*Asset.*)/;
  for (const t of s.types.filter((x) => !x.name.startsWith("__") && utiles.test(x.name))) {
    console.log(`\n${t.kind} ${t.name}`);
    for (const f of t.fields ?? []) console.log(`  ${f.name}${f.args.length ? `(${f.args.map((a) => `${a.name}: ${nomType(a.type)}`).join(", ")})` : ""}: ${nomType(f.type)}`);
    for (const f of t.inputFields ?? []) console.log(`  ${f.name}: ${nomType(f.type)}`);
    if (t.enumValues?.length) console.log(`  = ${t.enumValues.map((e) => e.name).join(" | ")}`);
    if (t.possibleTypes?.length) console.log(`  = ${t.possibleTypes.map((e) => e.name).join(" | ")}`);
  }
}
