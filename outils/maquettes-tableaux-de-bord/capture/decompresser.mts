// T-EXT-51c : lanceur de décompression d'un .zip de maquette. Usage :
//   tsx outils/maquettes-tableaux-de-bord/capture/decompresser.mts --zip /entree/dossier.zip --sortie /sortie/maquette
// Codes de sortie : 0 ok ; 1 erreur inattendue ; 3 environnement non autorisé (garde) ; 4 entrée refusée
// (arguments manquants, archive refusée, sortie déjà non vide). Aucun réseau, aucun shell, aucun eval.
import { decompresserZip, ErreurZip, lireArchiveSurDisque } from "./decompresser-zip";
import { environnementAutorise } from "./garde";

function args(argv: string[]): Record<string, string> {
  const r: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--") && argv[i + 1] !== undefined && !argv[i + 1]!.startsWith("--")) r[a.slice(2)] = argv[++i]!;
  }
  return r;
}

function principal(): number {
  const verdict = environnementAutorise(process.env, process.platform);
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
