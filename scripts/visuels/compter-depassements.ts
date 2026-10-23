/**
 * COMPTE, en LECTURE SEULE, les carrousels pas encore rendus ou à refaire dont un texte dépasse les limites actuelles du schéma
 * (lot L1, remesuré avec le texte borné à x = 912 / 860 : 2 cartes, texte de carte 240 → 130 signes ; 3 cartes 80 → 64 ; 4 cartes 80 → 46 ; 5 ou 6 cartes 36 → 20 ; points de T06 à 4 : 58 → 52 ; étapes de T20 ; titre de T01 60 → 52 ; et les autres budgets remesurés). Un tel carrousel
 * serait refusé au prochain rendu ou à la prochaine validation : il faut le réécrire.
 *
 *   DATABASE_URL=postgresql://… npx tsx scripts/visuels/compter-depassements.ts
 *
 * Accès : la variable d'environnement `DATABASE_URL`, comme le studio (aucune valeur en dur) ; la session est ouverte en LECTURE SEULE
 * (`default_transaction_read_only`) : aucune écriture n'est possible. Concernés : visuels non supprimés (hors corbeille), hors démonstration, de statut
 * brouillon, écrit, bloqué, rendu en cours, échec de rendu ou refusé (pas encore rendus, ou à refaire) ; les statuts à valider, validés,
 * programmés et publiés ont déjà leur rendu, qui n'est pas touché. Sortie : le nombre et la liste des `id` avec statut et champs en cause
 * (chemin du champ et budget, JAMAIS le contenu des textes). Code de sortie : 0 (aucun dépassement), 1 (au moins un), 2 (accès impossible).
 */
import { pathToFileURL } from "node:url";
import pg from "pg";
import { CarrouselSpec } from "@/domaine/visuels/schema";

/** Statuts des carrousels pas encore rendus ou à refaire (`src/domaine/visuels/statuts.ts`). */
export const STATUTS_A_CONTROLER: readonly string[] = ["brouillon", "ecrit", "bloque", "rendu_en_cours", "echec_rendu", "refuse"];

export interface DocumentVisuel {
  id: string;
  data: unknown;
}

export interface Depassement {
  id: string;
  statut: string;
  /** Chemin du champ en cause et message du schéma (budget en signes), sans le contenu du texte. */
  champs: string[];
}

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Pure : ne garde que les visuels à contrôler dont le spec dépasse une limite de longueur du schéma actuel. */
export function compterDepassements(documents: readonly DocumentVisuel[]): Depassement[] {
  const trouves: Depassement[] = [];
  for (const { id, data } of documents) {
    if (!estObjet(data) || typeof data.statut !== "string" || !STATUTS_A_CONTROLER.includes(data.statut)) continue;
    if (data.corbeilleLe || data.estDemo || data.spec === undefined) continue;
    const verdict = CarrouselSpec.safeParse(data.spec);
    if (verdict.success) continue;
    const longueurs = verdict.error.issues.filter((i) => i.code === "too_big" || (i.code === "custom" && /trop long/.test(i.message)));
    if (longueurs.length === 0) continue;
    trouves.push({ id, statut: data.statut, champs: longueurs.map((i) => `${i.path.join(".")} : ${i.code === "too_big" ? "au-delà du plafond" : i.message}`) });
  }
  return trouves;
}

async function lireVisuels(url: string): Promise<DocumentVisuel[]> {
  // Lecture seule imposée à la session : même une erreur de ce script ne peut rien écrire.
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000, statement_timeout: 30_000, options: "-c default_transaction_read_only=on" });
  await client.connect();
  try {
    const { rows } = await client.query<DocumentVisuel>("SELECT id, data FROM documents WHERE collection = 'visuels' ORDER BY id");
    return rows;
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL absente : rien n'est lu.");
    process.exit(2);
  }
  let documents: DocumentVisuel[];
  try {
    documents = await lireVisuels(url);
  } catch (e) {
    console.error(`Base injoignable : ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }
  const depassements = compterDepassements(documents);
  console.log(`${depassements.length} carrousel(s) pas encore rendu(s) ou à refaire dépassent les limites actuelles (sur ${documents.length} visuel(s) en base).`);
  for (const d of depassements) console.log(`- ${d.id} (${d.statut}) : ${d.champs.join(" ; ")}`);
  process.exit(depassements.length > 0 ? 1 : 0);
}
