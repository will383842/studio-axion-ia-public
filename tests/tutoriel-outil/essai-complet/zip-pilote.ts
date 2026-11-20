/**
 * T-EXT-37a : le zip du pilote 05 Stocks, FABRIQUÉ EN MÉMOIRE à partir des fichiers de T-EXT-05 et T-EXT-12 (lecture
 * seule). Aucun binaire versionné, aucun fichier écrit, aucun réseau. Zip « sans compression » (méthode 0), assez pour
 * l'essai : le dossier complet (maquette, données, scénario, script court, commande du pilote).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE_PILOTE = join(process.cwd(), "outils", "maquettes-tableaux-de-bord", "05-stocks");

/** Fichiers du dossier du pilote, dans l'ordre du zip. */
export const FICHIERS_PILOTE_05 = ["index.html", "app.js", "demo-data.js", "styles.css", "donnees.json", "scenario.json", "script-court.txt", "commande-pilote.json"] as const;

export interface EntreeZip {
  nom: string;
  octets: Uint8Array;
}

const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(octets: Uint8Array): number {
  let c = 0xffffffff;
  for (const o of octets) c = TABLE_CRC[(c ^ o) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Fichiers du pilote 05 lus sur le disque (lecture seule). */
export function lireDossierPilote05(racine: string = RACINE_PILOTE): EntreeZip[] {
  return FICHIERS_PILOTE_05.map((nom) => ({ nom, octets: new Uint8Array(readFileSync(join(racine, nom))) }));
}

/** Zip « stocké » (sans compression) construit en mémoire. */
export function fabriquerZip(entrees: readonly EntreeZip[]): Uint8Array {
  const morceaux: Uint8Array[] = [];
  const centrale: Uint8Array[] = [];
  let decalage = 0;
  const enc = new TextEncoder();
  for (const e of entrees) {
    const nom = enc.encode(e.nom);
    const crc = crc32(e.octets);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // noms en UTF-8
    local.setUint16(8, 0, true); // méthode 0 : stocké
    local.setUint32(14, crc, true);
    local.setUint32(18, e.octets.length, true);
    local.setUint32(22, e.octets.length, true);
    local.setUint16(26, nom.length, true);
    morceaux.push(new Uint8Array(local.buffer), nom, e.octets);
    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, e.octets.length, true);
    dir.setUint32(24, e.octets.length, true);
    dir.setUint16(28, nom.length, true);
    dir.setUint32(42, decalage, true);
    centrale.push(new Uint8Array(dir.buffer), nom);
    decalage += 30 + nom.length + e.octets.length;
  }
  const tailleCentrale = centrale.reduce((s, m) => s + m.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, entrees.length, true);
  fin.setUint16(10, entrees.length, true);
  fin.setUint32(12, tailleCentrale, true);
  fin.setUint32(16, decalage, true);
  const tout = [...morceaux, ...centrale, new Uint8Array(fin.buffer)];
  const zip = new Uint8Array(tout.reduce((s, m) => s + m.length, 0));
  let p = 0;
  for (const m of tout) {
    zip.set(m, p);
    p += m.length;
  }
  return zip;
}

/** Le zip du pilote 05, complet, en mémoire. */
export const fabriquerZipPilote05 = (racine?: string): Uint8Array => fabriquerZip(lireDossierPilote05(racine));

/**
 * Relecture minimale d'un zip « stocké » (en attendant T-EXT-41 `extraireZipSur`, qui fera le vrai contrôle des entrées :
 * taille, chemins piégés). Sert seulement à prouver que le zip fabriqué se relit à l'identique.
 */
export function relireZip(zip: Uint8Array): EntreeZip[] {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const dec = new TextDecoder();
  const sortie: EntreeZip[] = [];
  let p = 0;
  while (p + 30 <= zip.length && v.getUint32(p, true) === 0x04034b50) {
    const taille = v.getUint32(p + 18, true);
    const lNom = v.getUint16(p + 26, true);
    const lExtra = v.getUint16(p + 28, true);
    const nom = dec.decode(zip.subarray(p + 30, p + 30 + lNom));
    const debut = p + 30 + lNom + lExtra;
    sortie.push({ nom, octets: zip.slice(debut, debut + taille) });
    p = debut + taille;
  }
  return sortie;
}
