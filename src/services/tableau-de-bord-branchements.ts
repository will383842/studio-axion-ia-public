/**
 * RACCORDS RÉELS DU « TABLEAU DE BORD » (fiche G4-09c-b-1) : voix (1 € par vidéo, CUMULÉ), narration de Claude, rendu par
 * `studio-rendu` (0 €). SERVICE NEUF QUE PERSONNE NE CHARGE : aucun importeur, aucune ligne dans `boucle.ts`, aucun réglage lu
 * ici (`voixActive` est un PARAMÈTRE de `dependancesDonnees`). `brancherTableauDeBord()` existe mais n'est appelée par personne :
 * le chargement et l'allumage sont la fiche ALLUMER-TABLEAU-DE-BORD-v21n. Modèle : `video-longue-branchements.ts`.
 *
 * Règles d'argent :
 *  - Plafond de voix : 100 centimes d'euro par vidéo, CUMULÉ sur toutes les fabrications (dépenses de la vidéo dont l'étape commence
 *    par « Voix tableau de bord · » + réservations actives `tbvoix-`). Refus si `engagé + demande > 100`, AVANT toute réservation
 *    et toute lecture.
 *  - Réservation par `verifierEtReserverSelonOrigine` (origine de la commande), UNE fois, avant la première lecture.
 *  - Une panne (personnage absent, voix non reliée, voix d'essai…) est un REFUS DE L'ÉTAPE, 0 € : la résolution de la voix précède
 *    toujours la réservation.
 *  - Narration : le port de Claude (plafond dur propre) ; `null` = texte gratuit. Rendu : studio-rendu, 0 € dans le code.
 */
import "server-only";
import type { CommandeFabrication, Ratio } from "@/domaine/types";
import type { DemandeRendu } from "@/fournisseurs/types";
import { moteurMontageDonnees, creerMoteurDonnees, type DependancesDonnees } from "@/moteurs/montage-donnees";
import type { ProprietesMontageDonnees } from "@/moteurs/montage-donnees/proprietes";
import { COMPOSITION_DONNEES } from "@/moteurs/montage-donnees/proprietes";
import { lecturesVoixMax, lireReglageRessemblance, PARAM_RESSEMBLANCE_VOIX } from "@/briques/voix-maitre/reference";
import { portNarrationClaude } from "./narration-tableau-claude";
import { PLAFOND_VOIX_TDB_CENTIMES_PROPOSE, voixTableauDeBord } from "./tableau-de-bord-voix";

/** Début de l'étape inscrite dans la réservation et la dépense de la voix (sert au calcul du cumul par vidéo). */
export const PREFIXE_ETAPE_VOIX_TDB = "Voix tableau de bord ·";
/** Début du `travailId` des réservations de la voix du tableau de bord. */
export const PREFIXE_TRAVAIL_VOIX_TDB = "tbvoix-";
const ATTENTE_SUIVI_MS = 5_000;

/** Ce que le service lit ou fait ailleurs : tout est injectable (les tests n'appellent rien de réel). */
export interface PortsTableauDeBord {
  /** Branchements réels (voix prête, stockage, rendu) : refus = exception. Chargé à la demande. */
  branchements?: (personnageId: string, videoId: string) => Promise<BranchementsTdb>;
  /** Centimes d'euro déjà engagés pour la voix de CETTE vidéo (dépenses + réservations actives). */
  engage?: (videoId: string) => Promise<number>;
  /** Porte d'argent : `verifierEtReserverSelonOrigine` par défaut. */
  reserverCredits?: (origine: CommandeFabrication["origine"], e: { total: number; caracteres: number; fournisseur: string; prixUnitaire: number }, demande: { videoId: string; travailId: string }) => Promise<void>;
  narration?: ReturnType<typeof portNarrationClaude>;
  /** Lecture du réglage de ressemblance (nombre de lectures au plus). */
  lecturesMax?: () => Promise<number>;
  attendre?: () => Promise<void>;
  /** Tarif de la voix, centimes d'euro par caractère. */
  tarifCentimesParCaractere?: number;
}

/** Sous-ensemble de `branchementsReels` utilisé ici. */
export interface BranchementsTdb {
  env: string;
  voix: {
    voix: () => { lire: (e: { idExterne: string; texte: string; reglages: never; prononciations: never[]; tauxUsdEur: number }) => Promise<{ fichierCle: string; dureeSec: number; mots: { mot: string; debutSec: number; finSec: number }[] }> };
    idVoix: string;
    reglages?: unknown;
    tauxUsdEur: number;
    fournisseurVoix: string;
  };
  montage: {
    rendu: () => { soumettre: (d: DemandeRendu) => Promise<{ idRendu: string }>; etat: (id: string) => Promise<{ statut: string; sortieCle?: string; erreur?: { message?: string } }> };
    signer: (lectures: Record<string, string>, depots: { cle: string; mime: string }[]) => Promise<{ lectures: Record<string, string>; depots: Record<string, string> }>;
    cle: (c: CommandeFabrication, nom: string) => string;
    garde?: { delaiMs: number };
  };
}

const sansDeuxPoints = (r: Ratio): string => r.replace(":", "");

/** Pose le plafond en centimes d'euro : la partie entière de chaque ligne est sommée. */
function engageParDefaut(): (videoId: string) => Promise<number> {
  return async (videoId) => {
    const { depots } = await import("./_commun");
    const d = depots();
    const depenses = await d.depenses.lister((x) => x.videoId === videoId && x.lignes.some((l) => l.etape.startsWith(PREFIXE_ETAPE_VOIX_TDB)));
    const depense = depenses.reduce((s, x) => s + x.lignes.filter((l) => l.etape.startsWith(PREFIXE_ETAPE_VOIX_TDB) && l.nature === "reel").reduce((t, l) => t + l.total.centimes, 0), 0);
    const reservations = await d.reservations.lister((r) => r.videoId === videoId && r.statut === "active" && !!r.travailId?.startsWith(PREFIXE_TRAVAIL_VOIX_TDB));
    return depense + reservations.reduce((s, r) => s + r.centimes, 0);
  };
}

/**
 * Dépendances du moteur pour une commande. `null` (pause claire, rien n'est payé) SEULEMENT pour ce qui se lit sans attente :
 * entrées absentes, ou `STUDIO_RENDU_URL` vide. Le reste est une promesse PARESSEUSE : un `throw` devient un refus de l'étape.
 * `voixActive` vient de l'appelant (aucun réglage lu ici) ; `false` : vidéo muette, aucune réservation.
 */
export function dependancesDonnees(c: CommandeFabrication, o: { voixActive: boolean }, ports: PortsTableauDeBord = {}): DependancesDonnees | null {
  if (!(c.entrees as Record<string, unknown> | undefined)?.montageDonnees) return null;
  if (!process.env.STUDIO_RENDU_URL) return null;

  const videoId = c.videoId;
  const personnageId = c.distribution?.[0]?.personnageId;
  let branches: Promise<BranchementsTdb> | undefined;
  const branchement = (): Promise<BranchementsTdb> => {
    if (!personnageId) throw new Error("Choisissez qui parle : cette vidéo n'a pas de personnage, rien n'est payé.");
    return (branches ??= (ports.branchements ?? (async (p, v) => (await import("./tableau-outils")).branchementsReels(p, v) as unknown as BranchementsTdb))(personnageId, videoId));
  };
  const travailId = `${PREFIXE_TRAVAIL_VOIX_TDB}${videoId}-${Date.now().toString(36)}`;

  const deps: DependancesDonnees = {
    narration: ports.narration ?? portNarrationClaude(videoId, c.origine),
    async monter(ratio, proprietes) {
      const b = await branchement();
      const nom = `tableau-de-bord-${sansDeuxPoints(ratio)}.mp4`;
      const cle = b.montage.cle(c, nom);
      // L'adresse SIGNÉE de la voix va dans les propriétés (copie), jamais dans `entrees`.
      const lectures: Record<string, string> = {};
      let audio: string | undefined;
      if (proprietes.audio) {
        const s = await b.montage.signer({ audio: proprietes.audio }, []);
        audio = s.lectures.audio;
      }
      const signe = await b.montage.signer(lectures, [{ cle, mime: "video/mp4" }]);
      const urlDepot = signe.depots[cle];
      const copie: ProprietesMontageDonnees = { ...proprietes, ...(audio ? { audio } : {}) };
      const demande: DemandeRendu = {
        idRendu: `tdb-${travailId}-${sansDeuxPoints(ratio)}-0`,
        operation: "composition",
        file: "longue",
        entrees: {},
        sortie: { urlDepot, cle },
        parametres: { composition: COMPOSITION_DONNEES, proprietes: copie },
      };
      const rendu = b.montage.rendu();
      const { idRendu } = await rendu.soumettre(demande);
      const attendre = ports.attendre ?? (() => new Promise<void>((ok) => setTimeout(ok, ATTENTE_SUIVI_MS)));
      const limite = Date.now() + (b.montage.garde?.delaiMs ?? 600_000);
      for (;;) {
        const e = await rendu.etat(idRendu);
        if (e.statut === "termine") return { fichierCle: e.sortieCle ?? cle };
        if (e.statut === "echec") throw new Error(e.erreur?.message ?? "L'assemblage de la vidéo a échoué : rien de plus n'est payé.");
        if (Date.now() > limite) throw new Error("L'assemblage de la vidéo prend trop de temps : vous pouvez réessayer.");
        await attendre();
      }
    },
  };

  if (!o.voixActive) return deps;

  const tarif = ports.tarifCentimesParCaractere ?? 0.03;
  // Le nombre de lectures vient du réglage de ressemblance : lu à la première lecture, jamais à la construction.
  const nombreDeLectures = async (): Promise<number> => {
    if (ports.lecturesMax) return ports.lecturesMax();
    const { lireParametre } = await import("./_commun");
    return lecturesVoixMax(lireReglageRessemblance(await lireParametre<unknown>(PARAM_RESSEMBLANCE_VOIX, undefined)));
  };
  const construire = async () =>
    voixTableauDeBord({
      tarifCentimesParCaractere: tarif,
      plafondCentimes: PLAFOND_VOIX_TDB_CENTIMES_PROPOSE,
      lecturesMax: await nombreDeLectures(),
      // La résolution de la voix (personnage, voix prête, reliée, non simulée) précède toute réservation : un refus coûte 0 €.
      lire: async (texte) => {
        const v = (await branchement()).voix;
        const r = await v.voix().lire({ idExterne: v.idVoix, texte, reglages: (v.reglages ?? { vitesse: 1, stabilite: 45, emotion: 30 }) as never, prononciations: [], tauxUsdEur: v.tauxUsdEur });
        return { audio: r.fichierCle, dureeSec: r.dureeSec, mots: r.mots };
      },
      reserver: async (e) => {
        const b = await branchement();
        // Plafond CUMULÉ par vidéo : déjà engagé + demande, lu AVANT toute réservation.
        const engage = await (ports.engage ?? engageParDefaut())(videoId);
        if (!Number.isFinite(engage) || engage < 0) throw new Error("Voix du tableau de bord refusée : le déjà engagé ne peut pas être vérifié, rien n'est payé.");
        if (engage + e.centimes > PLAFOND_VOIX_TDB_CENTIMES_PROPOSE) throw new Error("Voix du tableau de bord refusée : le plafond de la vidéo serait dépassé, rien n'est payé.");
        await (ports.reserverCredits ?? reserverParDefaut)(c.origine, { total: e.centimes, caracteres: e.caracteres, fournisseur: b.voix.fournisseurVoix, prixUnitaire: tarif }, { videoId, travailId });
      },
    });
  let voixConstruite: ReturnType<typeof construire> | undefined;
  return { ...deps, voix: { lire: async (texte) => (await (voixConstruite ??= construire())).lire(texte) } };
}

/** Porte d'argent réelle : crédits et budget du mois selon l'origine de la commande. */
async function reserverParDefaut(origine: CommandeFabrication["origine"], e: { total: number; caracteres: number; fournisseur: string; prixUnitaire: number }, demande: { videoId: string; travailId: string }): Promise<void> {
  const { verifierEtReserverSelonOrigine } = await import("./credits");
  const { centimes } = await import("@/lib/montants");
  const total = centimes(e.total);
  await verifierEtReserverSelonOrigine(origine, { lignes: [{ etape: `${PREFIXE_ETAPE_VOIX_TDB} lecture`, fournisseur: e.fournisseur, unite: "caractere", quantite: e.caracteres, prixUnitaire: centimes(e.prixUnitaire), total, nature: "estime" }], total }, total.centimes, "Cette vidéo", demande);
}

/**
 * Pose les dépendances réelles sur le moteur inscrit (une fois par processus). NON APPELÉE ici : chargée et allumée par
 * ALLUMER-TABLEAU-DE-BORD-v21n, qui fournit la lecture du réglage de voix (`voixActive`) ; par défaut : muette.
 */
export function brancherTableauDeBord(voixActive: () => boolean = () => false): void {
  const g = globalThis as typeof globalThis & { [k: symbol]: unknown };
  const cle = Symbol.for("studio-axion-ia-public.tableau-de-bord-branche");
  if (g[cle]) return;
  g[cle] = true;
  Object.assign(moteurMontageDonnees, creerMoteurDonnees((c) => dependancesDonnees(c, { voixActive: voixActive() })));
}
