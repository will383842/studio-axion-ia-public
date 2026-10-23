/**
 * RETOUCHE PAR BOUTONS DU TABLEAU ANIMÉ (tâche TB-20, plan `02-FORMAT-TABLEAU-ANIME.md` § 13.1), côté moteur.
 *
 * Un catalogue FERMÉ d'opérations nommées. Chacune est PURE : (fiche, paramètres) → nouvelle fiche, puis la fiche
 * entière repasse la validation complète (`validerFicheTableau` : schéma, règles communes, règles 2 à 17). Aucune
 * saisie libre de coordonnées : une opération désigne une scène et un élément par leur identifiant, et ne choisit
 * que dans des listes fermées (marques, gestes, dessins de la banque, appels de la bibliothèque, page voisine).
 * Habillage et stylo ne sont jamais touchés.
 *
 * Chaque opération DÉCLARE, sans rien lancer : le libellé de son bouton, ce qu'elle refait (des pages, la fin, ou
 * aussi la voix) et donc si elle coûte. Seule une retouche qui change un mot DIT relit la voix : elle est payante et
 * doit être annoncée avant. `apercuRetouche` rend ce qui serait refait, en comparant l'ancienne fiche et la nouvelle :
 *  - voix inchangée : les scènes qui MONTRENT une page touchée (une seule échelle par page, `mise-en-page.ts`) : les
 *    scènes de cette page et la première scène de la page suivante, qui la tourne ; aucune autre ;
 *  - voix changée : la voix est relue en entier, le calage refait ; toutes les scènes et la fin sont comptées comme
 *    refaites (valeur prudente : leurs temps peuvent tous bouger).
 *
 * Opérations du plan § 13.1 non reprises, faute de champ dans la fiche (`fiche.ts`, hors de cette tâche) :
 * `agrandir` / `reduire` (aucune taille dans la fiche, la mise en page choisit une échelle par page),
 * `changerCouverture` (aucune couverture dans la fiche) ; ralentir ou accélérer une scène (son temps vient de la voix).
 *
 * Aucun accès base ni réseau : tout ce qui vient de l'extérieur arrive par le contexte.
 */
import { z } from "zod";
import { identifiantSur, jsonCanonique, texteObligatoire } from "@/briques/fiche-scenes";
import { texteVoixTableau } from "./fabriquer";
import { MARQUES, cleMot, validerFicheTableau, type ElementTableau, type FicheTableau, type SceneTableau } from "./fiche";
import type { ContexteTableau } from "./regles";

/* ------------------------------------------------------------------ */
/* Catalogue fermé                                                       */
/* ------------------------------------------------------------------ */

/** Gestes proposés par les boutons (le geste « pointer » n'en fait pas partie). */
export const GESTES_RETOUCHE = ["souligner", "entourer", "barrer", "cocher"] as const;

const sceneId = identifiantSur;
const elementId = identifiantSur;

export const schemaOperationRetouche = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("remplacerTexteLigne"), sceneId, elementId, texte: texteObligatoire() }),
  z.strictObject({ type: z.literal("marquerMotImportant"), sceneId, elementId, mot: texteObligatoire() }),
  z.strictObject({ type: z.literal("retirerMotImportant"), sceneId, elementId, mot: texteObligatoire() }),
  z.strictObject({ type: z.literal("ajouterMarque"), sceneId, elementId, marque: z.enum(MARQUES) }),
  z.strictObject({ type: z.literal("retirerMarque"), sceneId, elementId }),
  z.strictObject({ type: z.literal("remplacerDessin"), sceneId, elementId, dessinId: texteObligatoire() }),
  z.strictObject({ type: z.literal("supprimerElement"), sceneId, elementId }),
  z.strictObject({ type: z.literal("changerGeste"), sceneId, elementId, geste: z.enum(GESTES_RETOUCHE) }),
  z.strictObject({ type: z.literal("deplacerScene"), sceneId, vers: z.enum(["page-precedente", "page-suivante"]) }),
  z.strictObject({ type: z.literal("changerFin"), appelId: texteObligatoire() }),
  z.strictObject({ type: z.literal("modifierTexteDit"), sceneId, texte: texteObligatoire() }),
]);

export type OperationRetouche = z.infer<typeof schemaOperationRetouche>;
export type TypeOperationRetouche = OperationRetouche["type"];

/** Ce qu'une opération refait : des pages seulement, la fin seulement, ou aussi la voix (payant). */
export type PorteeRetouche = "pages" | "fin" | "voix";

export interface DescriptionOperation {
  /** Texte du bouton, en français simple. */
  libelle: string;
  refait: PorteeRetouche;
  /** Vrai seulement quand la voix est relue (à annoncer AVANT). */
  payant: boolean;
}

export const CATALOGUE_RETOUCHES: Readonly<Record<TypeOperationRetouche, DescriptionOperation>> = {
  remplacerTexteLigne: { libelle: "Changer le texte écrit", refait: "pages", payant: false },
  marquerMotImportant: { libelle: "Mettre un mot en valeur", refait: "pages", payant: false },
  retirerMotImportant: { libelle: "Ne plus mettre ce mot en valeur", refait: "pages", payant: false },
  ajouterMarque: { libelle: "Souligner, entourer ou barrer la ligne", refait: "pages", payant: false },
  retirerMarque: { libelle: "Enlever le trait sur la ligne", refait: "pages", payant: false },
  remplacerDessin: { libelle: "Changer le dessin", refait: "pages", payant: false },
  supprimerElement: { libelle: "Retirer cet élément", refait: "pages", payant: false },
  changerGeste: { libelle: "Changer le geste du stylo", refait: "pages", payant: false },
  deplacerScene: { libelle: "Passer à la page d'avant ou d'après", refait: "pages", payant: false },
  changerFin: { libelle: "Changer la fin", refait: "fin", payant: false },
  modifierTexteDit: { libelle: "Changer ce qui est dit (voix refaite, payant)", refait: "voix", payant: true },
};

export const TYPES_OPERATION_RETOUCHE = Object.keys(CATALOGUE_RETOUCHES) as TypeOperationRetouche[];

/** Vrai si `type` est une opération du catalogue. */
export function estOperationRetouche(type: string): type is TypeOperationRetouche {
  return Object.prototype.hasOwnProperty.call(CATALOGUE_RETOUCHES, type);
}

/* ------------------------------------------------------------------ */
/* Contexte et résultat                                                  */
/* ------------------------------------------------------------------ */

/** Contexte des règles, sans le script (déduit des fiches), avec la bibliothèque des appels (fin). */
export interface ContexteRetouche extends Omit<ContexteTableau, "texteScript"> {
  /** Identifiants des appels de la bibliothèque (fins possibles) ; absent : aucune fin ne peut être choisie. */
  appels?: readonly string[];
}

export interface ApercuRetouche {
  ok: boolean;
  /** La nouvelle fiche ; refusée : la fiche de départ, inchangée. */
  fiche: FicheTableau;
  /** Scènes refaites, dans l'ordre de la vidéo. */
  scenesRefaites: string[];
  finRefaite: boolean;
  voixRefaite: boolean;
  /** Caractères relus par la voix (0 sans voix refaite). */
  caracteresARelire: number;
  payant: boolean;
  /** Refus en phrases claires pour Will (vide si acceptée). */
  refus: string[];
}

/* ------------------------------------------------------------------ */
/* Opérations                                                            */
/* ------------------------------------------------------------------ */

class RefusRetouche extends Error {}

const refuser = (phrase: string): never => {
  throw new RefusRetouche(phrase);
};

function trouverScene(fiche: FicheTableau, id: string): SceneTableau {
  return fiche.scenes.find((s) => s.id === id) ?? refuser(`La scène « ${id} » n'existe pas dans cette vidéo.`);
}

const NOMS_TYPES: Readonly<Record<ElementTableau["type"], string>> = {
  ligne: "une ligne écrite",
  dessin: "un dessin",
  chiffre: "un chiffre",
  preuve: "une bulle de preuve",
  geste: "un geste du stylo",
  mention: "une mention",
};

function trouverElement<T extends ElementTableau["type"]>(scene: SceneTableau, id: string, type?: T): Extract<ElementTableau, { type: T }> {
  const e = scene.elements.find((x) => x.id === id) ?? refuser(`L'élément « ${id} » n'est pas dans la scène ${scene.id}.`);
  if (type && e.type !== type) refuser(`L'élément « ${id} » de la scène ${scene.id} n'est pas ${NOMS_TYPES[type]}.`);
  return e as Extract<ElementTableau, { type: T }>;
}

/** Les pages restent numérotées sans trou (une page vidée disparaît). */
function renumeroter(fiche: FicheTableau): void {
  const ordre = [...new Set(fiche.scenes.map((s) => s.page))];
  for (const s of fiche.scenes) s.page = ordre.indexOf(s.page) + 1;
}

/** Applique UNE opération sur une copie de la fiche. Lève `RefusRetouche` avec une phrase pour Will. */
function appliquer(depart: FicheTableau, op: OperationRetouche, contexte: ContexteRetouche): FicheTableau {
  const fiche = structuredClone(depart);
  if (op.type === "changerFin") {
    if (!(contexte.appels ?? []).includes(op.appelId)) refuser("Cette fin ne fait pas partie de la bibliothèque des appels : choisissez-en une dans la liste.");
    fiche.appelId = op.appelId;
    return fiche;
  }
  const scene = trouverScene(fiche, op.sceneId);
  switch (op.type) {
    case "remplacerTexteLigne": {
      const l = trouverElement(scene, op.elementId, "ligne");
      l.texte = op.texte.trim();
      // Les mots importants qui ne sont plus dans la ligne sont oubliés (ceux qui restent gardent leur mise en valeur).
      const mots = new Set(l.texte.split(/\s+/).map(cleMot));
      const gardes = (l.importants ?? []).filter((m) => mots.has(cleMot(m)));
      if (gardes.length) l.importants = gardes;
      else delete l.importants;
      break;
    }
    case "marquerMotImportant": {
      const l = trouverElement(scene, op.elementId, "ligne");
      const mot = l.texte.split(/\s+/).find((m) => cleMot(m) && cleMot(m) === cleMot(op.mot)) ?? refuser(`Le mot « ${op.mot} » n'est pas dans la ligne « ${l.texte} ».`);
      if ((l.importants ?? []).some((m) => cleMot(m) === cleMot(mot))) refuser(`Le mot « ${mot} » est déjà mis en valeur.`);
      l.importants = [...(l.importants ?? []), mot.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")];
      break;
    }
    case "retirerMotImportant": {
      const l = trouverElement(scene, op.elementId, "ligne");
      const reste = (l.importants ?? []).filter((m) => cleMot(m) !== cleMot(op.mot));
      if (reste.length === (l.importants ?? []).length) refuser(`Le mot « ${op.mot} » n'est pas mis en valeur dans cette ligne.`);
      if (reste.length) l.importants = reste;
      else delete l.importants;
      break;
    }
    case "ajouterMarque":
      trouverElement(scene, op.elementId, "ligne").marque = op.marque;
      break;
    case "retirerMarque": {
      const l = trouverElement(scene, op.elementId, "ligne");
      if (!l.marque) refuser("Cette ligne n'a pas de trait à enlever.");
      delete l.marque;
      break;
    }
    case "remplacerDessin":
      trouverElement(scene, op.elementId, "dessin").dessinId = op.dessinId;
      break;
    case "supprimerElement": {
      trouverElement(scene, op.elementId);
      const vise = scene.elements.find((e) => e.type === "geste" && e.cibleId === op.elementId);
      if (vise) refuser(`Un geste du stylo vise cet élément : retirez d'abord le geste « ${vise.id} ».`);
      if (scene.elements.length === 1) refuser(`C'est le seul élément de la scène ${scene.id} : une scène garde au moins un élément.`);
      scene.elements = scene.elements.filter((e) => e.id !== op.elementId);
      break;
    }
    case "changerGeste":
      trouverElement(scene, op.elementId, "geste").geste = op.geste;
      break;
    case "deplacerScene": {
      const i = fiche.scenes.indexOf(scene);
      if (op.vers === "page-precedente") {
        if (i === 0) refuser("La première scène reste sur la première page.");
        if (fiche.scenes[i - 1].page === scene.page) refuser(`Seule la première scène d'une page peut passer à la page d'avant : ce n'est pas le cas de la scène ${scene.id}.`);
        scene.page = fiche.scenes[i - 1].page;
      } else {
        const suivante = fiche.scenes[i + 1];
        if (suivante?.page === scene.page) refuser(`Seule la dernière scène d'une page peut passer à la page d'après : ce n'est pas le cas de la scène ${scene.id}.`);
        scene.page = suivante ? suivante.page : scene.page + 1;
      }
      renumeroter(fiche);
      break;
    }
    case "modifierTexteDit":
      scene.texteDit = op.texte.trim();
      break;
  }
  return fiche;
}

/* ------------------------------------------------------------------ */
/* Ce qui est refait                                                     */
/* ------------------------------------------------------------------ */

const texteDe = (fiche: Pick<FicheTableau, "scenes">) => fiche.scenes.map((s) => s.texteDit).join(" ");

/** Scènes refaites entre deux fiches (mêmes scènes, même ordre) ; voix inchangée. */
function scenesQuiMontrent(avant: FicheTableau, apres: FicheTableau): string[] {
  const pageAvant = new Map(avant.scenes.map((s) => [s.id, s.page]));
  const parId = new Map(avant.scenes.map((s) => [s.id, jsonCanonique(s)]));
  const changees = apres.scenes.filter((s) => parId.get(s.id) !== jsonCanonique(s));
  const pagesApres = new Set(changees.map((s) => s.page));
  const pagesAvant = new Set(changees.map((s) => pageAvant.get(s.id)));
  const touchee = (s: SceneTableau) => pagesApres.has(s.page) || pagesAvant.has(pageAvant.get(s.id));
  // La première scène de la page suivante tourne la page touchée : elle la montre aussi.
  return apres.scenes.filter((s, i, t) => touchee(s) || (i > 0 && t[i - 1].page !== s.page && touchee(t[i - 1]))).map((s) => s.id);
}

/* ------------------------------------------------------------------ */
/* Aperçu                                                                */
/* ------------------------------------------------------------------ */

function refusApercu(fiche: FicheTableau, refus: string[]): ApercuRetouche {
  return { ok: false, fiche, scenesRefaites: [], finRefaite: false, voixRefaite: false, caracteresARelire: 0, payant: false, refus };
}

/** Lit une opération brute (bouton, service) ; `null` : elle n'est pas du catalogue ou sa forme est fausse. */
export function lireOperationRetouche(brute: unknown): OperationRetouche | null {
  const r = schemaOperationRetouche.safeParse(brute);
  return r.success ? r.data : null;
}

/**
 * Aperçu d'une ou plusieurs opérations, appliquées dans l'ordre, SANS rien lancer : la nouvelle fiche validée, ce qui
 * serait refait et ce que cela coûte. Refusée : la fiche de départ, inchangée, et les raisons en phrases claires.
 */
export function apercuRetouche(fiche: FicheTableau, operation: OperationRetouche | readonly OperationRetouche[], contexte: ContexteRetouche): ApercuRetouche {
  const operations: readonly unknown[] = Array.isArray(operation) ? operation : [operation];
  if (!operations.length) return refusApercu(fiche, ["Aucune retouche n'est demandée."]);
  let nouvelle = fiche;
  try {
    for (const brute of operations) {
      const op = lireOperationRetouche(brute) ?? refuser("Cette retouche ne fait pas partie des boutons proposés.");
      nouvelle = appliquer(nouvelle, op, contexte);
    }
  } catch (err) {
    // Une fiche de départ mal formée ne se retouche pas : elle repasse d'abord par la validation.
    return refusApercu(fiche, [err instanceof RefusRetouche ? err.message : "La fiche de scènes de cette vidéo est illisible : la retouche n'est pas possible."]);
  }
  if (jsonCanonique(nouvelle) === jsonCanonique(fiche)) return refusApercu(fiche, ["Cette retouche ne change rien à la vidéo."]);

  const { appels: _appels, ...regles } = contexte;
  void _appels;
  const voixRefaite = texteDe(nouvelle) !== texteDe(fiche);
  // Le texte dit est la référence : inchangé, il doit le rester mot pour mot ; changé, il devient le nouveau script
  // (contrôles du script repassés sur lui par la règle 13).
  const validation = validerFicheTableau(nouvelle, { ...regles, texteScript: texteDe(nouvelle) });
  if (!validation.ok) return refusApercu(fiche, validation.problemes.map((p) => `Cette retouche n'est pas possible. ${p.message}`));

  const finRefaite = voixRefaite || nouvelle.appelId !== fiche.appelId;
  return {
    ok: true,
    fiche: validation.fiche,
    scenesRefaites: voixRefaite ? nouvelle.scenes.map((s) => s.id) : scenesQuiMontrent(fiche, nouvelle),
    finRefaite,
    voixRefaite,
    caracteresARelire: voixRefaite ? texteVoixTableau(nouvelle).length : 0,
    payant: voixRefaite,
    refus: [],
  };
}
