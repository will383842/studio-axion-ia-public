/**
 * Lecture d'un `.cube` téléchargé, AU FIL DU FICHIER (relecture sécurité R45, défauts n° 1 et 2) : le fichier n'est
 * jamais chargé ni découpé en entier, seule la ligne en cours est gardée (`LecteurCube` : 256 caractères par ligne,
 * lignes hors couleurs comptées, taille du fichier bornée par la grille annoncée). Même lecture que le navigateur et le
 * studio : un fichier piégé est refusé en quelques millisecondes, sans figer la boucle d'événements.
 */
import { createReadStream } from "node:fs";
import { LecteurCube, type Lut3D } from "../../src/lib/lut3d.js";

export async function lireCubeFichier(chemin: string): Promise<Lut3D> {
  const lecteur = new LecteurCube();
  const flux = createReadStream(chemin, { encoding: "utf8", highWaterMark: 64 * 1024 });
  try {
    for await (const morceau of flux) lecteur.pousser(morceau as string);
  } finally {
    flux.destroy();
  }
  return lecteur.terminer();
}
