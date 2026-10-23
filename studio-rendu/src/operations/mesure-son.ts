/**
 * Opération `mesure-son` (file courte, lot M4 ; plan B.7, B.8 `niveau-sonore`) : mesure un fichier déjà exporté
 * (vidéo ou son) — niveau intégré, LRA, CRÊTE VRAIE, niveau dans les pauses (`parametres.pauses`, en secondes).
 * Entrée : `media`. Sortie : le rapport JSON déposé ; les mesures sont aussi rendues dans l'état.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ErreurRendu, type Operation } from "../contrat.js";
import { fichierEntree } from "../composition/entrees.js";
import { deposer, telecharger } from "../outils.js";
import { mesurerFichier } from "../son/mesure.js";

export const mesureSon: Operation = async (demande, contexte) => {
  const url = demande.entrees.media;
  if (!url) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Entrée « media » manquante." });
  const local = join(contexte.dossier, fichierEntree("media", url));
  await telecharger(url, local, contexte.signal);
  contexte.progression(30);
  const pauses = Array.isArray(demande.parametres.pauses) ? (demande.parametres.pauses as [number, number][]) : [];
  const m = await mesurerFichier(local, pauses, contexte.signal);
  const rapport = join(contexte.dossier, "mesure-son.json");
  await writeFile(rapport, JSON.stringify(m));
  contexte.progression(90);
  await deposer(demande.sortie.urlDepot, rapport, "application/json", contexte.signal);
  return { mesures: { ...m } };
};
