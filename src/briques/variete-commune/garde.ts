/**
 * Garde « trop proche ? » (E2-ANTI-REPETITION, X2-04). PUR : ni date, ni hasard, ni réseau.
 * Aucun appelant (tout éteint).
 */
import { ressemblance, SEUIL_COMMUN } from "./ressemblance";
import type { AxeCommun, EmpreinteVideo, ResultatGarde, Voisine } from "./types";

export interface OptionsGarde {
  seuil?: number;
  /** Nombre de voisines récentes (rang 0 = la plus récente) dont l'ouverture ne doit pas être reprise. */
  ouverturesRecentes?: number;
}

const NOMS: Readonly<Record<AxeCommun, string>> = {
  habillage: "habillage", typo: "écriture", palette: "couleurs", ouverture: "ouverture", fin: "fin",
  transitions: "transitions", sousTitres: "sous-titres", sons: "sons", objets: "objets",
  recit: "récit", camera: "mouvements de caméra", dosage: "rythme",
};

function liste(axes: AxeCommun[]): string {
  const n = axes.map((a) => NOMS[a]);
  return n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} et ${n[n.length - 1]}`;
}

/** « 2026-11-10T08:00:00.000Z » → « 10/11/2026 » (sans `Date`). */
function jour(le: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(le);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : le;
}

function sansImposes(e: EmpreinteVideo, imposes: readonly AxeCommun[]): EmpreinteVideo {
  const axes = { ...e.axes };
  for (const a of imposes) delete axes[a];
  return { ...e, axes };
}

function memeOuverture(a: EmpreinteVideo, b: EmpreinteVideo): boolean {
  const va = a.axes.ouverture;
  const vb = b.axes.ouverture;
  if (!va || !vb || va.length === 0 || vb.length === 0) return false;
  const sa = new Set(va);
  const sb = new Set(vb);
  return sa.size === sb.size && [...sa].every((v) => sb.has(v));
}

function description(v: Voisine): string {
  return `la vidéo publiée le ${jour(v.empreinte.le)} sur ${v.reseau}`;
}

/** Compare une candidate à ses voisines. Ne modifie pas ses entrées. */
export function verifier(
  empreinte: EmpreinteVideo,
  voisines: readonly Voisine[],
  { seuil = SEUIL_COMMUN, ouverturesRecentes = 3 }: OptionsGarde = {},
): ResultatGarde {
  const imposes = empreinte.imposes ?? [];
  const candidate = sansImposes(empreinte, imposes);
  const recentes = voisines.filter((v) => v.rang < ouverturesRecentes);

  let pire: { v: Voisine; score: number; axes: AxeCommun[] } | null = null;
  let pireNul: number | null = null;
  let imposeSeul: Voisine | null = null;
  for (const v of voisines) {
    const r = ressemblance(candidate, sansImposes(v.empreinte, imposes));
    if (r.score !== null && (pire === null || r.score > pire.score)) pire = { v, score: r.score, axes: r.axesCommuns };
    if (r.score === null) pireNul = pireNul ?? 0;
    if (imposes.length > 0 && !imposeSeul) {
      const brut = ressemblance(empreinte, v.empreinte);
      if (brut.score !== null && brut.score >= seuil && (r.score === null || r.score < seuil)) imposeSeul = v;
    }
  }

  // Ouverture reprise d'une des voisines récentes (sauf si l'ouverture est imposée).
  if (!imposes.includes("ouverture")) {
    for (const v of recentes) {
      if (memeOuverture(empreinte, v.empreinte)) {
        const r = ressemblance(candidate, sansImposes(v.empreinte, imposes));
        return {
          ok: false,
          score: pire ? pire.score : r.score,
          voisine: v.empreinte.videoId,
          axesCommuns: r.axesCommuns,
          phrase: `Cette vidéo ressemble trop à ${description(v)} : l'ouverture est la même que sur l'une des dernières vidéos.`,
        };
      }
    }
  }

  if (pire && pire.score >= seuil) {
    return {
      ok: false,
      score: pire.score,
      voisine: pire.v.empreinte.videoId,
      axesCommuns: pire.axes,
      phrase: `Cette vidéo ressemble trop à ${description(pire.v)} : ${liste(pire.axes)} pareils.`,
    };
  }

  if (imposeSeul) {
    return {
      ok: true,
      score: pire ? pire.score : null,
      voisine: imposeSeul.empreinte.videoId,
      axesCommuns: pire ? pire.axes : [],
      phrase: `Cette vidéo ressemble à ${description(imposeSeul)}, mais seulement sur ce que vous avez choisi (votre choix).`,
    };
  }

  return {
    ok: true,
    score: pire ? pire.score : null,
    ...(pire ? { voisine: pire.v.empreinte.videoId } : {}),
    axesCommuns: pire ? pire.axes : [],
    phrase: "Cette vidéo se distingue assez des vidéos récentes.",
  };
}
