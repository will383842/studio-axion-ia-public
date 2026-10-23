/**
 * REGISTRE DE PREUVES FICTIVES (plan v5 B.3.7) : les fixtures réelles sont produites sur CE registre, jamais sur celui
 * de production. Tout est inventé (entreprises, lieux, montants) ; les noms sensibles servent à vérifier l'anonymisation.
 */
import type { Preuve } from "@/domaine/types";

const LE = "2026-10-02T08:00:00.000Z";
const base = { formulationsInterdites: [], motsClesIncompatibles: [], saisiePar: "will" as const, statut: "validee" as const, creeLe: LE, modifieLe: LE, valideeLe: LE };

export const PREUVES_FICTIVES: Preuve[] = [
  {
    ...base,
    id: "prv-fictive-1",
    enonce: "Une PME de négoce a réduit de 6 heures par semaine la saisie de ses factures.",
    type: "cas-client",
    nature: "chiffree",
    valeurs: [{ brut: "6 heures", normalise: 6, unite: "h/semaine" }],
    formulationsAutorisees: ["6 heures de saisie en moins chaque semaine"],
    source: { titre: "Mission fictive n° 1", date: LE },
    niveau: "prouve",
    client: { anonymise: true, accordEcrit: true, secteur: "négoce", lieu: "Fictiville", nomsSensibles: ["Société Fictive Alpha", "Jeanne Exemple"] },
    motsCles: ["factures", "saisie"],
    pilier: "productivite",
  },
  {
    ...base,
    id: "prv-fictive-2",
    enonce: "Un cabinet comptable a traité 340 dossiers de plus sur la saison.",
    type: "cas-client",
    nature: "chiffree",
    valeurs: [{ brut: "340 dossiers", normalise: 340 }],
    formulationsAutorisees: ["340 dossiers de plus"],
    source: { titre: "Mission fictive n° 2", date: LE },
    niveau: "observe",
    client: { anonymise: true, accordEcrit: false, secteur: "comptabilité", nomsSensibles: ["Cabinet Bêta Conseil"] },
    motsCles: ["comptable", "dossiers"],
  },
  {
    ...base,
    id: "prv-fictive-3",
    enonce: "Le règlement européen sur l'IA s'applique par étapes jusqu'en 2027.",
    type: "regle-loi",
    nature: "qualitative",
    valeurs: [],
    formulationsAutorisees: ["s'applique par étapes"],
    source: { titre: "Texte officiel (fictif pour les essais)", date: LE },
    niveau: "prouve",
    motsCles: ["règlement", "IA"],
  },
];
