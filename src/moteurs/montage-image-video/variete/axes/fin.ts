/**
 * Axe « fin » de la variété (lot OUV-FIN, doc 72 axe 8, maquettes `prototypes/d1-ouvertures-fins/fins.tsx`).
 *
 * Seul change le moment « phrase-choc » (la fin propre à chaque réseau, venue de la banque, n'est pas touchée) : il
 * devient un bloc `sorte: "variete"`, axe « fin », à la même place. La phrase reste MOT POUR MOT, aux mêmes heures.
 *  - FIN-A (référence, tirable) : rien ne change.
 *  - FIN-C (boucle) : la dernière image reprend la première, celle de l'ouverture tirée (même objet, état final).
 *  - FIN-D (le chiffre qui reste) : le chiffre-clé reste au-dessus de la phrase-choc.
 * Un chiffre n'est jamais montré avant d'être dit (Q13, hors ouverture) : sinon repli sur FIN-A, inscrit dans `replis`.
 */
import type { FormatIV } from "@/briques/schema-motion/variete";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { BlocRenduIV, MomentPlanIV } from "../../mise-en-scene";
import type { AxeVarieteIV, EtapeVarieteIV } from "../index";
import { LectureCarte, type ChiffreOuvertureIV, type DonneesOuvertureIV } from "./ouverture";

/** Données de l'écran de fin (lues par `studio-rendu/compositions/image-video/variete/fin/donnees.ts`). */
export type DonneesFinIV = {
  /** La phrase-choc du moment, exacte (`*mot*` = orange), et l'heure de chaque mot (s, depuis le début du bloc). */
  phrase: string;
  heures: number[];
  /** Les mêmes mots, avec la ponctuation de la phrase de la carte quand ce sont exactement les mêmes. */
  mots: string[];
  /** Nombre de mots de chaque phrase (une ligne par écran de la fiche). */
  lignes: number[];
} & (
  | {
      code: "FIN-C";
      /** L'ouverture de la version (code et données), redessinée dans son état final. */
      boucle: DonneesOuvertureIV;
      /** Un chiffre de la carte déjà dit, montré à la place de l'heure (horloge). */
      deja: ChiffreOuvertureIV | null;
      /** L'heure de la phrase-choc (aiguilles seulement, sans texte). */
      heure: { h: number; m: number } | null;
    }
  | { code: "FIN-D"; chiffre: ChiffreOuvertureIV; part: number | null }
);

type PhraseChoc = Extract<MomentPlanIV, { sorte: "phrase-choc" }>;

/** Mots de la carte (avec ponctuation) s'ils sont exactement ceux du moment ; sinon ceux du moment. */
function motsPonctues(carte: CarteImage, phrase: string): string[] {
  const dits = phrase.replace(/\*/g, "").split(/\s+/).filter(Boolean);
  const ecrits = (carte.phraseChocValidee ?? carte.phraseChoc).split(/\s+/).filter(Boolean);
  const nu = (m: string) => m.replace(/[.,!?…;:]+$/u, "");
  return ecrits.length === dits.length && ecrits.every((m, i) => nu(m) === dits[i]) ? ecrits : dits;
}

/** Nombre de mots de chaque écran « phrase-choc » de la fiche ; une seule ligne si le compte ne tombe pas juste. */
function lignesDe(etape: EtapeVarieteIV, n: number): number[] {
  const l = etape.fiche.ecrans.filter((e) => e.partie === "phrase-choc").map((e) => e.textesEcran.join(" ").replace(/\*/g, "").split(/\s+/).filter(Boolean).length);
  return l.reduce((a, b) => a + b, 0) === n && l.length ? l : [n];
}

/** Les clés de chiffres que l'écran d'ouverture montre. */
function clesMontrees(d: DonneesOuvertureIV, lecture: LectureCarte): string[] {
  const parBrut = new Map(lecture.carte.chiffres.map((c) => [c.brut, lecture.cles.get(c.id)!]));
  switch (d.code) {
    case "OUV-A":
      return [d.resultat.chiffre.cle, ...(d.depart.chiffre ? [d.depart.chiffre.cle] : [])];
    case "OUV-B":
      return [d.avant.chiffre.cle, d.apres.chiffre.cle];
    case "OUV-C":
      return [...(d.objet.chiffre ? [d.objet.chiffre.cle] : []), ...(d.heure ? [parBrut.get(d.heure.texte) ?? ""] : [])];
    case "OUV-D":
      return d.mots.flatMap((m) => (parBrut.has(m.texte) ? [parBrut.get(m.texte)!] : []));
    case "OUV-E":
      return [];
  }
}

export const AXE_FIN: AxeVarieteIV = {
  axe: "fin",
  possibles(carte: CarteImage, format: FormatIV) {
    void format;
    return ["FIN-A", "FIN-C", ...(new LectureCarte(carte).chiffreFinal() ? ["FIN-D" as const] : [])];
  },
  appliquer(etape: EtapeVarieteIV): EtapeVarieteIV {
    const code = etape.recette.fin;
    if (code !== "FIN-C" && code !== "FIN-D") return etape;
    const repli = (raison: string): EtapeVarieteIV => ({ ...etape, replis: [...etape.replis, { axe: "fin", code, raison }] });
    const i = etape.blocs.findIndex((b) => b.sorte === "moments" && b.moments.some((m) => m.sorte === "phrase-choc"));
    if (i < 0) return repli("pas de phrase-choc à l'écran");
    const b = etape.blocs[i] as Extract<BlocRenduIV, { sorte: "moments" }>;
    if (b.moments.length !== 1) return repli("la phrase-choc partage son écran avec un autre moment");
    const m = b.moments[0] as PhraseChoc;
    const lecture = new LectureCarte(etape.carte);
    const dit = (cle: string) => etape.chiffresDits.some((c) => c.cle === cle && c.t < b.debut - 1e-6);
    const mots = motsPonctues(etape.carte, m.phrase);
    const commun = { phrase: m.phrase, heures: [...m.heures], mots, lignes: lignesDe(etape, mots.length) };
    let donnees: DonneesFinIV;
    if (code === "FIN-D") {
      const fin = lecture.chiffreFinal();
      const said = fin && dit(lecture.cles.get(fin.c.id)!) ? fin.c : etape.carte.bandeauChiffres.map((id) => etape.carte.chiffres.find((c) => c.id === id)).find((c) => c && c.valeur !== null && dit(lecture.cles.get(c.id)!));
      if (!said) return repli("aucun chiffre-clé dit avant la phrase-choc");
      donnees = { ...commun, code, chiffre: lecture.chiffre(said), part: said.unite === "%" ? said.valeur : null };
    } else {
      const ouverture = etape.blocs.find((x) => x.sorte === "variete" && x.axe === "ouverture");
      if (!ouverture || ouverture.sorte !== "variete") return repli("pas d'écran d'ouverture à reprendre");
      const boucle = ouverture.donnees as DonneesOuvertureIV;
      const pasDits = clesMontrees(boucle, lecture).filter((c) => !dit(c));
      if (pasDits.length) return repli(`l'ouverture montre un chiffre pas encore dit (${pasDits.join(", ")})`);
      // L'heure de la phrase-choc (« 3h ») : les aiguilles seulement ; à l'écran, un chiffre du bandeau déjà dit.
      const refs = new Set(etape.fiche.ecrans.filter((e) => e.partie === "phrase-choc").flatMap((e) => e.refs));
      const h = etape.carte.chiffres.find((c) => refs.has(c.id) && c.unite === "heure" && c.valeur !== null);
      const bandeau = etape.carte.bandeauChiffres.map((id) => etape.carte.chiffres.find((c) => c.id === id)!).filter((c) => c && dit(lecture.cles.get(c.id)!));
      const deja = bandeau.length ? bandeau[bandeau.length - 1] : null;
      donnees = { ...commun, code, boucle, deja: deja ? lecture.chiffre(deja) : null, heure: h && h.valeur !== null ? { h: Math.floor(h.valeur / 60) % 24, m: h.valeur % 60 } : null };
    }
    const bloc: BlocRenduIV = { id: b.id, debut: b.debut, fin: b.fin, ...(b.variete ? { variete: b.variete } : {}), sorte: "variete", axe: "fin", code, donnees };
    return { ...etape, blocs: etape.blocs.map((x, k) => (k === i ? bloc : x)) };
  },
};
