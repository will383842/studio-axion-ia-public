/**
 * EFFETS SPÉCIAUX DANS LA CHAÎNE (Lot I, raccord du lot F3 dans l'habillage du lot C/E). Fichier à part pour que
 * `chaine.ts` ne gagne que quelques lignes (commentées « Lot I »). PUR, sauf les appels à `studio-rendu` faits par
 * les outils de montage reçus (aucun réseau ici).
 *
 *   - passages d'effets du monteur (`objetMain`, `vitreBrisee`, `transitionEcran`) → `preparerEffetsFacecam` avec la
 *     piste `/visages`, les coupes actives, le cadre de chaque plan et les raccords ;
 *   - chaque effet = une demande `composition` SANS mode (CRF bas facultatif), la carte révélée par une vitre rendue
 *     AVANT l'effet ; le MP4 se pose comme une carte plein écran (coupe franche, son de la piste dessous) ;
 *   - effet raté (main introuvable ou rendu en panne) : retiré, « 1 élément non fait », drapeau « Réessayer » ;
 *   - bruitage de verre (banque `public/bruitages/verre-1.wav`) posé au mot, sous la voix, si la consigne le veut ;
 *   - une image de contrôle au milieu de chaque effet (opération `image-fixe` existante) pour la relecture Claude.
 */
import type { BaseComposition, OutilsMontage } from "@/briques/composition/montage";
import type { Intervalle } from "@/briques/coupes";
import { caracterePrise, carteEnvironnement, estimerLumiere, visagePx, type CadreMontage, type CaracterePrise, type CarteEnvironnement, type FenetreSource, type Lumiere } from "@/briques/effets-speciaux";
import { GAIN_SOUS_VOIX_DB } from "@/briques/intensite/bruitages";
import type { BruitagePlace } from "@/briques/intensite/types";
import { miseEnPage, preparerCarte } from "@/briques/motion";
import type { PisteVisage, PlanCamera } from "@/briques/realisation";
import type { PassageFacecam } from "@/domaine/facecam";
import type { CommandeFabrication } from "@/domaine/types";
import { suivreRendu } from "@/fournisseurs/rendu/client";
import type { DemandeRendu } from "@/fournisseurs/types";
import { preparerEffetsFacecam, type RenduEffetFacecam } from "./effets-speciaux";
import { passageEffetSpecial } from "./monteur/effets";
import { monteeVersPrise } from "./monteur/temps";
import { demandeRenduCarte } from "./raccords";
import type { BruitageDemande } from "./monteur/appliquer";

/** Bruitage de verre de la banque (fabriqué par `outils/bruitages/fabriquer.mts`). */
export const ELEMENT_VERRE = "bruit-verre-1";
export const MEDIA_VERRE = { cle: "/bruitages/verre-1.wav", mime: "audio/wav", dureeSec: 0.4 } as const;
/**
 * V6 « interdit de mentir » : sons de la banque du studio (`public/bruitages`, CC0, variante 1) qu'un bruitage demandé
 * au monteur peut poser (« mets un whoosh ») ; durées du manifeste.
 */
export const MEDIAS_BANQUE: Record<NonNullable<BruitageDemande["famille"]>, { elementId: string; cle: string; mime: string; dureeSec: number }> = {
  "illustration-forte": { elementId: "bruit-illustration-forte-1", cle: "/bruitages/illustration-forte-1.wav", mime: "audio/wav", dureeSec: 0.24 },
  impact: { elementId: "bruit-impact-1", cle: "/bruitages/impact-1.wav", mime: "audio/wav", dureeSec: 0.16 },
  chiffre: { elementId: "bruit-chiffre-1", cle: "/bruitages/chiffre-1.wav", mime: "audio/wav", dureeSec: 0.09 },
  document: { elementId: "bruit-document-1", cle: "/bruitages/document-1.wav", mime: "audio/wav", dureeSec: 0.3 },
  telephone: { elementId: "bruit-telephone-1", cle: "/bruitages/telephone-1.wav", mime: "audio/wav", dureeSec: 0.31 },
  verre: { elementId: ELEMENT_VERRE, cle: MEDIA_VERRE.cle, mime: MEDIA_VERRE.mime, dureeSec: MEDIA_VERRE.dureeSec },
};

/** Bruitages demandés au monteur → sons posés au mixage (sous la voix ; jamais après la fin de la vidéo). */
export function bruitagesDemandes(demandes: BruitageDemande[], dureeSec: number): BruitagePlace[] {
  return demandes.flatMap((b) => {
    const m = b.famille ? MEDIAS_BANQUE[b.famille] : undefined;
    if (!m || !(b.monteeSec < dureeSec - m.dureeSec)) return [];
    return [{ elementId: m.elementId, declencheur: b.famille === "verre" ? "illustration-forte" : b.famille!, debutSec: Math.max(0, b.monteeSec), dureeSec: m.dureeSec, gainDb: GAIN_SOUS_VOIX_DB, planId: b.id }];
  });
}

/**
 * CRF des effets : la piste montée est en 10 bits, l'effet ne dure que 0,6 à 8 s ; quasi sans perte comme
 * `rendreImageRemotion`. Paramètre FACULTATIF de l'opération `composition` sans mode (ignoré par un studio-rendu
 * d'avant le lot I : réglages par défaut).
 */
export const CRF_EFFETS = 10;

export const SAUT_EFFET = "Un effet spécial";
const MESSAGE_EFFET_RATE = "Un effet n'a pas pu être fait : la vidéo est livrée sans lui (« Refaire l'effet » sur Votre vidéo).";

/** Un effet suivi par la chaîne (état gardé : petit, les poses vont dans la demande, pas ailleurs). */
export interface EffetChaine {
  /** Identifiant du passage du monteur. */
  id: string;
  demande: DemandeRendu;
  /** `attente` : pas encore soumis (au tour suivant, ou quand la carte révélée `attendCarte` est rendue). */
  statut: "attente" | "soumise" | "faite" | "echec";
  essais: number;
  debutSec: number;
  finSec: number;
  attendCarte?: string;
  /** Image de contrôle au milieu de l'effet (relecture Claude) : jamais bloquante. */
  controle?: { demande: DemandeRendu; statut: "attente" | "soumise" | "faite" | "echec" };
  /** Clés R2 à signer en lecture à la soumission (`entree:<nom>` → adresse). */
  lectures: Record<string, string>;
}

/** Les passages d'effets spéciaux parmi ceux du monteur (gardés par la chaîne pour l'habillage). */
export function effetsDesPassages(passages: PassageFacecam[]): PassageFacecam[] {
  return passages.filter((p) => !!passageEffetSpecial(p));
}

/** Coupes actives (temps de la prise) : le complément des passages gardés. */
export function coupesDesGardes(gardes: Intervalle[], dureeSourceSec: number): Intervalle[] {
  const coupes: Intervalle[] = [];
  let t = 0;
  for (const g of [...gardes].sort((a, b) => a.debutSec - b.debutSec)) {
    if (g.debutSec > t + 1e-6) coupes.push({ debutSec: t, finSec: g.debutSec });
    t = Math.max(t, g.finSec);
  }
  if (dureeSourceSec > t + 1e-6) coupes.push({ debutSec: t, finSec: dureeSourceSec });
  return coupes;
}

/** Fenêtre de la source montrée à un instant monté : le cadre du plan, divisé par la taille de la source. */
export function cadreDesPlans(plans: PlanCamera[] | undefined, source: { largeur: number; hauteur: number }): CadreMontage {
  const plein: FenetreSource = { x: 0, y: 0, largeur: 1, hauteur: 1 };
  if (!plans?.length) return plein;
  const fenetres = plans.map((p) => ({ debutSec: p.debutSec, finSec: p.finSec, f: { x: p.cadre.x / source.largeur, y: p.cadre.y / source.hauteur, largeur: p.cadre.largeur / source.largeur, hauteur: p.cadre.hauteur / source.hauteur } }));
  return (s: number) => (fenetres.find((p) => s >= p.debutSec - 1e-6 && s < p.finSec) ?? (s < fenetres[0].debutSec ? fenetres[0] : fenetres[fenetres.length - 1])).f;
}

/** Image RVB décodée (octets R, V, B à la suite). */
export interface ImageRvb {
  donnees: ArrayLike<number>;
  largeur: number;
  hauteur: number;
}

/**
 * Lumière de la prise, mesurée sur l'image de contrôle du début (vignette de la piste montée, 0,5 s) dans la zone
 * du visage. Image absente ou visage introuvable : undefined (repli `luminanceVisage` dans la brique).
 */
export function lumiereDeLaVignette(image: ImageRvb | null | undefined, piste: PisteVisage | null | undefined, coupes: Intervalle[], cadre: CadreMontage, instantSec = 0.5): Lumiere | undefined {
  if (!image || image.donnees.length < image.largeur * image.hauteur * 3) return undefined;
  const boite = visagePx(piste?.echantillons, monteeVersPrise(instantSec, coupes), cadre, image.largeur, image.hauteur, instantSec);
  if (!boite || boite[2] < 4 || boite[3] < 4) return undefined;
  return estimerLumiere(image.donnees, image.largeur, image.hauteur, boite);
}

/** Remplace les références `entree:<nom>` par les adresses signées (l'opération sans mode ne le fait pas elle-même). */
export function avecAdresses<T>(v: T, adresses: Record<string, string>): T {
  if (typeof v === "string") return (v.startsWith("entree:") && adresses[v.slice(7)] ? adresses[v.slice(7)] : v) as T;
  if (Array.isArray(v)) return v.map((x) => avecAdresses(x, adresses)) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, avecAdresses(x, adresses)])) as T;
  return v;
}

const idRendu = (cle: string, essai = 0) => `${cle.replace(/[^A-Za-z0-9_-]/g, "-").slice(-120)}${essai ? `-e${essai}` : ""}`;

export interface EntreeEffetsChaine {
  /** Passages d'effets du monteur (temps du montage, ancre dans la prise). */
  passages: PassageFacecam[];
  piste?: PisteVisage | null;
  /** Passages gardés (temps de la prise) et durée de la prise : les coupes actives s'en déduisent. */
  gardes: Intervalle[];
  dureeSourceSec: number;
  plans?: PlanCamera[];
  source: { largeur: number; hauteur: number };
  /** Raccords du montage (s). */
  raccordsSec: number[];
  pisteMonteeCle: string;
  /** Préfixe des clés R2 des effets (`facecam/<vidéo>/<version>/effets`). */
  prefixe: string;
  /** Image de contrôle du début (vignette décodée), pour la lumière de l'objet 3D. */
  vignette?: ImageRvb | null;
  dureeSec: number;
}

export interface EffetsPrepares {
  effets: EffetChaine[];
  /** Cartes révélées à rendre AVANT leur effet (suivies avec les autres cartes de l'habillage). */
  cartes: { id: string; demande: DemandeRendu }[];
  cartesPleinEcran: { debutSec: number; finSec: number; carteCle: string }[];
  bruitages: BruitagePlace[];
  /** Passages d'effets à jour (drapeaux d'échec « Réessayer »), à recopier dans `entrees.facecam`. */
  passages: PassageFacecam[];
  /** Effets non faits dès la préparation (main introuvable). */
  rates: number;
}

/**
 * Lot I2 (raccordé à l'intégration Z) : reflets (`carteEnvironnement`) et caractère de la prise (`caracterePrise`)
 * mesurés sur la même vignette que la lumière. Le grain lu sur la petite vignette est sous-estimé (réduction) : il ne
 * sert que de plancher ; le flou est ramené en px de sortie. Image absente : rien (rendu d'avant).
 */
export function realismeDeLaVignette(image: ImageRvb | null | undefined, largeurSortie: number): { environnement?: CarteEnvironnement; prise?: CaracterePrise } {
  if (!image || image.donnees.length < image.largeur * image.hauteur * 3) return {};
  return {
    environnement: carteEnvironnement(image.donnees, image.largeur, image.hauteur),
    prise: caracterePrise(image.donnees, image.largeur, image.hauteur, undefined, largeurSortie / Math.max(1, image.largeur)),
  };
}

/** Prépare les effets : demandes (non soumises), cartes révélées, plages posées, bruitages, drapeaux. */
export async function preparerEffetsChaine(e: EntreeEffetsChaine, outils: Pick<OutilsMontage, "signer">): Promise<EffetsPrepares> {
  const coupes = coupesDesGardes(e.gardes, e.dureeSourceSec);
  const cadre = cadreDesPlans(e.plans, e.source);
  const largeur = 1080;
  const hauteur = 1920;
  const lumiere = lumiereDeLaVignette(e.vignette, e.piste, coupes, cadre);
  const realisme = realismeDeLaVignette(e.vignette, largeur);
  const r = preparerEffetsFacecam({ passages: e.passages, ...(e.piste ? { piste: e.piste } : {}), coupes, cadre, largeur, hauteur, raccordsSec: e.raccordsSec, pisteMonteeCle: e.pisteMonteeCle, prefixe: e.prefixe, ...(lumiere ? { lumiere } : {}), ...realisme });
  // Un effet qui déborde de la vidéo (fin de prise) est ramené à sa durée ; vide : écarté.
  const rendus = r.rendus.filter((x) => x.debutSec < e.dureeSec - 0.2);
  const effets: EffetChaine[] = [];
  const cartes: EffetsPrepares["cartes"] = [];
  for (const rendu of rendus) {
    const signe = await outils.signer({}, [{ cle: rendu.cle, mime: "video/mp4" }, { cle: cleControle(rendu.cle), mime: "image/png" }, ...(rendu.carteARendre ? [{ cle: rendu.carteARendre.cle, mime: "video/mp4" }] : [])]);
    let attendCarte: string | undefined;
    if (rendu.carteARendre) {
      const cr = rendu.carteARendre;
      const p = preparerCarte({ carte: cr.carte }, miseEnPage("9:16", "plein-ecran", cr.dureeSec));
      if (p.parametres) {
        attendCarte = `${rendu.passageId}-carte`;
        cartes.push({ id: attendCarte, demande: demandeRenduCarte({ id: attendCarte, cle: cr.cle, parametres: p.parametres, repli: false, erreurs: [] }, signe.depots[cr.cle] ?? "") });
      }
    }
    effets.push(effetChaine(rendu, signe.depots[rendu.cle] ?? "", signe.depots[cleControle(rendu.cle)] ?? "", attendCarte));
  }
  const gardes = new Set(effets.map((x) => x.id));
  const bruitages: BruitagePlace[] = r.bruitages
    .filter((b) => gardes.has(b.passageId))
    .map((b) => ({ elementId: ELEMENT_VERRE, declencheur: "illustration-forte", debutSec: b.monteeSec, dureeSec: MEDIA_VERRE.dureeSec, gainDb: GAIN_SOUS_VOIX_DB, planId: b.passageId }));
  return {
    effets,
    cartes,
    cartesPleinEcran: effets.map((x) => ({ debutSec: x.debutSec, finSec: Math.min(e.dureeSec, x.finSec), carteCle: x.demande.sortie.cle })),
    bruitages,
    passages: r.passages.filter((p) => !!passageEffetSpecial(p)),
    rates: r.decisions.filter((d) => d.livre === "sans-detourage").length,
  };
}

const cleControle = (cle: string) => cle.replace(/\.mp4$/, "-controle.png");

function effetChaine(rendu: RenduEffetFacecam, depot: string, depotControle: string, attendCarte?: string): EffetChaine {
  const parametres = { ...rendu.parametres, crf: CRF_EFFETS } as unknown as Record<string, unknown>;
  const images = (rendu.parametres.proprietes as { images: number }).images;
  return {
    id: rendu.passageId,
    statut: "attente",
    essais: 0,
    debutSec: rendu.debutSec,
    finSec: rendu.finSec,
    lectures: rendu.entrees,
    ...(attendCarte ? { attendCarte } : {}),
    demande: { idRendu: idRendu(rendu.cle), operation: "composition", file: "longue", entrees: {}, sortie: { urlDepot: depot, cle: rendu.cle }, parametres },
    controle: {
      statut: "attente",
      demande: { idRendu: idRendu(cleControle(rendu.cle)), operation: "image-fixe", file: "courte", entrees: {}, sortie: { urlDepot: depotControle, cle: cleControle(rendu.cle) }, parametres: { composition: rendu.parametres.composition, image: Math.floor(images / 2), proprietes: rendu.parametres.proprietes as unknown as Record<string, unknown> } },
    },
  };
}

/** Soumet l'effet (et son image de contrôle) avec les adresses de lecture du moment. */
async function soumettreEffet(x: EffetChaine, outils: Pick<OutilsMontage, "signer" | "rendu">): Promise<void> {
  const signe = await outils.signer(x.lectures, x.essais ? [{ cle: x.demande.sortie.cle, mime: "video/mp4" }] : []);
  const parametres = x.demande.parametres as { proprietes?: unknown };
  x.demande = {
    ...x.demande,
    idRendu: `${x.demande.idRendu.replace(/-e\d+$/, "")}${x.essais ? `-e${x.essais}` : ""}`,
    ...(x.essais ? { sortie: { ...x.demande.sortie, urlDepot: signe.depots[x.demande.sortie.cle] ?? x.demande.sortie.urlDepot } } : {}),
    parametres: { ...x.demande.parametres, proprietes: avecAdresses(parametres.proprietes, signe.lectures) },
  };
  x.statut = "soumise";
  await outils.rendu().soumettre(x.demande);
  if (x.controle && x.controle.statut === "attente") {
    const pc = x.controle.demande.parametres as { proprietes?: unknown };
    x.controle.demande = { ...x.controle.demande, parametres: { ...x.controle.demande.parametres, proprietes: avecAdresses(pc.proprietes, signe.lectures) } };
    x.controle.statut = "soumise";
    await outils.rendu().soumettre(x.controle.demande).catch(() => {
      x.controle!.statut = "echec";
    });
  }
}

/** Retire un effet raté de la composition (plan posé et bruitage). */
function retirer(base: BaseComposition, x: EffetChaine): void {
  const sup = base.supplements ?? {};
  base.supplements = { ...sup, cartesPleinEcran: sup.cartesPleinEcran?.filter((c) => c.carteCle !== x.demande.sortie.cle) };
  if (base.bruitages) base.bruitages = base.bruitages.filter((b) => b.planId !== x.id);
}

/**
 * Un tour des effets : soumet ceux dont la carte est prête, suit les autres (une nouvelle demande au plus), retire les
 * ratés. Rend `true` tant qu'un effet est en cours (la composition finale attend).
 */
export async function avancerEffetsChaine(
  hab: { cartes: { id: string; statut: string }[]; base: BaseComposition; effets?: EffetChaine[] },
  outils: Pick<OutilsMontage, "signer" | "rendu">,
  sauter: (brique: string, message: string) => void,
): Promise<boolean> {
  for (const x of hab.effets ?? []) {
    if (x.statut === "attente") {
      const carte = x.attendCarte ? hab.cartes.find((c) => c.id === x.attendCarte) : { statut: "faite" };
      if (!carte || carte.statut === "echec") {
        x.statut = "echec";
        if (x.controle) x.controle.statut = "echec";
        retirer(hab.base, x);
        sauter(SAUT_EFFET, MESSAGE_EFFET_RATE);
      } else if (carte.statut === "faite") await soumettreEffet(x, outils);
      continue;
    }
    if (x.controle?.statut === "soumise") {
      const s = await suivreRendu(outils.rendu(), x.controle.demande).catch(() => null);
      if (s?.statut === "termine") x.controle.statut = "faite";
      else if (!s || s.statut === "echec") x.controle.statut = "echec";
    }
    if (x.statut !== "soumise") continue;
    const s = await suivreRendu(outils.rendu(), x.demande);
    if (s.statut === "termine") x.statut = "faite";
    else if (s.statut === "echec") {
      if (s.erreur.reessayable && x.essais < 1) {
        x.essais += 1;
        await soumettreEffet(x, outils);
      } else {
        x.statut = "echec";
        retirer(hab.base, x);
        sauter(SAUT_EFFET, MESSAGE_EFFET_RATE);
      }
    }
  }
  return (hab.effets ?? []).some((x) => x.statut === "attente" || x.statut === "soumise");
}

/**
 * Commande vue par la composition finale : les sons de la banque posés (verre d'un effet, bruitages demandés au
 * monteur) ajoutés aux médias.
 */
export function commandeAvecVerre<C extends Pick<CommandeFabrication, "medias">>(c: C, base: BaseComposition): C {
  const manquants = Object.values(MEDIAS_BANQUE).filter((m) => base.bruitages?.some((b) => b.elementId === m.elementId) && !c.medias?.[m.elementId]);
  if (!manquants.length) return c;
  return { ...c, medias: { ...(c.medias ?? {}), ...Object.fromEntries(manquants.map((m) => [m.elementId, { cle: m.cle, mime: m.mime, dureeSec: m.dureeSec }])) } };
}

/** Images de contrôle des effets rendus, pour la relecture Claude (défaut surveillé : `visage-cache`). */
export function imagesControleEffets(effets: EffetChaine[] | undefined): { elementId: string; cle: string; legende: string }[] {
  return (effets ?? [])
    .filter((x) => x.statut === "faite" && x.controle?.statut === "faite")
    .map((x) => ({ elementId: x.id, cle: x.controle!.demande.sortie.cle, legende: `Effet spécial, milieu (${((x.debutSec + x.finSec) / 2).toFixed(1)} s) : le visage doit rester visible` }));
}
