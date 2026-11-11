/**
 * MIGRATION — étape 23 (L1-07) : l'existant entre au plan éditorial. Chaque Publication déjà enregistrée reçoit un
 * créneau (`cre-<id de la publication>`) qui en reprend source, réseau, heure (UTC) et statut. Les Publications ne sont
 * JAMAIS modifiées ni supprimées. Jouée UNE SEULE FOIS (repère `migrations.plan-editorial`) : une publication écrite
 * après n'est pas reprise ici. Un créneau déjà présent n'est jamais écrasé. Renvoie null au second passage.
 */
import type { Depots } from "@/domaine/depots";
import type { CreneauEditorial } from "@/domaine/plan-editorial/types";
import { statutPlanDepuisPublication } from "@/domaine/plan-editorial/correspondances";

const REPERE = "migrations.plan-editorial";

/** Jour (AAAA-MM-JJ) d'un instant ISO, à Paris. */
function jourDeParis(instant: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant));
  return p;
}

export async function etape23PlanEditorial(d: Depots, maintenant: string): Promise<Record<string, unknown> | null> {
  if (await d.parametres.obtenir(REPERE)) return null;
  const publications = await d.publications.lister();
  if (publications.length === 0) return null;
  let creneaux = 0;
  for (const p of publications) {
    const id = `cre-${p.id}`;
    if (await d.creneauxEditoriaux.obtenir(id)) continue;
    const c: CreneauEditorial = {
      id,
      jourVise: jourDeParis(p.date),
      heuresParReseau: { [p.reseau]: new Date(p.date).toISOString() },
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
  return creneaux ? { creneaux } : null;
}
