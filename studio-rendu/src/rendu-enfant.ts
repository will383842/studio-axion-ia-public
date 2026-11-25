/**
 * Rendu Remotion dans un PROCESSUS ENFANT (essai du 25/11).
 *
 * Cause : à la fermeture du navigateur, Remotion efface le profil Chrome en SYNCHRONE (`fs.rmSync`). Avec un film en
 * 2160 × 2700 ce profil pèse 15 Go (1631 fichiers) : la boucle d'événements du serveur HTTP restait bloquée 8,5 s, les
 * connexions gardées ouvertes étaient coupées (ECONNRESET) et le suivi du studio échouait. Le rendu tourne donc dans
 * un enfant : c'est lui que `rmSync` bloque, jamais le serveur.
 *
 * Ce module sert aux DEUX côtés :
 *   - le parent appelle `lancerRenduEnfant` (fork, progression, arrêt, traduction des erreurs) ;
 *   - l'enfant (même fichier, lancé avec `STUDIO_RENDU_ENFANT=1`) lit sa demande, rend, et répond par messages IPC.
 * Il n'importe Remotion que dans l'enfant, à la demande.
 */
import { fork, type ChildProcess } from "node:child_process";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";

/** Ce que le parent demande à l'enfant (tout en JSON). */
export interface DemandeEnfant {
  serveUrl: string;
  id: string;
  proprietes: Record<string, unknown>;
  /** Réglages communs de rendu (`REGLAGES_RENDU`), passés tels quels. */
  reglages: Record<string, unknown>;
  /** Réglages en plus de `renderMedia` (par exemple `crf`, `colorSpace`). */
  supplements: Record<string, unknown>;
  sortie: string;
}

/** Messages de l'enfant vers le parent. */
export type MessageEnfant =
  | { type: "progression"; pc: number }
  | { type: "fini"; images: number; fps: number }
  | { type: "erreur"; phase: "selection" | "rendu"; message: string; /** Code de la cause (`ECONNREFUSED`…), s'il existe. */ codeCause?: string };

/** Erreur remontée par l'enfant : `phase` dit si c'est le choix de la composition ou le rendu. */
export class ErreurEnfant extends Error {
  constructor(message: string, public readonly phase: "selection" | "rendu" | "processus", public readonly codeCause?: string) {
    super(message);
    this.name = "ErreurEnfant";
  }
}

/** Le strict nécessaire d'un processus enfant (un faux le remplace dans les tests). */
export interface EnfantMinimal {
  on(evenement: "message", ecoute: (m: unknown) => void): unknown;
  /** `close` (et non `exit`) : il attend la fermeture du canal IPC, donc le dernier message n'est jamais perdu. */
  on(evenement: "close", ecoute: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
  on(evenement: "error", ecoute: (e: Error) => void): unknown;
  send(m: unknown): unknown;
  kill(signal?: NodeJS.Signals): unknown;
}

export interface OptionsEnfant {
  /** Lance l'enfant (défaut : `child_process.fork`, qui hérite de `process.execArgv`, donc du chargeur tsx). */
  lancer?: (module: string, env: NodeJS.ProcessEnv) => EnfantMinimal;
  /**
   * Délai avant SIGKILL après l'arrêt demandé (défaut 60 s). Après un arrêt, Remotion efface en synchrone le profil
   * Chrome (8,5 s pour 15 Go) : un SIGKILL trop tôt couperait cet effacement et laisserait le profil dans /tmp. Le
   * serveur n'est plus gelé ; après un dépassement de délai la place dans la file est libérée tout de suite
   * (`Promise.race` de `files.ts`) alors que l'enfant vit encore jusqu'à 60 s (il se ferme et efface son profil) : un
   * autre montage peut donc démarrer pendant ce temps, au prix d'un peu de mémoire. Le dossier du rendu, lui, n'est
   * effacé qu'à la fin de l'enfant (au plus 90 s).
   */
  delaiAbattageMs?: number;
  /**
   * Dossier temporaire de l'enfant (`TMPDIR`). Le profil Chrome (`puppeteer_dev_chrome_profile-*`) et les dossiers de
   * Remotion y vivent : ils sont effacés avec le dossier du rendu (`files.ts`, sans bloquer le serveur) à la fin de
   * l'enfant (succès, échec, arrêt, plantage). Après un dépassement de délai, `files.ts` attend la fin du travail
   * (l'enfant fini ou tué par SIGKILL), au plus 90 s, avant d'effacer le dossier : l'enfant ne peut plus y écrire.
   * Le dossier doit exister.
   */
  dossierTemp?: string;
  /** Module de l'enfant (défaut : `cheminEnfant()`). */
  module?: string;
}

/** Chemin du module enfant, avec la même extension que ce fichier (`.ts` sous tsx, `.js` une fois construit). */
export function cheminEnfant(ici: string = import.meta.url): string {
  const fichier = fileURLToPath(ici);
  return fileURLToPath(new URL(`./rendu-enfant${extname(fichier)}`, ici));
}

function lancerParDefaut(module: string, env: NodeJS.ProcessEnv): EnfantMinimal {
  const enfant: ChildProcess = fork(module, [], { env, stdio: ["ignore", "inherit", "inherit", "ipc"] });
  return enfant as unknown as EnfantMinimal;
}

/**
 * Rend la vidéo dans un enfant. Renvoie le nombre d'images et les images par seconde. Rejette avec une `ErreurEnfant`
 * (message de l'enfant) ou, si l'enfant disparaît, « Le processus de rendu s'est arrêté (signal …) ».
 */
export function lancerRenduEnfant(demande: DemandeEnfant, contexte: { progression: (pc: number) => void; signal: AbortSignal }, options: OptionsEnfant = {}): Promise<{ images: number; fps: number }> {
  return new Promise((ok, ko) => {
    if (contexte.signal.aborted) return ko(new ErreurEnfant("Le rendu a été arrêté avant son départ.", "processus"));
    const enfant = (options.lancer ?? lancerParDefaut)(options.module ?? cheminEnfant(), { ...process.env, STUDIO_RENDU_ENFANT: "1", ...(options.dossierTemp ? { TMPDIR: options.dossierTemp } : {}) });
    let resultat: { images: number; fps: number } | null = null;
    let erreur: ErreurEnfant | null = null;
    let fini = false;
    let abattage: ReturnType<typeof setTimeout> | undefined;
    const terminer = (f: () => void) => {
      if (fini) return;
      fini = true;
      clearTimeout(abattage);
      contexte.signal.removeEventListener("abort", arreter);
      f();
    };
    const arreter = () => {
      try {
        enfant.kill("SIGTERM");
      } catch {
        // Déjà parti.
      }
      abattage = setTimeout(() => {
        try {
          enfant.kill("SIGKILL");
        } catch {
          // Déjà parti.
        }
      }, options.delaiAbattageMs ?? 60_000);
      abattage.unref?.();
    };
    contexte.signal.addEventListener("abort", arreter, { once: true });
    enfant.on("message", (brut) => {
      const m = brut as MessageEnfant | null;
      if (!m || typeof m !== "object") return;
      if (m.type === "progression") contexte.progression(m.pc);
      else if (m.type === "fini") resultat = { images: m.images, fps: m.fps };
      else if (m.type === "erreur") erreur = new ErreurEnfant(m.message, m.phase, m.codeCause);
    });
    enfant.on("error", (e) => terminer(() => ko(new ErreurEnfant(`Le processus de rendu n'a pas pu démarrer (${e.message}).`, "processus"))));
    enfant.on("close", (code, signal) =>
      terminer(() => {
        if (code === 0 && resultat) return ok(resultat);
        if (erreur) return ko(erreur);
        const cause = signal ? `signal ${signal}` : `code ${code}`;
        ko(new ErreurEnfant(`Le processus de rendu s'est arrêté (${cause}).`, "processus"));
      }),
    );
    try {
      enfant.send({ type: "demande", demande });
    } catch (e) {
      terminer(() => ko(new ErreurEnfant(`Le processus de rendu n'a pas reçu sa demande (${e instanceof Error ? e.message : String(e)}).`, "processus")));
      arreter();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Côté enfant                                                         */
/* ------------------------------------------------------------------ */

function dire(m: MessageEnfant): Promise<void> {
  return new Promise((ok) => {
    if (!process.send) return ok();
    process.send(m, () => ok());
  });
}

const texteErreur = (e: unknown): string => (e instanceof Error ? e.message : String(e ?? "erreur"));

/** Code de la cause (`fetch failed` → `ECONNREFUSED`) : il passe par l'IPC pour que le parent le montre. */
function causeDe(e: unknown): { codeCause?: string } {
  const code = (e as { cause?: { code?: unknown } } | null)?.cause?.code;
  return typeof code === "string" && code ? { codeCause: code } : {};
}

/** Arrêt demandé (SIGTERM) ou parent disparu : posé dès le départ, consulté avant `renderMedia`. */
let arretDemande = false;
let annuler: (() => void) | null = null;

/** Rend la composition demandée (mêmes appels qu'avant, dans ce processus). */
async function rendreDansEnfant(d: DemandeEnfant): Promise<void> {
  const { makeCancelSignal, renderMedia, selectComposition } = await import("@remotion/renderer");
  let choisie: Awaited<ReturnType<typeof selectComposition>>;
  try {
    choisie = await selectComposition({ serveUrl: d.serveUrl, id: d.id, inputProps: d.proprietes });
  } catch (e) {
    await dire({ type: "erreur", phase: "selection", message: texteErreur(e), ...causeDe(e) });
    process.exit(1);
  }
  if (arretDemande) {
    await dire({ type: "erreur", phase: "rendu", message: "Le rendu a été arrêté avant son départ." });
    process.exit(1);
  }
  const { cancelSignal, cancel } = makeCancelSignal();
  annuler = cancel;
  try {
    await renderMedia({
      ...(d.reglages as object),
      composition: choisie,
      serveUrl: d.serveUrl,
      codec: "h264",
      ...(d.supplements as object),
      outputLocation: d.sortie,
      inputProps: d.proprietes,
      cancelSignal,
      onProgress: ({ progress }: { progress: number }) => void dire({ type: "progression", pc: progress * 95 }),
    } as Parameters<typeof renderMedia>[0]);
  } catch (e) {
    await dire({ type: "erreur", phase: "rendu", message: texteErreur(e), ...causeDe(e) });
    process.exit(1);
  }
  await dire({ type: "fini", images: choisie.durationInFrames, fps: choisie.fps });
  process.exit(0);
}

if (process.env.STUDIO_RENDU_ENFANT === "1" && process.send) {
  // Posés dès le départ : un arrêt pendant `selectComposition` (qui ouvre déjà un navigateur) ne tue plus Node sans
  // fermer Chrome ; le drapeau est consulté avant `renderMedia`. Parent disparu (canal fermé) : plus personne ne lit.
  process.on("SIGTERM", () => {
    arretDemande = true;
    annuler?.();
  });
  process.on("disconnect", () => {
    arretDemande = true;
    if (annuler) annuler();
    else process.exit(1);
  });
  process.once("message", (m: { type?: string; demande?: DemandeEnfant }) => {
    if (m?.type !== "demande" || !m.demande) return process.exit(2);
    rendreDansEnfant(m.demande).catch(async (e) => {
      await dire({ type: "erreur", phase: "rendu", message: texteErreur(e), ...causeDe(e) });
      process.exit(1);
    });
  });
}
