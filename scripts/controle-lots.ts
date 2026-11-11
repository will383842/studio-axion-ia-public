// CONTRÔLE DE LOTS — fonctions pures, aucun appel réel (ni réseau, ni fichier, ni serveur).
// Entrée : les fiches du lot (en-têtes déjà lus), les PR ouvertes (numéro + fichiers) et la jauge du jour.
// Sortie : `lancer` (faux dès qu'un refus existe) et la liste des refus, chacun avec sa règle.
// Règles : fichiers exacts, jamais deux fiches sur le même fichier, parallele_avec lu dans les deux sens,
// fermeture des versions (une V1 ne dépend jamais d'une V2), comparaison aux PR ouvertes,
// jauge à 400 M de jetons et 400 sessions (atteints ou dépassés : aucune vague lancée ; jauge illisible ou négative : refus).
// Un chemin dont le dernier segment a une extension passe comme fichier exact, dossier à point compris (docs/v1.2) : la routine ne connaît pas l'arbre, la fiche doit lister de vrais fichiers.
// Un fichier exact porte une extension : un fichier sans extension (Dockerfile, LICENSE) est refusé, à lister avec son extension ou à faire lister autrement.
// Exécution : routines cloud ou Actions d'un dépôt public, jamais sur le PC.

export const PLAFOND_JETONS = 400_000_000;
export const PLAFOND_SESSIONS = 400;

export type Fiche = {
  id: string;
  version: string;
  dependDe: string[];
  fichiers: string[];
  paralleleAvec: string[];
};
export type PrOuverte = { numero: number; fichiers: string[] };
export type Jauge = { jetons: number; sessions: number };
export type Regle =
  | "lot-vide"
  | "fichiers-exacts"
  | "meme-fichier"
  | "parallele-un-sens"
  | "fermeture-versions"
  | "version-inconnue"
  | "id-double"
  | "dependance-inconnue"
  | "pr-ouverte"
  | "jauge";
export type Refus = { id: string; regle: Regle; detail: string };
export type Resultat = { lancer: boolean; refus: Refus[] };

function liste(valeur: string | undefined): string[] {
  if (!valeur) return [];
  const v = valeur.trim();
  const interieur = v.startsWith("[") && v.endsWith("]") ? v.slice(1, -1) : v;
  return interieur
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, "").trim())
    .filter(Boolean);
}

/** Lit l'en-tête (entre les deux lignes « --- ») d'une fiche. */
export function lireFiche(texte: string): Fiche {
  const m = texte.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---/);
  const champs: Record<string, string> = {};
  for (const ligne of (m?.[1] ?? "").split("\n")) {
    const i = ligne.indexOf(":");
    if (i > 0) champs[ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim();
  }
  const unique = (champs.id ?? "").replace(/^["']|["']$/g, "");
  return {
    id: unique,
    version: (champs.version ?? "").replace(/^["']|["']$/g, ""),
    dependDe: liste(champs.depend_de),
    paralleleAvec: liste(champs.parallele_avec),
    fichiers: liste(champs.fichiers_autorises).map((f) => f.replace(/\s*\(nouveau\)\s*$/, "")),
  };
}

function estFichierExact(chemin: string): boolean {
  if (!chemin || chemin.endsWith("/") || /[*?{}[\]]/.test(chemin)) return false;
  const nom = chemin.split("/").pop() ?? "";
  return /\.[A-Za-z0-9]+$/.test(nom);
}

function rang(version: string): number {
  const n = /^V(\d+)$/i.exec(version.trim());
  return n ? Number(n[1]) : Number.NaN;
}

export function controlerLot(entree: {
  fiches: Fiche[];
  prOuvertes: PrOuverte[];
  jauge: Jauge;
  /** Identifiants déjà fusionnés (dépendances satisfaites hors du lot). */
  fusionnees?: string[];
  /** Version (« V1 », « V2 »…) des fiches déjà fusionnées, pour fermer les versions hors du lot. */
  versionsFusionnees?: Record<string, string>;
}): Resultat {
  const { fiches, prOuvertes, jauge } = entree;
  const refus: Refus[] = [];
  const ajouter = (id: string, regle: Regle, detail: string) => refus.push({ id, regle, detail });

  const illisible =
    !Number.isFinite(jauge.jetons) || !Number.isFinite(jauge.sessions) || jauge.jetons < 0 || jauge.sessions < 0;
  if (illisible) {
    ajouter("*", "jauge", `jauge illisible ou négative (jetons ${jauge.jetons}, sessions ${jauge.sessions}) : arrêt de sécurité`);
  } else if (jauge.jetons >= PLAFOND_JETONS || jauge.sessions >= PLAFOND_SESSIONS) {
    ajouter("*", "jauge", `jetons ${jauge.jetons}/${PLAFOND_JETONS}, sessions ${jauge.sessions}/${PLAFOND_SESSIONS}`);
  }
  if (fiches.length === 0) ajouter("*", "lot-vide", "aucune fiche dans le lot");

  const parId = new Map(fiches.map((f) => [f.id, f]));
  const fusionnees = new Set(entree.fusionnees ?? []);
  const versionsFusionnees = entree.versionsFusionnees ?? {};

  const vus = new Set<string>();
  for (const f of fiches) {
    if (vus.has(f.id)) ajouter(f.id, "id-double", `identifiant ${f.id} présent plusieurs fois dans le lot`);
    vus.add(f.id);
  }

  for (const f of fiches) {
    const rangF = rang(f.version);
    if (Number.isNaN(rangF)) ajouter(f.id, "version-inconnue", `version illisible : « ${f.version} » (attendu V<n>)`);
    if (f.fichiers.length === 0) ajouter(f.id, "fichiers-exacts", "aucun fichier listé");
    for (const c of f.fichiers) {
      if (!estFichierExact(c)) ajouter(f.id, "fichiers-exacts", `pas un fichier exact : ${c}`);
    }

    for (const d of f.dependDe) {
      const cible = parId.get(d);
      let versionCible: string | undefined;
      if (cible) versionCible = cible.version;
      else if (fusionnees.has(d)) {
        versionCible = versionsFusionnees[d];
        if (versionCible === undefined) {
          ajouter(f.id, "version-inconnue", `version de ${d} (fusionnée) non fournie`);
          continue;
        }
      } else {
        ajouter(f.id, "dependance-inconnue", `${d} absente du lot et non fusionnée`);
        continue;
      }
      const rangC = rang(versionCible);
      if (Number.isNaN(rangC)) {
        ajouter(f.id, "version-inconnue", `version illisible pour ${d} : « ${versionCible} »`);
      } else if (!Number.isNaN(rangF) && rangC > rangF) {
        ajouter(f.id, "fermeture-versions", `${f.version} dépend de ${d} (${versionCible})`);
      }
    }

    for (const p of f.paralleleAvec) {
      const autre = parId.get(p);
      if (autre && !autre.paralleleAvec.includes(f.id)) {
        ajouter(f.id, "parallele-un-sens", `${p} ne déclare pas ${f.id} en retour`);
      }
    }

    for (const pr of prOuvertes) {
      const commun = f.fichiers.filter((c) => pr.fichiers.includes(c));
      if (commun.length > 0) ajouter(f.id, "pr-ouverte", `PR #${pr.numero} touche ${commun.join(", ")}`);
    }
  }

  const proprietaire = new Map<string, string>();
  for (const f of fiches) {
    for (const c of f.fichiers) {
      const premier = proprietaire.get(c);
      if (premier && premier !== f.id) ajouter(f.id, "meme-fichier", `${c} déjà visé par ${premier}`);
      else proprietaire.set(c, f.id);
    }
  }

  return { lancer: refus.length === 0, refus };
}
