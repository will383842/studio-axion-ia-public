/** Rubriques de la page Réglages › Cadence, dans l'ordre d'affichage. Aucun mot technique. */
export const RUBRIQUES_CADENCE = [
  { id: "heures", titre: "Heures par réseau", aide: "Les heures proposées pour publier, séparées par des virgules (08:00, 18:00)." },
  { id: "quota", titre: "Publications par jour", aide: "Au-delà, le calendrier vous prévient. Rien n'est bloqué." },
  { id: "ecart", titre: "Écart entre deux publications", aide: "En minutes. Si l'écart est plus court, le calendrier vous prévient." },
] as const;
