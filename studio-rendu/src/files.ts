/**
 * Les DEUX FILES de `studio-rendu` (B.9 ter) — sans état durable : tout vit en mémoire ; après un redémarrage,
 * un rendu inconnu répond 404 et le studio le soumet à nouveau avec le même identifiant.
 *
 * - File COURTE, prioritaire : travaux de quelques secondes (nettoyage de l'audio, tranches, ffprobe, image fixe),
 *   au plus `paralleleCourte` à la fois, délai maximal 30 s ; elle passe DEVANT les montages en attente.
 * - File LONGUE : montages Remotion, UN SEUL à la fois.
 * - Idempotent : une demande déjà connue (même `idRendu`) n'est pas relancée, sauf si elle a échoué.
 * - Les résultats sont gardés 24 h en mémoire, puis oubliés.
 * - Incident du 12/10 : toute erreur d'un rendu (Remotion, FFmpeg, navigateur fermé, délai dépassé) écrit `echec` avec un
 *   motif lisible ; un montage a une durée maximale PROPORTIONNÉE à sa longueur (`delaiRendu`) ; un rejet non géré du
 *   processus fait passer les rendus en cours en échec (`echouerEnCours`, `surveillerRejets`) au lieu de les laisser
 *   « en cours ». Après un redémarrage, un identifiant inconnu répond « inconnu » (404), jamais un état périmé.
 */
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ErreurRendu, type DemandeRendu, type EtatRendu, type Operation, type OperationRendu } from "./contrat.js";
import { sansAdresses } from "./outils.js";

export interface OptionsFiles {
  operations: Partial<Record<OperationRendu, Operation>>;
  /** Travaux courts en parallèle (défaut 2 : les deux processeurs du conteneur). */
  paralleleCourte?: number;
  /** Délai maximal d'un travail court (défaut 30 s). */
  delaiCourteMs?: number;
  /** Délai maximal d'un montage (défaut 20 min) : plafond du délai proportionné (`delaiRendu`). */
  delaiLongueMs?: number;
  /** Durée de conservation des états en mémoire (défaut 24 h). */
  conservationMs?: number;
  horloge?: () => number;
  /** Dossier de travail temporaire (défaut : celui du système). */
  creerDossier?: () => Promise<string>;
}

interface Entree {
  demande: DemandeRendu;
  /** Empreinte de la demande (sans adresses signées) : même identifiant, autre empreinte = conflit. */
  empreinte: string;
  etat: EtatRendu;
  recuA: number;
  finiA?: number;
  /** Arrêt du travail en cours (délai, rejet non géré). */
  controleur?: AbortController;
}

/** Montage : socle et part par seconde de vidéo du délai proportionné. */
export const DELAI_SOCLE_LONGUE_MS = 10 * 60_000;
export const DELAI_PAR_SECONDE_MS = 20_000;

/** Durée (s) de la vidéo demandée, lue dans les paramètres : `dureeSec` (montage) ou la scène (`proprietes.scene`). */
export function dureeDemandeeSec(d: DemandeRendu): number | null {
  const p = d.parametres as { dureeSec?: unknown; proprietes?: { scene?: { debutMs?: unknown; finMs?: unknown } } };
  if (typeof p.dureeSec === "number" && Number.isFinite(p.dureeSec) && p.dureeSec > 0) return p.dureeSec;
  const sc = p.proprietes?.scene;
  if (typeof sc?.debutMs === "number" && typeof sc.finMs === "number" && sc.finMs > sc.debutMs) return (sc.finMs - sc.debutMs) / 1000;
  return null;
}

/**
 * Durée maximale d'un travail. File courte : `delaiCourteMs`. Montage : 10 min + 20 s par seconde de vidéo, au plus
 * `delaiLongueMs` (une vidéo de 30 s ou plus garde le plafond d'avant ; une scène de 5 s : 11 min 40) ; durée inconnue :
 * le plafond. PUR.
 */
export function delaiRendu(d: DemandeRendu, o: { delaiCourteMs: number; delaiLongueMs: number }): number {
  if (d.file === "courte") return o.delaiCourteMs;
  const duree = dureeDemandeeSec(d);
  if (duree === null) return o.delaiLongueMs;
  return Math.min(o.delaiLongueMs, DELAI_SOCLE_LONGUE_MS + Math.ceil(duree) * DELAI_PAR_SECONDE_MS);
}

/** Longueur gardée d'un message d'échec. */
const LONGUEUR_MOTIF = 300;

/**
 * Texte court qui garde la FIN (la vraie cause d'un stderr FFmpeg, pas sa bannière). Les lignes de pile d'appels
 * (`    at …`) sont retirées d'abord : leur fin ne dit rien (essai du 25/11 : « …et:347:12) »). PUR.
 */
export function finDuTexte(texte: string, max: number = LONGUEUR_MOTIF): string {
  const sansPile = texte.split("\n").filter((l) => !/^\s+at /.test(l)).join("\n").trim();
  return sansPile.length > max ? `…${sansPile.slice(-max)}` : sansPile;
}

/** Code de la cause réseau d'une erreur (`fetch failed` → `ECONNREFUSED`), sinon null. PUR. */
function codeCause(e: unknown): string | null {
  const cause = (e as { cause?: { code?: unknown } } | null)?.cause;
  return typeof cause?.code === "string" && cause.code ? cause.code : null;
}

/** Motif lisible d'une erreur quelconque d'un rendu (navigateur fermé, FFmpeg, Remotion…). PUR. */
export function motifEchec(e: unknown): ErreurRendu["erreur"] {
  if (e instanceof ErreurRendu) return e.erreur;
  const brut = sansAdresses((e instanceof Error ? e.message : String(e ?? "")).trim());
  const cause = codeCause(e);
  const court = finDuTexte(brut) + (cause && !brut.includes(cause) ? ` (${cause})` : "");
  if (/target closed|session closed|browser has disconnected|browser closed|protocol error/i.test(brut)) {
    return { code: "indisponible", reessayable: true, message: `Le navigateur du rendu s'est fermé pendant le dessin (${court}).` };
  }
  if (/\bENOSPC\b|no space left on device/i.test(brut) || (e as NodeJS.ErrnoException | null)?.code === "ENOSPC") {
    return { code: "inconnu", reessayable: false, message: "Le disque du serveur de rendu est plein." };
  }
  if (!court) return { code: "inconnu", reessayable: true, message: "Le rendu a échoué sans message." };
  return { code: "inconnu", reessayable: true, message: court };
}

/** Écriture JSON stable (clés triées) ; une adresse (http, https) est réduite à son chemin, sans signature. PUR. */
function jsonStable(v: unknown): string {
  const norme = (x: unknown): unknown => {
    if (typeof x === "string" && /^https?:\/\//i.test(x)) {
      try {
        const u = new URL(x);
        return `${u.origin}${u.pathname}`;
      } catch {
        return "[adresse]";
      }
    }
    if (Array.isArray(x)) return x.map(norme);
    if (x && typeof x === "object") return Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, w]) => [k, norme(w)]));
    return x;
  };
  return JSON.stringify(norme(v)) ?? "null";
}

/**
 * Empreinte d'une demande : opération, file, paramètres, clé de sortie et entrées (nom ET fichier : origine + chemin,
 * sans la signature). Jamais l'adresse de dépôt ni les signatures (elles changent à chaque signature) ; un autre
 * fichier sous le même nom d'entrée (voix brute puis voix mixée) est bien une autre demande. PUR.
 */
export function empreinteDemande(d: DemandeRendu): string {
  return createHash("sha256").update(jsonStable({ operation: d.operation, file: d.file, parametres: d.parametres, sortie: d.sortie?.cle, entrees: d.entrees ?? {} })).digest("hex");
}

/** Identifiant sans son suffixe de reprise (`-eN`, `-sN`, `-rN`) : un même montage repris garde le même identifiant de base. PUR. */
export function idDeBase(idRendu: string): string {
  return idRendu.replace(/-[esr]\d+$/, "");
}

export class FilesRendu {
  /** Nombre de dépassements de délai par identifiant de base (en mémoire, comme le reste). */
  private readonly depassements = new Map<string, number>();
  private readonly rendus = new Map<string, Entree>();
  private readonly attenteCourte: string[] = [];
  private readonly attenteLongue: string[] = [];
  private enCoursCourte = 0;
  private enCoursLongue = 0;
  private readonly o: Required<Omit<OptionsFiles, "operations">> & { operations: OptionsFiles["operations"] };
  /** Promesses des travaux lancés (tests : attendre la fin). */
  private readonly actifs = new Set<Promise<void>>();

  constructor(options: OptionsFiles) {
    this.o = {
      operations: options.operations,
      paralleleCourte: options.paralleleCourte ?? 2,
      delaiCourteMs: options.delaiCourteMs ?? 30_000,
      delaiLongueMs: options.delaiLongueMs ?? 20 * 60_000,
      conservationMs: options.conservationMs ?? 24 * 3600_000,
      horloge: options.horloge ?? Date.now,
      creerDossier: options.creerDossier ?? (() => mkdtemp(join(tmpdir(), "studio-rendu-"))),
    };
  }

  /**
   * Reçoit une demande et répond tout de suite. Idempotent sur `idRendu` AVEC la même empreinte ; un autre contenu sous
   * le même identifiant (rendu non échoué) est un conflit : rien n'est lancé, le serveur répond 409.
   */
  soumettre(demande: DemandeRendu): { idRendu: string; nouveau: boolean; conflit?: boolean } {
    this.oublierAnciens();
    const existant = this.rendus.get(demande.idRendu);
    const empreinte = empreinteDemande(demande);
    if (existant && existant.etat.statut !== "echec") {
      if (existant.empreinte !== empreinte) return { idRendu: demande.idRendu, nouveau: false, conflit: true };
      return { idRendu: demande.idRendu, nouveau: false };
    }
    this.rendus.set(demande.idRendu, { demande, empreinte, etat: { statut: "en_file", rang: 0 }, recuA: this.o.horloge() });
    (demande.file === "courte" ? this.attenteCourte : this.attenteLongue).push(demande.idRendu);
    this.planifier();
    return { idRendu: demande.idRendu, nouveau: true };
  }

  /** État d'un rendu (null : inconnu → 404). Le rang est recalculé à chaque lecture. */
  etat(idRendu: string): EtatRendu | null {
    const e = this.rendus.get(idRendu);
    if (!e) return null;
    if (e.etat.statut === "en_file") {
      const file = e.demande.file === "courte" ? this.attenteCourte : this.attenteLongue;
      // Les montages attendent aussi les travaux courts en attente (ils passent devant).
      const devant = file.indexOf(idRendu) + (e.demande.file === "longue" ? this.attenteCourte.length : 0);
      return { statut: "en_file", rang: Math.max(0, devant) + 1 };
    }
    return e.etat;
  }

  /** Nombre de travaux en attente et en cours (santé du conteneur). */
  resume() {
    return { courte: { attente: this.attenteCourte.length, enCours: this.enCoursCourte }, longue: { attente: this.attenteLongue.length, enCours: this.enCoursLongue } };
  }

  /** Attend la fin de tous les travaux lancés (tests, arrêt propre). */
  async inactif(): Promise<void> {
    while (this.actifs.size) await Promise.allSettled([...this.actifs]);
  }

  private planifier() {
    // La file courte d'abord : tant qu'il y a un travail court en attente et une place, il part.
    while (this.attenteCourte.length && this.enCoursCourte < this.o.paralleleCourte) {
      this.lancer(this.attenteCourte.shift()!, "courte");
    }
    // Un seul montage à la fois, et seulement quand aucun travail court n'attend.
    if (!this.attenteCourte.length && this.enCoursLongue === 0 && this.attenteLongue.length) {
      this.lancer(this.attenteLongue.shift()!, "longue");
    }
  }

  private lancer(idRendu: string, file: "courte" | "longue") {
    const entree = this.rendus.get(idRendu);
    if (!entree) return;
    if (file === "courte") this.enCoursCourte++;
    else this.enCoursLongue++;
    entree.etat = { statut: "en_cours", progression: 0 };
    const p = this.executer(entree, file).finally(() => {
      if (file === "courte") this.enCoursCourte--;
      else this.enCoursLongue--;
      this.actifs.delete(p);
      this.planifier();
    });
    this.actifs.add(p);
  }

  /**
   * Fait passer en ÉCHEC tous les rendus en cours (rejet non géré du processus : on ne sait pas lequel l'a causé) et les
   * arrête. Leur fin éventuelle n'écrase plus cet état. Renvoie leurs identifiants.
   */
  echouerEnCours(message: string): string[] {
    const ids: string[] = [];
    for (const [id, e] of this.rendus) {
      if (e.etat.statut !== "en_cours") continue;
      e.etat = { statut: "echec", erreur: { code: "inconnu", reessayable: true, message } };
      e.finiA = this.o.horloge();
      e.controleur?.abort();
      ids.push(id);
    }
    return ids;
  }

  private async executer(entree: Entree, file: "courte" | "longue"): Promise<void> {
    const { demande } = entree;
    const operation = this.o.operations[demande.operation];
    if (!operation) {
      entree.etat = { statut: "echec", erreur: { code: "refuse", reessayable: false, message: `Opération « ${demande.operation} » pas encore disponible.` } };
      entree.finiA = this.o.horloge();
      return;
    }
    const controleur = new AbortController();
    entree.controleur = controleur;
    const delai = delaiRendu({ ...demande, file }, this.o);
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    const erreurDelai = new ErreurRendu({ code: "indisponible", reessayable: true, message: `Délai de ${Math.round(delai / 1000)} s dépassé.` });
    let depasse = false;
    const depassement = new Promise<never>((_, rejeter) => {
      minuterie = setTimeout(() => {
        depasse = true;
        rejeter(erreurDelai);
        controleur.abort();
      }, delai);
    });
    let dossier: string | undefined;
    try {
      dossier = await this.o.creerDossier();
      const resultat = await Promise.race([
        operation(demande, {
          dossier,
          signal: controleur.signal,
          progression: (pc) => {
            if (entree.etat.statut === "en_cours") entree.etat = { statut: "en_cours", progression: Math.max(0, Math.min(99, Math.round(pc))) };
          },
        }),
        depassement,
      ]);
      // Une opération qui rend la main en réponse à l'arrêt n'a pas abouti : le délai a été dépassé.
      if (depasse) throw erreurDelai;
      // Déjà mis en échec (rejet non géré) : ce résultat tardif n'écrase rien.
      if (entree.etat.statut !== "en_cours") return;
      entree.etat = { statut: "termine", sortieCle: demande.sortie.cle, ...(resultat.mesures ? { mesures: resultat.mesures } : {}) };
    } catch (e) {
      if (entree.etat.statut === "en_cours") {
        let erreur = motifEchec(e);
        if (depasse && e === erreurDelai) {
          const base = idDeBase(demande.idRendu);
          const nombre = (this.depassements.get(base) ?? 0) + 1;
          this.depassements.set(base, nombre);
          // Deuxième dépassement du même montage : un nouvel essai dépasserait encore, on s'arrête là.
          if (nombre >= 2) erreur = { code: "indisponible", reessayable: false, message: "Le montage dépasse la durée maximale du serveur de rendu." };
        }
        entree.etat = { statut: "echec", erreur };
        console.error(`[studio-rendu] échec ${demande.operation} ${demande.idRendu} : ${erreur.code} ${finDuTexte(sansAdresses(erreur.message))}`);
      }
    } finally {
      clearTimeout(minuterie);
      entree.controleur = undefined;
      entree.finiA ??= this.o.horloge();
      if (dossier) await rm(dossier, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private oublierAnciens() {
    const limite = this.o.horloge() - this.o.conservationMs;
    for (const [id, e] of this.rendus) if (e.finiA !== undefined && e.finiA < limite) this.rendus.delete(id);
  }
}

/**
 * Un rejet non géré (promesse oubliée dans Remotion, le navigateur ou une opération) ne tue plus le processus en
 * silence et ne laisse jamais un rendu « en cours » : les rendus en cours passent en échec, avec le motif. Renvoie de
 * quoi retirer l'écoute (tests).
 */
export function surveillerRejets(files: Pick<FilesRendu, "echouerEnCours">, processus: Pick<NodeJS.Process, "on" | "off"> = process, journal: (ligne: string) => void = console.error): () => void {
  const ecoute = (raison: unknown) => {
    const motif = raison instanceof Error ? raison.message : String(raison);
    const ids = files.echouerEnCours(`Erreur non attrapée pendant le rendu : ${motif}`);
    journal(`[studio-rendu] rejet non géré (${motif}) : ${ids.length ? `${ids.join(", ")} en échec` : "aucun rendu en cours"}`);
  };
  processus.on("unhandledRejection", ecoute);
  return () => void processus.off("unhandledRejection", ecoute);
}
