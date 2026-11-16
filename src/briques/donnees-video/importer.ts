/**
 * IMPORTEUR `tableau-de-bord.v1` (G4-02) — un JSON ou un CSV borné devient un tableau de bord, rien n'est deviné.
 * Pur : aucune lecture de disque, aucun réseau, aucun appel à Claude ; le contenu est fourni par l'appelant.
 * Rien n'importe ce fichier en production. La sortie passe TOUJOURS par `lireTableauDeBord` (G4-01).
 *
 * FORMAT CSV FIXÉ (aucune détection « intelligente ») :
 * - Séparateur : « ; » (usage français) si la première ligne en contient, sinon « , ».
 *   Avec « , », une cellule numérique contenant une virgule est refusée (virgule décimale ET séparateur : ambigu).
 * - Guillemets doubles RFC 4180 (« "" » = un guillemet ; séparateur et retours à la ligne permis entre guillemets).
 * - BOM UTF-8 et fins de ligne \r\n retirés, pas refusés. Les lignes vides sont ignorées.
 * - Première ligne = en-têtes, exactement l'une de ces deux formes :
 *   · indicateurs : `id;libelle;valeur;unite;precision;sens`
 *   · série       : `serie;libelle;unite;x;valeur` (une ligne par point ; les points d'une série se suivent en gardant l'ordre)
 * - Nombres lus par `lireNombreFr` ; un nombre « 1,234 » ou « 1.234 » (mille ou décimal ?) est refusé, jamais deviné.
 * - `meta` (titre, période, source) est exigé pour un CSV ; il est ignoré pour un JSON (le JSON porte déjà ces champs).
 */
import { lireNombreFr } from "../../domaine/mesures";
import { lireTableauDeBord, VERSION_TABLEAU_DE_BORD, type IndicateurTableau, type SerieTableau, type TableauDeBord } from "./types";

export const TAILLE_MAX_OCTETS = 200 * 1024;
export const LIGNES_CSV_MAX = 500;
export const COLONNES_CSV_MAX = 40;

export type MetaImport = { titre: string; periode: TableauDeBord["periode"]; source: string };
export type ResultatImport = { ok: true; donnee: TableauDeBord; remarques: string[] } | { ok: false; erreurs: string[] };

const EN_TETE_INDICATEURS = ["id", "libelle", "valeur", "unite", "precision", "sens"];
const EN_TETE_SERIE = ["serie", "libelle", "unite", "x", "valeur"];
/** « 1,234 » / « 1.234 » : un à trois chiffres (le premier non nul), un séparateur, trois chiffres : mille ou décimal ? */
const AMBIGU = /^[1-9]\d{0,2}[.,]\d{3}$/;

const refus = (...erreurs: string[]): ResultatImport => ({ ok: false, erreurs });

type Enregistrement = { ligne: number; cellules: string[] };

/** Petit lecteur RFC 4180. Renvoie `null` si un guillemet reste ouvert. */
function lireCsv(texte: string, sep: string): Enregistrement[] | null {
  const lignes: Enregistrement[] = [];
  let cellules: string[] = [];
  let cellule = "";
  let entre = false;
  let ligne = 1;
  let debut = 1;
  const fermerCellule = () => {
    cellules.push(cellule);
    cellule = "";
  };
  const fermerLigne = () => {
    fermerCellule();
    if (cellules.some((c) => c.trim() !== "")) lignes.push({ ligne: debut, cellules });
    cellules = [];
  };
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (entre) {
      if (c === '"') {
        if (texte[i + 1] === '"') {
          cellule += '"';
          i++;
        } else entre = false;
      } else {
        if (c === "\n") ligne++;
        cellule += c;
      }
    } else if (c === '"' && cellule === "") entre = true;
    else if (c === sep) fermerCellule();
    else if (c === "\n") {
      fermerLigne();
      ligne++;
      debut = ligne;
    } else cellule += c;
  }
  if (entre) return null;
  fermerLigne();
  return lignes;
}

type Nombre = { ok: true; n: number } | { ok: false; message: string };

function lireNombre(brut: string, sep: string, ligne: number, colonne: number): Nombre {
  const t = brut.trim();
  const ou = `ligne ${ligne}, colonne ${colonne}`;
  if (sep === "," && t.includes(",")) return { ok: false, message: `Nombre ambigu (${ou}) : « ${t} » avec « , » comme séparateur ; utilisez « ; » ou le point décimal.` };
  if (AMBIGU.test(t.replace(/[\s  ]/g, ""))) return { ok: false, message: `Nombre ambigu (${ou}) : « ${t} » peut être un millier ou un décimal.` };
  const n = lireNombreFr(t);
  if (Number.isNaN(n)) return { ok: false, message: `Nombre illisible (${ou}) : « ${t} ».` };
  return { ok: true, n };
}

function depuisCsv(contenu: string, meta: MetaImport): ResultatImport {
  const texte = contenu.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const premiere = texte.split("\n", 1)[0] ?? "";
  const sep = premiere.includes(";") ? ";" : ",";
  const lignes = lireCsv(texte, sep);
  if (!lignes) return refus("CSV illisible : un guillemet n'est pas refermé.");
  if (lignes.length === 0) return refus("CSV vide : une ligne d'en-têtes est attendue.");
  if (lignes.length > LIGNES_CSV_MAX) return refus(`Fichier trop long : ${LIGNES_CSV_MAX} lignes au plus.`);
  const [entete, ...corps] = lignes;
  if (entete.cellules.length > COLONNES_CSV_MAX) return refus(`Fichier trop large : ${COLONNES_CSV_MAX} colonnes au plus.`);
  const noms = entete.cellules.map((c) => c.trim().toLowerCase());
  const est = (forme: string[]) => noms.length === forme.length && forme.every((f, i) => f === noms[i]);
  const genre = est(EN_TETE_INDICATEURS) ? "indicateurs" : est(EN_TETE_SERIE) ? "serie" : null;
  if (!genre) return refus(`En-têtes CSV inconnus : attendu « ${EN_TETE_INDICATEURS.join(";")} » ou « ${EN_TETE_SERIE.join(";")} ».`);

  const erreurs: string[] = [];
  const indicateurs: IndicateurTableau[] = [];
  const series: SerieTableau[] = [];
  for (const { ligne, cellules } of corps) {
    if (cellules.length !== noms.length) {
      erreurs.push(`Ligne ${ligne} : ${noms.length} colonnes attendues, ${cellules.length} trouvées.`);
      continue;
    }
    const c = cellules.map((x) => x.trim());
    if (genre === "indicateurs") {
      const v = lireNombre(c[2], sep, ligne, 3);
      const p = lireNombre(c[4], sep, ligne, 5);
      if (!v.ok) erreurs.push(v.message);
      if (!p.ok) erreurs.push(p.message);
      if (v.ok && p.ok) indicateurs.push({ id: c[0], libelle: c[1], valeur: v.n, unite: c[3], precision: p.n, sens: c[5] as IndicateurTableau["sens"] });
    } else {
      const v = lireNombre(c[4], sep, ligne, 5);
      if (!v.ok) {
        erreurs.push(v.message);
        continue;
      }
      let s = series.find((x) => x.id === c[0]);
      if (!s) {
        s = { id: c[0], libelle: c[1], unite: c[2], points: [] };
        series.push(s);
      } else if (s.libelle !== c[1] || s.unite !== c[2]) {
        erreurs.push(`Ligne ${ligne} : la série « ${c[0]} » change de libellé ou d'unité.`);
        continue;
      }
      s.points.push({ x: c[3], valeur: v.n });
    }
  }
  if (erreurs.length) return { ok: false, erreurs };
  const r = lireTableauDeBord({ version: VERSION_TABLEAU_DE_BORD, titre: meta.titre, periode: meta.periode, source: meta.source, indicateurs, series, comparaisons: [], alertes: [], calculs: [] });
  return r.ok ? { ok: true, donnee: r.donnee, remarques: [] } : r;
}

/** Importe un JSON ou un CSV borné. Ne lève jamais. */
export function importerTableauDeBord(contenu: string, nature: "json" | "csv", meta?: MetaImport): ResultatImport {
  try {
    if (typeof contenu !== "string") return refus("Contenu illisible.");
    if (new TextEncoder().encode(contenu).length > TAILLE_MAX_OCTETS) return refus(`Fichier trop gros : ${TAILLE_MAX_OCTETS / 1024} Ko au plus.`);
    if (nature === "json") {
      let objet: unknown;
      try {
        objet = JSON.parse(contenu.replace(/^﻿/, ""));
      } catch {
        return refus("Fichier JSON illisible.");
      }
      const r = lireTableauDeBord(objet);
      return r.ok ? { ok: true, donnee: r.donnee, remarques: [] } : r;
    }
    if (nature === "csv") {
      if (!meta || !meta.titre || !meta.periode || !meta.source) return refus("Un CSV demande le titre, la période et la source : informations absentes.");
      return depuisCsv(contenu, meta);
    }
    return refus("Nature de fichier inconnue : « json » ou « csv ».");
  } catch {
    return refus("Import impossible : contenu illisible.");
  }
}
