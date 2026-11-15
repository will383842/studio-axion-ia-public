/**
 * Écran « Guides » (lot G5) · textes et conversions PURES (sans React). Langage simple pour le fondateur :
 * pour la suite d'un compte, on dit « suivre le compte ».
 */
import type { ContenuGuide } from "@/domaine/guides-pdf/guide-contenu";

export const TEXTES_GUIDES = {
  titre: "Guides à télécharger",
  intro: "Fabriquez un guide en 5 gestes. Rien n'est envoyé sur un réseau social, et rien ne s'allume tout seul.",
  etapes: ["Choisir le mot", "Rédiger avec l'IA", "Relire et valider", "Fabriquer le PDF", "Rattacher au mot"],
  choisirMot: "Mot du guide",
  motAide: "Choisissez un mot de la liste ou écrivez-en un nouveau.",
  creer: "Créer son guide",
  rediger: "Rédiger avec l'IA",
  redigerAide: "Claude écrit un brouillon. Il reste « à valider » tant que vous ne l'avez pas relu.",
  toutLu: "J'ai tout lu",
  toutLuDetail: "Cochez seulement après avoir relu le guide en entier.",
  valider: "Valider",
  fabriquer: "Fabriquer le PDF",
  fabriquerAide: "Le texte validé est envoyé au site, qui fabrique le PDF.",
  rattacher: "Rattacher au mot",
  rattacherAide: "Le guide est ajouté au catalogue et lié au mot, sans être allumé. L'allumage est un geste à part.",
  aucunBrouillon: "Pas encore de brouillon pour ce mot.",
  apercu: "Aperçu du guide fabriqué",
  rattache: "Rattaché au mot (inactif).",
  pdfFabrique: "PDF fabriqué.",
  erreurGeneral: "Le geste n'a pas abouti. Réessayez.",
} as const;

/** Étape atteinte (0 à 4) : sert à montrer où en est le guide. */
export function etapeAtteinte(v: { derniere: { statut: string } | null; fabrique: { rattache: boolean } | null } | null): number {
  if (!v || !v.derniere) return 0;
  if (v.fabrique?.rattache) return 4;
  if (v.fabrique) return 3;
  return v.derniere.statut === "Validé" ? 2 : 1;
}

export interface SectionEditable {
  titre: string;
  /** Paragraphes séparés par une ligne vide. */
  paragraphes: string;
  /** Une puce par ligne. */
  puces: string;
}
export interface ContenuEditable {
  titre: string;
  sections: SectionEditable[];
}

export function versEditable(c: ContenuGuide): ContenuEditable {
  return { titre: c.titre, sections: c.sections.map((s) => ({ titre: s.titre, paragraphes: s.paragraphes.join("\n\n"), puces: s.puces.join("\n") })) };
}

/** Texte saisi → contenu du guide. Les lignes vides en trop sont ignorées ; le contrôle complet reste côté serveur. */
export function depuisEditable(e: ContenuEditable): ContenuGuide {
  const nettoyer = (l: string[]) => l.map((x) => x.trim()).filter(Boolean);
  return {
    titre: e.titre.trim(),
    sections: e.sections.map((s) => ({
      titre: s.titre.trim(),
      // Un retour à la ligne simple dans un paragraphe devient une espace (le contrôle des caractères refuse les sauts de ligne).
      paragraphes: nettoyer(s.paragraphes.split(/\n\s*\n/).map((x) => x.replace(/\s*[\r\n]+\s*/g, " "))),
      puces: nettoyer(s.puces.split("\n")),
    })),
  };
}
