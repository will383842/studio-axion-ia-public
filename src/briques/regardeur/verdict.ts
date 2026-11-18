import { mots, normaliser } from "./normaliser";
import type { CodeDefautVu, DefautVu, FinAttendue, ImageLue, InstantRegard, LectureRegard, VerdictRegard } from "./types";

const BLOQUANTS = new Set<CodeDefautVu>(["phrase-non-choisie", "fin-absente", "page-vide", "texte-coupe"]);

const contient = (haut: string, aiguille: string) => aiguille !== "" && ` ${haut} `.includes(` ${aiguille} `);

/**
 * Le CODE décide des défauts à partir de la recopie de Claude. Fonction PURE, ne lève jamais : sur une exception,
 * rien n'est jugé et tous les instants sont « non relus ».
 */
export function jugerRegard(e: { instants: InstantRegard[]; lecture: LectureRegard | null; textesPermis: string[]; fin?: FinAttendue }): VerdictRegard {
  try {
    return juger(e);
  } catch {
    return { defauts: [], relues: 0, nonRelues: Array.isArray(e?.instants) ? e.instants.length : 0, partiesFautives: [] };
  }
}

function juger(e: { instants: InstantRegard[]; lecture: LectureRegard | null; textesPermis: string[]; fin?: FinAttendue }): VerdictRegard {
  const parNom = new Map<string, ImageLue>((e.lecture ? e.lecture.images : []).map((i) => [i.nom, i]));
  const permis = normaliser(e.textesPermis.join(" "));
  const lignes = e.textesPermis.flatMap((t) => t.split(/[.!?\n]+/)).map((t) => new Set(mots(t)));
  const defauts: DefautVu[] = [];
  let relues = 0;
  let nonRelues = 0;
  const ajouter = (i: InstantRegard, code: CodeDefautVu, detail: string) =>
    defauts.push({ code, nom: i.nom, instantSec: i.instantSec, partieId: i.partieId, detail, bloquantSiSur: BLOQUANTS.has(code) });

  const ordre = [...e.instants].sort((a, b) => a.instantSec - b.instantSec);
  for (const i of ordre) {
    const img = parNom.get(i.nom);
    if (!img) {
      nonRelues++;
      ajouter(i, "non-relue", "L'image n'a pas pu être relue.");
      continue;
    }
    relues++;
    if (img.noire) {
      ajouter(i, "noire", "L'image est entièrement noire.");
      continue;
    }
    if (img.illisible) {
      ajouter(i, "illisible", "L'image est illisible.");
      continue;
    }
    if (i.texteAttendu && (img.pageVide || img.textes.length === 0)) ajouter(i, "page-vide", "Du texte est attendu à cet instant, mais la page est vide.");
    for (const t of img.textes) {
      if (t.coupe) ajouter(i, "texte-coupe", `Texte coupé : « ${t.texte} »`);
      if (t.horsCadre) ajouter(i, "hors-cadre", `Texte qui dépasse du cadre : « ${t.texte} »`);
      const entiers = mots(t.texte);
      if (entiers.length < 3) continue;
      const jugés = t.coupe ? entiers.slice(0, -1) : entiers;
      if (jugés.length === 0 || contient(permis, jugés.join(" "))) continue;
      const longs = jugés.filter((m) => m.length >= 4);
      if (longs.length > 0 && lignes.some((l) => longs.every((m) => l.has(m)))) continue;
      ajouter(i, "phrase-non-choisie", `Texte à l'écran qui ne fait pas partie des textes choisis : « ${t.texte} »`);
    }
    if (img.sousTitre && img.sousTitre.trim() !== "" && i.motsDits.length > 0) {
      const dits = new Set(i.motsDits.flatMap((m) => mots(m, 3)));
      if (!mots(img.sousTitre, 3).some((m) => dits.has(m))) ajouter(i, "desynchro", `Le sous-titre « ${img.sousTitre} » ne correspond pas aux mots dits à ce moment.`);
    }
  }

  if (e.fin) {
    const cibles = ordre.filter((i) => i.sorte === "fin");
    const derniere = ordre.filter((i) => i.sorte === "partie").at(-1);
    if (derniere) cibles.push(derniere);
    const lues = cibles.map((i) => parNom.get(i.nom)).filter((x): x is ImageLue => !!x && !x.noire && !x.illisible);
    const instantFin = ordre.filter((i) => i.sorte === "fin").at(-1);
    if (lues.length > 0 && instantFin) {
      const vus = lues.flatMap((x) => [...x.textes.map((t) => t.texte), ...(x.sousTitre ? [x.sousTitre] : [])]).map(normaliser);
      const cle = e.fin.motCle ? normaliser(e.fin.motCle) : "";
      let present: boolean;
      if (cle) present = vus.some((v) => contient(v, cle));
      else {
        const voulus = mots(e.fin.texte, 4);
        const mv = new Set(vus.flatMap((v) => v.split(" ")));
        present = voulus.length === 0 || voulus.filter((m) => mv.has(m)).length / voulus.length >= 0.6;
      }
      if (!present) ajouter(instantFin, "fin-absente", `La fin choisie n'apparaît pas à l'écran : « ${e.fin.texte} »`);
    }
  }

  defauts.sort((a, b) => a.instantSec - b.instantSec);
  const partiesFautives: string[] = [];
  for (const d of defauts) if (d.code !== "non-relue" && d.partieId !== null && !partiesFautives.includes(d.partieId)) partiesFautives.push(d.partieId);
  return { defauts, relues, nonRelues, partiesFautives };
}
