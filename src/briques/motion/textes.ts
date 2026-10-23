/**
 * PONT « TEXTES DE LA CARTE » → DONNÉES DU MODÈLE (brique `motion`). L'opération `ajouterCarte` du monteur (lot D)
 * porte les textes de la carte dans l'ordre (`textes[]`) ; cette convention, simple pour Claude, est remise ici en
 * données typées de chaque modèle. Convention (reprise dans la consigne du monteur, `CONVENTION_TEXTES`) :
 *   liste          : [titre, point 1, point 2…] (3 textes ou plus ; 2 textes = 2 points sans titre)
 *   chiffre        : ["45 min", "pour un diagnostic fuite complet", "En moyenne"?]
 *   avant-apres    : ["12 h", "3 h", "La paperasse par semaine"?, "à la main"?, "avec l'IA"?]
 *   ligne-de-temps : [titre, "Étape — détail", …] (le détail après « — » ou « : » est facultatif)
 *   deux-colonnes  : ["À la main : 2 heures ; des oublis", "Avec l'IA : 10 minutes ; zéro oubli", "En commun : votre expertise ; votre prix", titre?]
 *   titre          : [titre, sous-titre?, sur-titre?] (un mot entre *astérisques* passe en orange)
 * PUR, sans alias « @/ ».
 */
import { iconePour } from "./choix";
import type { CarteModele, IdModeleMotion } from "./types";

export const CONVENTION_TEXTES: Record<IdModeleMotion, string> = {
  liste: "[titre, point 1, point 2, …] — 2 à 5 points courts",
  chiffre: '["45 min", "ce que le chiffre veut dire", "sur-titre facultatif"]',
  "avant-apres": '["12 h", "3 h", "titre facultatif", "légende d\'avant facultative", "légende d\'après facultative"]',
  "ligne-de-temps": '[titre, "Étape — détail", …] — 3 à 6 étapes',
  "deux-colonnes": '["Titre gauche : point ; point", "Titre droite : point ; point", "En commun : point ; point", "titre facultatif"]',
  titre: "[titre, sous-titre facultatif, sur-titre facultatif] — un mot entre *astérisques* passe en orange",
};

const propre = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** « 45 min », « 32 % », « 1,5 h » → valeur et unité (null si aucun nombre). */
export function lireValeur(texte: string): { valeur: number; unite: string; decimales: number; prefixe?: string } | null {
  const m = /([+×x−-]?)\s*(\d+(?:[  .]\d{3})*(?:[.,]\d+)?)\s*(.*)$/.exec(propre(texte));
  if (!m) return null;
  const brut = m[2].replace(/[  .](?=\d{3}\b)/g, "");
  const valeur = Number(brut.replace(",", "."));
  if (!Number.isFinite(valeur)) return null;
  const prefixe = m[1] === "x" ? "×" : m[1] || undefined;
  return { valeur, unite: propre(m[3]), decimales: /[.,]\d+$/.test(brut) ? Math.min(2, brut.split(/[.,]/)[1].length) : 0, ...(prefixe ? { prefixe } : {}) };
}

/** « Titre : point ; point » → titre et points. */
function colonne(texte: string | undefined): { titre: string; points: string[] } {
  const brut = propre(texte);
  const i = brut.indexOf(":");
  const titre = i >= 0 ? brut.slice(0, i) : brut;
  const reste = i >= 0 ? brut.slice(i + 1) : "";
  return { titre: propre(titre), points: propre(reste).split(/\s*[;•]\s*/).map(propre).filter(Boolean).slice(0, 4) };
}

/** Données d'un modèle depuis les textes d'une opération `ajouterCarte` ; null si les textes ne suffisent pas. */
export function carteDepuisTextes(modele: IdModeleMotion, textes: string[]): CarteModele | null {
  const t = textes.map(propre).filter(Boolean);
  switch (modele) {
    case "liste": {
      if (t.length < 2) return null;
      const titre = t.length >= 3 ? t[0] : undefined;
      const points = t.length >= 3 ? t.slice(1) : t;
      return { modele, donnees: { ...(titre ? { titre } : {}), elements: points.slice(0, 5).map((texte) => ({ texte, icone: iconePour(texte) })) } };
    }
    case "chiffre": {
      const v = t[0] ? lireValeur(t[0]) : null;
      if (!v) return null;
      return { modele, donnees: { valeur: v.valeur, decimales: v.decimales, ...(v.unite ? { unite: v.unite } : {}), ...(v.prefixe ? { prefixe: v.prefixe } : {}), libelle: t[1] ?? "", ...(t[2] ? { surTitre: t[2] } : {}), icone: iconePour(t[1] ?? "") } };
    }
    case "avant-apres": {
      const a = t[0] ? lireValeur(t[0]) : null;
      const b = t[1] ? lireValeur(t[1]) : null;
      if (!a || !b) return null;
      return { modele, donnees: { ...(t[2] ? { titre: t[2] } : {}), avant: { valeur: a.valeur, unite: a.unite || b.unite, ...(t[3] ? { libelle: t[3] } : {}) }, apres: { valeur: b.valeur, unite: b.unite || a.unite, ...(t[4] ? { libelle: t[4] } : {}) } } };
    }
    case "ligne-de-temps": {
      const titre = t.length >= 4 ? t[0] : undefined;
      const etapes = t.length >= 4 ? t.slice(1) : t;
      if (etapes.length < 2) return null;
      return {
        modele,
        donnees: {
          ...(titre ? { titre } : {}),
          etapes: etapes.slice(0, 6).map((e) => {
            const [titreEtape, detail] = e.split(/\s+[—–-]\s+|\s*:\s+/, 2);
            return { titre: propre(titreEtape), ...(detail ? { detail: propre(detail) } : {}), icone: iconePour(e) };
          }),
        },
      };
    }
    case "deux-colonnes": {
      if (t.length < 2) return null;
      const g = colonne(t[0]);
      const d = colonne(t[1]);
      const c = t[2] ? colonne(t[2]) : { titre: "En commun", points: [] };
      return { modele, donnees: { ...(t[3] ? { titre: t[3] } : {}), gauche: { ...g, icone: iconePour(g.titre) }, droite: { ...d, icone: iconePour(d.titre) }, commun: { titre: c.titre || "En commun", points: c.points } } };
    }
    case "titre":
      if (!t[0]) return null;
      return { modele, donnees: { variante: "titre", titre: t[0], ...(t[1] ? { sousTitre: t[1] } : {}), ...(t[2] ? { surTitre: t[2] } : {}) } };
  }
}
