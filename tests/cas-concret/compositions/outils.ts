/**
 * Outils des tests des compositions « Cas concret MD » : lecture des fichiers du dossier COMME DU TEXTE (les tests
 * n'importent jamais un `.tsx`), noms attendus des fichiers de type et d'objet.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { IDS_OBJETS, TYPES_ECRAN } from "../../../src/briques/ecrans-motion";

export const DOSSIER = join(process.cwd(), "studio-rendu/compositions/cas-concret");

/** Nom de composant d'un identifiant : « liste-avant » → « ListeAvant », « e-mail » → « EMail ». */
export const nomComposant = (id: string) => id.split("-").map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join("");

export const FICHIERS_TYPES = TYPES_ECRAN.map((t) => `types/${nomComposant(t)}.tsx`);
export const FICHIERS_OBJETS = IDS_OBJETS.map((o) => `objets/${nomComposant(o)}.tsx`);

/** Code sans les commentaires (ils peuvent nommer une police ou une couleur). */
export const sansCommentaires = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

/** Tous les fichiers `.ts` et `.tsx` du dossier, chemins relatifs, avec leur code sans commentaires. */
export function sourcesDuDossier(dossier = DOSSIER): { f: string; texte: string }[] {
  const res: { f: string; texte: string }[] = [];
  const parcourir = (d: string) => {
    for (const nom of readdirSync(d).sort()) {
      const chemin = join(d, nom);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (/\.tsx?$/.test(nom)) res.push({ f: relative(dossier, chemin).replace(/\\/g, "/"), texte: sansCommentaires(readFileSync(chemin, "utf8")) });
    }
  };
  parcourir(dossier);
  return res;
}
