/**
 * Données de la galerie (K20) — image C « Chatbot support client », racontée comme la maquette validée : entrée,
 * décision, séparation 80/20, branche A (ticket clôturé), retour au point de décision, branche B (alerte), scène
 * « Ensemble ». Schéma = la carte figée `tests/image-video/fixtures/cartes/C.json`, icônes déjà résolues par la table
 * de L1 (un test vérifie la concordance). Heures des mots simulées (aucune voix). PUR : aucune dépendance au rendu.
 */
import type { ProprietesSceneIV, SchemaEntree } from "../../../src/briques/schema-motion";

/** Instants des images fixes de la galerie (secondes) : les 6 moments demandés par L7. */
export const INSTANTS_GALERIE_C = Object.freeze([
  { nom: "1-entree", t: 1.2 },
  { nom: "2-separation", t: 5.6 },
  { nom: "3-branche-a", t: 10.2 },
  { nom: "4-retour", t: 12.3 },
  { nom: "5-branche-b", t: 18.2 },
  { nom: "6-ensemble", t: 20.4 },
] as const);

function schemaC(): SchemaEntree {
  return {
    noeuds: [
      { id: "n01", libelle: "Message client entrant", court: "Message client", detail: "23h14", role: "declencheur", couleur: "noir", ordre: 1, icone: "message" },
      { id: "n02", libelle: "Chatbot IA", detail: "analyse la demande", role: "decision", couleur: "orange", ordre: 2, icone: "robot" },
      { id: "n03", libelle: "Réponse générée", role: "etape", couleur: "orange", ordre: 3, groupe: "g-branche-a", icone: "etincelles" },
      { id: "n04", libelle: "Envoyée en 4 sec", court: "Envoyée en 4 s", role: "etape", couleur: "orange", ordre: 4, groupe: "g-branche-a", icone: "eclair" },
      { id: "n05", libelle: "Ticket clôturé auto", court: "Ticket clôturé", role: "etape", couleur: "orange", ordre: 5, groupe: "g-branche-a", icone: "document" },
      { id: "n06", libelle: "Résolu sans intervention humaine", court: "Résolu sans humain", role: "resultat", couleur: "vert", ordre: 6, groupe: "g-branche-a", icone: "coche" },
      { id: "n07", libelle: "Email structuré auto", court: "Email structuré", role: "etape", couleur: "noir", ordre: 7, groupe: "g-branche-b", icone: "mail" },
      { id: "n08", libelle: "Envoyé équipe concernée", court: "Email à l'équipe", role: "etape", couleur: "noir", ordre: 8, groupe: "g-branche-b", icone: "utilisateurs" },
      { id: "n09", libelle: "Alerte Telegram", detail: "🔔 Intervention requise", role: "etape", couleur: "noir", ordre: 9, groupe: "g-branche-b", icone: "cloche" },
      { id: "n10", libelle: "Client informé", detail: "Réponse sous 2h", role: "resultat", couleur: "noir", ordre: 10, groupe: "g-branche-b", icone: "utilisateur" },
    ],
    liens: [
      { id: "l01", de: "n01", vers: "n02", couleur: "orange", style: "plein" },
      { id: "l02", de: "n02", vers: "n03", etiquette: "80 % — Réponse connue", part: 80, couleur: "orange", style: "plein" },
      { id: "l03", de: "n03", vers: "n04", couleur: "orange", style: "plein" },
      { id: "l04", de: "n04", vers: "n05", couleur: "orange", style: "plein" },
      { id: "l05", de: "n05", vers: "n06", couleur: "orange", style: "plein" },
      { id: "l06", de: "n02", vers: "n07", etiquette: "20 % — Limite atteinte", part: 20, couleur: "noir", style: "plein" },
      { id: "l07", de: "n07", vers: "n08", couleur: "noir", style: "plein" },
      { id: "l08", de: "n08", vers: "n09", couleur: "noir", style: "plein" },
      { id: "l09", de: "n09", vers: "n10", couleur: "noir", style: "plein" },
    ],
    groupes: [
      { id: "g-branche-a", sorte: "branche", titre: "Réponse connue", noeuds: ["n03", "n04", "n05", "n06"], majoritaire: true },
      { id: "g-branche-b", sorte: "branche", titre: "Limite atteinte", noeuds: ["n07", "n08", "n09", "n10"] },
    ],
    chiffres: [
      { brut: "23h14", dansNoeud: "n01", aDire: true },
      { brut: "4 sec", dansNoeud: "n04", aDire: true },
      { brut: "2h", dansNoeud: "n10", aDire: true },
      { brut: "80 %", aDire: true },
      { brut: "20 %", aDire: true },
      // Le bandeau de l'image répète « 80 % » (c06 de la carte) : 9 chiffres, comme la carte de référence.
      { brut: "80 %", aDire: true },
      { brut: "0 demande", aDire: true },
      { brut: "24h/24", aDire: true },
      { brut: "3h", aDire: true },
    ],
  };
}

/** Propriétés de la scène de galerie de l'image C (objet neuf à chaque appel). */
export function sceneGalerieC(): ProprietesSceneIV {
  return {
    largeur: 1080,
    hauteur: 1920,
    fps: 25,
    dureeSec: 21.5,
    fond: "ivoire",
    marque: "axion-ia.com",
    schema: schemaC(),
    mots: [
      { noeud: "n01", t: 0.4 },
      { noeud: "n02", t: 2.6 },
      { noeud: "n03", t: 6.8 },
      { noeud: "n04", t: 7.9 },
      { noeud: "n05", t: 8.9 },
      { noeud: "n06", t: 9.9 },
      { noeud: "n02", t: 12.1 },
      { noeud: "n07", t: 14.2 },
      { noeud: "n08", t: 15.3 },
      { noeud: "n09", t: 16.4 },
      { noeud: "n10", t: 17.6 },
    ],
    separations: [{ noeud: "n02", t: 4.2 }],
    coches: [
      { noeud: "n05", t: 9.3 },
      { noeud: "n10", t: 18.0 },
    ],
    entetes: [
      { debut: 0, fin: 2.4, etiquette: "Situation type · support client", titre: "Un client vous *écrit.*" },
      { debut: 2.4, fin: 6.5, etiquette: "Le chatbot décide", titre: "*Deux* chemins." },
      { debut: 6.5, fin: 11.8, etiquette: "Chemin 1 · 80 %", titre: "Ticket *clôturé.*" },
      { debut: 11.8, fin: 14, etiquette: "Chemin 2 · 20 %", titre: "Sa *limite.*" },
      { debut: 14, fin: 19.5, etiquette: "Chemin 2 · 20 %", titre: "Une *alerte.*" },
      { debut: 19.5, fin: 21.5, etiquette: "Vue d'ensemble", titre: "Tout le *circuit.*" },
    ],
    ensembles: [{ debut: 19.8, fin: 21.3, chiffresCles: ["80 %", "20 %"] }],
  };
}
