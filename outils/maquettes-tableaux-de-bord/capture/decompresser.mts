// T-EXT-51c : lanceur de décompression d'un .zip de maquette. Usage :
//   tsx outils/maquettes-tableaux-de-bord/capture/decompresser.mts --zip /entree/dossier.zip --sortie /sortie/maquette
// --sortie doit être un SOUS-DOSSIER du volume de sortie (jamais /sortie elle-même, qui est un point de montage).
// NE JAMAIS lancer ce lanceur en même temps qu'une capture (ou une autre décompression) sur le même /sortie : au démarrage il
// supprime les `.decompression-*` périmés frères de la sortie, y compris celui d'un lancement concurrent.
// Codes de sortie : 0 ok ; 1 erreur inattendue ; 3 environnement non autorisé (garde) ; 4 entrée refusée
// (arguments manquants, archive refusée, sortie déjà non vide). Aucun réseau, aucun shell, aucun eval.
import { existsSync } from "node:fs";
import { decompresserZip, ErreurZip, lireArchiveSurDisque } from "./decompresser-zip";
import { environnementAutorise, type Verdict } from "./garde";

// Fichiers témoins d'un conteneur Docker / Podman. Indice calculé ICI, sans fichier commun avec le lot garde (#1609) :
// à remplacer par `indicesConteneur` de garde.ts après fusion de #1609.
const INDICE_DOCKER = "/.dockerenv";
const INDICE_PODMAN = "/run/.containerenv";
const conteneurDetecte = (): boolean => [INDICE_DOCKER, INDICE_PODMAN].some((c) => existsSync(c));
// Type élargi : compile avec la garde à 2 arguments (pile actuelle) ET avec celle à 3 arguments (#1609).
const garde = environnementAutorise as (env: Record<string, string | undefined>, plateforme: string, conteneurDetecte?: boolean) => Verdict;

function args(argv: string[]): Record<string, string> {
  const r: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--") && argv[i + 1] !== undefined && !argv[i + 1]!.startsWith("--")) r[a.slice(2)] = argv[++i]!;
  }
  return r;
}

function principal(): number {
  const verdict = garde(process.env, process.platform, conteneurDetecte());
  if (!verdict.ok) {
    console.error(verdict.raison);
    return 3;
  }
  const a = args(process.argv.slice(2));
  for (const k of ["zip", "sortie"]) {
    if (!a[k]) {
      console.error(`Argument « --${k} » obligatoire.`);
      return 4;
    }
  }
  try {
    const r = decompresserZip(lireArchiveSurDisque(a.zip!), a.sortie!);
    console.log(`Archive décompressée : ${r.fichiers} fichier(s), ${r.octets} octet(s).`);
    if (r.restesSupprimes > 0) console.log(`Temporaires périmés supprimés : ${r.restesSupprimes}.`);
    if (r.ignores.length > 0) console.log(`Fichiers système ignorés (${r.ignores.length}) : ${r.ignores.join(", ")}.`);
    return 0;
  } catch (e) {
    if (e instanceof ErreurZip) {
      console.error(`Archive refusée (${e.famille}) : ${e.message}`);
      return 4;
    }
    console.error(`Erreur inattendue : ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

process.exit(principal());
