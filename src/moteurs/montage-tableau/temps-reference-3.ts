/**
 * HEURES FINES DU STYLE « reference/3 » (14/10/2026, regard de Will : « le motion design n'est pas assez précis »,
 * « l'écriture traîne »). PUR. Lues dans la voix (mots horodatés), pour que le rendu suive EXACTEMENT ce qui est dit :
 *  - `<id>~fin` : la voix a fini de dire le bloc (le dernier de ses mots dits dans sa phrase) — il est écrit au plus
 *    tard à cette heure ;
 *  - `<id>~mot:<k>` et `<id>~motfin:<k>` : début et fin du k-ième mot important (`importants`) dit — le crayon
 *    l'entoure ou le souligne pendant qu'il est dit ;
 *  - `<id>~vers` : le premier mot du côté « après » d'une transformation (« Client A ») — il s'écrit à ce mot ;
 *  - `<id>~debut` : la voix commence à dire le bloc (le premier de ses mots dits) — une page n'arrive pas avant que la voix
 *    dise sa première phrase (le titre n'est jamais seul) ;
 *  - `<id>~cle` : la voix dit le dernier mot écrit du bloc (le mot-clé) — le marqueur balaie et la poussée douce part
 *    à cet instant (peps, 15/10) ;
 *  - bloc orange `<scène>~bloc` : `~debut`, `~fin`, et `~mot:0` / `~motfin:0`, le chiffre de son compteur dit (« trois »,
 *    « aucune ») — le bloc se pousse à cet instant.
 * Une heure introuvable n'est pas posée (le rendu garde alors son rythme naturel).
 */
import type { MotCalage } from "@/briques/motion/calage";
import { debutsDePhrase, mots } from "@/domaine/controles-script/texte";
import { cleMot } from "@/domaine/prononciations";
import { motsDitsParScene } from "./calage";
import { idBloc, type FicheTableau } from "./fiche";
import { cotesTransformation } from "./gabarit-3";

const cles = (t: string) => mots(t).map(cleMot).filter(Boolean);
const LETTRES: Record<number, string[]> = { 0: ["zero", "aucun", "aucune"], 1: ["un", "une"], 2: ["deux"], 3: ["trois"], 4: ["quatre"], 5: ["cinq"], 6: ["six"], 7: ["sept"], 8: ["huit"], 9: ["neuf"], 10: ["dix"] };

/** Heures fines (ms, horloge de la vidéo) de chaque bloc d'une fiche « reference/3 » calée. */
export function tempsReference3(fiche: FicheTableau, motsDits: readonly MotCalage[], prononciations: readonly { mot: string; prononciation: string }[] = []): Record<string, number> {
  const parScene = motsDitsParScene(fiche, motsDits, prononciations);
  const res: Record<string, number> = {};
  if (!parScene) return res;
  fiche.scenes.forEach((s, k) => {
    const dits = parScene[k];
    const toks = mots(s.texteDit).map(cleMot);
    const fins = [...debutsDePhrase(s.texteDit), toks.length];
    const finPhrase = (a: number) => (fins.find((d) => d > a) ?? toks.length) - 1;
    /** Le dernier mot du texte écrit dit entre `a` et la fin de sa phrase ; sinon la fin de la phrase. */
    const finDite = (texte: string, a: number) => {
      const fin = finPhrase(a);
      const derniers = cles(texte);
      for (let n = derniers.length - 1; n >= 0; n--) {
        for (let j = fin; j >= a; j--) if (toks[j] === derniers[n]) return j;
      }
      return fin;
    };
    /**
     * Le mot où la voix commence à dire le texte écrit (les ancres sont réparties par le rythme, elles ne le disent
     * pas) : l'un de ses trois premiers mots, dit au plus tard à l'ancre (le plus proche), sinon juste après ; sinon
     * l'ancre.
     */
    const debutDit = (texte: string, a: number) => {
      for (const c of cles(texte).slice(0, 3)) {
        for (let j = Math.min(a, toks.length - 1); j >= 0; j--) if (toks[j] === c) return j;
        for (let j = a + 1; j < toks.length; j++) if (toks[j] === c) return j;
      }
      return a;
    };
    const chercher = (mot: string, depuis: number) => {
      const c = cleMot(mot);
      for (let j = depuis; j < toks.length; j++) if (toks[j] === c) return j;
      return -1;
    };
    const textes: { id: string; texte: string; ancre: number; importants?: string[]; transformation?: boolean }[] = [];
    for (const e of s.elements) {
      if (e.type === "ligne") textes.push({ id: e.id, texte: e.texte, ancre: e.ancre, ...(e.importants ? { importants: e.importants } : {}), transformation: e.bloc === "transformation" });
      else if (e.type === "preuve") e.lignes.forEach((l, j) => textes.push({ id: j ? `${e.id}~${j}` : e.id, texte: l.replace(/^\s*(avant|après|apres)\s*:\s*/iu, ""), ancre: e.ancre }));
    }
    const bloc = s.gabarit?.bloc;
    if (bloc) {
      textes.push({ id: idBloc(s.id), texte: bloc.texte, ancre: Math.min(bloc.ancre ?? 0, Math.max(0, toks.length - 1)) });
      // Le chiffre du compteur dit (le plus proche du mot du bloc) : le bloc se pousse à cet instant.
      if (bloc.compteur) {
        const voulus = new Set([String(bloc.compteur.a), ...(LETTRES[bloc.compteur.a] ?? [])]);
        const a = bloc.ancre ?? 0;
        const j = toks.map((t, i) => (voulus.has(t) ? i : -1)).filter((i) => i >= 0).sort((u, v) => Math.abs(u - a) - Math.abs(v - a))[0];
        if (j !== undefined && dits[j]) {
          res[`${idBloc(s.id)}~mot:0`] = dits[j].debutMs;
          res[`${idBloc(s.id)}~motfin:0`] = dits[j].finMs;
        }
      }
    }
    for (const x of textes) {
      if (x.ancre >= toks.length) continue;
      const cotes = x.transformation ? cotesTransformation(x.texte) : null;
      const d = debutDit(x.texte, x.ancre);
      if (dits[d]) res[`${x.id}~debut`] = dits[d].debutMs;
      const j = finDite(cotes ? cotes.vers : x.texte, x.ancre);
      if (dits[j]) {
        res[`${x.id}~fin`] = dits[j].finMs;
        res[`${x.id}~cle`] = dits[j].debutMs;
      }
      if (cotes) {
        const v = chercher(cles(cotes.vers)[0] ?? "", x.ancre);
        if (v >= 0 && dits[v]) res[`${x.id}~vers`] = dits[v].debutMs;
      }
      let depuis = x.ancre;
      (x.importants ?? []).forEach((m, i) => {
        const v = chercher(m, depuis);
        if (v < 0 || !dits[v]) return;
        res[`${x.id}~mot:${i}`] = dits[v].debutMs;
        res[`${x.id}~motfin:${i}`] = dits[v].finMs;
        depuis = v + 1;
      });
    }
  });
  return res;
}
