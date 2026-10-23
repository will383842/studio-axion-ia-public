/**
 * MIGRATION DE DONNÉES AU DÉMARRAGE (plan du moteur avocat, B.0 règle transversale).
 *
 * La démonstration n'est semée qu'au premier démarrage et la base « documents » n'est jamais purgée :
 * toute correction de données par défaut passe donc ICI, lancée par `instrumentation.ts` une fois la base prête.
 * Règles : IDEMPOTENTE (rejouable sans effet), testée, et elle ne SUPPRIME rien — elle renomme un champ,
 * ajoute un élément, ou retire une valeur par défaut (« avocat » d'une liste `formatsParDefaut`).
 * Les scripts ne sont PAS réécrits ici : ils sont migrés à la lecture (B.9 bis).
 * Les modèles gardent leurs styles (un modèle est un choix explicite qui prime sur le défaut du format).
 */
import type { Depots } from "@/domaine/depots";
import type { ElementBibliotheque, Licence, MentionIA, Modele, ValeurDecor, Video, Visage } from "@/domaine/types";
import { scriptsReferenceFiche } from "@/donnees/references-avocat";
import { decorsCatalogue, fichiersDecorsCatalogue } from "@/donnees/decors-catalogue";
import { elementsLutsAxion, fichiersLutsAxion } from "@/donnees/luts-axion";
import { MENTION_IA_ANCIEN_DEFAUT, MENTION_IA_PAR_DEFAUT } from "@/domaine/derivations";
import { normaliserTenue } from "@/domaine/distribution";
import {
  ACCESSOIRE_MICRO,
  ACCESSOIRE_MICRO_V1,
  DECOR_NOIR_CHAUD,
  HABILLAGE_AVOCAT,
  LUT_AVOCAT,
  PROFIL_SON_AVOCAT,
  STYLE_MONTAGE_AVOCAT,
  STYLE_SOUS_TITRES_AVOCAT,
} from "@/donnees/elements-avocat";
import { etape12Prononciations } from "./migrations/etape-12-prononciations";
import { etape13MesImages } from "./migrations/etape-13-mes-images";
import { etape14DecorsRealistes } from "./migrations/etape-14-decors-realistes";
import { etape15Veille } from "./migrations/etape-15-veille";
import { etape16Bruitages } from "./migrations/etape-16-bruitages";
import { etape17Credits } from "./migrations/etape-17-credits";
import { etape18Calage } from "./migrations/etape-18-calage";
import { etape19Generateur } from "./migrations/etape-19-generateur";
import { etape20Exemples } from "./migrations/etape-20-exemples";
import { etape21SourceAxion } from "./migrations/etape-21-source-axion";

export const VERSION_MIGRATION_MOTEUR_AVOCAT = 1;

export interface RapportMigration {
  elementsAjoutes: string[];
  elementsConvertis: string[];
  defautsDeplaces: string[];
  visagesMigres: number;
  videosMigrees: number;
  modelesMigres: number;
  mentionMiseAJour: boolean;
  /** Étape 8 (lot M1) : accroches de référence de la fiche de style ajoutées. */
  scriptsReferenceAjoutes?: string[];
  /** Étape 9 (lot M3) : décors du catalogue de départ ajoutés (fonds neutres Axion, décors réalistes à vérifier). */
  decorsAjoutes?: string[];
  /** Étape 10 (lot M4) : LUT « Axion Buffer » installées (fichier `.cube` posé ou élément ajouté). */
  lutsInstallees?: string[];
  /** Étape 11 (lot M4b) : micro de podcast replacé (capsule entière dans l'image), s'il avait encore la valeur du lot M0. */
  microReplace?: boolean;
  /** Étapes 12-15 (lots A et B, réservées le 02/10) : résumé de chaque étape qui a changé quelque chose. */
  lots?: Record<string, Record<string, unknown>>;
}

const PROPRIETE: Licence = { type: "propriete", usageCommercial: true, reseaux: [] };

/** Éléments par défaut du format avocat, installés s'ils manquent (mêmes valeurs que la démonstration). */
function elementsAvocat(maintenant: string): ElementBibliotheque[] {
  const base = { marqueId: "marque-axion", licence: PROPRIETE, creeLe: maintenant, modifieLe: maintenant };
  return [
    { ...base, id: "st-avocat-v1", type: "style-sous-titres", nom: "Avocat", motsCles: ["avocat", "contour", "orange"], valeur: STYLE_SOUS_TITRES_AVOCAT, formatsParDefaut: ["avocat"] },
    { ...base, id: "sm-avocat-v1", type: "style-montage", nom: "Avocat", motsCles: ["avocat", "coupes franches"], valeur: STYLE_MONTAGE_AVOCAT, formatsParDefaut: ["avocat"] },
    { ...base, id: "ps-avocat-v1", type: "profil-son", nom: "Avocat : voix sèche", motsCles: ["avocat", "voix"], valeur: PROFIL_SON_AVOCAT, formatsParDefaut: ["avocat"] },
    { ...base, id: "hab-avocat-v1", type: "habillage", nom: "Avocat : encadré d'ouverture", motsCles: ["avocat", "encadré"], valeur: HABILLAGE_AVOCAT, formatsParDefaut: ["avocat"] },
    { ...base, id: "lut-avocat-v1", type: "lut", nom: "Axion clair-obscur (v1)", ...LUT_AVOCAT, formatsParDefaut: ["avocat"] },
    { ...base, id: "fond-noir-chaud", type: "decor", nom: "Noir chaud", motsCles: ["noir", "orange", "avocat"], valeur: DECOR_NOIR_CHAUD, formatsParDefaut: ["avocat"] },
    { ...base, id: "acc-micro-podcast", type: "accessoire", nom: "Micro de podcast", motsCles: ["micro", "podcast"], valeur: ACCESSOIRE_MICRO, formatsParDefaut: ["avocat"] },
    { ...base, id: "ton-piece-will", type: "bruitage", nom: "Ton de pièce", motsCles: ["silence", "pièce", "ambiance"], valeur: { type: "bruitage", categorie: "ambiance", dureeSec: 30 }, formatsParDefaut: [] },
  ];
}

/** Types dont l'avocat avait un défaut contraire à la fiche de style (B.0 §8). */
const TYPES_DEFAUT_AVOCAT = new Set(["lut", "style-sous-titres", "style-montage", "habillage", "profil-son", "musique", "decor", "fond"]);

function egal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Un ancien décor `{ ambiance }` ou un ancien fond `{ teinte }` → décor complet (même identifiant). */
function valeurDecorDepuis(e: ElementBibliotheque): ValeurDecor | null {
  const v = e.valeur as unknown as Record<string, unknown>;
  // Le fond par défaut de l'avocat reçoit sa valeur complète (noir chaud + lueur orange, B.3).
  if (e.id === "fond-noir-chaud" && !("mode" in v)) return DECOR_NOIR_CHAUD;
  if (e.type === "fond" || v.type === "fond") {
    return { type: "decor", mode: "teinte", teinte: String(v.teinte ?? ""), profondeurFlou: 12, directionLumiere: "gauche", positionSujet: 0.5 };
  }
  if (e.type === "decor" && !("mode" in v)) {
    const image = e.vignetteFichierId ?? e.fichierId;
    return {
      type: "decor",
      mode: image ? "image" : "teinte",
      imageFichierId: image,
      ambiance: typeof v.ambiance === "string" ? v.ambiance : undefined,
      profondeurFlou: 12,
      directionLumiere: "gauche",
      positionSujet: 0.5,
    };
  }
  return null;
}

/** Applique la migration du moteur avocat. Idempotente ; ne supprime rien. */
export async function migrerDonnees(d: Depots, maintenant: string = new Date().toISOString()): Promise<RapportMigration> {
  const rapport: RapportMigration = { elementsAjoutes: [], elementsConvertis: [], defautsDeplaces: [], visagesMigres: 0, videosMigrees: 0, modelesMigres: 0, mentionMiseAJour: false };

  /* --- 1. Fusion fond → décor (même identifiant, rien n'est perdu) --- */
  for (const e of await d.elements.lister((x) => x.type === "fond" || x.type === "decor")) {
    const valeur = valeurDecorDepuis(e);
    if (!valeur) continue;
    await d.elements.enregistrer({ ...e, type: "decor", valeur, modifieLe: maintenant });
    rapport.elementsConvertis.push(e.id);
  }

  /* --- 2. Éléments avocat installés s'ils manquent --- */
  const nouveaux = elementsAvocat(maintenant);
  for (const e of nouveaux) {
    if (await d.elements.obtenir(e.id)) continue;
    await d.elements.enregistrer(e);
    rapport.elementsAjoutes.push(e.id);
  }

  /* --- 3. Défauts du format avocat : retirés des anciens éléments, posés sur les nouveaux --- */
  const idsNouveaux = new Set(nouveaux.filter((e) => e.formatsParDefaut.includes("avocat")).map((e) => e.id));
  for (const e of await d.elements.lister((x) => TYPES_DEFAUT_AVOCAT.has(x.type))) {
    const aAvocat = e.formatsParDefaut.includes("avocat");
    if (idsNouveaux.has(e.id) && !aAvocat) {
      await d.elements.modifier(e.id, { formatsParDefaut: [...e.formatsParDefaut, "avocat"] });
      rapport.defautsDeplaces.push(`+${e.id}`);
    } else if (!idsNouveaux.has(e.id) && aAvocat) {
      await d.elements.modifier(e.id, { formatsParDefaut: e.formatsParDefaut.filter((f) => f !== "avocat") });
      rapport.defautsDeplaces.push(`-${e.id}`);
    }
  }

  /* --- 4. Visages : `decor` renommé `fondTournage` ; tenue normalisée ; posture et origine --- */
  for (const v of await d.visages.lister()) {
    const ancien = v as Visage & { decor?: string };
    const aMigrer = ancien.fondTournage === undefined || ancien.decor !== undefined || !v.tenueId || !v.posture || !v.origine;
    if (!aMigrer) continue;
    const { decor, ...reste } = ancien;
    const suite: Visage = {
      ...reste,
      fondTournage: reste.fondTournage ?? decor ?? "",
      tenueId: reste.tenueId || normaliserTenue(reste.tenue) || undefined,
      posture: reste.posture ?? "assis",
      origine: reste.origine ?? "filme",
    };
    if (egal(suite, v)) continue;
    await d.visages.enregistrer(suite);
    rapport.visagesMigres += 1;
  }

  /* --- 5. Vidéos et modèles : `styles.fondId` → `decorId` --- */
  for (const v of await d.videos.lister((x) => "fondId" in (x.styles ?? {}))) {
    const { fondId, ...styles } = v.styles as Video["styles"] & { fondId?: string };
    await d.videos.enregistrer({ ...v, styles: { ...styles, decorId: styles.decorId ?? fondId } });
    rapport.videosMigrees += 1;
  }
  for (const m of await d.modeles.lister((x) => "fondId" in (x.stylesChoisis ?? {}))) {
    const { fondId, ...styles } = m.stylesChoisis as Modele["stylesChoisis"] & { fondId?: string };
    await d.modeles.enregistrer({ ...m, stylesChoisis: { ...styles, decorId: styles.decorId ?? fondId } });
    rapport.modelesMigres += 1;
  }

  /* --- 6. Mention IA : nouvelle valeur par défaut, SEULEMENT si Will n'avait jamais touché au réglage --- */
  const mention = await d.parametres.obtenir("mentionIA.parDefaut");
  if (mention && egal(mention.valeur as MentionIA, MENTION_IA_ANCIEN_DEFAUT)) {
    await d.parametres.enregistrer({ ...mention, valeur: MENTION_IA_PAR_DEFAUT, modifieLe: maintenant });
    rapport.mentionMiseAJour = true;
  }

  /* --- 7. Trace de la migration (rejouable : elle ne refait rien la seconde fois) --- */
  const changement =
    rapport.elementsAjoutes.length + rapport.elementsConvertis.length + rapport.defautsDeplaces.length + rapport.visagesMigres + rapport.videosMigrees + rapport.modelesMigres + Number(rapport.mentionMiseAJour);
  if (changement > 0) {
    const existant = await d.parametres.obtenir("migrations.moteurAvocat");
    await d.parametres.enregistrer({ id: "migrations.moteurAvocat", valeur: { version: VERSION_MIGRATION_MOTEUR_AVOCAT, appliqueeLe: maintenant, rapport }, creeLe: existant?.creeLe ?? maintenant, modifieLe: maintenant });
    await d.evenements.enregistrer({
      id: `ev-migration-${maintenant}`,
      type: "migration",
      message: `Mise à jour des réglages du format avocat (${changement} changement${changement > 1 ? "s" : ""})`,
      date: maintenant,
      creeLe: maintenant,
      modifieLe: maintenant,
    });
  }

  /* --- 8. Lot M1 : accroches de référence de la fiche de style, ajoutées si elles manquent (jamais réécrites) --- */
  for (const sc of scriptsReferenceFiche(maintenant)) {
    if (await d.scripts.obtenir(sc.id)) continue;
    await d.scripts.enregistrer(sc);
    (rapport.scriptsReferenceAjoutes ??= []).push(sc.id);
  }
  if (rapport.scriptsReferenceAjoutes?.length) {
    await d.evenements.enregistrer({
      id: `ev-migration-references-${maintenant}`,
      type: "migration",
      message: `Accroches de référence du format avocat ajoutées (${rapport.scriptsReferenceAjoutes.length})`,
      date: maintenant,
      creeLe: maintenant,
      modifieLe: maintenant,
    });
  }
  /* --- 9. Lot M3 : catalogue des décors (décision de Will), ajouté s'il manque ; un décor existant n'est jamais réécrit --- */
  for (const f of fichiersDecorsCatalogue(maintenant)) {
    if (!(await d.fichiers.obtenir(f.id))) await d.fichiers.enregistrer(f);
  }
  for (const e of decorsCatalogue(maintenant)) {
    if (await d.elements.obtenir(e.id)) continue;
    await d.elements.enregistrer(e);
    (rapport.decorsAjoutes ??= []).push(e.id);
  }
  if (rapport.decorsAjoutes?.length) {
    await d.evenements.enregistrer({
      id: `ev-migration-decors-${maintenant}`,
      type: "migration",
      message: `Décors du catalogue ajoutés à la Bibliothèque (${rapport.decorsAjoutes.length})`,
      date: maintenant,
      creeLe: maintenant,
      modifieLe: maintenant,
    });
  }
  /*
   * --- 10. Lot M4 : les 4 LUT « Axion Buffer » (65 points). Fichiers ajoutés s'ils manquent ; `lut-avocat-v1` (posée
   * sans fichier à l'étape 2) reçoit son `.cube` ; les trois autres sont ajoutées. Une LUT qui a déjà son fichier n'est
   * jamais réécrite, et les LUT d'exemple (`lut-axion-chaud`, `lut-neutre`, `lut-cinema`) ne sont pas touchées.
   */
  for (const f of fichiersLutsAxion(maintenant)) {
    if (!(await d.fichiers.obtenir(f.id))) await d.fichiers.enregistrer(f);
  }
  for (const e of elementsLutsAxion(maintenant)) {
    const existant = await d.elements.obtenir(e.id);
    if (!existant) {
      await d.elements.enregistrer(e);
      (rapport.lutsInstallees ??= []).push(e.id);
      continue;
    }
    if (existant.fichierId || existant.valeur.type !== "lut") continue;
    await d.elements.modifier(e.id, {
      fichierId: e.fichierId,
      vignetteFichierId: existant.vignetteFichierId ?? e.vignetteFichierId,
      version: existant.version ?? e.version,
      valeur: { ...existant.valeur, tailleCube: 65, avantFichierId: existant.valeur.avantFichierId ?? (e.valeur.type === "lut" ? e.valeur.avantFichierId : undefined), apresFichierId: existant.valeur.apresFichierId ?? (e.valeur.type === "lut" ? e.valeur.apresFichierId : undefined) },
      modifieLe: maintenant,
    });
    (rapport.lutsInstallees ??= []).push(e.id);
  }
  if (rapport.lutsInstallees?.length) {
    await d.evenements.enregistrer({
      id: `ev-migration-luts-${maintenant}`,
      type: "migration",
      message: `LUT Axion installées dans la Bibliothèque (${rapport.lutsInstallees.length})`,
      date: maintenant,
      creeLe: maintenant,
      modifieLe: maintenant,
    });
  }
  /* --- 11. Lot M4b : micro replacé (capsule entière, devant l'orateur) SEULEMENT s'il garde la valeur du lot M0 --- */
  const micro = await d.elements.obtenir("acc-micro-podcast");
  if (micro && egal(micro.valeur, ACCESSOIRE_MICRO_V1)) {
    await d.elements.modifier(micro.id, { valeur: ACCESSOIRE_MICRO, modifieLe: maintenant });
    rapport.microReplace = true;
    await d.evenements.enregistrer({ id: `ev-migration-micro-${maintenant}`, type: "migration", message: "Micro de podcast replacé devant l'orateur (entier dans l'image)", date: maintenant, creeLe: maintenant, modifieLe: maintenant });
  }
  /*
   * --- 12 à 15 : réservées aux lots A et B (02/10, `docs/BRANCHEMENTS-EXECUTION.md`), une par fichier
   * (`services/migrations/etape-NN-*.ts`) pour que les lots en parallèle ne se disputent pas ce fichier. Dans l'ordre. ---
   */
  for (const [nom, etape] of [
    ["prononciations", etape12Prononciations],
    ["mes-images", etape13MesImages],
    ["decors-realistes", etape14DecorsRealistes],
    ["veille", etape15Veille],
    // 16 à 18 : lot « intensité · crédits · calage » (02/10, `docs/LOT-INTENSITE-CREDITS-EXECUTION.md`), D1, D2, D3.
    ["bruitages", etape16Bruitages],
    ["credits", etape17Credits],
    ["calage", etape18Calage],
    // 19 : générateur de scripts, lot G1a (plan v5 B.2.8), branche `generateur/maquettes` ; numéro à confirmer à la fusion.
    ["generateur", etape19Generateur],
    // 20 : vérification de bout en bout n° 2 — exemples de démonstration masqués (jamais effacés), liens d'exemple coupés.
    ["exemples", etape20Exemples],
    // 21 : Source axion-ia.com (03/10) — pages clés du site suivies au départ.
    ["source-axion", etape21SourceAxion],
  ] as const) {
    const resume = await etape(d, maintenant);
    if (!resume) continue;
    (rapport.lots ??= {})[nom] = resume;
    // Les étapes qui n'écrivent pas leur propre événement en reçoivent un ici (E2E-2 données n° 6) : le journal dit ce
    // qui a changé au démarrage, au lieu de rester muet.
    if (!ETAPES_AVEC_EVENEMENT.has(nom)) {
      const n = compterResume(resume);
      await d.evenements.enregistrer({
        id: `ev-migration-${nom}-${maintenant}`,
        type: "migration",
        message: nom === "generateur" ? messageGenerateur(resume) : `Mise à jour des données « ${LIBELLES_ETAPES[nom] ?? nom} » (${n} changement${n > 1 ? "s" : ""})`,
        date: maintenant,
        creeLe: maintenant,
        modifieLe: maintenant,
      });
    }
  }
  return rapport;
}

const LIBELLES_ETAPES: Record<string, string> = { "mes-images": "Mes images", "decors-realistes": "décors", bruitages: "bruitages", credits: "crédits", calage: "calage", "source-axion": "votre site" };

/** Étapes qui écrivent déjà leur événement « migration » elles-mêmes. */
const ETAPES_AVEC_EVENEMENT = new Set<string>(["prononciations", "veille", "exemples"]);

/** Nombre de changements d'un résumé d'étape : longueur des listes, nombres, 1 pour une valeur posée. */
function compterResume(resume: Record<string, unknown>): number {
  let n = 0;
  for (const v of Object.values(resume)) {
    if (Array.isArray(v)) n += v.length;
    else if (typeof v === "number") n += v;
    else if (v) n += 1;
  }
  return n;
}

function messageGenerateur(r: Record<string, unknown>): string {
  const nb = (v: unknown) => (Array.isArray(v) ? v.length : typeof v === "number" ? v : 0);
  const parties = [
    nb(r.tournuresAjoutees) ? `${nb(r.tournuresAjoutees)} tournures à éviter` : "",
    nb(r.reglesDateesAjoutees) ? `${nb(r.reglesDateesAjoutees)} règles des réseaux` : "",
    nb(r.elementsAjoutes) ? `${nb(r.elementsAjoutes)} éléments` : "",
    r.contexteAxion ? "le contexte d'Axion-IA" : "",
  ].filter(Boolean);
  return `Générateur de scripts installé${parties.length ? ` (${parties.join(", ")})` : ""}`;
}

/**
 * Total des changements d'un rapport, ÉTAPES 12 À 20 COMPRISES (E2E-2 données n° 6 : le journal de démarrage disait
 * « déjà à jour » alors que l'étape 19 venait d'ajouter 135 documents, car `rapport.lots` n'était pas compté).
 */
export function totalChangements(r: RapportMigration): number {
  let n = r.elementsAjoutes.length + r.elementsConvertis.length + r.defautsDeplaces.length + r.visagesMigres + r.videosMigrees + r.modelesMigres + Number(r.mentionMiseAJour);
  n += (r.scriptsReferenceAjoutes?.length ?? 0) + (r.decorsAjoutes?.length ?? 0) + (r.lutsInstallees?.length ?? 0) + Number(!!r.microReplace);
  for (const resume of Object.values(r.lots ?? {})) n += Math.max(1, compterResume(resume));
  return n;
}

/** Ligne du journal de démarrage : total, puis le détail des étapes 12 à 20 (ce que relit le § 6.1 de MISE-EN-LIGNE.md). */
export function resumeDemarrage(r: RapportMigration): string {
  const total = totalChangements(r);
  if (!total) return "déjà à jour";
  const lots = Object.entries(r.lots ?? {}).map(([nom, resume]) => `${nom} : ${compterResume(resume)}`);
  return `${total} changement${total > 1 ? "s" : ""}${lots.length ? ` (${lots.join(" ; ")})` : ""}`;
}
