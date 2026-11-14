// L8-06 — seuils d'échelle (70 % attention, 90 % critique) et rétention des médias générés non publiés.
// Fonctions pures : aucun appel réseau, aucune base, aucune écriture. L'envoi d'une alerte reste celui de
// deploiement/alerte.sh (L5-08, e-mail sans IA) ; ce module ne fait que décider du niveau.

export const SEUIL_ATTENTION_PCT = 70;
export const SEUIL_CRITIQUE_PCT = 90;

export type NiveauSeuil = "normal" | "attention" | "critique" | "invalide";
export type NomMesure = "file" | "rendus" | "appels" | "base" | "r2";

export interface Mesure {
  nom: NomMesure;
  utilise: number;
  capacite: number;
}

export interface AlerteEchelle {
  nom: NomMesure;
  niveau: Exclude<NiveauSeuil, "normal">;
  pct: number;
  message: string;
}

/** Pourcentage d'usage ; NaN si la mesure est inexploitable (capacité ≤ 0, valeurs négatives ou non finies). */
export function pourcentage(utilise: number, capacite: number): number {
  if (!Number.isFinite(utilise) || !Number.isFinite(capacite) || utilise < 0 || capacite <= 0) return Number.NaN;
  return (utilise / capacite) * 100;
}

/** < 70 normal ; 70 à < 90 attention ; ≥ 90 critique (y compris un dépassement > 100) ; négatif ou non fini : invalide. */
export function niveauSeuil(pct: number): NiveauSeuil {
  if (!Number.isFinite(pct) || pct < 0) return "invalide";
  if (pct >= SEUIL_CRITIQUE_PCT) return "critique";
  if (pct >= SEUIL_ATTENTION_PCT) return "attention";
  return "normal";
}

const LIBELLES: Record<NomMesure, string> = {
  file: "file de travaux",
  rendus: "rendus vidéo",
  appels: "appels aux services",
  base: "base de données",
  r2: "stockage R2",
};

/** Une alerte par mesure hors du niveau normal ; une mesure invalide est signalée, jamais ignorée. */
export function evaluerCharge(mesures: Mesure[]): AlerteEchelle[] {
  const alertes: AlerteEchelle[] = [];
  for (const m of mesures) {
    const pct = pourcentage(m.utilise, m.capacite);
    const niveau = niveauSeuil(pct);
    if (niveau === "normal") continue;
    const texte =
      niveau === "invalide"
        ? `mesure inexploitable pour ${LIBELLES[m.nom]}`
        : `${LIBELLES[m.nom]} à ${Math.floor(pct)} % (${niveau === "critique" ? "seuil critique 90 %" : "seuil d'attention 70 %"})`;
    alertes.push({ nom: m.nom, niveau, pct, message: texte });
  }
  return alertes;
}

// --- Rétention : uniquement les médias générés non publiés. Jamais une donnée de personne. ---

export const CATEGORIE_MEDIA_NON_PUBLIE = "media-genere-non-publie";

/** Catégories de données de personnes : intouchables par toute règle de rétention. */
export const CATEGORIES_PERSONNE = [
  "contact",
  "compte",
  "identite",
  "message-recu",
  "consentement",
  "donnee-personnelle",
] as const;

export interface RegleRetention {
  id: string;
  categorie: string;
  joursMax: number;
}

export const REGLES_RETENTION: readonly RegleRetention[] = [
  { id: "rendus-non-publies", categorie: CATEGORIE_MEDIA_NON_PUBLIE, joursMax: 30 },
  { id: "brouillons-media-non-publies", categorie: CATEGORIE_MEDIA_NON_PUBLIE, joursMax: 14 },
];

/** Vrai si la règle vise autre chose qu'un média généré non publié (donnée de personne ou catégorie inconnue). */
export function regleVisePersonne(regle: RegleRetention): boolean {
  return regle.categorie !== CATEGORIE_MEDIA_NON_PUBLIE;
}
