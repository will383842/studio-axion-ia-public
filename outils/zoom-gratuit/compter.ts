/**
 * C8-Z05a : comptage PUR des zooms d'une vidéo, pour la planche C8-Z05 et la décision C8-Z07 (Williams).
 * Outil local : jamais importé par `src/` ni `studio-rendu/`. Aucun import (types recopiés, structurels).
 * Aucune donnée réelle ici : la session qui déploie l'appliquera aux vidéos actuelles.
 */

export type PlanClassique = { debutSec: number; finSec: number; taille: number; ouverture: string; zoomDemande?: boolean };
export type PlanAvocat = { debutSec: number; finSec: number; zoom: number; zoomFin?: number };
export type Fenetre = { debutSec: number; finSec: number };

export interface CompteZooms {
  total: number;
  parMinute: number;
  maxSur60s: number;
  detail: Record<string, number>;
}

/** Plus grand nombre d'instants dans une fenêtre glissante [t, t + 60[ (même définition que regles.ts). */
function maxSur60(instants: readonly number[]): number {
  let max = 0;
  for (const t of instants) {
    const n = instants.filter((x) => x >= t && x < t + 60).length;
    if (n > max) max = n;
  }
  return max;
}

function compte(instants: readonly number[], dureeSec: number, detail: Record<string, number>): CompteZooms {
  const total = instants.length;
  const valide = Number.isFinite(dureeSec) && dureeSec > 0;
  const parMinute = valide ? Math.round((total / (dureeSec / 60)) * 100) / 100 : 0;
  return { total, parMinute, maxSur60s: maxSur60(instants), detail };
}

/** Un zoom = un punch-in, ou une coupe dont la taille est plus grande que celle du plan précédent. */
export function zoomsClassique(plans: readonly PlanClassique[], dureeSec: number): CompteZooms {
  const instants: number[] = [];
  let punchIn = 0;
  let resserrements = 0;
  plans.forEach((p, i) => {
    if (i === 0) return;
    if (p.ouverture === "punch-in") {
      punchIn++;
      instants.push(p.debutSec);
    } else if (p.ouverture === "coupe" && p.taille > plans[i - 1].taille) {
      resserrements++;
      instants.push(p.debutSec);
    }
  });
  return compte(instants, dureeSec, { punchIn, resserrements });
}

/** Un zoom = un zoom lent (zoomFin > zoom), ou un plan plus serré que la fin du précédent. */
export function zoomsAvocat(plans: readonly PlanAvocat[], dureeSec: number): CompteZooms {
  const instants: number[] = [];
  let lents = 0;
  let resserrements = 0;
  plans.forEach((p, i) => {
    const lent = typeof p.zoomFin === "number" && Number.isFinite(p.zoomFin) && p.zoomFin > p.zoom;
    const prec = i > 0 ? plans[i - 1] : null;
    const serre = prec !== null && p.zoom > (prec.zoomFin ?? prec.zoom);
    if (lent) lents++;
    if (serre) resserrements++;
    if (lent || serre) instants.push(p.debutSec);
  });
  return compte(instants, dureeSec, { lents, resserrements });
}

export function zoomsFenetres(fenetres: readonly Fenetre[], dureeSec: number): CompteZooms {
  return compte(fenetres.map((f) => f.debutSec), dureeSec, { fenetres: fenetres.length });
}

/** Ligne de rapport pour la future planche (virgule décimale). */
export function ligneRapport(nom: string, c: CompteZooms): string {
  return `${nom} : ${c.total} zoom(s), ${String(c.parMinute).replace(".", ",")} par minute, au plus ${c.maxSur60s} sur 60 s`;
}
