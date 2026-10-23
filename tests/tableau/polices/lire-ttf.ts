/**
 * Lecture MINIMALE d'un fichier de police TrueType (tables `head`, `hhea`, `hmtx`, `cmap` format 4 ou 12) : chasse de
 * chaque caractère, en unités de la police. Sert à générer et à vérifier la table de Montserrat ExtraBold du stylo
 * (`src/briques/stylo/metriques-montserrat.ts`). Aucune dépendance.
 */
import { readFileSync } from "node:fs";

export interface ChassesPolice {
  unitesParEm: number;
  /** Chasse (unités) du caractère, ou `undefined` s'il n'est pas dans la police. */
  chasse: (c: string) => number | undefined;
}

export function lireChasses(fichier: string): ChassesPolice {
  const b = readFileSync(fichier);
  const n = b.readUInt16BE(4);
  const tables = new Map<string, number>();
  for (let i = 0; i < n; i++) tables.set(b.toString("ascii", 12 + i * 16, 16 + i * 16), b.readUInt32BE(12 + i * 16 + 8));
  const t = (nom: string) => {
    const o = tables.get(nom);
    if (o === undefined) throw new Error(`table ${nom} absente de ${fichier}`);
    return o;
  };
  const unitesParEm = b.readUInt16BE(t("head") + 18);
  const nbMetriques = b.readUInt16BE(t("hhea") + 34);
  const hmtx = t("hmtx");
  const avance = (g: number) => b.readUInt16BE(hmtx + 4 * Math.min(g, nbMetriques - 1));

  const cmap = t("cmap");
  const nbSous = b.readUInt16BE(cmap + 2);
  let f4 = -1;
  let f12 = -1;
  for (let i = 0; i < nbSous; i++) {
    const plateforme = b.readUInt16BE(cmap + 4 + i * 8);
    const codage = b.readUInt16BE(cmap + 6 + i * 8);
    const o = cmap + b.readUInt32BE(cmap + 8 + i * 8);
    const format = b.readUInt16BE(o);
    if (format === 12 && (plateforme === 3 || plateforme === 0)) f12 = o;
    if (format === 4 && ((plateforme === 3 && codage === 1) || plateforme === 0)) f4 = o;
  }
  const glyphe = (code: number): number => {
    if (f12 >= 0) {
      const nb = b.readUInt32BE(f12 + 12);
      for (let i = 0; i < nb; i++) {
        const d = f12 + 16 + i * 12;
        const debut = b.readUInt32BE(d);
        const fin = b.readUInt32BE(d + 4);
        if (code >= debut && code <= fin) return b.readUInt32BE(d + 8) + code - debut;
      }
      return 0;
    }
    if (f4 < 0 || code > 0xffff) return 0;
    const segX2 = b.readUInt16BE(f4 + 6);
    const fins = f4 + 14;
    const debuts = fins + segX2 + 2;
    const deltas = debuts + segX2;
    const decalages = deltas + segX2;
    for (let i = 0; i < segX2 / 2; i++) {
      if (code > b.readUInt16BE(fins + 2 * i)) continue;
      const debut = b.readUInt16BE(debuts + 2 * i);
      if (code < debut) return 0;
      const delta = b.readInt16BE(deltas + 2 * i);
      const dec = b.readUInt16BE(decalages + 2 * i);
      if (dec === 0) return (code + delta) & 0xffff;
      const g = b.readUInt16BE(decalages + 2 * i + dec + 2 * (code - debut));
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  };
  return {
    unitesParEm,
    chasse: (c) => {
      const g = glyphe(c.codePointAt(0)!);
      return g ? avance(g) : undefined;
    },
  };
}
