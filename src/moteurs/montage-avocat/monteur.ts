/**
 * ADAPTATEUR AVOCAT DE LA BRIQUE MONTEUR (mission H). PUR.
 *
 * Option FACULTATIVE, figée au lancement depuis le réglage caché `avocat.monteur` (coupé par défaut) :
 * `commande.entrees.avocatMonteur = { consignes }` — consignes « Monteur, … » dites dans une prise avocat (quand la
 * transcription libre de la prise les contient) et messages du fil de discussion. Absente : rien n'est lu, l'avocat
 * est monté EXACTEMENT comme avant.
 *
 * Même agent que le face caméra (brique `monteur`) : mêmes consignes, même ancrage sur un mot, même relecture
 * tolérante, même version simple par règles fixes (aucun appel Claude ici). Seul le vocabulaire change : l'avocat
 * applique ce qu'il sait faire —
 *   - « 3 caméras » (brique `multicamera`, prises filmées) ;
 *   - zoom (le plan passe en poitrine, punch-in) ;
 *   - carte animée et titre (brique `motion`, seulement si `avocat.motionCommune` est allumé) ;
 *   - style des animations (« en spectaculaire ») ;
 * et répond clairement pour le reste (« Pour une vidéo avocat, je ne sais pas encore faire … : rien n'a été changé. »).
 */
import { z } from "zod";
import { choisirModele, lireDemandeStyle } from "@/briques/motion";
import { estConsigneTroisCameras } from "@/briques/multicamera/consigne";
import { ancreConsigne, motsSansCoupe, type MotMonteur } from "@/briques/monteur/ancrage";
import { familleDeLaConsigne, refusClair, type AdaptateurMonteur, type ConsigneAncree, type ReponseRegles } from "@/briques/monteur/adaptateur";
import type { EntreeCatalogueMonteur } from "@/briques/monteur/catalogue";
import { lireConsignes, type ConsigneMonteur } from "@/briques/monteur/consignes";
import { lireReponseOperations, schemaCarteCommune, schemaMulticamera, schemaReponsePour, schemaRetirerCommun, schemaTitreCommun, schemaZoomCommun, type ConsigneLue } from "@/briques/monteur/operations";
import type { CommandeFabrication, MotHorodate } from "@/domaine/types";
import type { PlanProduit } from "../types";
import type { PhraseMotion } from "@/briques/motion";

export const ENTREE_MONTEUR_AVOCAT = "avocatMonteur";
export const PARAM_MONTEUR_AVOCAT = "avocat.monteur";

export const schemaOperationAvocat = z.union([schemaCarteCommune, schemaZoomCommun, schemaTitreCommun, schemaRetirerCommun, schemaMulticamera]);
export type OperationAvocat = z.infer<typeof schemaOperationAvocat>;
export const schemaReponseMonteurAvocat = schemaReponsePour(schemaOperationAvocat);

/** Catalogue de l'avocat (ce qu'il sait faire). */
export function catalogueMonteurAvocat(avecMotion: boolean): EntreeCatalogueMonteur<OperationAvocat["type"]>[] {
  return [
    { type: "multicamera", libelle: "3 caméras", regle: "prises filmées seulement : la prise de face plus deux angles fabriqués par le double sur le même son (de côté, contre-plongée douce).", exemples: ["Fais-le en 3 caméras"] },
    { type: "zoom", libelle: "Zoom", regle: "le plan qui contient le mot passe en cadrage poitrine (punch-in) ; calé sur le début d'un mot important.", exemples: ["Zoome quand je dis « licenciement »"] },
    ...(avecMotion
      ? ([
          { type: "ajouterCarte", libelle: "Carte animée", regle: "modèle du catalogue de la brique motion (style sobre ou spectaculaire), 3 à 8 s, plein écran.", exemples: ["Mets une carte avec le chiffre 32 %", "Fais les animations en spectaculaire"] },
          { type: "titre", libelle: "Titre", regle: "carte titre plein écran, seulement à la demande ; jamais de nom ni de marque.", exemples: ["Mets le titre « Vos droits au travail »"] },
        ] as EntreeCatalogueMonteur<OperationAvocat["type"]>[])
      : []),
  ];
}

const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function texteCite(texte: string): string | null {
  const g = texte.match(/[«“"]\s*([^»”"]+?)\s*[»”"]/);
  if (g) return g[1];
  const deuxPoints = texte.split(/\s:\s|:\s/)[1];
  return deuxPoints?.trim() || null;
}

/** Une consigne → opérations de l'avocat, ou un refus clair. Le style seul est compris sans opération. */
function operationParRegles(c: ConsigneAncree, avecMotion: boolean): { ops: OperationAvocat[]; resume: string; comprise: boolean } {
  const t = sansAccents(c.texte);
  const famille = familleDeLaConsigne(c.texte);
  const { debutMot, finMot } = c.ancre;
  if (famille === "multicamera") {
    const actif = estConsigneTroisCameras(c.texte);
    return { ops: [{ type: "multicamera", actif }], resume: actif ? "Montage en 3 caméras demandé" : "Une seule caméra", comprise: true };
  }
  if (famille === "zoom") return { ops: [{ type: "zoom", debutMot, finMot, style: /lent|doucement/.test(t) ? "lent" : "punch-in", cible: "visage" }], resume: "Zoom ajouté", comprise: true };
  if (famille === "titre" || famille === "ajouterCarte") {
    if (!avecMotion) return { ops: [], resume: refusClair("avocat", famille), comprise: false };
    const style = lireDemandeStyle(c.texte);
    if (famille === "titre") {
      const texte = texteCite(c.texte);
      return texte ? { ops: [{ type: "titre", texte, debutMot, finMot, pleinEcran: true }], resume: `Titre « ${texte} »`, comprise: true } : { ops: [], resume: "Quel titre voulez-vous ? Écrivez-le entre guillemets.", comprise: false };
    }
    const cite = texteCite(c.texte);
    const choix = choisirModele(cite ?? c.texte);
    if (choix) return { ops: [{ type: "ajouterCarte", debutMot, finMot, modele: choix.modele, textes: cite ? [cite] : [], description: c.texte.trim().slice(0, 200) }], resume: "Carte animée ajoutée", comprise: true };
    if (style) return { ops: [], resume: `Animations en style ${style}`, comprise: true };
    return { ops: [], resume: "Je n'ai pas compris quelle carte poser : pouvez-vous préciser (liste, chiffre, étapes, comparaison) ?", comprise: false };
  }
  if (famille) return { ops: [], resume: refusClair("avocat", famille), comprise: false };
  return { ops: [], resume: "Je n'ai pas compris cette consigne : pouvez-vous la reformuler ?", comprise: false };
}

/** Version simple de l'avocat (règles fixes, aucun appel). */
export function reglesFixesAvocat(consignes: ConsigneAncree[], avecMotion: boolean): ReponseRegles<OperationAvocat> {
  const operations: OperationAvocat[] = [];
  const lues: ConsigneLue[] = [];
  for (const c of consignes) {
    const r = operationParRegles(c, avecMotion);
    const debut = operations.length;
    operations.push(...r.ops);
    lues.push({ consigneId: c.id, comprise: r.comprise, resume: r.resume, operations: r.ops.map((_, i) => debut + i) });
  }
  return { reponse: reponseDesConsignes(lues), operations, consignes: lues };
}

/** « C'est fait » seulement quand TOUTES les consignes sont appliquées ; sinon la raison de chaque refus. */
function reponseDesConsignes(lues: readonly { comprise: boolean; resume: string }[]): string {
  const comprises = lues.filter((l) => l.comprise).length;
  if (!lues.length) return "Rien à changer.";
  if (comprises === lues.length) return comprises > 1 ? `C'est fait : ${comprises} consignes appliquées.` : `C'est fait : ${lues[0].resume.charAt(0).toLowerCase()}${lues[0].resume.slice(1)}.`;
  return lues.filter((l) => !l.comprise).map((l) => l.resume).join(" ");
}

/** Vérif A2 (10/10) : ce que le monteur ne peut PAS appliquer sur cette vidéo (jamais « C'est fait » à tort). */
export const REFUS_ZOOM_ILLUSTRATION = "À ce moment, c'est une illustration qui est à l'écran : le zoom n'est possible que sur vous.";
export const REFUS_TROIS_CAMERAS_DOUBLE = "Les 3 caméras demandent une vidéo filmée (vos prises) : pas possible avec votre double seul.";

export function adaptateurMonteurAvocat(options: { motion?: boolean } = {}): AdaptateurMonteur<OperationAvocat> {
  const avecMotion = options.motion === true;
  const catalogue = catalogueMonteurAvocat(avecMotion);
  return {
    format: "avocat",
    catalogue,
    typesSupportes: catalogue.map((e) => e.type),
    schemaReponse: schemaReponseMonteurAvocat,
    lireReponse: (brut) => lireReponseOperations(brut, schemaOperationAvocat),
    reglesFixes: (consignes) => reglesFixesAvocat(consignes, avecMotion),
    exemples: (max = 8) => catalogue.flatMap((e) => e.exemples).slice(0, max),
  };
}

/* ------------------------------------------------------------------ */
/* Option et application dans le moteur                                 */
/* ------------------------------------------------------------------ */

export interface OptionMonteurAvocat {
  consignes: ConsigneMonteur[];
}

/** Lecture tolérante de `entrees.avocatMonteur` ; absente ou vide : null (rien ne change). */
export function optionMonteurAvocat(c: Pick<CommandeFabrication, "entrees">): OptionMonteurAvocat | null {
  const brut = c.entrees?.[ENTREE_MONTEUR_AVOCAT];
  if (!brut || typeof brut !== "object") return null;
  const consignes = lireConsignes((brut as { consignes?: unknown }).consignes);
  return consignes.length ? { consignes } : null;
}

export interface DecisionsMonteurAvocat {
  /** « 3 caméras » demandé (true), refusé (« une seule caméra » : false), ou rien dit (undefined). */
  multicamera?: boolean;
  /** Phrases de style (« en spectaculaire ») pour les cartes de la vidéo. */
  demandesStyle: string[];
  /** Cartes demandées (phrases explicites pour `cartesPourFormat`). */
  cartes: PhraseMotion[];
  /** Plans à passer en poitrine (zoom). */
  plansZoom: number[];
  /** Ce que Will lit : chaque consigne, comprise ou non, avec la réponse claire. */
  consignes: { id: string; texte: string; comprise: boolean; resume: string }[];
  reponse: string;
}

/**
 * Interprète les consignes de la vidéo (version simple) et rend ce que le moteur avocat applique. Les temps viennent
 * des mots de l'audio maître (temps de la vidéo livrée : l'avocat n'a pas de coupe).
 */
export function deciderMonteurAvocat(option: OptionMonteurAvocat, mots: readonly MotHorodate[], plans: readonly PlanProduit[], avecMotion: boolean, contexte: { prisesFilmees?: boolean } = {}): DecisionsMonteurAvocat {
  const motsM: MotMonteur[] = motsSansCoupe(mots);
  const ancrees: ConsigneAncree[] = option.consignes.map((c) => ({ ...c, ancre: ancreConsigne(c.texte, motsM, c.dansPriseSec) }));
  const r = adaptateurMonteurAvocat({ motion: avecMotion }).reglesFixes(ancrees);
  const d: DecisionsMonteurAvocat = { demandesStyle: [], cartes: [], plansZoom: [], consignes: [], reponse: r.reponse };
  const temps = (i: number) => mots[Math.max(0, Math.min(mots.length - 1, i))];
  const planA = (sec: number) => plans.find((p) => sec >= p.debutSec - 1e-6 && sec < p.finSec - 1e-6) ?? plans.at(-1);
  r.consignes.forEach((l, k) => {
    const c = ancrees.find((x) => x.id === l.consigneId) ?? ancrees[k];
    d.consignes.push({ id: l.consigneId, texte: c?.texte ?? "", comprise: l.comprise, resume: l.resume });
    if (c && l.comprise && lireDemandeStyle(c.texte)) d.demandesStyle.push(c.texte);
    const refuser = (resume: string) => Object.assign(d.consignes.at(-1)!, { comprise: false, resume });
    for (const i of l.operations) {
      const op = r.operations[i];
      if (op.type === "multicamera") {
        if (op.actif && contexte.prisesFilmees === false) refuser(REFUS_TROIS_CAMERAS_DOUBLE);
        else d.multicamera = op.actif;
      } else if (op.type === "zoom" && mots.length) {
        const p = planA(temps(op.debutMot).debutSec);
        if (p && p.sourceImage !== "double") refuser(REFUS_ZOOM_ILLUSTRATION);
        else if (p && !d.plansZoom.includes(p.ordre)) d.plansZoom.push(p.ordre);
      } else if ((op.type === "ajouterCarte" || op.type === "titre") && mots.length) {
        const debut = op.debutMot === null ? 0 : temps(op.debutMot).debutSec;
        const fin = op.finMot === null ? debut + 4 : Math.max(debut + 3, temps(op.finMot).finSec);
        const texteDit = mots.filter((m) => m.debutSec >= debut - 1e-6 && m.finSec <= fin + 1e-6).map((m) => m.mot).join(" ");
        d.cartes.push(op.type === "titre" ? { id: `monteur-${l.consigneId}-${i}`, texte: op.texte, debutSec: debut, finSec: fin, place: "titre", textes: [op.texte] } : { id: `monteur-${l.consigneId}-${i}`, texte: texteDit || op.description, debutSec: debut, finSec: fin, modele: op.modele, ...(op.textes.length ? { textes: op.textes } : {}), demande: c?.texte });
      }
    }
  });
  d.reponse = reponseDesConsignes(d.consignes);
  return d;
}

/** Plans de l'avocat avec les zooms demandés (cadrage poitrine, punch-in). */
export function appliquerZoomsAvocat(plans: PlanProduit[], ordres: readonly number[]): PlanProduit[] {
  if (!ordres.length) return plans;
  return plans.map((p) => (ordres.includes(p.ordre) && p.sourceImage === "double" ? { ...p, cadrage: { ...p.cadrage, valeur: "poitrine" as const, zoom: Math.max(p.cadrage.zoom || 1, 1.15), zoomFin: Math.max(p.cadrage.zoomFin ?? p.cadrage.zoom ?? 1, 1.15) } } : p));
}
