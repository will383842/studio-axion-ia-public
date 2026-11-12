/**
 * MIGRATION — étape 23 (L1-07) : l'existant entre au plan éditorial. Chaque Publication déjà enregistrée reçoit un
 * créneau (`cre-<id de la publication>`) qui en reprend source, réseau, heure (UTC) et statut. Les Publications ne sont
 * JAMAIS modifiées ni supprimées. Jouée UNE SEULE FOIS (repère `migrations.plan-editorial`) : une publication écrite
 * après n'est pas reprise ici (le repère est posé même sans publication). Un créneau déjà présent n'est jamais écrasé.
 * Les publications de démonstration (`estDemo`) n'entrent pas au plan ; une date vide ou illisible est sautée et comptée
 * (`illisibles`), sans faire échouer le démarrage. Renvoie null au second passage.
 */
import type { Depots } from "@/domaine/depots";
import type { CreneauEditorial } from "@/domaine/plan-editorial/types";
import { statutPlanDepuisPublication } from "@/domaine/plan-editorial/correspondances";

const REPERE = "migrations.plan-editorial";

/** Instant ISO (UTC) et jour de Paris (AAAA-MM-JJ) d'une date, ou null si elle est vide ou illisible. */
function lireDate(date: string): { iso: string; jour: string } | null {
  const t = new Date(date);
  if (!date || Number.isNaN(t.getTime())) return null;
  const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
  return { iso: t.toISOString(), jour };
}

export async function etape23PlanEditorial(d: Depots, maintenant: string): Promise<Record<string, unknown> | null> {
  if (await d.parametres.obtenir(REPERE)) return null;
  const publications = await d.publications.lister();
  let creneaux = 0;
  let illisibles = 0;
  for (const p of publications) {
    if (p.estDemo) continue;
    const id = `cre-${p.id}`;
    if (await d.creneauxEditoriaux.obtenir(id)) continue;
    const lu = lireDate(p.date);
    if (!lu) {
      illisibles++;
      continue;
    }
    const c: CreneauEditorial = {
      id,
      jourVise: lu.jour,
      heuresParReseau: { [p.reseau]: lu.iso },
      compteCible: p.canalId ?? "compte-inconnu",
      ...(p.videoId ? { videoId: p.videoId } : {}),
      ...(!p.videoId && p.visuelId ? { visuelId: p.visuelId } : {}),
      statut: statutPlanDepuisPublication(p.statut),
      decalages: 0,
    };
    await d.creneauxEditoriaux.enregistrer(c);
    creneaux++;
  }
  await d.parametres.enregistrer({ id: REPERE, valeur: maintenant, creeLe: maintenant, modifieLe: maintenant });
  return creneaux || illisibles ? { creneaux, ...(illisibles ? { illisibles } : {}) } : null;
}
