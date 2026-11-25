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
  | { type: "erreur"; phase: "selection" | "rendu"; message: string };

/** Erreur remontée par l'enfant : `phase` dit si c'est le choix de la composition ou le rendu. */
export class ErreurEnfant extends Error {
  constructor(message: string, public readonly phase: "selection" | "rendu" | "processus") {
    super(message);
    this.name = "ErreurEnfant";
  }
}

/** Le strict nécessaire d'un processus enfant (un faux le remplace dans les tests). */
export interface EnfantMinimal {
  on(evenement: "message", ecoute: (m: unknown) => void): unknown;
  on(evenement: "exit", ecoute: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
  on(evenement: "error", ecoute: (e: Error) => void): unknown;
  send(m: unknown): unknown;
  kill(signal?: NodeJS.Signals): unknown;
}

export interface OptionsEnfant {
  /** Lance l'enfant (défaut : `child_process.fork`, qui hérite de `process.execArgv`, donc du chargeur tsx). */
  lancer?: (module: string, env: NodeJS.ProcessEnv) => EnfantMinimal;
  /** Délai avant SIGKILL après l'arrêt demandé (défaut 5 s). */
  delaiAbattageMs?: number;
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
    const enfant = (options.lancer ?? lancerParDefaut)(options.module ?? cheminEnfant(), { ...process.env, STUDIO_RENDU_ENFANT: "1" });
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
      }, options.delaiAbattageMs ?? 5_000);
      abattage.unref?.();
    };
    contexte.signal.addEventListener("abort", arreter, { once: true });
    enfant.on("message", (brut) => {
      const m = brut as MessageEnfant | null;
      if (!m || typeof m !== "object") return;
      if (m.type === "progression") contexte.progression(m.pc);
      else if (m.type === "fini") resultat = { images: m.images, fps: m.fps };
      else if (m.type === "erreur") erreur = new ErreurEnfant(m.message, m.phase);
    });
    enfant.on("error", (e) => terminer(() => ko(new ErreurEnfant(`Le processus de rendu n'a pas pu démarrer (${e.message}).`, "processus"))));
    enfant.on("exit", (code, signal) =>
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

/** Rend la composition demandée (mêmes appels qu'avant, dans ce processus). */
async function rendreDansEnfant(d: DemandeEnfant): Promise<void> {
  const { makeCancelSignal, renderMedia, selectComposition } = await import("@remotion/renderer");
  let choisie: Awaited<ReturnType<typeof selectComposition>>;
  try {
    choisie = await selectComposition({ serveUrl: d.serveUrl, id: d.id, inputProps: d.proprietes });
  } catch (e) {
    await dire({ type: "erreur", phase: "selection", message: texteErreur(e) });
    process.exit(1);
  }
  const { cancelSignal, cancel } = makeCancelSignal();
  // Arrêt demandé par le parent : Remotion ferme proprement son navigateur et le rendu échoue.
  process.on("SIGTERM", () => cancel());
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
    await dire({ type: "erreur", phase: "rendu", message: texteErreur(e) });
    process.exit(1);
  }
  await dire({ type: "fini", images: choisie.durationInFrames, fps: choisie.fps });
  process.exit(0);
}

if (process.env.STUDIO_RENDU_ENFANT === "1" && process.send) {
  process.once("message", (m: { type?: string; demande?: DemandeEnfant }) => {
    if (m?.type !== "demande" || !m.demande) return process.exit(2);
    rendreDansEnfant(m.demande).catch(async (e) => {
      await dire({ type: "erreur", phase: "rendu", message: texteErreur(e) });
      process.exit(1);
    });
  });
}
