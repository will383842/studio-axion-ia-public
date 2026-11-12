/**
 * VALIDATEUR DU PLAN DE SCÈNES (lot C) — ne refuse JAMAIS : il renvoie des REMARQUES et répare par repli.
 *  - durées liées aux mots (début = premier mot, fin ≥ dernier mot), scènes dans l'ordre et sans chevauchement ;
 *  - pièces existantes (nom approché → pièce la plus proche), paramètres valides (champ faux → valeur de l'exemple) ;
 *  - couleurs et polices dans la charte (hex hors charte, police autre que Manrope, orange sur fond clair) ;
 *  - face caméra : jamais devant le visage ; transitions douces ;
 *  - repli d'un niveau par scène : 3 (code libre, désactivé) → 2 → 1 ; niveau 2 sans calque valide → pièce niveau 1
 *    la plus proche. Une entrée illisible donne un plan de repli (légendes et chiffres, niveau 1).
 */
import { z } from "zod";
import { CHARTE_AXION, POLICE_AXION, TEINTES_INTERDITES } from "../jetons-motion";
import { CATALOGUE_BRIQUES, pieceLaPlusProche, type IdPiece } from "./catalogue";
import { avecEmpreintes } from "./empreinte";
import { schemaFormat, schemaMot, schemaPlanBrut, VERSION_PLAN_SCENES, type Calque, type FormatPlan, type HabillagePlan, type MotMinute, type Niveau, type PlanValide, type ScenePlan } from "./schema";
import { devantLeVisage, POSITIONS, POSITION_SURE_FACECAM, SCENE_MIN_MS, TRANSITIONS, TRANSITION_MAX_MS, TRANSITION_MIN_MS, type Position } from "./zones";

/** Niveau 3 (code libre) : désactivé par défaut. Même activé, il n'est pas encore rendu : repli d'un niveau. */
export const CODE_LIBRE_ACTIF = false;

export type CodeRemarque =
  | "PLAN_ILLISIBLE"
  | "VERSION"
  | "FORMAT"
  | "MOTS"
  | "DUREE_PLAN"
  | "DUREE_RECALEE"
  | "CHEVAUCHEMENT"
  | "SCENE_RETIREE"
  | "ID_SCENE"
  | "PIECE_INCONNUE"
  | "PARAMETRES_REPARES"
  | "CALQUE_RETIRE"
  | "REPLI_NIVEAU_1"
  | "CODE_LIBRE_DESACTIVE"
  | "COULEUR_HORS_CHARTE"
  | "POLICE_HORS_CHARTE"
  | "ORANGE_SUR_CLAIR"
  | "DEVANT_LE_VISAGE"
  | "TRANSITION_ADOUCIE"
  | "TEXTE_COUPE"
  | "LLM_ILLISIBLE"
  | "LLM_INDISPONIBLE";

export interface Remarque {
  code: CodeRemarque;
  sceneId?: string;
  /** Phrase courte, en français, pour Williams. */
  message: string;
}

export interface ContexteValidation {
  /** Minutage des mots qui fait foi (remplace celui du plan). */
  mots?: MotMinute[];
  format?: FormatPlan;
  facecam?: boolean;
  /** Durée totale imposée (ms) ; sinon celle du plan, au moins la fin du dernier mot. */
  dureeMs?: number;
}

export interface ResultatValidation {
  plan: PlanValide;
  remarques: Remarque[];
}

const FORMAT_DEFAUT: FormatPlan = { largeur: 1080, hauteur: 1920, fps: 25 };
const HEX_CHARTE = new Set(Object.values(CHARTE_AXION).map((c) => c.toLowerCase()));
const TRANSITION_DEFAUT = { entree: "fondu", sortie: "fondu", dureeMs: 400 } as const;

const estObjet = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const nombre = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/* ------------------------------ Charte ------------------------------ */

/** Retire du contenu les couleurs hors charte et les polices autres que Manrope (récursif). */
function nettoyerCharte(v: unknown, cle: string, signaler: (code: CodeRemarque, message: string) => void): unknown {
  if (typeof v === "string") {
    if (/police|font/i.test(cle) && !v.toLowerCase().includes(POLICE_AXION.toLowerCase())) {
      signaler("POLICE_HORS_CHARTE", `Police « ${v.slice(0, 30)} » remplacée par ${POLICE_AXION}.`);
      return undefined;
    }
    if (/^#[0-9a-f]{3,8}$/i.test(v.trim()) && !HEX_CHARTE.has(v.trim().toLowerCase())) {
      signaler("COULEUR_HORS_CHARTE", `Couleur ${v} hors charte retirée.`);
      return undefined;
    }
    if (/couleur|color|teinte/i.test(cle) && TEINTES_INTERDITES.some((t) => v.toLowerCase().includes(t))) {
      signaler("COULEUR_HORS_CHARTE", `Couleur « ${v.slice(0, 20)} » hors charte retirée.`);
      return undefined;
    }
    return v;
  }
  if (Array.isArray(v)) return v.map((x) => nettoyerCharte(x, cle, signaler));
  if (estObjet(v)) {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      const n = nettoyerCharte(x, k, signaler);
      if (n !== undefined) o[k] = n;
    }
    return o;
  }
  return v;
}

/* ---------------------------- Paramètres ---------------------------- */

/** Paramètres réparés champ par champ : un champ faux ou absent prend la valeur de l'exemple ; un champ inconnu part. */
export function reparerParametres(piece: IdPiece, brut: unknown): { parametres: unknown; champs: string[] } {
  const def = CATALOGUE_BRIQUES[piece];
  const direct = def.schema.safeParse(brut);
  if (direct.success) return { parametres: direct.data, champs: [] };
  const forme = (def.schema as unknown as z.ZodObject<z.ZodRawShape>).shape;
  const exemple = def.exemple as Record<string, unknown>;
  const source = estObjet(brut) ? brut : {};
  const champs: string[] = [];
  const candidat: Record<string, unknown> = {};
  for (const k of Object.keys(forme)) {
    const r = (forme[k] as z.ZodType).safeParse(source[k]);
    if (r.success) candidat[k] = r.data;
    else {
      candidat[k] = structuredClone(exemple[k]);
      champs.push(k);
    }
  }
  for (const k of Object.keys(source)) if (!(k in forme)) champs.push(k);
  const final = def.schema.safeParse(candidat);
  return final.success ? { parametres: final.data, champs } : { parametres: structuredClone(def.exemple), champs: Object.keys(forme) };
}

/** Paramètres d'une pièce de repli bâtie sur un texte (légende, ou carte KPI si un chiffre s'y trouve). */
export function parametresDepuisTexte(piece: IdPiece, texte: string): unknown {
  const propre = texte.replace(/\s+/g, " ").trim() || "Axion IA";
  if (piece === "carte-kpi") {
    const m = /(\d+(?:[.,]\d+)?)\s*(%|€|min|h)?/.exec(propre);
    const valeur = m ? Number(m[1]!.replace(",", ".")) : 0;
    const libelle = propre.replace(m?.[0] ?? "", "").replace(/\s+/g, " ").replace(/^[\s,:;.\-]+|[\s,:;.\-]+$/g, "").slice(0, 40) || "Résultat";
    return reparerParametres("carte-kpi", { libelle, valeur, prefixe: "", suffixe: m?.[2] ? ` ${m[2]}` : "", decimales: m?.[1]?.match(/[.,](\d+)/)?.[1]?.length ?? 0, tendance: "hausse", variation: "" }).parametres;
  }
  if (piece === "legende") return { texte: propre.slice(0, 80), sousTexte: "", style: "bandeau" };
  return structuredClone(CATALOGUE_BRIQUES[piece].exemple);
}

/* ------------------------------ Repli ------------------------------ */

/** Plan de repli à partir du minutage : une scène niveau 1 par phrase (chiffre → carte KPI, sinon légende). */
export function planDeRepli(contexte: ContexteValidation): Omit<PlanValide, "scenes"> & { scenes: ScenePlan[] } {
  const mots = contexte.mots ?? [];
  const format = contexte.format ?? FORMAT_DEFAUT;
  const finMots = mots.at(-1)?.finMs ?? 0;
  const dureeMs = Math.max(contexte.dureeMs ?? 0, finMots, 3000);
  const phrases: { premier: number; dernier: number }[] = [];
  let debut = 0;
  mots.forEach((m, i) => {
    if (/[.!?:]$/.test(m.texte) || i - debut >= 11 || i === mots.length - 1) {
      phrases.push({ premier: debut, dernier: i });
      debut = i + 1;
    }
  });
  const scenes: ScenePlan[] = phrases.length
    ? phrases.map((p, i) => {
        const texte = mots.slice(p.premier, p.dernier + 1).map((m) => m.texte).join(" ");
        const piece = pieceLaPlusProche(undefined, texte);
        const fin = i + 1 < phrases.length ? mots[phrases[i + 1]!.premier]!.debutMs : dureeMs;
        return { id: `s${i + 1}`, version: 1, mots: p, debutMs: mots[p.premier]!.debutMs, finMs: Math.max(fin, mots[p.premier]!.debutMs + SCENE_MIN_MS), niveau: 1, position: contexte.facecam ? POSITION_SURE_FACECAM : "centre", transition: { ...TRANSITION_DEFAUT }, piece, parametres: parametresDepuisTexte(piece, texte) } as ScenePlan;
      })
    : [{ id: "s1", version: 1, mots: { premier: 0, dernier: 0 }, debutMs: 0, finMs: dureeMs, niveau: 1, position: contexte.facecam ? POSITION_SURE_FACECAM : "centre", transition: { ...TRANSITION_DEFAUT }, piece: "legende", parametres: parametresDepuisTexte("legende", "Axion IA") } as ScenePlan];
  return { version: VERSION_PLAN_SCENES, format, facecam: contexte.facecam ?? false, dureeMs, habillage: { fond: "ivoire", accent: "terracotta" }, mots, scenes };
}

/* ---------------------------- Validation ---------------------------- */

export function validerPlan(brut: unknown, contexte: ContexteValidation = {}): ResultatValidation {
  const remarques: Remarque[] = [];
  const noter = (code: CodeRemarque, message: string, sceneId?: string) => {
    if (!remarques.some((r) => r.code === code && r.sceneId === sceneId && r.message === message)) remarques.push({ code, message, ...(sceneId ? { sceneId } : {}) });
  };
  const lu = schemaPlanBrut.safeParse(brut);
  if (!lu.success || lu.data.scenes.length === 0) {
    noter("PLAN_ILLISIBLE", "Plan de scènes illisible : plan simple de repli (légendes et chiffres).");
    return { plan: avecEmpreintes(validerPlanInterne(planDeRepli(contexte), contexte, () => {})), remarques };
  }
  return { plan: avecEmpreintes(validerPlanInterne(lu.data, contexte, noter)), remarques };
}

type Noter = (code: CodeRemarque, message: string, sceneId?: string) => void;

function validerPlanInterne(p: Record<string, unknown> & { scenes: unknown[] }, contexte: ContexteValidation, noter: Noter): Omit<PlanValide, "scenes"> & { scenes: ScenePlan[] } {
  if (p.version !== VERSION_PLAN_SCENES) noter("VERSION", `Version du plan mise à ${VERSION_PLAN_SCENES}.`);
  // Format et minutage : le contexte fait foi.
  let format = contexte.format;
  if (!format) {
    const f = schemaFormat.safeParse(estObjet(p.format) ? { ...p.format, fps: 25 } : p.format);
    if (estObjet(p.format) && p.format.fps !== 25) noter("FORMAT", "Cadence ramenée à 25 images par seconde.");
    if (!f.success) noter("FORMAT", "Format illisible : 1080 × 1920.");
    format = f.success ? f.data : FORMAT_DEFAUT;
  }
  let mots = contexte.mots;
  if (!mots) {
    const m = z.array(schemaMot).safeParse(p.mots);
    if (!m.success) noter("MOTS", "Minutage des mots absent ou illisible : scènes gardées sur leurs propres temps.");
    mots = m.success ? m.data : [];
  }
  const facecam = contexte.facecam ?? p.facecam === true;
  // Habillage : orange sur fond clair → terracotta.
  const h = estObjet(p.habillage) ? p.habillage : {};
  const habillage: HabillagePlan = { fond: h.fond === "noir" ? "noir" : "ivoire", accent: h.accent === "orange" ? "orange" : "terracotta" };
  if (habillage.accent === "orange" && habillage.fond !== "noir") {
    habillage.accent = "terracotta";
    noter("ORANGE_SUR_CLAIR", "Orange réservé au fond noir : terracotta sur fond clair.");
  }
  const finMots = mots.at(-1)?.finMs ?? 0;
  let dureeMs = contexte.dureeMs ?? nombre(p.dureeMs) ?? 0;
  if (dureeMs < finMots) {
    if (nombre(p.dureeMs) !== undefined || contexte.dureeMs !== undefined) noter("DUREE_PLAN", "Durée du plan allongée jusqu'au dernier mot.");
    dureeMs = finMots;
  }

  const ids = new Set<string>();
  const scenes: ScenePlan[] = [];
  let finPrecedente = 0;
  p.scenes.forEach((sBrut, index) => {
    const s = estObjet(sBrut) ? sBrut : {};
    // Identifiant unique.
    let id = typeof s.id === "string" && s.id.trim() ? s.id.trim().slice(0, 36) : `s${index + 1}`;
    if (ids.has(id)) {
      let k = 2;
      while (ids.has(`${id}-${k}`)) k++;
      noter("ID_SCENE", `Identifiant de scène en double : ${id}-${k}.`, `${id}-${k}`);
      id = `${id}-${k}`;
    }
    ids.add(id);
    const signaler = (code: CodeRemarque, message: string) => noter(code, message, id);

    // Mots couverts et durées.
    const ms = estObjet(s.mots) ? s.mots : {};
    let premier = Math.max(0, Math.floor(nombre(ms.premier) ?? 0));
    let dernier = Math.max(premier, Math.floor(nombre(ms.dernier) ?? premier));
    if (mots.length) {
      premier = Math.min(premier, mots.length - 1);
      dernier = Math.min(Math.max(dernier, premier), mots.length - 1);
    }
    let debutMs = nombre(s.debutMs) ?? 0;
    let finMs = nombre(s.finMs) ?? 0;
    let recale = false;
    if (mots.length) {
      const dMot = mots[premier]!.debutMs;
      const fMot = mots[dernier]!.finMs;
      if (debutMs !== dMot || finMs < fMot || finMs <= debutMs) {
        recale = true;
        signaler("DUREE_RECALEE", "Début et fin recalés sur les mots du script.");
        debutMs = dMot;
        if (finMs < fMot || finMs <= dMot) finMs = fMot;
      }
    }
    if (debutMs < finPrecedente) {
      recale = true;
      signaler("CHEVAUCHEMENT", "Scène décalée après la précédente (elles se chevauchaient).");
      debutMs = finPrecedente;
    }
    if (finMs - debutMs < SCENE_MIN_MS) {
      if (!recale) signaler("DUREE_RECALEE", `Scène allongée à ${SCENE_MIN_MS} ms au moins.`);
      finMs = debutMs + SCENE_MIN_MS;
    }
    if (dureeMs && debutMs >= dureeMs) {
      signaler("SCENE_RETIREE", "Scène après la fin de la vidéo : retirée.");
      return;
    }
    if (finMs > dureeMs) dureeMs = finMs;
    finPrecedente = finMs;

    // Texte à l'écran.
    let texte = typeof s.texte === "string" && s.texte.trim() ? s.texte.trim() : undefined;
    if (texte && texte.length > 120) {
      signaler("TEXTE_COUPE", "Texte à l'écran coupé à 120 caractères.");
      texte = texte.slice(0, 120);
    }
    const texteScene = texte ?? mots.slice(premier, dernier + 1).map((m) => m.texte).join(" ");

    // Pièce niveau 1 (toujours présente : c'est aussi le repli des niveaux 2 et 3).
    const pieceDemandee = s.piece;
    let piece = pieceLaPlusProche(pieceDemandee, texteScene);
    let parametres: unknown;
    if (piece !== pieceDemandee) {
      signaler("PIECE_INCONNUE", `Pièce « ${String(pieceDemandee ?? "aucune")} » inconnue : « ${CATALOGUE_BRIQUES[piece].nom} » à la place.`);
      parametres = parametresDepuisTexte(piece, texteScene);
    } else {
      const r = reparerParametres(piece, nettoyerCharte(s.parametres, "", signaler));
      if (r.champs.length) signaler("PARAMETRES_REPARES", `Paramètres réparés (${r.champs.join(", ")}).`);
      parametres = r.parametres;
    }

    // Calques (niveau 2).
    let niveau: Niveau = s.niveau === 2 || s.niveau === 3 ? s.niveau : 1;
    const calques: Calque[] = [];
    if (Array.isArray(s.calques)) {
      s.calques.slice(0, 6).forEach((cBrut, i) => {
        const c = estObjet(cBrut) ? cBrut : {};
        if (typeof c.piece !== "string" || !Object.hasOwn(CATALOGUE_BRIQUES, c.piece)) {
          signaler("CALQUE_RETIRE", `Calque ${i + 1} : pièce « ${String(c.piece ?? "aucune")} » inconnue, retiré.`);
          return;
        }
        const pc = c.piece as IdPiece;
        const r = reparerParametres(pc, nettoyerCharte(c.parametres, "", signaler));
        if (r.champs.length) signaler("PARAMETRES_REPARES", `Calque ${i + 1} : paramètres réparés (${r.champs.join(", ")}).`);
        const zone = POSITIONS.includes(c.zone as Position) ? (c.zone as Position) : "plein";
        calques.push({ piece: pc, parametres: r.parametres, debutMs: Math.max(0, Math.min(nombre(c.debutMs) ?? 0, finMs - debutMs - 200)), zone } as Calque);
      });
      if (s.calques.length > 6) signaler("CALQUE_RETIRE", "Au plus 6 calques par scène : les suivants sont retirés.");
    }
    if (niveau === 3) {
      signaler("CODE_LIBRE_DESACTIVE", CODE_LIBRE_ACTIF ? "Code libre pas encore rendu : repli d'un niveau." : "Code libre désactivé : repli d'un niveau.");
      niveau = 2;
    }
    if (niveau === 2 && calques.length === 0) {
      if (pieceDemandee !== piece) piece = pieceLaPlusProche(Array.isArray(s.calques) ? (s.calques.find(estObjet)?.piece ?? pieceDemandee) : pieceDemandee, texteScene);
      if (pieceDemandee !== piece) parametres = parametresDepuisTexte(piece, texteScene);
      signaler("REPLI_NIVEAU_1", `Composition impossible : pièce en stock « ${CATALOGUE_BRIQUES[piece].nom} ».`);
      niveau = 1;
    }

    // Position (jamais devant le visage en face caméra) et transition douce.
    let position: Position = POSITIONS.includes(s.position as Position) ? (s.position as Position) : facecam ? POSITION_SURE_FACECAM : "centre";
    if (facecam && devantLeVisage(position)) {
      signaler("DEVANT_LE_VISAGE", `Scène déplacée en bas : la position « ${position} » cachait le visage.`);
      position = POSITION_SURE_FACECAM;
    }
    const t = estObjet(s.transition) ? s.transition : {};
    const entree = TRANSITIONS.includes(t.entree as never) ? (t.entree as (typeof TRANSITIONS)[number]) : "fondu";
    const sortie = TRANSITIONS.includes(t.sortie as never) ? (t.sortie as (typeof TRANSITIONS)[number]) : "fondu";
    const dureeT = nombre(t.dureeMs) ?? TRANSITION_DEFAUT.dureeMs;
    const plafond = Math.max(TRANSITION_MIN_MS, Math.min(TRANSITION_MAX_MS, Math.floor((finMs - debutMs) / 3)));
    const dureeTransition = Math.min(plafond, Math.max(TRANSITION_MIN_MS, dureeT));
    if (entree !== t.entree || sortie !== t.sortie || dureeTransition !== dureeT) signaler("TRANSITION_ADOUCIE", "Transition remplacée par une transition douce.");

    const version = Math.max(1, Math.floor(nombre(s.version) ?? 1));
    scenes.push({
      id,
      version,
      mots: { premier, dernier },
      debutMs,
      finMs,
      niveau,
      ...(texte ? { texte } : {}),
      position,
      transition: { entree, sortie, dureeMs: dureeTransition },
      piece,
      parametres,
      ...(niveau === 2 ? { calques } : {}),
    } as ScenePlan);
  });
  if (scenes.length === 0) {
    noter("PLAN_ILLISIBLE", "Aucune scène utilisable : plan simple de repli.");
    return planDeRepli({ mots, format, facecam, dureeMs });
  }
  return { version: VERSION_PLAN_SCENES, format, facecam, dureeMs: Math.max(dureeMs, scenes.at(-1)!.finMs), habillage, mots, scenes };
}
