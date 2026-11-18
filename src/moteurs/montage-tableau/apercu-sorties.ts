/**
 * FIX-ECRAN-SCENES-COMPLET : ce que chaque fichier dira et écrira, calculé depuis les MÊMES sorties relues et la MÊME
 * mise en page que la fabrication (`mettreEnPage(s.fiche, s.options)`, comme `controles.ts`). PUR : aucun accès service.
 * Une ligne de la fiche que la mise en page ne pose pas n'apparaît pas (l'écran ne promet que ce qui sera écrit).
 */
import type { FicheTableau } from "./fiche";
import type { IdSortie } from "./formats-sortie";
import { mettreEnPage } from "./mise-en-page";
import type { SortiePreparee } from "./relecture";
import { texteDitDe } from "./variantes-fin";

export interface ApercuSortie {
  sortie: IdSortie;
  libelle: string;
  /** Tout ce que la voix dit pour ce fichier. */
  dit: string;
  /** Phrases dites dans ce fichier et absentes du texte dit de la fiche (ajoutées par le Studio). */
  phrasesAjoutees: string[];
  /** Fin choisie retirée de ce fichier par une règle du 12/10 (TikTok, Shorts, LinkedIn) : le Studio le dit, rien n'est mis à sa place. */
  avisFin?: string;
  pages: { numero: number; lignes: { texte: string; ajout: boolean }[] }[];
}

/** Texte comparable : minuscules, sans accents, apostrophes et ponctuation réduites à un espace, bords espacés. */
const normaliser = (t: string) => ` ${t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9.]+/g, " ").replace(/\.(?=\s|$)/g, " ").replace(/\s+/g, " ").trim()} `;

const CLES_TECHNIQUES = /^(id|type|niveau|role|bloc|marque|cote|geste|dessinId|cibleId|preuveId|ancre|gabarit)$/;

/** Tous les textes que la fiche écrit pour ses éléments (champs de texte, jamais les identifiants). */
function textesDesElements(fiche: FicheTableau): string[] {
  const sortie: string[] = [];
  const voir = (v: unknown, cle?: string): void => {
    if (typeof v === "string") {
      if (!cle || !CLES_TECHNIQUES.test(cle)) sortie.push(v);
    } else if (Array.isArray(v)) v.forEach((x) => voir(x, cle));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) voir(x, k);
  };
  for (const s of fiche.scenes) for (const e of s.elements) voir(e);
  return sortie;
}

const phrasesDe = (t: string) => t.split(/(?<=[.!?…])\s+/u).map((p) => p.trim()).filter(Boolean);

/** Les lignes écrites d'une sortie, page par page : une ligne par élément, plus le texte du gabarit (« Idée reçue »). */
function pagesDe(fiche: FicheTableau, s: SortiePreparee): { numero: number; textes: string[] }[] {
  const mise = mettreEnPage(s.fiche, s.options);
  return mise.pages.map((p) => ({
    numero: p.page,
    textes: p.elements.flatMap((e) => {
      const g = e.gabarit as { texte?: { texte?: string } } | undefined;
      const ligne = e.lignes.map((l) => l.texte).join(" ").trim();
      return [...(ligne ? [ligne] : []), ...(g?.texte?.texte?.trim() ? [g.texte.texte.trim()] : [])];
    }),
  }));
}

export function apercuDesSorties(fiche: FicheTableau, relues: readonly SortiePreparee[]): ApercuSortie[] {
  const ditFiche = normaliser(texteDitDe(fiche));
  const connus = [ditFiche, ...textesDesElements(fiche).map(normaliser)];
  return relues.map((s) => {
    const dit = texteDitDe(s.fiche);
    let pages: ApercuSortie["pages"] = [];
    try {
      pages = pagesDe(fiche, s).map((p) => ({ numero: p.numero, lignes: p.textes.map((texte) => ({ texte, ajout: /\p{L}/u.test(texte) && !connus.some((c) => c.includes(normaliser(texte))) })) }));
    } catch {
      pages = [];
    }
    return { sortie: s.id, libelle: s.libelle, dit, phrasesAjoutees: phrasesDe(dit).filter((p) => !ditFiche.includes(normaliser(p))), pages };
  });
}
