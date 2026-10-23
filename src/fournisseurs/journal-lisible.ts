/**
 * Phrases du Journal pour un choix de service (Réglages > Connexions), en mots simples : titre lisible du service et
 * nom simple du catalogue, jamais le nom interne du type ni l'identifiant du registre. PUR.
 *
 * Les anciennes lignes déjà en base (« Service « son » : studio-rendu choisi », « … remis en simulation ») ne sont
 * pas effacées : `traduireLigneJournal` les réécrit à l'affichage par la même règle.
 */
import { implementationPrevue } from "./catalogue";
import { TITRES_SERVICES } from "./titres";
import type { TypeFournisseur } from "./types";

const estType = (t: string): t is TypeFournisseur => Object.hasOwn(TITRES_SERVICES, t);

/** « Son et mixage : Serveur du studio choisi », ou « Son et mixage remis en mode essai ». */
export function phraseChoixService(type: TypeFournisseur, id: string): string {
  const titre = TITRES_SERVICES[type];
  if (id === "simulation") return `${titre} remis en mode essai`;
  const nom = implementationPrevue(type, id)?.nom ?? "nouveau service";
  return `${titre} : ${nom} choisi`;
}

const ANCIEN_CHOIX = /^Service « ([a-z0-9-]+) » : ([a-z0-9-]+) choisi$/;
const ANCIEN_ESSAI = /^Service « ([a-z0-9-]+) » remis en (?:simulation|mode essai)$/;

/** Réécrit une ancienne ligne de choix de service ; toute autre ligne est rendue telle quelle. */
export function traduireLigneJournal(message: string): string {
  const choix = ANCIEN_CHOIX.exec(message);
  if (choix && estType(choix[1])) return phraseChoixService(choix[1], choix[2]);
  const essai = ANCIEN_ESSAI.exec(message);
  if (essai && estType(essai[1])) return phraseChoixService(essai[1], "simulation");
  return message;
}
