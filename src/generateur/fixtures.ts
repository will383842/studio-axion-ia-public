/**
 * FIXTURES SANS DONNÉE CLIENT (lot G0, plan v5 B.3.7) — PUR, testé.
 * Toute sortie réelle de Claude gardée comme fixture passe par ici (outil `outils/generateur/exporter-fixture.mts`) :
 * les noms sensibles, le lieu d'un client (avec son secteur) et les valeurs des preuves `cas-client` RÉELLES sont
 * remplacés, puis l'écriture est REFUSÉE si l'un d'eux, un terme de la liste locale (`.fixtures-termes-sensibles`, non
 * versionnée) ou une clé Anthropic y figure encore.
 */
import type { Matiere, Preuve } from "@/domaine/types";
import { contientCle, masquerSecrets } from "@/fournisseurs/claude/secret";

export interface TermeSensible {
  terme: string;
  remplacement: string;
  origine: string;
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Termes à retirer d'une fixture, tirés des registres (et de la liste locale). Les plus longs d'abord. */
export function termesSensibles(registres: { preuves?: Pick<Preuve, "id" | "type" | "valeurs" | "client">[]; matieres?: Pick<Matiere, "id" | "nomsSensibles">[] }, termesLocaux: string[] = []): TermeSensible[] {
  const t: TermeSensible[] = [];
  for (const m of registres.matieres ?? []) for (const n of m.nomsSensibles ?? []) t.push({ terme: n, remplacement: "[nom]", origine: `matiere ${m.id}` });
  for (const p of registres.preuves ?? []) {
    for (const n of p.client?.nomsSensibles ?? []) t.push({ terme: n, remplacement: "[nom]", origine: `preuve ${p.id}` });
    if (p.client?.lieu) t.push({ terme: p.client.lieu, remplacement: "[lieu]", origine: `preuve ${p.id} (lieu${p.client.secteur ? ` avec le secteur ${p.client.secteur}` : ""})` });
    if (p.type === "cas-client") for (const v of p.valeurs) if (v.brut.trim().length >= 2) t.push({ terme: v.brut, remplacement: "[valeur]", origine: `preuve ${p.id} (valeur)` });
  }
  for (const l of termesLocaux) if (l.trim()) t.push({ terme: l.trim(), remplacement: "[terme]", origine: "liste locale" });
  const vus = new Set<string>();
  return t.filter((x) => x.terme.trim().length >= 2 && !vus.has(norm(x.terme)) && vus.add(norm(x.terme))).sort((a, b) => b.terme.length - a.terme.length);
}

function motif(terme: string): RegExp {
  const echappe = terme.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${echappe}(?![\\p{L}\\p{N}])`, "giu");
}

/** Remplace chaque terme sensible (casse ignorée, mot entier) ; masque aussi toute clé. */
export function anonymiserFixture(texte: string, termes: TermeSensible[]): string {
  let s = masquerSecrets(texte);
  for (const t of termes) s = s.replace(motif(t.terme), t.remplacement);
  return s;
}

/** Ce qui reste de sensible dans un texte (vide : la fixture peut être écrite). Recherche sans accents ni casse. */
export function restesSensibles(texte: string, termes: TermeSensible[]): string[] {
  const n = norm(texte);
  const restes = termes.filter((t) => n.includes(norm(t.terme))).map((t) => `${t.origine} : « ${t.terme} »`);
  if (contientCle(texte)) restes.push("une clé Anthropic");
  return restes;
}

/** Anonymise, puis REFUSE (exception) s'il reste quoi que ce soit. Renvoie le texte prêt à écrire. */
export function preparerFixture(texte: string, termes: TermeSensible[]): string {
  const propre = anonymiserFixture(texte, termes);
  const restes = restesSensibles(propre, termes);
  if (restes.length) throw new Error(`Fixture refusée : il reste ${restes.join(" ; ")}`);
  return propre;
}
