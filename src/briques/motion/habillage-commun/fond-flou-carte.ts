/**
 * Fond flou et assombri pendant une carte (C10-03a) : calcul PUR des fenêtres, sans le champ de rendu (C10-03b).
 * Imports de type seulement, aucun hasard, aucune date. Éteint : rien n'importe ce fichier.
 * Le flou vise le décor du double, jamais la personne : chaque fenêtre porte `cible: "decor"`. Jamais de flou par
 * filtre CSS, et pas sur le visage : c'est l'appelant qui garantit la zone, au branchement.
 */
import type { PlanScene } from "../../composition/scene";

export interface OptionsFondFlouCarte {
  flouPx?: number;
  assombrir?: number;
  fonduSec?: number;
  /** Le double a-t-il un décor séparé de la personne ? Seul `false` coupe tout (défaut : vrai, l'appelant le garantit). */
  decorSepare?: boolean;
}

export interface FenetreFondFlou {
  debutSec: number;
  finSec: number;
  flouPx: number;
  assombrir: number;
  fonduSec: number;
  cible: "decor";
}

export const FOND_FLOU_DEFAUT = { flouPx: 12, assombrir: 0.35, fonduSec: 0.3 } as const;

function borne(v: number | undefined, min: number, max: number, defaut: number): number {
  const x = typeof v === "number" && Number.isFinite(v) ? v : defaut;
  return Math.min(max, Math.max(min, x));
}

/** Un plan « montre une carte devant le décor du double » : plan double avec écran partagé ou mise en page. */
function montreUneCarte(p: PlanScene): boolean {
  return p.type === "double" && (p.ecranPartage !== undefined || p.miseEnPage !== undefined) && p.finSec > p.debutSec;
}

export function fondFlouPendantCartes(plans: PlanScene[], options: OptionsFondFlouCarte = {}): FenetreFondFlou[] {
  if (options.decorSepare === false) return [];
  const flouPx = borne(options.flouPx, 0, 24, FOND_FLOU_DEFAUT.flouPx);
  const assombrir = borne(options.assombrir, 0, 0.6, FOND_FLOU_DEFAUT.assombrir);
  const fonduSec = borne(options.fonduSec, 0.2, 0.4, FOND_FLOU_DEFAUT.fonduSec);
  const brutes = plans
    .filter(montreUneCarte)
    .map((p) => ({ debutSec: p.debutSec, finSec: p.finSec }))
    .sort((a, b) => a.debutSec - b.debutSec || a.finSec - b.finSec);
  const fenetres: FenetreFondFlou[] = [];
  for (const b of brutes) {
    const derniere = fenetres[fenetres.length - 1];
    if (derniere && b.debutSec <= derniere.finSec + 1e-6) derniere.finSec = Math.max(derniere.finSec, b.finSec);
    else fenetres.push({ ...b, flouPx, assombrir, fonduSec, cible: "decor" });
  }
  return fenetres;
}
