/**
 * RÈGLE D'ENTRÉE D'ÉCRITURE DES FORMATS (lot C1.6). PUR et NON BRANCHÉ : seul un test l'appelle.
 * Un format ne peut pas être « actif » sans : recette commune, mémoire anti-copie commune, contrôles communs, débit mesuré.
 * Les formats déjà actifs avant ce lot sont des EXCEPTIONS DATÉES (fin de validité + condition de levage), à lever au branchement. L'avocat est hors contrat.
 */
export type PieceContrat = "recetteCommune" | "memoire" | "controles" | "debitMesure";
export const PIECES_CONTRAT: readonly PieceContrat[] = ["recetteCommune", "memoire", "controles", "debitMesure"];

export type ContratEcriture = Record<PieceContrat, boolean>;

export interface ExceptionEcriture {
  formatId: string;
  /** AAAA-MM-JJ : jour où l'exception a été accordée. */
  depuis: string;
  /** AAAA-MM-JJ : dernier jour de validité ; le lendemain, la règle échoue (la date « aujourd'hui » est injectée). */
  jusquAu?: string;
  /** Condition de levage explicite : ce qui doit être fait pour retirer l'exception. */
  levee?: string;
  /** Pièces que l'exception tolère. Absent : toutes (exception totale, format sans contrat). Un format sous contrat partiel n'est excepté que pour ce qui lui manque. */
  pieces?: readonly PieceContrat[];
  /**
   * Périmètre d'une exception qui ne couvre qu'une partie du format (ex. « chaînes grande et equipe »). Une exception avec périmètre ne
   * remplace jamais une pièce manquante du contrat : elle complète un contrat limité (`PORTEE_CONTRAT`) pour le reste du format.
   */
  perimetre?: string;
  raison: string;
}

export interface ViolationContrat {
  formatId: string;
  manque: PieceContrat[];
  message: string;
}

/** Ce vers quoi pointe une pièce déclarée : un module du dépôt (chemin depuis la racine) et, au besoin, une constante ou fonction qu'il exporte. */
export interface PreuvePiece {
  module: string;
  symbole?: string;
  /** Module qui écrit réellement le format : il doit importer le symbole (ou, sans symbole importé, le module de la preuve). */
  utilisePar?: string;
}

export interface ViolationPreuve {
  formatId: string;
  piece: PieceContrat;
  message: string;
}

/** Hors contrat, ni exigé ni excepté (décision de Will : rien sur l'avocat). */
export const FORMATS_HORS_CONTRAT: readonly string[] = ["avocat"];

/**
 * Contrats déclarés (lot G4). Une pièce à `true` doit avoir sa preuve dans `PREUVES_CONTRAT`. Aucun format n'a de contrat COMPLET :
 * le débit mesuré (scripts par heure sur de vrais essais) n'a été relevé nulle part. Le cas concret écrit avec sa propre recette
 * (R01…), pas `RECETTE_SCRIPT` : sa recette commune reste à brancher. Image → vidéo et face caméra animée n'importent ni la
 * mémoire ni la ressemblance communes : pas de contrat, exception.
 *
 * FACE CAMÉRA : contrat valable pour la CHAÎNE COURTE SEULEMENT (`PORTEE_CONTRAT`). Recette (`RECETTE_SCRIPT`), mémoire et contrôle de
 * ressemblance ne sont branchés que dans `chaine-courte.ts` / `boucle-generation.ts`, pas dans la grande chaîne (mode « Je choisis »,
 * réglage `generateur.chaine`) ni dans `equipe` : exception datée à part (`perimetre`) pour ces deux chaînes.
 *
 * MÉMOIRE ET RESSEMBLANCE : BRANCHÉES MAIS RÉGLAGE COUPÉ PAR DÉFAUT (`ecriture.memoireCentrale`, `ecriture.memoireTableau`,
 * `ecriture.memoireCasConcret`). En production, aucune mémoire anti-copie n'est active tant que Will n'a pas allumé les interrupteurs
 * (Réglages › Écriture des scripts). « memoire: true » dit « branché », pas « actif ».
 *
 * TABLEAU : n'utilise qu'une PARTIE de la recette commune (éléments 3 à 7, `RECETTE_SANS_DEBIT` dans tableau-scripts/consignes.ts),
 * pas la recette entière.
 */
export const CONTRATS_ECRITURE: Record<string, Partial<ContratEcriture>> = {
  facecam: { recetteCommune: true, memoire: true, controles: true, debitMesure: false },
  "tableau-anime": { recetteCommune: true, memoire: true, controles: true, debitMesure: false },
  "cas-concret": { recetteCommune: false, memoire: true, controles: true, debitMesure: false },
};

/** Formats dont le contrat ne vaut que pour une partie des chaînes d'écriture : ils exigent une exception à périmètre pour le reste. */
export const PORTEE_CONTRAT: Readonly<Record<string, string>> = { facecam: "chaîne courte seulement" };

const RECETTE = "src/donnees/generateur/recette-script.ts";
export const PREUVES_CONTRAT: Record<string, Partial<Record<PieceContrat, PreuvePiece>>> = {
  facecam: {
    recetteCommune: { module: RECETTE, symbole: "RECETTE_SCRIPT", utilisePar: "src/generateur/chaine-courte.ts" },
    memoire: { module: "src/services/memoire-centrale.ts", symbole: "preparerMemoireCentrale", utilisePar: "src/services/boucle-generation.ts" },
    controles: { module: "src/domaine/ecriture-commune/memoire-centrale.ts", symbole: "CONTROLE_RESSEMBLANCE", utilisePar: "src/generateur/chaine-courte.ts" },
  },
  "tableau-anime": {
    recetteCommune: { module: RECETTE, symbole: "RECETTE_SCRIPT", utilisePar: "src/services/tableau-scripts/consignes.ts" },
    memoire: { module: "src/services/tableau-scripts/memoire.ts", symbole: "memoireDuTableau", utilisePar: "src/services/tableau-scripts/index.ts" },
    controles: { module: "src/domaine/ecriture-commune/ressemblance.ts", symbole: "controlerRessemblance", utilisePar: "src/services/tableau-scripts/memoire.ts" },
  },
  "cas-concret": {
    memoire: { module: "src/services/memoire-cas-concret.ts", symbole: "memoireCommuneDuStudio", utilisePar: "src/services/cas-concret-branchements.ts" },
    controles: { module: "src/domaine/ecriture-commune/memoire-centrale.ts", symbole: "mesurerRessemblance", utilisePar: "src/moteurs/montage-cas-concret/ecriture.ts" },
  },
};

const FIN = "2026-12-31";
const RAISON = "actif avant le lot C1 ; débit mesuré non relevé (scripts par heure sur de vrais essais)";
export const EXCEPTIONS_ECRITURE: readonly ExceptionEcriture[] = [
  {
    formatId: "facecam",
    depuis: "2026-10-18",
    jusquAu: FIN,
    pieces: ["debitMesure"],
    levee: "relever le débit réel (scripts par heure) sur de vrais essais, puis passer debitMesure à true avec sa preuve",
    raison: RAISON,
  },
  {
    formatId: "facecam",
    depuis: "2026-10-19",
    jusquAu: FIN,
    pieces: ["recetteCommune", "memoire", "controles"],
    perimetre: "chaînes grande et equipe, verrouillées depuis le 23/10/2026 pour les nouvelles écritures (seules les écritures déjà lancées y passent encore)",
    levee: "brancher recette, mémoire et ressemblance sur la grande chaîne et sur equipe, ou retirer ces deux chaînes",
    raison: "recette, mémoire et ressemblance ne sont branchées que sur la chaîne courte",
  },
  {
    formatId: "tableau-anime",
    depuis: "2026-10-18",
    jusquAu: FIN,
    pieces: ["debitMesure"],
    levee: "relever le débit réel (scripts par heure) sur de vrais essais, puis passer debitMesure à true avec sa preuve",
    raison: RAISON,
  },
  {
    formatId: "cas-concret",
    depuis: "2026-10-18",
    jusquAu: FIN,
    pieces: ["recetteCommune", "debitMesure"],
    levee: "brancher la recette commune dans l'écriture du cas concret et relever son débit réel sur de vrais essais",
    raison: "actif avant le lot C1 ; écrit avec sa propre recette (R01…), débit mesuré non relevé",
  },
  {
    formatId: "facecam-animee",
    depuis: "2026-10-18",
    jusquAu: FIN,
    levee: "déclarer son contrat (sa recette, sa mémoire et ses contrôles lui arrivent déjà par la chaîne courte du générateur central ; aucun module propre ne les importe)",
    raison: "actif avant le lot C1 ; contrat non déclaré (écrite par la chaîne courte, qui lui applique recette, mémoire et contrôles)",
  },
  {
    formatId: "image-video",
    depuis: "2026-10-18",
    jusquAu: FIN,
    levee: "brancher la recette, la mémoire (source à lire côté image-video, TODO C4), les contrôles et le débit mesuré, puis déclarer son contrat",
    raison: "format en service (masqué mais ouvert dans la navigation) ; n'importe ni la recette, ni la mémoire, ni la ressemblance communes",
  },
];

const dateValide = (d: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

/** Une exception n'est recevable que datée d'un jour valide, motivée, jamais postérieure à `aujourdhui` (si connu) ni à sa propre fin. */
const recevable = (e: ExceptionEcriture, aujourdhui?: string): boolean =>
  dateValide(e.depuis) && e.raison.trim() !== "" && (e.jusquAu === undefined || (dateValide(e.jusquAu) && e.depuis <= e.jusquAu)) && (aujourdhui === undefined || e.depuis <= aujourdhui);

/**
 * Les formats actifs (ou masqués mais ouverts dans la navigation, comme `statutNavigation`) qui n'ont ni contrat complet ni exception
 * datée valide pour ce qui leur manque. Une exception échue (`jusquAu` < `aujourdhui`) ne protège plus. `aujourdhui` (AAAA-MM-JJ) est
 * injecté : la fonction ne lit jamais l'horloge. Absent, les fins de validité ne sont pas contrôlées. Vide : tout est en règle.
 */
export function verifierContratEcriture(
  formats: readonly { id: string; statut: string; ouvertDansLaNavigation?: boolean }[],
  contrats: Readonly<Record<string, Partial<ContratEcriture>>>,
  exceptions: readonly ExceptionEcriture[],
  options: { aujourdhui?: string; portees?: Readonly<Record<string, string>> } = {},
): ViolationContrat[] {
  const violations: ViolationContrat[] = [];
  const connus = new Set(formats.map((f) => f.id));
  for (const id of Object.keys(contrats)) {
    if (!connus.has(id)) violations.push({ formatId: id, manque: [], message: `Contrat déclaré pour « ${id} », format absent du registre.` });
  }
  for (const f of formats) {
    const ouvert = f.statut === "actif" || (f.statut === "masque" && f.ouvertDansLaNavigation === true);
    if (!ouvert || FORMATS_HORS_CONTRAT.includes(f.id)) continue;
    const c = contrats[f.id] ?? {};
    const portee = options.portees?.[f.id];
    if (portee) {
      const declarees = PIECES_CONTRAT.filter((p) => c[p]);
      const couvre = exceptions.some(
        (e) => e.formatId === f.id && e.perimetre && recevable(e, options.aujourdhui) && !(e.jusquAu !== undefined && options.aujourdhui !== undefined && e.jusquAu < options.aujourdhui) && declarees.every((p) => e.pieces?.includes(p)),
      );
      if (!couvre) violations.push({ formatId: f.id, manque: declarees, message: `Le contrat du format « ${f.id} » ne vaut que pour : ${portee}. Exception datée à périmètre manquante, échue ou irrecevable pour les autres chaînes.` });
    }
    const manque = PIECES_CONTRAT.filter((p) => !c[p]);
    if (!manque.length) continue;
    const valides = exceptions.filter((e) => e.formatId === f.id && !e.perimetre && recevable(e, options.aujourdhui));
    const echues = valides.filter((e) => e.jusquAu !== undefined && options.aujourdhui !== undefined && e.jusquAu < options.aujourdhui);
    const actives = valides.filter((e) => !echues.includes(e));
    if (actives.some((e) => manque.every((p) => !e.pieces || e.pieces.includes(p)))) continue;
    const echue = echues.length ? ` Exception échue le ${echues[0].jusquAu} (levée attendue : ${echues[0].levee ?? "non précisée"}).` : "";
    violations.push({ formatId: f.id, manque, message: `Le format « ${f.id} » est actif sans : ${manque.join(", ")}.${echue}` });
  }
  return violations;
}

const sansExtension = (c: string): string => c.replace(/\.tsx?$/, "").replace(/\/index$/, "");

/** Chemin (depuis la racine) visé par un import `@/…` ou relatif écrit dans `depuis`, sans extension. */
function resoudre(depuis: string, spec: string): string | null {
  if (spec.startsWith("@/")) return sansExtension(`src/${spec.slice(2)}`);
  if (!spec.startsWith(".")) return null;
  const morceaux = depuis.split("/").slice(0, -1);
  for (const m of spec.split("/")) {
    if (m === "..") morceaux.pop();
    else if (m !== ".") morceaux.push(m);
  }
  return sansExtension(morceaux.join("/"));
}

/** Le module `ecrivain` importe-t-il `symbole` par un import NOMMÉ dont le chemin mène à `cible` (instruction `import { … } from`, `const { … } = await import()` ou `(await import()).symbole`) ? Sans symbole : importe-t-il le module `cible` lui-même (import statique ou `import()`) ? */
function importe(source: string, ecrivain: string, cible: string, symbole?: string): boolean {
  const visee = sansExtension(cible);
  const mene = (spec: string): boolean => resoudre(ecrivain, spec) === visee;
  if (!symbole) {
    for (const m of source.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)) if (mene(m[1])) return true;
    return false;
  }
  const nomme = (liste: string): boolean => liste.split(",").some((n) => n.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim() === symbole);
  for (const m of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g)) if (nomme(m[1]) && mene(m[2])) return true;
  for (const m of source.matchAll(/\{([^}]*)\}\s*=\s*await\s+import\s*\(\s*["']([^"']+)["']\s*\)/g)) if (nomme(m[1].replace(/\s*:\s*\w+/g, "")) && mene(m[2])) return true;
  const point = new RegExp(`await\\s+import\\s*\\(\\s*["']([^"']+)["']\\s*\\)\\s*\\)\\s*\\.\\s*${symbole}\\b`, "g");
  for (const m of source.matchAll(point)) if (mene(m[1])) return true;
  return false;
}

/** Chaque pièce déclarée `true` doit pointer un module qui existe (lu par `lire`, null si absent) et, si indiqué, une constante ou fonction qu'il exporte ; `utilisePar` (module écrivain) doit l'importer. */
export function verifierPreuvesContrat(
  contrats: Readonly<Record<string, Partial<ContratEcriture>>>,
  preuves: Readonly<Record<string, Partial<Record<PieceContrat, PreuvePiece>>>>,
  lire: (chemin: string) => string | null,
): ViolationPreuve[] {
  const violations: ViolationPreuve[] = [];
  for (const [formatId, c] of Object.entries(contrats)) {
    for (const piece of PIECES_CONTRAT) {
      if (!c[piece]) continue;
      const preuve = preuves[formatId]?.[piece];
      const echec = (message: string) => violations.push({ formatId, piece, message: `Format « ${formatId} », pièce ${piece} : ${message}` });
      if (!preuve) { echec("déclarée sans preuve."); continue; }
      const source = lire(preuve.module);
      if (source === null) { echec(`module absent (${preuve.module}).`); continue; }
      if (preuve.symbole && !new RegExp(`export\\s+(?:async\\s+)?(?:const|function|let|class)\\s+${preuve.symbole}\\b`).test(source)) { echec(`« ${preuve.symbole} » n'est pas exporté par ${preuve.module}.`); continue; }
      if (preuve.utilisePar) {
        const ecrivain = lire(preuve.utilisePar);
        if (ecrivain === null) echec(`module écrivain absent (${preuve.utilisePar}).`);
        else if (!importe(ecrivain, preuve.utilisePar, preuve.module, preuve.symbole)) echec(`${preuve.utilisePar} n'importe ni « ${preuve.symbole ?? preuve.module} » ni ${preuve.module} : le format ne s'en sert pas.`);
      }
    }
  }
  return violations;
}
