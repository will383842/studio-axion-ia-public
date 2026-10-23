/**
 * L'IMAGE SUIT LA PAROLE (L0c, 15/10, analyse A1). Contrôle PUR du script (fiche d'écrans), rendu en AVERTISSEMENTS
 * montrés à Will quand il valide le script : jamais bloquant tant que Will ne les a pas vus à l'usage.
 *
 *  - liste « avant » : chaque case apparaît dans le morceau de phrase (entre deux virgules) qui la dit ; une case dont
 *    aucun mot n'est dit est signalée ; une énumération dite plus longue que les cases aussi (« 5 tâches dites, 4 cases ») ;
 *  - étape : le titre, la ligne ou une puce reprend au moins un mot-clé ou un chiffre dit pendant l'écran.
 *
 * Un mot-clé : un mot de 4 lettres au moins, hors mots outils, comparé sans casse, sans accent, sans élision, sur ses
 * 5 premières lettres (« inscription » ≈ « s'inscrit ») ; un chiffre écrit (« 15 ») vaut son nom en lettres (« quinze »).
 */
import { nombreEnLettres } from "@/domaine/prononciations";
import { motsDe, type EcranCorps } from "./fiche";

export interface AvertissementCorrespondance {
  ecranId: string;
  detail: string;
}

/** Mots outils jamais pris pour des mots-clés. */
const MOTS_OUTILS = new Set(["avec", "dans", "pour", "tout", "toute", "toutes", "tous", "sans", "plus", "leur", "leurs", "votre", "notre", "nous", "vous", "elle", "elles", "cette", "sont", "fait", "chaque", "comme", "mais", "aussi", "tres", "alors", "puis", "avant", "apres", "etait", "cest", "quil", "quelle", "depuis", "entre", "encore", "meme"]);
const LONGUEUR_CLE = 5;

const sansAccent = (m: string) => m.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
/** Forme comparable d'un mot : sans casse ni accent ni élision ni ponctuation. */
const forme = (m: string) =>
  sansAccent(m.replace(/\*/g, ""))
    .replace(/^(?:l|d|s|n|j|m|t|c|qu|jusqu|lorsqu|puisqu)['’]/u, "")
    .replace(/[^a-z0-9]/g, "");

/** Mots-clés d'un texte (racines de 5 lettres), chiffres écrits remplacés par leur nom en lettres. */
function cles(texte: string): string[] {
  const enLettres = texte.replace(/\d+(?:[ \u00a0]\d{3})*/g, (n) => ` ${nombreEnLettres(Number(n.replace(/[ \u00a0]/g, "")))} `);
  return motsDe(enLettres.replace(/-/g, " "))
    .map(forme)
    .filter((m) => m.length >= 4 && !MOTS_OUTILS.has(m))
    .map((m) => m.slice(0, LONGUEUR_CLE));
}

/** Mots lus du texte dit, avec le rang du morceau (entre deux ponctuations) et de la phrase où chacun tombe. */
function decouper(texteDit: string): { mot: string; morceau: number; phrase: number }[] {
  const res: { mot: string; morceau: number; phrase: number }[] = [];
  let morceau = 0;
  let phrase = 0;
  for (const brut of motsDe(texteDit)) {
    const lu = /[\p{L}\p{N}]/u.test(brut);
    if (lu) res.push({ mot: brut, morceau, phrase });
    if (/[,;:.!?…]["»”)]*$/u.test(brut) || !lu) morceau++;
    if (/[.!?…]["»”)]*$/u.test(brut)) phrase++;
  }
  return res;
}

const nettoye = (t: string) => t.replace(/\*/g, "").replace(/[,;:.!?…]+$/u, "");

function avertissementsListe(e: Extract<EcranCorps, { type: "liste-avant" }>): string[] {
  const res: string[] = [];
  const mots = decouper(e.texteDit);
  const clesDuMorceau = new Map<number, Set<string>>();
  for (const m of mots) for (const c of cles(m.mot)) (clesDuMorceau.get(m.morceau) ?? clesDuMorceau.set(m.morceau, new Set()).get(m.morceau)!).add(c);
  const surMots: number[] = [];
  e.taches.forEach((tache, k) => {
    const ev = e.evenements.find((x) => x.cible === `tache-${k + 1}`);
    if (!ev || !mots[ev.surMot]) return;
    surMots.push(ev.surMot);
    const voulues = cles(tache);
    const morceaux = [...clesDuMorceau].filter(([, s]) => voulues.some((c) => s.has(c))).map(([n]) => n);
    const posee = mots[ev.surMot];
    if (!morceaux.length) {
      res.push(`la case « ${nettoye(tache)} » n'est jamais dite : elle apparaît sur « ${nettoye(posee.mot)} ».`);
      return;
    }
    if (!morceaux.includes(posee.morceau)) {
      const dit = mots.find((m) => m.morceau === morceaux[0])!;
      res.push(`la case « ${nettoye(tache)} » apparaît sur « ${nettoye(posee.mot)} », alors que la voix la dit sur « ${nettoye(dit.mot)} ».`);
    }
  });
  // L'énumération dite : du morceau de la première case à la fin de sa phrase.
  if (surMots.length) {
    const premier = mots[Math.min(...surMots)];
    const enumeres = new Set(mots.filter((m) => m.phrase === premier.phrase && m.morceau >= premier.morceau).map((m) => m.morceau));
    if (enumeres.size > e.taches.length) res.push(`${enumeres.size} tâches dites, ${e.taches.length} cases : chaque tâche dite doit avoir sa case (ou en dire moins).`);
  }
  return res;
}

function avertissementsEtape(e: Extract<EcranCorps, { type: "etape" }>): string[] {
  const dites = new Set(cles(e.texteDit));
  const ecrits = [e.titre, e.ligne, ...e.puces];
  if (ecrits.some((t) => cles(t).some((c) => dites.has(c)))) return [];
  return [`l'étape « ${nettoye(e.titre)} » ne reprend aucun mot ni chiffre de ce que dit la voix (« ${e.texteDit.trim()} »).`];
}

/** Les écarts entre ce qui s'affiche et ce qui est dit, écran par écran (vide : rien à signaler). PUR. */
export function avertissementsCorrespondance(ecrans: readonly EcranCorps[]): AvertissementCorrespondance[] {
  return ecrans.flatMap((e) => {
    const details = e.type === "liste-avant" ? avertissementsListe(e) : e.type === "etape" ? avertissementsEtape(e) : [];
    return details.map((detail) => ({ ecranId: e.id, detail }));
  });
}
