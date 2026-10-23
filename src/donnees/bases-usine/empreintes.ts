/**
 * EMPREINTES DES BASES (ADR 0001 « une seule copie des bases », le dépôt privé des bases/usine/docs/adr/). PUR : aucune
 * lecture de fichier, aucun alias « @/ », donc utilisable par le script de synchro, les tests et la sonde de santé.
 *
 * - `fichiers` : sha256 (hex complet) des octets de chaque base Markdown de la source ;
 * - `empreinte` : sha256 de la concaténation « nom:sha256\n » triée par nom (même calcul que le manifeste de depot-prive) ;
 * - `json` : sha256 des octets de chaque JSON dérivé et enregistré ici. Ajout propre au studio, qui ne garde pas les
 *   Markdown : sans lui, un JSON modifié à la main ne pourrait pas être détecté sans la source.
 */
import { createHash } from "node:crypto";

export function sha256(octets: string | Uint8Array): string {
  return createHash("sha256").update(octets).digest("hex");
}

/** Empreinte unique d'un ensemble de bases : `nom:sha256\n` trié par nom, puis sha256. */
export function empreinteDe(fichiers: Record<string, string>): string {
  const corps = Object.keys(fichiers)
    .sort()
    .map((nom) => `${nom}:${fichiers[nom]}\n`)
    .join("");
  return sha256(corps);
}

/** Contenu de `donnees/source.json` (écrit uniquement par `scripts/bases/synchroniser-bases.mts`). */
export interface SourceBases {
  version: 1;
  /** Chemin de la source : `le dépôt privé des bases/usine/bases/pour-la-machine`. */
  source: string;
  commit: string | null;
  /** Date du commit source (ISO 8601). */
  date: string | null;
  /** Instant de la dernière synchro (ISO 8601). */
  synchronise_le: string;
  fichiers: Record<string, string>;
  empreinte: string;
  json: Record<string, string>;
}

/**
 * GARDE INTERNE : la copie locale correspond à son propre `source.json`. `copie` = nom du JSON → octets lus.
 * Renvoie la liste des écarts (vide = conforme). Aucun jeton, aucun réseau.
 */
export function ecartsInternes(source: SourceBases, copie: Record<string, string | Uint8Array>): string[] {
  const liste: string[] = [];
  if (source.version !== 1) liste.push(`source.json : version ${String(source.version)} inconnue (attendu 1)`);
  const recalculee = empreinteDe(source.fichiers);
  if (recalculee !== source.empreinte) liste.push(`source.json : empreinte déclarée ${source.empreinte} ≠ recalculée ${recalculee}`);
  for (const [md, h] of Object.entries(source.fichiers)) if (!/^[0-9a-f]{64}$/.test(h)) liste.push(`source.json : sha256 de ${md} invalide`);
  for (const nom of Object.keys(source.json)) if (!(nom in copie)) liste.push(`${nom} : déclaré dans source.json, absent de la copie`);
  for (const nom of Object.keys(copie)) if (!(nom in source.json)) liste.push(`${nom} : présent dans la copie, non déclaré dans source.json`);
  for (const [nom, octets] of Object.entries(copie)) {
    const attendu = source.json[nom];
    if (attendu !== undefined && sha256(octets) !== attendu) liste.push(`${nom} : modifié depuis la synchro (sha256 ${sha256(octets).slice(0, 12)}… ≠ ${attendu.slice(0, 12)}…)`);
  }
  const mdSansJson = Object.keys(source.fichiers).filter((md) => !(md.replace(/\.md$/, ".json") in source.json));
  for (const md of mdSansJson) liste.push(`${md} : base déclarée sans JSON dérivé`);
  return liste;
}

/** Manifeste de depot-prive (`MANIFESTE-BASES.json`), seule partie lue par les gardes. */
export interface ManifesteBases {
  version: number;
  commit: string;
  fichiers: Record<string, string>;
  empreinte: string;
}

/** GARDE EXTERNE : `source.json` = manifeste actuel de depot-prive. Liste des écarts (vide = à jour). */
export function ecartsExternes(source: SourceBases, manifeste: ManifesteBases): string[] {
  const liste: string[] = [];
  if (manifeste.version !== 1) liste.push(`manifeste : version ${String(manifeste.version)} inconnue (attendu 1)`);
  if (source.empreinte !== manifeste.empreinte) liste.push(`empreinte : studio ${source.empreinte.slice(0, 12)}… ≠ depot-prive ${String(manifeste.empreinte).slice(0, 12)}… (source ${manifeste.commit.slice(0, 8)}, studio synchronisé sur ${source.commit?.slice(0, 8) ?? "?"})`);
  for (const nom of new Set([...Object.keys(source.fichiers), ...Object.keys(manifeste.fichiers)])) {
    const a = source.fichiers[nom];
    const b = manifeste.fichiers[nom];
    if (a === undefined) liste.push(`${nom} : dans depot-prive, absent du studio`);
    else if (b === undefined) liste.push(`${nom} : dans le studio, absent de depot-prive`);
    else if (a !== b) liste.push(`${nom} : sha256 différent de depot-prive`);
  }
  return liste;
}
