/** L4-10 — Lecteur du calendrier CSV (séparateur « ; » ou « , »). Colonnes : numero, date, heure, version. */
import { ErreurFormatPlan, type LigneCalendrier } from "./formats";

const COLONNES = ["numero", "date", "heure", "version"] as const;

export function lireCalendrierCsv(texte: string): LigneCalendrier[] {
  const lignes = texte.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lignes.length === 0) throw new ErreurFormatPlan("Calendrier vide.");
  const sep = lignes[0].includes(";") ? ";" : ",";
  const entete = lignes[0].split(sep).map((c) => c.trim().toLowerCase());
  const idx = COLONNES.map((c) => entete.indexOf(c));
  if (idx.some((i) => i < 0)) throw new ErreurFormatPlan(`Colonnes attendues : ${COLONNES.join(", ")}.`);
  return lignes.slice(1).map((l, i) => {
    const c = l.split(sep).map((v) => v.trim());
    const numero = Number(c[idx[0]]);
    const date = c[idx[1]] ?? "";
    if (!Number.isInteger(numero) || numero < 1) throw new ErreurFormatPlan(`Ligne ${i + 2} : numéro invalide.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new ErreurFormatPlan(`Ligne ${i + 2} : date invalide.`);
    return { numero, date, heure: c[idx[2]] ?? "", version: (c[idx[3]] ?? "").toUpperCase() };
  });
}
