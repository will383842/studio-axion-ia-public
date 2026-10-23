/**
 * Couverture d'une structure par la matière disponible (plan v5 B.3.9 points 4 et 13, C67). PUR.
 *
 * Une combinaison n'est réalisable que si ses temps OBLIGATOIRES ont chacun une source vraie (matière ou preuve), que
 * le corps qu'on peut en tirer dure au moins 16 s (estimation) et que l'appui n'est pas « faible » sans second ancrage.
 * Sinon : `MATIERE_INSUFFISANTE`, 0 €, sans numéro, avec la liste précise de ce qui manque.
 */
import { detailConcret } from "@/domaine/derivations-generateur";
import type { Matiere, ObjectifSujet, Preuve } from "@/domaine/types";
import { dureeTexte } from "./horloge";
import type { SourceTemps, StructureGenerateur, TempsStructure } from "./types";
import { normaliser } from "./texte";

/** Corps minimal estimé (s) pour écrire une vidéo plutôt qu'une phrase (C67, juges du banc v4). */
export const CORPS_MIN_ESTIME_SEC = 16;
/** Facteur de mise en phrase : une matière de 10 mots donne ≈ 15 mots dits (provisoire, à mesurer en G4). */
export const FACTEUR_MISE_EN_PHRASE = 1.5;
/** Sources retenues par temps pour estimer le corps (provisoire, à mesurer en G4). */
export const SOURCES_PAR_TEMPS = 2;

const MOTIF_CAUSE = /(?:^|[^a-z])(parce que|car|puisque|sinon|a cause|du coup|ce qui|c'est pour ca|donc|afin de|pour eviter|risque)(?=$|[^a-z])/;

export interface StockMatiere {
  matieres: Matiere[];
  preuves: Preuve[];
  /** Will parle (« Je lis », « J'improvise ») : un `avis-will` peut alors porter la vidéo (n° 65). */
  quiParleWill: boolean;
  objectif?: ObjectifSujet;
}

/** Les éléments (matières ou preuves) qui peuvent couvrir une source. */
export function candidatsSource(src: SourceTemps, stock: StockMatiere): { id: string; texte: string; genre: "matiere" | "preuve" }[] {
  if ("matiere" in src) {
    if (src.quiParleWill && !stock.quiParleWill) return [];
    return stock.matieres
      .filter((m) => m.type === src.matiere && (!src.contient || MOTIF_CAUSE.test(normaliser(m.texte))))
      .map((m) => ({ id: m.id, texte: m.texte, genre: "matiere" as const }));
  }
  const p = stock.preuves.filter((x) => {
    switch (src.preuve) {
      case "chiffree":
        return x.nature === "chiffree";
      case "prouve":
        return x.niveau === "prouve";
      case "observe":
        return x.niveau === "observe" || x.niveau === "prouve";
      case "regle-loi":
        return x.type === "regle-loi";
      case "cas-client":
        return x.type === "cas-client";
      case "avant-apres":
        return x.type === "cas-client" && !!x.client?.accordAvantApres && x.nature === "chiffree";
      case "formulation-autorisee":
        return x.formulationsAutorisees.length > 0;
      default:
        return true;
    }
  });
  return p.map((x) => ({ id: x.id, texte: x.enonce, genre: "preuve" as const }));
}

export interface Couverture {
  realisable: boolean;
  /** Temps obligatoires sans source (« le pourquoi », « 1 à 3 gestes »…). */
  manquants: TempsStructure[];
  appuiManquant: boolean;
  /** Ce qui couvre chaque temps (identifiants). */
  sources: Record<string, string[]>;
  appuis: string[];
  corpsEstimeSec: number;
  faible: boolean;
}

function obligatoire(t: TempsStructure, objectif?: ObjectifSujet): boolean {
  return t.obligatoire || (!!objectif && !!t.obligatoireSiObjectif?.includes(objectif));
}

/**
 * Couverture de la structure pour un ancrage principal donné (et un second éventuel).
 * Le texte de l'ancrage compte dans le corps estimé ; chaque source retenue aussi (une seule fois).
 */
export function couvrirStructure(structure: StructureGenerateur, ancrage: Matiere, stock: StockMatiere, debit: number, second?: Matiere): Couverture {
  const sources: Record<string, string[]> = {};
  const manquants: TempsStructure[] = [];
  const textes = new Map<string, string>([[ancrage.id, ancrage.texte]]);
  if (second) textes.set(second.id, second.texte);
  // Chaque temps (obligatoire ou non) peut nourrir le corps de ses 2 meilleures sources ; l'appui aussi.
  const prendre = (c: { id: string; texte: string }[]) => c.filter((x) => !textes.has(x.id)).slice(0, SOURCES_PAR_TEMPS).forEach((x) => textes.set(x.id, x.texte));
  for (const t of structure.temps) {
    const c = t.sources.flatMap((s) => candidatsSource(s, stock));
    sources[t.id] = c.map((x) => x.id);
    if (obligatoire(t, stock.objectif) && !c.length) manquants.push(t);
    prendre(c);
  }
  const appuis = structure.appui.flatMap((s) => candidatsSource(s, stock));
  const appuiManquant = structure.appui.length > 0 && !appuis.length;
  prendre(appuis);
  const corpsEstimeSec = +(dureeTexte([...textes.values()].join(". "), debit) * FACTEUR_MISE_EN_PHRASE).toFixed(1);
  const faibleAncrage = ["observation", "idee-recue"].includes(ancrage.type) && !detailConcret(ancrage.texte);
  const preuveConcrete = stock.preuves.some((p) => p.nature === "chiffree");
  const faible = faibleAncrage && !second && !preuveConcrete;
  return {
    realisable: !manquants.length && !appuiManquant && corpsEstimeSec >= CORPS_MIN_ESTIME_SEC && !faible,
    manquants,
    appuiManquant,
    sources,
    appuis: appuis.map((x) => x.id),
    corpsEstimeSec,
    faible,
  };
}

/** Phrase de la carte « matière insuffisante » : ce qui manque, en clair. */
export function libelleManque(c: Couverture): string {
  const parts = c.manquants.map((t) => t.libelle);
  if (c.appuiManquant) parts.push("un appui (une preuve, une observation, ou votre avis si vous parlez)");
  if (c.faible) parts.push("un détail concret (un chiffre, un métier, un objet)");
  if (!parts.length && c.corpsEstimeSec < CORPS_MIN_ESTIME_SEC) parts.push(`assez de matière pour tenir ${CORPS_MIN_ESTIME_SEC} s (≈ ${String(c.corpsEstimeSec).replace(".", ",")} s aujourd'hui)`);
  return parts.join(" ; ");
}
