/**
 * ACCROCHES DE RÉFÉRENCE DU FORMAT AVOCAT (plan du moteur avocat, B.9 bis ; lot M1). PUR.
 * Une seule source, partagée par la démonstration (base neuve) et par la migration au démarrage (base en ligne).
 */
import type { Script } from "@/domaine/types";

/**
 * Accroches et sujets de la fiche de style (`references-avocat/FICHE-STYLE-AVOCAT.md`), rangés comme SCRIPTS DE
 * RÉFÉRENCE du format avocat (plan B.9 bis, lot M1) : seulement le sujet et l'accroche (pas le texte entier des
 * vidéos de référence), avec leur type et leur adresse, pour guider le futur générateur.
 */
export function scriptsReferenceFiche(maintenant: string): Script[] {
  const ref = (id: string, sujet: string, accroche: string, adresse: "tu" | "vous", type: NonNullable<Script["accroche"]>["type"]): Script => ({
    id,
    formatId: "avocat",
    versionFormat: 2,
    sujet,
    adresse,
    accroche: { type, note: 90 },
    version: 1,
    blocs: [{ id: `${id}-accroche`, blocRecette: "accroche", segments: [{ id: `${id}-s1`, texte: accroche }] }],
    favori: false,
    reference: true,
    statutEditorial: "valide",
    marqueId: "marque-axion",
    creeLe: maintenant,
    modifieLe: maintenant,
  });
  return [
    ref("script-ref-fiche-radar", "Flashé par un radar automatique : faut-il payer ?", "Tu reçois un PV d'un radar automatique ? Surtout, ne le paye pas.", "tu", "contre-intuitif"),
    ref("script-ref-fiche-controle", "Contrôle routier : l'erreur que tout le monde fait", "Lors d'un contrôle routier, le premier réflexe, c'est de tout reconnaître. Ça, jamais.", "vous", "erreur-commune"),
    ref("script-ref-fiche-6-points", "6 points en une seule journée : le combo qui tue", "6 points en une seule journée : c'est le combo qui tue.", "tu", "chiffre-choc"),
  ];
}
