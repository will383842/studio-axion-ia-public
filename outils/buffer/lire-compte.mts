/**
 * LOT R1 — LECTURE DU COMPTE BUFFER (LECTURE SEULE, GRATUIT) ET RÉPONSES ENREGISTRÉES ANONYMISÉES.
 *
 * Lit, par des `query` GraphQL uniquement (jamais `mutation`) : le compte et ses organisations, les canaux de la
 * première organisation, puis au plus 3 publications récentes (pour relever la forme RÉELLE d'un `Post`). Écrit
 * `tests/fixtures/r1-buffer-lectures.json` APRÈS anonymisation : chaque identifiant est remplacé par un identifiant
 * d'exemple stable, les noms, adresses, textes et liens par des valeurs d'exemple. La clé n'est jamais affichée.
 *
 * Usage (racine du dépôt) : BUFFER_API_KEY=… pnpm exec tsx outils/buffer/lire-compte.mts
 * Les requêtes sont celles du client du studio (`src/fournisseurs/publication/buffer.ts`) : ce relevé les éprouve.
 */
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { REQUETE_CANAUX, REQUETE_COMPTE, REQUETE_ETAT_POST, REQUETE_POSTS_CANAL } from "../../src/fournisseurs/publication/requetes";
import { REQUETE_POST_BUFFER } from "../../src/fournisseurs/mesures/buffer";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SORTIE = join(RACINE, "tests", "fixtures", "r1-buffer-lectures.json");

const cle = process.env.BUFFER_API_KEY?.trim();
if (!cle) {
  console.error("BUFFER_API_KEY absente de l'environnement : rien n'est lu.");
  process.exit(2);
}

async function lire(query: string, variables: Record<string, unknown> = {}): Promise<unknown> {
  if (/^\s*mutation\b/i.test(query)) throw new Error("Lecture seule : aucune mutation.");
  const r = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${cle}` },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`Buffer a répondu ${r.status}.`);
  return r.json();
}

const compte = (await lire(REQUETE_COMPTE)) as { data?: { account?: { organizations?: { id: string }[] } } };
const orgId = compte.data?.account?.organizations?.[0]?.id;
const canaux = orgId ? ((await lire(REQUETE_CANAUX, { organizationId: orgId })) as { data?: { channels?: { id: string }[] } }) : null;
const ids = (canaux?.data?.channels ?? []).map((c) => c.id);
const posts = orgId && ids.length ? await lire(REQUETE_POSTS_CANAL, { organizationId: orgId, channelIds: ids, depuis: "2020-01-01T00:00:00.000Z", nombre: 3 }) : null;
// État d'une publication (programmée de préférence) et statistiques d'une publication envoyée : les deux lectures du studio.
const noeuds = ((posts as { data?: { posts?: { edges?: { node: { id: string; status: string } }[] } } } | null)?.data?.posts?.edges ?? []).map((e) => e.node);
const aSuivre = noeuds.find((p) => p.status === "scheduled") ?? noeuds[0];
const envoyee = noeuds.find((p) => p.status === "sent");
const etat = aSuivre ? await lire(REQUETE_ETAT_POST, { id: aSuivre.id }) : null;
const stats = envoyee ? await lire(REQUETE_POST_BUFFER, { id: envoyee.id }) : null;
const introuvable = await lire(REQUETE_ETAT_POST, { id: "000000000000000000000000" });

/* ---------- Anonymisation : rien de réel ne sort d'ici ---------- */
const table = new Map<string, string>();
let n = 0;
const idExemple = (vrai: string, prefixe: string) => {
  if (!table.has(vrai)) table.set(vrai, `${prefixe}${String(++n).padStart(4, "0")}`.padEnd(24, "0"));
  return table.get(vrai)!;
};
const CHAMPS_ID: Record<string, string> = { id: "e0", channelId: "c0", organizationId: "o0", serviceId: "s0", ideaId: "i0", contentItemId: "k0" };
function anonymiser(x: unknown, cleParent = ""): unknown {
  if (Array.isArray(x)) return x.map((y) => anonymiser(y, cleParent));
  if (x && typeof x === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x)) {
      if (typeof v === "string" && k in CHAMPS_ID) o[k] = idExemple(v, CHAMPS_ID[k]);
      else if (typeof v === "string" && /^(email|ownerEmail|backupEmail)$/.test(k)) o[k] = "exemple@exemple.fr";
      else if (typeof v === "string" && /^(name|displayName|descriptor)$/.test(k)) o[k] = `Exemple ${k}`;
      else if (typeof v === "string" && /^(avatar|externalLink|source|thumbnail|supportUrl)$/.test(k)) o[k] = "https://exemple.invalid/fichier";
      else if (typeof v === "string" && /^(text|rawError)$/.test(k)) o[k] = `Texte d'exemple (${v.length} caractères à l'origine).`;
      else o[k] = anonymiser(v, k);
    }
    return o;
  }
  return x;
}
const sortie = {
  _note: `Réponses RÉELLES de https://api.buffer.com (queries de lecture seule) enregistrées le ${new Date().toISOString().slice(0, 10)}, ANONYMISÉES : identifiants, noms, adresses, textes et liens remplacés par des valeurs d'exemple. Forme et énumérations conservées.`,
  compte: anonymiser(compte),
  canaux: anonymiser(canaux),
  posts: anonymiser(posts),
  etat: anonymiser(etat),
  stats: anonymiser(stats),
  introuvable: anonymiser(introuvable),
};
const texte = JSON.stringify(sortie, null, 2);
for (const vrai of table.keys()) if (texte.includes(vrai)) throw new Error("Un identifiant réel a survécu à l'anonymisation : rien n'est écrit.");
if (texte.includes(cle)) throw new Error("La clé apparaît : rien n'est écrit.");
writeFileSync(SORTIE, texte + "\n");
const services = ((sortie.canaux as { data?: { channels?: { service: string; isDisconnected: boolean }[] } })?.data?.channels ?? []).map((c) => `${c.service}${c.isDisconnected ? " (déconnecté)" : ""}`);
console.log(`Organisations : ${compte.data?.account?.organizations?.length ?? 0} · canaux : ${services.join(", ") || "aucun"} · publications relevées : ${((posts as { data?: { posts?: { edges?: unknown[] } } })?.data?.posts?.edges ?? []).length}`);
console.log(`Écrit : ${SORTIE}`);
