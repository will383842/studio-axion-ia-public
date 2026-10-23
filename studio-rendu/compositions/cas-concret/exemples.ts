/**
 * Propriétés d'exemple (R1a) : un écran de chaque type, avec les textes de la vidéo de référence, dans la zone
 * protégée commune aux quatre réseaux du format (Facebook, Instagram, TikTok, LinkedIn). Construites À LA DEMANDE
 * (fonction), jamais au chargement du module. Servent de propriétés par défaut et aux tests.
 */
import { proprietesEcrans, type EcranCale, type ProprietesEcran, type TypeEcran, type ZoneProtegeePct } from "../../../src/briques/ecrans-motion";

/** Union des zones protégées 9:16 de Facebook, Instagram, TikTok et LinkedIn (`zoneProtegeeCombinee`, recopiée). */
export const ZONE_QUATRE_RESEAUX: ZoneProtegeePct = Object.freeze({ haut: 14, droite: 18, bas: 30, gauche: 6 });

/** Bande des sous-titres du format : une seule ligne courte, 8 % de la hauteur (et non les 14 % par défaut de la brique). */
export const BANDE_SOUS_TITRES_CAS_CONCRET = 0.08;

const CONTENUS = [
  { type: "accroche", etiquette: "Recrutement · cas réel", lignes: ["On recrute", "nos collaborateurs", "*en…*"] },
  { type: "chiffre", nombre: 15, unite: "minutes.", pastilles: ["0 CV à trier", "0 relance", "0 papier"], compteur: false },
  { type: "liste-avant", etiquette: "Avant", titre: "C'était *ça.*", taches: ["Trier les candidatures", "Répondre à chacun", "Relancer", "Caler un rendez-vous"], total: { valeur: "+1 H", ligne: "pour chaque personne" } },
  { type: "titre", lignes: ["Alors on a", "tout *automatisé.*"] },
  { type: "etape", numero: 2, nombreEtapes: 6, titre: "L'*inscription*", ligne: "Toute seule. En vingt secondes.", visuel: { objet: "telephone-capture" }, puces: ["Inscrite"] },
  { type: "objet", titre: "Elle *oublie ?*", ligne: "Le rappel part tout seul.", visuel: { objet: "telephone-notification", textes: ["Rappel : notre échange demain à 14:00"] } },
  { type: "preuve", etiquette: "Et les données ?", titre: "Conforme *RGPD.*", puces: ["100 % automatique", "0 intervention manuelle"] },
  { type: "resultat", etiquette: "Résultat", titre: "Des heures *gagnées.*", avant: "+1 H", maintenant: "15 MIN", ligne: "à chaque recrutement" },
  { type: "question", lignes: ["Et dans votre", "*entreprise ?*"], question: "Quelle tâche pourrait tourner toute seule ?" },
  { type: "appel-mot", etiquette: "Pour la recevoir", invite: "Écrivez", mot: "IA", suite: "en *commentaire.*" },
  { type: "promesse", invite: "On vous envoie", cadeau: "*toute la structure*", ligne: "de cette automatisation, à mettre en place chez vous" },
  { type: "lien", titre: "Le lien est en commentaire", lien: "Diagnostic gratuit · lien en commentaire", signature: "Axion-*IA*" },
] as const;

/** Les 12 écrans d'exemple, dans l'ordre des types, 3 s chacun, fonds alternés. */
export function exemplesEcrans(): ProprietesEcran[] {
  const ecrans = CONTENUS.map(
    (c, i) =>
      ({
        ...structuredClone(c),
        id: `e${String(i + 1).padStart(2, "0")}`,
        fond: i % 2 ? "ivoire" : "sombre",
        debutMs: i * 3000,
        finMs: (i + 1) * 3000,
        evenements: c.type === "chiffre" ? [{ cible: "eclair", ms: i * 3000 }] : [],
      }) as EcranCale,
  );
  return proprietesEcrans({ ecrans, captures: {}, zoneProtegee: ZONE_QUATRE_RESEAUX, bandeSousTitres: BANDE_SOUS_TITRES_CAS_CONCRET });
}

/** L'écran d'exemple d'un type. */
export function exempleEcran(type: TypeEcran): ProprietesEcran {
  return exemplesEcrans().find((e) => e.type === type)!;
}
