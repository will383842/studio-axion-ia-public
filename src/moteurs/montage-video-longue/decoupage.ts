/**
 * DÉCOUPAGE DU SCRIPT DE LA VIDÉO LONGUE (lot QUALL-1) — PUR, une seule source : appelé par l'écran (`chapitresDuScript`,
 * ré-exporté par `PlanChapitres`) ET par le serveur (`lireEntreesVideoLongue` → `normaliserChapitres`). Aucun import hors
 * du contrat commun : lisible côté client comme côté serveur. Le texte reste celui de l'utilisateur, rien n'est inventé.
 */
import { TEMPS_LONGUE } from "./storyboard-types";

export interface ChapitreDecoupe {
  id: string;
  titre: string;
  /** « Ce que ce chapitre explique » : écrit par l'utilisateur, vide au départ. */
  explique: string;
  texte: string;
}

const compter = (t: string): number => t.split(/\s+/).filter(Boolean).length;

/** Découpe une phrase par phrase (le texte reste celui de l'utilisateur, aucun mot ajouté ni changé). */
export function decouperEnPhrases(texte: string): string[] {
  return texte
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…])\s+/)
    .filter(Boolean);
}

/** Temps de lecture d'une phrase de `mots` mots (respiration non comprise). */
export const dureePhraseMs = (mots: number): number => Math.max(TEMPS_LONGUE.phraseMinMs, (mots / TEMPS_LONGUE.motsParSeconde) * 1000);

/** Temps d'un chapitre sans voix : son carton, puis chaque phrase (lecture + respiration). Cartons de titre et de fin non compris. */
export function dureeChapitreMs(texte: string): number {
  let t: number = TEMPS_LONGUE.cartonChapitreMs;
  for (const p of decouperEnPhrases(texte)) t += dureePhraseMs(compter(p)) + TEMPS_LONGUE.respirationMs;
  return t;
}

/** Ligne-titre : ligne seule non vide, 12 mots et 90 caractères au plus, sans ponctuation FINALE de phrase, sans puce. */
export function estLigneTitre(ligne: string): boolean {
  const l = ligne.trim();
  if (!l || /\n/.test(l)) return false;
  // Les signes seuls (« : », « — ») ne sont pas des mots.
  if (l.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length > 12 || l.length > 90) return false;
  if (/[.!?…;,:]$/.test(l)) return false;
  if (/^(?:[-•*]|\d+[.)])(?:\s|$)/.test(l)) return false;
  return true;
}

/** Un titre vide ou « Chapitre 3 » compte comme manquant. */
export const titreManquant = (titre: string | undefined): boolean => !titre || !titre.trim() || /^chapitre\s*\d+$/i.test(titre.trim());

/** Titre déduit du texte : première proposition de la première phrase (2 à 8 mots), sinon ses 6 premiers mots + « … ». */
export function titreDeduit(texte: string): string {
  const phrase = decouperEnPhrases(texte)[0] ?? "";
  if (!phrase) return "";
  const proposition = phrase.split(/[,;:.?!…]/)[0].trim();
  const n = compter(proposition);
  if (n >= 2 && n <= 8) return proposition;
  const mots = phrase.split(/\s+/).filter(Boolean);
  const sansFin = phrase.replace(/[.!?…]+$/, "").trim();
  if (mots.length <= 6) return sansFin;
  return `${mots.slice(0, 6).join(" ").replace(/[.,;:!?…]+$/, "")}…`;
}

interface ChapitreSimple {
  id: string;
  titre: string;
  texte: string;
}

const joindreTitres = (a: string, b: string): string => (a && b ? `${a} — ${b}` : a || b);

/** Fusionne les chapitres de moins de 10 s (cartons, titre et fin compris) avec le suivant, le dernier avec le précédent. */
function fusionnerCourts<T extends ChapitreSimple>(liste: T[], avecQuestion: boolean): T[] {
  const out = [...liste];
  const duree = (i: number): number =>
    dureeChapitreMs(out[i].texte) + (i === 0 && avecQuestion ? TEMPS_LONGUE.cartonTitreMs : 0) + (i === out.length - 1 ? TEMPS_LONGUE.finMs : 0);
  for (;;) {
    if (out.length < 2) return out;
    const court = out.findIndex((_, i) => duree(i) < TEMPS_LONGUE.chapitreMinMs);
    if (court < 0) return out;
    const a = court < out.length - 1 ? court : court - 1;
    const b = a + 1;
    const garder = compter(out[b].texte) > compter(out[a].texte) ? out[b] : out[a];
    out.splice(a, 2, { ...out[a], titre: garder.titre, texte: `${out[a].texte} ${out[b].texte}`.trim() });
  }
}

const ID = (i: number) => `chapitre-${i + 1}`;

/**
 * Chapitres tirés du script collé. Avec « # » : un titre « # … » ouvre un chapitre (règle d'origine). Sans « # » : blocs aux
 * lignes vides ; une ligne-titre (courte, sans ponctuation finale) devient le titre du paragraphe qui la suit ; un bloc fait
 * seulement d'une ligne-titre n'est jamais un chapitre ; un chapitre de moins de 10 s est fusionné. Script vide : rien.
 */
export function chapitresDuScript(script: string): ChapitreDecoupe[] {
  const brut = script.replace(/\r\n/g, "\n").trim();
  if (!brut) return [];
  const lignes = brut.split("\n");
  if (lignes.some((l) => /^#+\s*\S/.test(l))) {
    const blocs: { titre: string; texte: string[] }[] = [];
    for (const l of lignes) {
      const m = /^#+\s*(.+)$/.exec(l.trim());
      if (m) blocs.push({ titre: m[1].trim(), texte: [] });
      else if (l.trim()) {
        if (blocs.length === 0) blocs.push({ titre: "", texte: [] });
        blocs[blocs.length - 1].texte.push(l.trim());
      }
    }
    return blocs
      .map((b) => ({ titre: b.titre, texte: b.texte.join(" ") }))
      .filter((b) => b.texte !== "" || b.titre !== "")
      .map((b, i) => ({ id: ID(i), titre: b.titre, explique: "", texte: b.texte }));
  }
  const chapitres: { titre: string; texte: string }[] = [];
  let attente = "";
  for (const bloc of brut.split(/\n\s*\n/)) {
    const l = bloc.split("\n").map((x) => x.trim()).filter(Boolean);
    if (l.length === 0) continue;
    if (l.length === 1 && estLigneTitre(l[0])) {
      attente = joindreTitres(attente, l[0]);
      continue;
    }
    const reste = l.slice(1);
    const paragraphe = reste.length > 1 || (reste.length === 1 && !estLigneTitre(reste[0]));
    if (estLigneTitre(l[0]) && paragraphe) {
      chapitres.push({ titre: joindreTitres(attente, l[0]), texte: reste.join(" ") });
    } else {
      chapitres.push({ titre: attente, texte: l.join(" ") });
    }
    attente = "";
  }
  if (attente) {
    // Ligne-titre finale sans paragraphe derrière : texte du chapitre précédent.
    if (chapitres.length) chapitres[chapitres.length - 1].texte += ` ${attente}`;
    else chapitres.push({ titre: "", texte: attente });
  }
  return fusionnerCourts(
    chapitres.map((c, i) => ({ id: ID(i), titre: c.titre, texte: c.texte })),
    false,
  ).map((c, i) => ({ id: ID(i), titre: c.titre, explique: "", texte: c.texte }));
}

/**
 * Côté serveur : même règle sur les chapitres déjà créés. Un chapitre sans titre dont le texte est une ligne-titre devient le
 * titre du chapitre suivant (ou le texte du précédent s'il est le dernier) ; puis aucun chapitre de moins de 10 s.
 */
export function normaliserChapitres<T extends ChapitreSimple>(chapitres: readonly T[], options: { question?: boolean } = {}): T[] {
  const out: T[] = [];
  let attente = "";
  for (const c of chapitres) {
    if (titreManquant(c.titre) && !/\n/.test(c.texte.trim()) && estLigneTitre(c.texte)) {
      attente = joindreTitres(attente, c.texte.trim());
      continue;
    }
    out.push(attente ? { ...c, titre: titreManquant(c.titre) ? attente : joindreTitres(attente, c.titre) } : c);
    attente = "";
  }
  if (attente) {
    if (out.length) out[out.length - 1] = { ...out[out.length - 1], texte: `${out[out.length - 1].texte} ${attente}` };
    else if (chapitres.length) out.push({ ...chapitres[chapitres.length - 1], titre: "", texte: attente });
  }
  return fusionnerCourts(out, options.question === true);
}
