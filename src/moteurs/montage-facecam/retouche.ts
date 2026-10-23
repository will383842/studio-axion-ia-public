/**
 * RETOUCHE RÉELLE DU FACE CAMÉRA (lot G) — PUR, aucun réseau.
 *
 * Une consigne (fil « Discuter avec mon monteur », feuilles Coupes / Retoucher l'image / Cartes / Sous-titres, Annuler
 * une consigne, correction de la relecture) donne une NOUVELLE version. On ne relance que ce qui a changé, en
 * réutilisant ce qui est déjà sur R2 (transcription, visages, son, passe image 10 bits, cartes déjà rendues) :
 *   - coupes (rétablir, couper)        → assemblage : son monté, plans, piste montée (cadrage), mots montés, habillage ;
 *                                        la passe image (dans le temps de la prise) est gardée si sa bande couvre
 *                                        encore tous les cadres ;
 *   - image (3 crans, teinte)          → passe image, puis cadrage et habillage ;
 *   - son (nettoyer, volume, musique)  → son monté, puis cadrage et habillage ;
 *   - carte (dont retirer / déplacer / changer le texte d'une carte automatique), écran partagé, mise en page,
 *     sous-titres, style               → l'habillage SEUL, et seules les cartes changées sont
 *                                        rendues (les autres sont reprises par leur empreinte).
 * Ce que la chaîne a fait est rangé dans `projetMontage.reprise` de la version (clés, petits résultats, empreinte des
 * entrées) : la version suivante repart de là.
 */
import type { CommandeFabrication } from "@/domaine/types";
import { lireEntreesFacecam, type EntreesFacecam, type ImageFacecam } from "@/domaine/facecam";
import type { DefinitionEtapeMoteur } from "../types";
import type { CleTravailChaine, EtatChaine, SuiviTravail } from "./chaine";
import { lireReglagesMonteur, type ReglagesMonteur } from "./monteur/appliquer";
import { coupesActives, resumerCoupes, type Intervalle } from "./monteur/temps";
import { passageEffetSpecial } from "./monteur/effets";
import { effetDuPassage } from "./monteur/effet-realiste";

/** Version du format de reprise rangé dans le projet de montage. */
export const VERSION_REPRISE = 1;

/** Ce qui, dans les entrées, décide de chaque étape (comparé entre deux versions). */
export interface SignatureMontage {
  /** Coupes en vigueur dans la prise (studio − rétablies + demandées). */
  coupes: Intervalle[];
  image: ImageFacecam;
  teinte: ReglagesMonteur["teinte"];
  son: Omit<ReglagesMonteur["son"], "bruitages">;
  /** Empreinte de tout ce que l'habillage lit (passages posés, bruitages). */
  habillage: string;
  /** Lot K : empreinte des effets réalistes par IA (morceaux reposés par le cadrage) ; absente : aucun. */
  effetsRealistes?: string;
  /** V6 : empreinte des zooms demandés (plans serrés posés par la réalisation) ; absente : aucun. */
  zooms?: string;
}

/** Ce qu'une version garde pour que la suivante reparte de là (petit : clés R2 et petits résultats). */
export interface RepriseChaine {
  version: number;
  signature: SignatureMontage;
  travaux: Partial<Record<CleTravailChaine, SuiviTravail>>;
  coupes?: EtatChaine["coupes"];
  plans?: EtatChaine["plans"];
  mots?: EtatChaine["mots"];
  decor?: EtatChaine["decor"];
  /** Lot F1 : formats 4:5, 1:1, 16:9 (plans et pistes pré-cadrées ; sans leur habillage, toujours refait). */
  declinaisons?: EtatChaine["declinaisons"];
  /** Mission H : piste multicaméra (reprise tant que la piste montée ne change pas : aucun angle refabriqué). */
  multicamera?: EtatChaine["multicamera"];
  /** Cartes déjà rendues (empreinte des paramètres → clé R2 du MP4). */
  cartes: { empreinte: string; cle: string }[];
  /** Durée de la vidéo montée (estimation du temps de la retouche). */
  dureeSec: number;
}

/** Étape refaite par une retouche. Lot K : `effets` = effets réalistes changés → seule la piste montée est refaite. */
export type PartieRefaite = "assemblage" | "image" | "son" | "habillage" | "effets" | "plans";

const arrondi = (x: number) => Math.round(x * 1000) / 1000;

/**
 * Version des contrôles machine du studio-aligneur (`image.VERSION_CONTROLES`). Une reprise dont la piste montée porte
 * des contrôles plus anciens la refait (10/10, `docs/facecam/JOURNAL-CONTROLES-QUALITE.md` : synchro et visage n'étaient
 * pas fiables, et restaient figés d'une version à l'autre tant que la piste montée était reprise).
 */
export const VERSION_CONTROLES = 2;

/** Empreinte courte et stable d'un texte (FNV-1a 32 bits, deux passes). Pas de sécurité : seulement l'égalité. */
export function empreinte(texte: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < texte.length; i++) {
    const c = texte.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x0100019d) >>> 0;
  }
  return `${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}-${texte.length}`;
}

export function signatureMontage(entrees: Record<string, unknown> | undefined): SignatureMontage {
  const facecam: EntreesFacecam = lireEntreesFacecam(entrees ?? {});
  const reglages = lireReglagesMonteur(entrees ?? {});
  const passages = facecam.passages.map((p) => {
    const { id, type, debutSec, finSec, modele, contenuCle, texte } = p;
    const x = p as { operation?: unknown; sansDetourage?: boolean };
    return { id, type, debutSec: arrondi(debutSec), finSec: arrondi(finSec), modele, contenuCle, texte, operation: x.operation, sansDetourage: x.sansDetourage };
  });
  const effets = facecam.passages.map(effetDuPassage).filter(Boolean).map((e) => [e!.id, arrondi(e!.debutPriseSec), arrondi(e!.finPriseSec), e!.consigneVideo]);
  // V6 : un zoom change les plans (ancre dans la prise : les temps montés suivent les coupes).
  const zooms = facecam.passages.filter((p) => (p as { operation?: { type?: string } }).operation?.type === "zoom").map((p) => [(p as { ancre?: unknown }).ancre ?? [p.debutSec, p.finSec]]);
  return {
    ...(effets.length ? { effetsRealistes: empreinte(JSON.stringify(effets)) } : {}),
    ...(zooms.length ? { zooms: empreinte(JSON.stringify(zooms)) } : {}),
    coupes: coupesActives(facecam, reglages.coupesDemandees).map((c) => ({ debutSec: arrondi(c.debutSec), finSec: arrondi(c.finSec) })),
    image: { ...facecam.image },
    teinte: reglages.teinte,
    son: { nettoyer: reglages.son.nettoyer, musique: reglages.son.musique, volume: reglages.son.volume },
    // Vérif V1 (retraits et corrections du chat) et 10/10 (gestes sur les cartes automatiques depuis la fiche) : absents,
    // empreinte inchangée pour les versions d'avant.
    habillage: empreinte(JSON.stringify({ passages, bruitages: reglages.son.bruitages, ...(reglages.cartesAutoRetirees.length ? { cartesAutoRetirees: reglages.cartesAutoRetirees } : {}), ...(reglages.correctionsSousTitres.length ? { correctionsSousTitres: reglages.correctionsSousTitres } : {}), ...(reglages.cartesAuto.length ? { cartesAuto: reglages.cartesAuto } : {}) })),
  };
}

const memes = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Ce qu'il faut refaire entre deux versions. L'habillage est toujours refait (c'est lui qui donne la nouvelle vidéo) ;
 * le reste seulement si ce qui le décide a changé. Sans signature d'avant : tout.
 */
export function partiesARefaire(avant: SignatureMontage | undefined, apres: SignatureMontage): Set<PartieRefaite> {
  const r = new Set<PartieRefaite>(["habillage"]);
  if (!avant) return new Set<PartieRefaite>(["assemblage", "image", "son", "habillage"]);
  if (!memes(avant.coupes, apres.coupes)) r.add("assemblage");
  if (!memes(avant.image, apres.image) || avant.teinte !== apres.teinte) r.add("image");
  if (!memes(avant.son, apres.son)) r.add("son");
  if ((avant.effetsRealistes ?? "") !== (apres.effetsRealistes ?? "")) r.add("effets");
  if ((avant.zooms ?? "") !== (apres.zooms ?? "")) r.add("plans");
  return r;
}

/** Passages gardés de la prise, d'après les coupes en vigueur. */
export function gardesDepuisCoupes(coupes: Intervalle[], dureeSec: number): Intervalle[] {
  const gardes: Intervalle[] = [];
  let t = 0;
  for (const c of [...coupes].sort((a, b) => a.debutSec - b.debutSec)) {
    if (c.debutSec > t + 1e-6) gardes.push({ debutSec: t, finSec: Math.min(c.debutSec, dureeSec) });
    t = Math.max(t, c.finSec);
  }
  if (dureeSec > t + 1e-6) gardes.push({ debutSec: t, finSec: dureeSec });
  return gardes.filter((g) => g.finSec > g.debutSec + 1e-6);
}

/** Lit la reprise rangée dans un projet de montage (absente, d'un autre moteur ou d'un autre format : null). */
export function lireReprise(projetMontage: Record<string, unknown> | undefined): RepriseChaine | null {
  const r = (projetMontage as { moteur?: string; reprise?: RepriseChaine } | undefined) ?? undefined;
  if (r?.moteur !== "montage-facecam" || !r.reprise || r.reprise.version !== VERSION_REPRISE) return null;
  return r.reprise;
}

/**
 * Reprise d'une chaîne finie : clés R2 et petits résultats seulement. Les mots de la transcription en ligne sont
 * retirés dès qu'ils sont sur R2 (le projet de montage reste petit).
 */
export function repriseDeLaChaine(etat: EtatChaine, signature: SignatureMontage, dureeSec: number): RepriseChaine {
  const travaux: RepriseChaine["travaux"] = {};
  for (const [nom, t] of Object.entries(etat.travaux) as [CleTravailChaine, SuiviTravail][]) {
    if (t?.statut !== "termine") continue;
    const resultat = { ...(t.resultat ?? {}) };
    if (nom === "transcrire" && resultat.transcriptionCle) delete resultat.mots;
    travaux[nom] = { ...t, resultat };
  }
  const cartes = (etat.habillage?.cartes ?? []).filter((c) => c.statut === "faite").map((c) => ({ empreinte: empreinte(JSON.stringify(c.demande.parametres)), cle: c.demande.sortie.cle }));
  return {
    version: VERSION_REPRISE,
    signature,
    travaux,
    ...(etat.coupes ? { coupes: etat.coupes } : {}),
    ...(etat.plans ? { plans: etat.plans } : {}),
    ...(etat.mots?.statut === "fait" ? { mots: etat.mots } : {}),
    ...(etat.decor ? { decor: etat.decor } : {}),
    ...(etat.declinaisons ? { declinaisons: declinaisonsSansHabillage(etat.declinaisons) } : {}),
    ...(etat.multicamera ? { multicamera: etat.multicamera } : {}),
    cartes: [...(etat.cartesReprises ?? []), ...cartes].filter((c, i, l) => l.findIndex((x) => x.empreinte === c.empreinte) === i).slice(-60),
    dureeSec,
  };
}

/**
 * Lot I : effets spéciaux des passages en vigueur (le monteur n'est pas rappelé) ; ils sont rendus de nouveau par
 * l'habillage, seul refait quand seul un effet change (son empreinte est dans `habillage`).
 */
export function effetsDesEntrees(entrees: Record<string, unknown> | undefined): { effets?: EntreesFacecam["passages"] } {
  const effets = lireEntreesFacecam(entrees ?? {}).passages.filter((p) => !!passageEffetSpecial(p));
  return effets.length ? { effets } : {};
}

/**
 * État de départ de la chaîne pour une retouche : ce qui reste valable est repris tel quel, ce qui doit être refait est
 * retiré (la chaîne le refait au tour suivant). Le monteur n'est JAMAIS rappelé (ses passages sont déjà dans les
 * entrées) : `monteur` est posé d'office avec les cartes des passages.
 */
export function etatPourRetouche(reprise: RepriseChaine, commande: Pick<CommandeFabrication, "entrees">, parties: Set<PartieRefaite>, cartes: NonNullable<EtatChaine["monteur"]>["cartes"]): EtatChaine {
  const travaux: EtatChaine["travaux"] = structuredClone(reprise.travaux);
  const etat: EtatChaine = {
    version: "chaine-facecam-1",
    travaux,
    ...(reprise.coupes ? { coupes: structuredClone(reprise.coupes) } : {}),
    ...(reprise.plans ? { plans: structuredClone(reprise.plans) } : {}),
    ...(reprise.mots ? { mots: { ...reprise.mots } } : {}),
    ...(reprise.decor ? { decor: structuredClone(reprise.decor) } : {}),
    ...(reprise.declinaisons ? { declinaisons: declinaisonsSansHabillage(structuredClone(reprise.declinaisons)) } : {}),
    // Mission H : la piste multicaméra suit la piste montée ; refaite seulement si celle-ci l'est (voir plus bas).
    ...(reprise.multicamera && !parties.has("assemblage") && !parties.has("image") && !parties.has("son") ? { multicamera: structuredClone(reprise.multicamera) } : {}),
    monteur: { statut: "fait", cartes, ...effetsDesEntrees(commande.entrees) },
    sauts: [],
    cartesReprises: reprise.cartes,
  };
  const entrees = (commande.entrees ?? {}) as Record<string, unknown>;
  const controles = (travaux.cadrage?.resultat as { controles?: { version?: number } } | undefined)?.controles;
  if (travaux.cadrage && (controles?.version ?? 1) < VERSION_CONTROLES) delete travaux.cadrage;
  if (parties.has("assemblage")) {
    // Les coupes du studio sont reprises (mêmes identifiants) ; seuls les passages gardés changent.
    const facecam = lireEntreesFacecam(entrees);
    const reglages = lireReglagesMonteur(entrees);
    const duree = reprise.coupes?.dureeSourceSec ?? Math.max(0, ...facecam.coupes.auto.map((c) => c.finSec));
    const actives = coupesActives(facecam, reglages.coupesDemandees);
    if (etat.coupes) {
      const gardes = gardesDepuisCoupes(actives, etat.coupes.dureeSourceSec);
      etat.coupes = {
        ...etat.coupes,
        gardes,
        dureeSortieSec: +gardes.reduce((s, g) => s + g.finSec - g.debutSec, 0).toFixed(3),
        resume: resumerCoupes(facecam, duree, reglages.coupesDemandees).phrase,
      };
    }
    delete etat.plans;
    delete etat.mots;
    delete travaux.son;
    delete travaux.cadrage;
    // La passe image est gardée si sa bande couvre encore les nouveaux cadres (vérifié une fois les plans refaits).
    etat.verifierBande = true;
    // Formats (lot F1) : refaits depuis les nouveaux plans du 9:16.
    delete etat.declinaisons;
  }
  if (parties.has("image")) {
    delete travaux.passe;
    delete travaux.cadrage;
    // Le décor appliqué partait de l'ancienne image : il est refait (option toujours décidée au lancement).
    if (etat.decor?.statut === "applique") delete etat.decor;
  }
  if (parties.has("son")) {
    delete travaux.son;
    delete travaux.cadrage;
  }
  // V6 : un zoom ajouté ou retiré : les plans sont refaits, puis la piste montée (la passe est gardée si sa bande
  // couvre encore les cadres).
  if (parties.has("plans") && !parties.has("assemblage")) {
    delete etat.plans;
    delete travaux.cadrage;
    etat.verifierBande = true;
    delete etat.declinaisons;
  }
  // Lot K : un effet réaliste ajouté, déplacé ou retiré : la piste montée est refaite (ses morceaux changent).
  if (parties.has("effets")) delete travaux.cadrage;
  // Formats (lot F1) : leurs pistes pré-cadrées repartent dès que l'image ou le son change (les plans restent).
  if ((parties.has("image") || parties.has("son")) && etat.declinaisons) {
    etat.declinaisons.cadrages = {};
    delete etat.declinaisons.passeLarge;
    delete etat.declinaisons.bandeLarge;
  }
  return etat;
}

/**
 * Étapes montrées pendant la retouche, avec un temps estimé réaliste (mesures du lot B et C : passe image ≈ 9 fois la
 * durée, son ≈ 0,5 fois, piste montée ≈ 1 fois, une carte ≈ 3,5 min, composition finale ≈ 1,5 fois + 1 min) : il
 * donne « Prête vers 14 h 35 ».
 */
export function etapesRetouche(parties: Set<PartieRefaite>, dureeSec: number, cartesARendre: number): DefinitionEtapeMoteur[] {
  const d = Math.max(10, dureeSec);
  const e: DefinitionEtapeMoteur[] = [];
  const precedentes = () => e.map((x) => x.cle);
  if (parties.has("assemblage")) e.push({ cle: "coupes", nom: "Les coupes", icone: "ciseaux", dependDe: [], dureeEstimeeSec: 2 });
  if (parties.has("assemblage") || parties.has("son")) e.push({ cle: "son", nom: "Le son", icone: "son", dependDe: precedentes(), dureeEstimeeSec: Math.round(0.5 * d + 20) });
  if (parties.has("image")) e.push({ cle: "etalonnage", nom: "L'image", icone: "contraste", dependDe: [], dureeEstimeeSec: Math.round(9 * d + 30) });
  if (parties.has("assemblage") || parties.has("image") || parties.has("son") || parties.has("effets") || parties.has("plans")) e.push({ cle: "montage", nom: "Le montage", icone: "ciseaux", dependDe: precedentes(), dureeEstimeeSec: Math.round(1 * d + 20) });
  e.push({ cle: "sous-titres", nom: "Les sous-titres et cartes", icone: "sous-titres", dependDe: precedentes(), dureeEstimeeSec: 15 + 210 * Math.max(0, cartesARendre) });
  e.push({ cle: "export", nom: "La vidéo finale", icone: "telecharger", dependDe: ["sous-titres"], dureeEstimeeSec: Math.round(1.5 * d + 60) });
  return e;
}

/** Les formats sans leur habillage (toujours refait par une retouche) ni leurs échecs. */
function declinaisonsSansHabillage(d: NonNullable<EtatChaine["declinaisons"]>): NonNullable<EtatChaine["declinaisons"]> {
  const { habillages: _h, cartes: _c, entreeHabillage: _e, repriseHabillage: _r, rates: _x, ...reste } = d;
  void _h;
  void _c;
  void _e;
  void _r;
  void _x;
  return reste;
}
