/**
 * PONT « TEXTES DE LA CARTE » → DONNÉES DES MODÈLES 7 À 13 (brique `motion`, lot F2), comme `textes.ts` pour les 6
 * premiers : l'opération `ajouterCarte` du monteur porte les textes dans l'ordre. Convention (reprise dans la consigne
 * du monteur, `CONVENTION_TEXTES_ETENDUS`) :
 *   graphique         : [titre?, "Libellé : 9 h", "Libellé : 6 h", …, "barres" | "courbe" | "camembert"?]
 *   icone-mot         : [mot, sens?, sur-titre?]
 *   probleme-solution : ["Problème — détail?", "Solution — détail?"]
 *   check-list        : [titre, point, point…] (3 textes ou plus ; 2 textes = 2 points sans titre)
 *   capture-annotee   : [titre?, "cercle : étiquette", "flèche : étiquette", …] + l'image du passage (obligatoire)
 *   titre-plein-ecran : [titre, sous-titre?, sur-titre?] (un mot entre *astérisques* passe en orange)
 *   documentaire      : ["Lyon, Rhône", "Mars 2026", "14 salariés — ce que dit le chiffre", "contexte"?]
 * PUR, sans alias « @/ ».
 */
import { iconePour } from "./choix";
import { varianteGraphique, type ContexteChoixMotion } from "./choix-etendu";
import { contientNomOuBandeau } from "./documentaire";
import { carteDepuisTextes, CONVENTION_TEXTES, lireValeur } from "./textes";
import { estModeleEtendu } from "./catalogue-etendu";
import type { CarteModele, IdModeleMotion } from "./types";
import type { AnnotationCapture, CarteModeleEtendu, CarteMotionTous, IdModeleMotionEtendu, IdModeleMotionTous, TypeAnnotation, VarianteGraphique } from "./types-etendus";

export const CONVENTION_TEXTES_ETENDUS: Record<IdModeleMotionEtendu, string> = {
  graphique: '[titre facultatif, "Libellé : 9 h", "Libellé : 6 h", …, "barres" | "courbe" | "camembert" facultatif] — 2 à 6 valeurs',
  "icone-mot": '[mot (1 à 3 mots), "ce qu\'il veut dire" facultatif, sur-titre facultatif]',
  "probleme-solution": '["Le problème — détail facultatif", "La solution — détail facultatif"]',
  "check-list": "[titre, point 1, point 2, …] — 2 à 6 points courts, chacun se coche quand il est dit",
  "capture-annotee": '[titre facultatif, "cercle : étiquette", "flèche : étiquette", "surligne : étiquette", "cadre : étiquette"] — 1 à 4 annotations ; il faut une image (Mes images ou B-roll)',
  "titre-plein-ecran": "[titre, sous-titre facultatif, sur-titre facultatif] — SEULEMENT si Will le demande ; un mot entre *astérisques* passe en orange",
  documentaire: '["lieu", "date", "14 salariés — ce que dit le chiffre", "contexte facultatif"] — jamais de nom de personne, jamais de bandeau « nom · marque »',
};

const propre = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const VARIANTES: VarianteGraphique[] = ["barres", "courbe", "camembert"];

/** « Titre — détail » ou « Titre : détail ». */
function face(texte: string | undefined): { titre: string; detail?: string } | null {
  const t = propre(texte);
  if (!t) return null;
  const [titre, detail] = t.split(/\s+[—–-]\s+|\s*:\s+/, 2);
  return { titre: propre(titre), ...(detail ? { detail: propre(detail) } : {}) };
}

const TYPES_ANNOTATION: [RegExp, TypeAnnotation][] = [
  [/^cercle|^entour/i, "cercle"],
  [/^fl[eè]che/i, "fleche"],
  [/^surlign/i, "surligne"],
  [/^cadre|^encadr/i, "cadre"],
];

/** Positions d'office des annotations (sans vision) : réparties de haut en bas, Claude les précise d'après l'image. */
function annotationsDOffice(n: number): Pick<AnnotationCapture, "x" | "y" | "largeur" | "hauteur">[] {
  return Array.from({ length: n }, (_, i) => ({ x: 0.1, y: Math.min(0.78, 0.12 + (i * 0.7) / Math.max(1, n - 1 || 1)), largeur: 0.8, hauteur: 0.12 }));
}

/**
 * Données d'un modèle 7 à 13 depuis les textes d'une opération `ajouterCarte` ; null si les textes ne suffisent pas
 * (la capture annotée exige l'image du passage dans `contexte.capture`).
 */
export function carteDepuisTextesEtendus(modele: IdModeleMotionEtendu, textes: string[], contexte: ContexteChoixMotion = {}): CarteModeleEtendu | null {
  const t = textes.map(propre).filter(Boolean);
  switch (modele) {
    case "graphique": {
      let variante: VarianteGraphique | undefined;
      let titre: string | undefined;
      const series: { libelle: string; valeur: number }[] = [];
      let unite: string | undefined;
      for (const x of t) {
        if ((VARIANTES as string[]).includes(x.toLowerCase())) {
          variante = x.toLowerCase() as VarianteGraphique;
          continue;
        }
        const i = x.lastIndexOf(":");
        const v = i > 0 ? lireValeur(x.slice(i + 1)) : null;
        if (v) {
          series.push({ libelle: propre(x.slice(0, i)), valeur: v.valeur });
          unite ??= v.unite || undefined;
        } else if (!titre) titre = x;
      }
      if (series.length < 2) return null;
      return { modele, donnees: { variante: variante ?? varianteGraphique(t.join(" "), series, unite), ...(titre ? { titre } : {}), ...(unite ? { unite } : {}), series: series.slice(0, 6) } };
    }
    case "icone-mot": {
      if (!t[0]) return null;
      return { modele, donnees: { mot: t[0], icone: iconePour(`${t[0]} ${t[1] ?? ""}`) ?? "ampoule", ...(t[1] ? { sousTitre: t[1] } : {}), ...(t[2] ? { surTitre: t[2] } : {}) } };
    }
    case "probleme-solution": {
      const p = face(t[0]);
      const s = face(t[1]);
      if (!p || !s) return null;
      return { modele, donnees: { probleme: { ...p, icone: iconePour(t[0]) ?? "alerte" }, solution: { ...s, icone: iconePour(t[1]) ?? "coche-cercle" } } };
    }
    case "check-list": {
      if (t.length < 2) return null;
      const titre = t.length >= 3 ? t[0] : undefined;
      const points = t.length >= 3 ? t.slice(1) : t;
      return { modele, donnees: { ...(titre ? { titre } : {}), elements: points.slice(0, 6).map((texte) => ({ texte })) } };
    }
    case "capture-annotee": {
      if (!contexte.capture) return null;
      let titre: string | undefined;
      const annotations: { type: TypeAnnotation; texte?: string }[] = [];
      for (const x of t) {
        const type = TYPES_ANNOTATION.find(([re]) => re.test(x))?.[1];
        if (type) {
          const etiquette = propre(x.split(/\s*:\s*/).slice(1).join(" : "));
          annotations.push({ type, ...(etiquette ? { texte: etiquette } : {}) });
        } else if (!titre) titre = x;
      }
      const liste = (annotations.length ? annotations : [{ type: "cercle" as const }]).slice(0, 4);
      const positions = annotationsDOffice(liste.length);
      return { modele, donnees: { image: contexte.capture, ...(titre ? { titre } : {}), annotations: liste.map((a, i) => ({ ...a, ...positions[i] })) } };
    }
    case "titre-plein-ecran":
      if (!t[0]) return null;
      return { modele, donnees: { titre: t[0], ...(t[1] ? { sousTitre: t[1] } : {}), ...(t[2] ? { surTitre: t[2] } : {}) } };
    case "documentaire": {
      const libres = t.filter((x) => !contientNomOuBandeau(x));
      const date = libres.find((x) => /\b(19|20)\d{2}\b|janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre/i.test(x));
      const chiffreBrut = libres.find((x) => x !== date && /^\s*[+−-]?\d/.test(x));
      const v = chiffreBrut ? lireValeur(chiffreBrut.split(/\s+[—–-]\s+/)[0]) : null;
      const libelle = chiffreBrut ? propre(chiffreBrut.split(/\s+[—–-]\s+/)[1]) : "";
      const autres = libres.filter((x) => x !== date && x !== chiffreBrut);
      const lieu = autres[0];
      const contexteTexte = autres[1];
      if (!lieu && !date && !v) return null;
      return {
        modele,
        donnees: {
          ...(lieu ? { lieu } : {}),
          ...(date ? { date } : {}),
          ...(v ? { chiffre: { valeur: v.valeur, ...(v.unite ? { unite: v.unite } : {}), libelle, ...(v.decimales ? { decimales: v.decimales } : {}) } } : {}),
          ...(contexteTexte ? { contexte: contexteTexte } : {}),
        },
      };
    }
  }
}

/** Convention des textes des 13 modèles (les 6 premiers d'abord, inchangés). */
export const CONVENTION_TEXTES_TOUS: Record<IdModeleMotionTous, string> = { ...CONVENTION_TEXTES, ...CONVENTION_TEXTES_ETENDUS };

/** Données de l'un des 13 modèles depuis ses textes (les 6 premiers par `carteDepuisTextes`, inchangé) ; null sinon. */
export function carteDepuisTextesTous(modele: IdModeleMotionTous, textes: string[], contexte: ContexteChoixMotion = {}): CarteMotionTous | null {
  if (estModeleEtendu(modele)) return carteDepuisTextesEtendus(modele, textes, contexte);
  return carteDepuisTextes(modele as IdModeleMotion, textes) as CarteModele | null;
}
