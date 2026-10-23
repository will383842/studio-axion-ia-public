import { joursRestants } from "@/domaine/corbeille";
import type { ActionCarrousel, VueCarrouselCarte, VueCarrouselFiche } from "@/domaine/visuels/contrats";
import { corbeillePermise, LIBELLES_STATUT, TRANSITIONS } from "@/domaine/visuels/statuts";
import type { Visuel } from "@/domaine/visuels/visuel";
import { lireVisuel, RENDU_PERIME_MS, type DependancesCarrousels } from "./carrousels";

/** Vues de lecture des carrousels : cartes de la liste et fiche. URL de lecture par `urlLecture`, jamais en dur. */

export type DependancesVues = Pick<DependancesCarrousels, "depot" | "urlLecture" | "allume" | "maintenant">;
export type VueListe = "tous" | "a_valider" | "valides" | "corbeille";

const filtres: Record<VueListe, (v: Visuel) => boolean> = {
  tous: (v) => !v.corbeilleLe,
  a_valider: (v) => !v.corbeilleLe && v.statut === "a_valider",
  valides: (v) => !v.corbeilleLe && v.statut === "valide",
  corbeille: (v) => !!v.corbeilleLe,
};

async function carte(v: Visuel, deps: DependancesVues): Promise<VueCarrouselCarte> {
  return {
    id: v.id,
    titre: v.titre,
    statut: v.statut,
    libelleStatut: LIBELLES_STATUT[v.statut],
    ...(v.rapport ? { verdict: v.rapport.verdict } : {}),
    nbPages: v.spec?.pages.length ?? 0,
    ...(v.rendu ? { vignetteUrl: await deps.urlLecture(v.rendu.vignetteCle) } : {}),
    modifieLe: v.modifieLe,
    ...(v.corbeilleLe ? { joursRestantsCorbeille: joursRestants(v.corbeilleLe, Date.parse(deps.maintenant())) } : {}),
  };
}

/** Calculées depuis TRANSITIONS et l'état corbeille : l'écran n'invente aucune action. */
function actionsPermises(v: Visuel, maintenantMs: number): ActionCarrousel[] {
  if (v.corbeilleLe) return joursRestants(v.corbeilleLe, maintenantMs) > 0 ? ["restaurer"] : [];
  const vers = TRANSITIONS[v.statut];
  const actions: ActionCarrousel[] = [];
  if (vers.includes("valide")) actions.push("valider");
  if (vers.includes("refuse")) actions.push("refuser");
  const refaisable = vers.includes("brouillon") || (vers.includes("refuse") && TRANSITIONS.refuse.includes("brouillon"));
  if (refaisable && v.entree.type === "sujet") actions.push("refaire");
  const renduPerime = v.statut === "rendu_en_cours" && (!v.renduDemandeLe || maintenantMs - Date.parse(v.renduDemandeLe) >= RENDU_PERIME_MS);
  if (vers.includes("rendu_en_cours") || renduPerime) actions.push("relancer_rendu");
  if (corbeillePermise(v.statut) && (v.statut !== "rendu_en_cours" || renduPerime)) actions.push("corbeille");
  return actions;
}

export async function listerCarrousels(vue: VueListe, deps: DependancesVues): Promise<VueCarrouselCarte[]> {
  const visuels = (await deps.depot.lister(filtres[vue])).sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));
  return Promise.all(visuels.map((v) => carte(v, deps)));
}

export async function ficheCarrousel(id: string, deps: DependancesVues): Promise<VueCarrouselFiche> {
  const v = await lireVisuel(id, deps);
  const pagesRendues = new Map((v.rendu?.pages ?? []).map((p) => [p.index, p]));
  const pages = await Promise.all(
    (v.spec?.pages ?? []).map(async (p, index) => {
      const rendue = pagesRendues.get(index);
      return {
        index,
        type: p.type,
        ...(rendue ? { urlX1: await deps.urlLecture(rendue.x1Cle) } : {}),
        ...(rendue?.x2Cle ? { urlX2: await deps.urlLecture(rendue.x2Cle) } : {}),
      };
    }),
  );
  return {
    ...(await carte(v, deps)),
    modeTexte: v.modeTexte,
    pourquoi: v.pourquoi ?? [],
    ...(v.rapport ? { rapport: v.rapport } : {}),
    pages,
    ...(v.rendu ? { pdfUrl: await deps.urlLecture(v.rendu.pdfCle) } : {}),
    ...(v.erreur ? { erreur: v.erreur } : {}),
    actionsPermises: actionsPermises(v, Date.parse(deps.maintenant())),
    generateurAllume: await deps.allume(),
  };
}
