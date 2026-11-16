/** Avis d'EXEMPLE (C8-A05). Jamais importé par `src/` ni `studio-rendu/` ; tous marqués `exemple: true`, jamais `published`. */
import type { AvisClient } from "../../src/domaine/avis-client/types";

const base = {
  auteur: "Client exemple",
  date: "2026-01-01",
  source: "direct" as const,
  statut: "exemple",
  accordAuteur: { ecrit: false, date: "2026-01-01", forme: "exemple fictif" },
  valideLe: "2026-01-01",
  exemple: true as const,
};

export const AVIS_EXEMPLE: AvisClient = { ...base, id: "exemple-note5", note: 5, texte: "Exemple de texte court pour juger la mise en page de la carte." };

export const AVIS_EXEMPLE_NOTE3: AvisClient = { ...base, id: "exemple-note3", note: 3, texte: "Exemple d'avis plus nuancé, affiché avec trois étoiles pleines." };

export const AVIS_EXEMPLE_LONG: AvisClient = {
  ...base,
  id: "exemple-long",
  note: 5,
  texte: "Ceci est un texte d'exemple volontairement long, pour vérifier la coupe de la carte. ".repeat(4).trim(),
};
