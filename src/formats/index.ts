/**
 * REGISTRE DES FORMATS (PLAN B.6.1). PUR : importable côté client et serveur.
 * Menu, « Nouvelle vidéo », onglets de « Mes vidéos », filtres et assistant sont
 * générés depuis cette liste. L'ordre ici = l'ordre d'affichage.
 */
import { formatAvocat } from "./avocat";
import { formatPodcast } from "./podcast";
import { formatEcranPartage, formatMotion, formatSelfie, formatUgc, formatCreateurB } from "./autres";
import { formatFacecam } from "./facecam";
import { formatTableauAnime } from "./tableau-anime";
import { formatCasConcret } from "./cas-concret";
import { formatFacecamAnimee } from "./facecam-animee";
import { formatImageVideo } from "./image-video";
import type { DefinitionFormat, StatutFormat } from "./types";
import type { ConseilSite, RegleChapitresWeb } from "@/domaine/site-videos/types";
import { BRIQUES_FACULTATIVES, type BlocScript, type BriqueFacultative, type ModeDeclinaison, type Script } from "@/domaine/types";
import { resoudreRecette, type RecetteResolue } from "./familles";
import { codeDuFormat } from "./registre-codes";

export type { DefinitionFormat } from "./types";

const FORMATS: DefinitionFormat[] = [formatAvocat, formatFacecam, formatPodcast, formatCreateurB, formatEcranPartage, formatMotion, formatUgc, formatSelfie, formatTableauAnime, formatCasConcret, formatFacecamAnimee, formatImageVideo];

/**
 * Inscrit un format PAR DES DONNÉES (générateur, plan v5 B.4.0) : ajouter un format ne change jamais le générateur
 * central. Sert au format fictif « test », inscrit depuis `tests/` seulement. Refusé si l'identifiant existe déjà.
 */
export function inscrireFormat(format: DefinitionFormat): DefinitionFormat {
  if (FORMATS.some((f) => f.id === format.id)) throw new Error(`Format déjà inscrit : ${format.id}`);
  FORMATS.push(format);
  return format;
}

/** Un format tel que le générateur le lit : code de classement, déclinaison et recette résolus (B.2.2, B.4.0). */
export interface FormatGenerateur extends DefinitionFormat {
  codeClassement: string;
  declinaison: ModeDeclinaison;
  recette: RecetteResolue;
}

export function formatGenerateur(id: string): FormatGenerateur {
  const format = obtenirFormat(id);
  const code = format.codeClassement ?? codeDuFormat(format.id);
  if (!code) throw new Error(`Le format ${format.id} n'a pas de code de classement (registre-codes.ts)`);
  const recette = resoudreRecette(format);
  return { ...format, codeClassement: code, declinaison: recette.declinaison, recette };
}

/**
 * Formats visibles (actifs + bientôt), hors « masque » et hors formats réservés à Will (`reserveAWill`).
 * `inclureReservesAWill` : l'interface CONNECTÉE (grille « Nouvelle vidéo », menu latéral) les montre aussi, avec une pastille « Essai » :
 * le studio n'a qu'une session, celle de Will (essai réel du 17/10). Idées, prix, personnages… gardent la liste sans eux.
 */
export function listerFormats(options: { inclureMasques?: boolean; inclureReservesAWill?: boolean } = {}): DefinitionFormat[] {
  return FORMATS.filter((f) => options.inclureMasques || (f.statut !== "masque" && (!f.reserveAWill || options.inclureReservesAWill === true)));
}

export function listerFormatsActifs(): DefinitionFormat[] {
  return FORMATS.filter((f) => f.statut === "actif" && !f.reserveAWill);
}

/** Conseil « aller sur le site » du format (défaut : « non »). La décision reste le réglage `siteGenerateurs.<id>`. */
export function conseilSite(format: Pick<DefinitionFormat, "site">): ConseilSite {
  return format.site ?? "non";
}

/** Découpage des chapitres web du format (défaut : un chapitre par bloc de la recette). */
export function regleChapitresWeb(format: Pick<DefinitionFormat, "chapitresWeb">): RegleChapitresWeb {
  return format.chapitresWeb ?? {};
}

/** Page où commence une nouvelle vidéo du format (`/nouvelle/<id>` si le format n'en déclare pas d'autre). */
export function adresseCreationFormat(format: { id: string }): string {
  return trouverFormat(format.id)?.adresseCreation ?? `/nouvelle/${format.id}`;
}

/** Fiche d'une vidéo : adresse déclarée par le format, sinon l'assistant pour un brouillon, sinon `/videos/<id>`. */
export function adresseFicheVideo(v: { id: string; statut: string; format: { id: string } }): string {
  const modele = trouverFormat(v.format.id)?.adresseFiche;
  if (modele) return modele.replace("{id}", encodeURIComponent(v.id));
  if (v.statut === "brouillon") return `/nouvelle/${v.format.id}?brouillon=${v.id}`;
  return `/videos/${v.id}`;
}

/** Statut vu par la navigation : un format masqué mais ouvert dans la navigation compte comme actif. */
export function statutNavigation(f: Pick<DefinitionFormat, "statut" | "ouvertDansLaNavigation">): StatutFormat {
  return f.statut === "masque" && f.ouvertDansLaNavigation ? "actif" : f.statut;
}

/** Format montré comme « essai » : réservé à Will, ou masqué ailleurs mais ouvert dans la navigation. */
export function formatEnEssai(f: Pick<DefinitionFormat, "reserveAWill" | "ouvertDansLaNavigation">): boolean {
  return f.reserveAWill === true || f.ouvertDansLaNavigation === true;
}

/**
 * Formats de la navigation : les formats visibles, plus ceux `masque` mais ouverts dans la navigation.
 * Actifs d'abord, « bientôt » ensuite (tri stable sur une copie ; FORMATS n'est jamais trié en place).
 */
export function listerFormatsNavigation(): DefinitionFormat[] {
  const rang = (f: DefinitionFormat) => (statutNavigation(f) === "actif" ? 0 : 1);
  return FORMATS.filter((f) => f.statut !== "masque" || f.ouvertDansLaNavigation).slice().sort((a, b) => rang(a) - rang(b));
}

export function trouverFormat(id: string): DefinitionFormat | undefined {
  return FORMATS.find((f) => f.id === id);
}

/** Libellé court d'un format (registre), avec repli sur le nom fourni si l'id est inconnu. */
export function nomCourtFormat(format: { id: string; nom?: string }): string {
  return trouverFormat(format.id)?.nomCourt ?? format.nom ?? format.id;
}

export function obtenirFormat(id: string): DefinitionFormat {
  const f = trouverFormat(id);
  if (!f) throw new Error(`Format inconnu : ${id}`);
  return f;
}

/** Briques que Will peut couper ou allumer pour une vidéo : interrupteurs de l'étape Réglages (AV2.7). */
export function briquesCoupables(format: DefinitionFormat): BriqueFacultative[] {
  return BRIQUES_FACULTATIVES.filter((b) => {
    const etat = format.briques[b];
    return etat === "active" || etat === "au-choix" || etat === "au-choix-coupee";
  });
}

/**
 * État final des briques : désactivées par le format OU coupées pour la vidéo → false.
 * Une brique « au-choix-coupee » (mention IA) n'est allumée que si la vidéo l'allume (`allumees`).
 */
export function briquesEffectives(format: DefinitionFormat, coupees: BriqueFacultative[] = [], allumees: BriqueFacultative[] = []): Record<BriqueFacultative, boolean> {
  return Object.fromEntries(
    BRIQUES_FACULTATIVES.map((b) => {
      const etat = format.briques[b];
      if (etat === "au-choix-coupee") return [b, allumees.includes(b) && !coupees.includes(b)];
      return [b, (etat === "active" || etat === "au-choix") && !coupees.includes(b)];
    }),
  ) as Record<BriqueFacultative, boolean>;
}

/**
 * La mention IA est-elle ACTIVE pour cette vidéo ? (incrustée par la brique, ou ajoutée au texte de publication).
 * Coupée : la carte « Avant de publier » a 4 cases au lieu de 5, et rien ne s'allume en ambre (décision de Will du 01/10).
 */
export function mentionIAActive(format: DefinitionFormat, video: { briquesCoupees?: BriqueFacultative[]; briquesAllumees?: BriqueFacultative[]; mentionIA: { dansLegende: boolean } }): boolean {
  return briquesEffectives(format, video.briquesCoupees, video.briquesAllumees)["mention-ia"] || video.mentionIA.dansLegende;
}

/** Cases de « Avant de publier » à cocher : 5, ou 4 quand la mention IA est coupée. */
export const CASES_AVANT_DE_PUBLIER = ["image", "son", "sousTitres", "mentionIA", "droits"] as const;
export function casesRequises(mentionActive: boolean): (typeof CASES_AVANT_DE_PUBLIER)[number][] {
  return CASES_AVANT_DE_PUBLIER.filter((c) => mentionActive || c !== "mentionIA");
}

/** Le format interdit la musique (avocat) : aucun sélecteur, aucune musique dans la commande (B.7). */
export function musiqueInterdite(format: DefinitionFormat): boolean {
  return format.musique === "interdite";
}

/**
 * UNE seule règle de musique par défaut, partagée par l'écran Style et la commande (bug corrigé, B.7) :
 * le choix de la vidéo, sinon la musique « par défaut » du format, et jamais rien si le format l'interdit.
 */
export function musiqueRetenue(format: DefinitionFormat, choisie: string | undefined, elements: { id: string; type: string; formatsParDefaut: string[]; archiveLe?: string }[]): string | undefined {
  if (musiqueInterdite(format)) return undefined;
  return choisie ?? elements.find((e) => e.type === "musique" && !e.archiveLe && e.formatsParDefaut.includes(format.id))?.id;
}

/** Valeurs par défaut des réglages d'un format (via son schéma zod). */
export function reglagesParDefaut(format: DefinitionFormat): Record<string, unknown> {
  return format.reglages.schema.parse({}) as Record<string, unknown>;
}

/** Valide des réglages ; renvoie les réglages complétés ou les erreurs lisibles. */
export function validerReglages(
  format: DefinitionFormat,
  reglages: unknown,
): { ok: true; reglages: Record<string, unknown> } | { ok: false; erreurs: string[] } {
  const r = format.reglages.schema.safeParse(reglages ?? {});
  if (r.success) return { ok: true, reglages: r.data as Record<string, unknown> };
  return { ok: false, erreurs: r.error.issues.map((i) => `${i.path.join(".")} : ${i.message}`) };
}

/** Fait passer des réglages enregistrés sous une ancienne version du format (AV2.2-8). */
export function migrerReglages(format: DefinitionFormat, reglages: Record<string, unknown>, depuisVersion: number): Record<string, unknown> {
  if (depuisVersion === format.version || !format.migrerReglages) return reglages;
  return format.migrerReglages(reglages, depuisVersion);
}

/**
 * TEST-UI-REEL U2 (CORRECTEUR FINAL A) : débit RÉEL de la voix HeyGen de Will, à la vitesse 1 (mots par seconde). Mesure
 * du 02/10 sur le compte (tests/a1-voix-heygen, `POST /v3/voices/speech`) : 10 mots en 3,8 s de parole (5,0 s en
 * tout). Bien plus lent que les 4,4 mots/s de la recette avocat (débit d'écriture, mesuré sur les vidéos de l'avocat de référence).
 */
export const DEBIT_VOIX_HEYGEN_MESURE = 2.6;

/**
 * Débit de LECTURE d'un texte (mots par seconde) : celui de la voix qui le lira quand on le connaît vraiment (voix
 * HeyGen reliée : débit mesuré × sa vitesse), sinon la recette du format. La durée annoncée, et donc le prix (le double
 * se paie à la seconde), suivent la vraie durée parlée.
 */
export function debitLecture(format: Pick<DefinitionFormat, "recetteScript">, voix?: { fournisseur?: string; reglages?: { vitesse?: number } } | null): number {
  const vitesse = Math.min(1.5, Math.max(0.5, voix?.reglages?.vitesse || 1));
  if (voix?.fournisseur === "heygen") return DEBIT_VOIX_HEYGEN_MESURE * vitesse;
  // TEST-UI-REEL U5 (CORRECTEUR UI2) : sans voix choisie, la durée annoncée est celle de la voix qui lira pour de vrai
  // (débit mesuré), jamais le débit d'écriture de la recette (4,4 mots/s pour l'avocat : 53 mots annoncés « ≈ 12 s »
  // au lieu d'environ 20 s). Une recette plus lente que la voix garde son débit. Une voix d'essai (« simulation ») garde
  // la recette : c'est le débit auquel le moteur avocat la fait lire, donc la vraie durée de son son.
  if (!voix?.fournisseur) return Math.min(format.recetteScript.motsParSeconde, DEBIT_VOIX_HEYGEN_MESURE * vitesse);
  return format.recetteScript.motsParSeconde;
}

/** Durée estimée d'un texte : round(mots ÷ débit) (B.0 §18) ; débit de la recette du format, ou celui de la voix (U2). */
export function estimerDureeTexte(format: DefinitionFormat, texte: string, debit: number = format.recetteScript.motsParSeconde): number {
  const mots = texte.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(mots / debit);
}

/** Le texte fixe la durée (format « depuis-script ») : aucune pastille de durée. */
export function dureeDepuisScript(format: Pick<DefinitionFormat, "durees">): boolean {
  return format.durees.mode === "depuis-script";
}

/** Durée par défaut d'un format : la pastille par défaut, ou la cible du générateur pour un format « depuis-script ». */
export function dureeParDefaut(format: Pick<DefinitionFormat, "durees">): number {
  return format.durees.mode === "depuis-script" ? format.durees.cibleParDefautSec : format.durees.parDefautSec;
}

/** Durées proposées (pastilles, atelier) : la liste du format, ou les cibles du générateur. */
export function valeursDuree(format: Pick<DefinitionFormat, "durees">): number[] {
  return format.durees.mode === "depuis-script" ? format.durees.ciblesGenerationSec : format.durees.valeursSec;
}

/**
 * Durée d'une vidéo dans toute la chaîne (commande, plans, contrôle) : estimée depuis le texte pour un
 * format « depuis-script », sinon la durée choisie. Sans texte : la durée choisie.
 */
export function dureeVideo(format: DefinitionFormat, texte: string | null | undefined, dureeChoisieSec: number, debit?: number): number {
  if (!dureeDepuisScript(format) || !texte?.trim()) return dureeChoisieSec;
  return Math.max(1, estimerDureeTexte(format, texte, debit));
}

export type ZoneDuree = "verte" | "orange" | "hors-zone" | "courte";

/** Zone d'une durée pour un format « depuis-script » : vert 25-40 s, orange 40-50 s, « hors zone » au-delà (jamais bloquant). */
export function zoneDuree(format: DefinitionFormat, dureeSec: number): ZoneDuree | null {
  if (format.durees.mode !== "depuis-script") return null;
  const [min, max] = format.durees.zoneSec;
  const [, maxOrange] = format.durees.zoneOrangeSec;
  if (dureeSec < min) return "courte";
  if (dureeSec <= max) return "verte";
  if (dureeSec <= maxOrange) return "orange";
  return "hors-zone";
}

/** Blocs d'un script dans la recette COURANTE du format (migration à la lecture, B.9 bis). Aucun texte perdu. */
export function blocsAJour(format: DefinitionFormat, blocs: BlocScript[], depuisVersion: number): BlocScript[] {
  if (depuisVersion >= format.version || !format.migrerScript) return blocs;
  return format.migrerScript(blocs, depuisVersion);
}

/** Script migré à la lecture (`versionFormat` < version du format) ; enregistré tel quel à la prochaine sauvegarde. */
export function scriptAJour<S extends Pick<Script, "formatId" | "versionFormat" | "blocs">>(script: S): S {
  const format = trouverFormat(script.formatId);
  if (!format || script.versionFormat >= format.version) return script;
  return { ...script, blocs: blocsAJour(format, script.blocs, script.versionFormat), versionFormat: format.version };
}

/** Blocs de la recette absents ou vides (« à compléter », jamais bloquant). */
export function blocsACompleter(format: DefinitionFormat, blocs: BlocScript[]): string[] {
  return format.recetteScript.blocs
    .filter((r) => !blocs.some((b) => b.blocRecette === r.id && b.segments.some((s) => s.texte.trim())))
    .map((r) => r.id);
}

/** Libellé court d'une durée : « 45 s », « 3 min », « 1 min 30 ». */
export function libelleDuree(sec: number): string {
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} min ${String(s).padStart(2, "0")}` : `${m} min`;
}

/** Plan facecam v4 (lot A) : le format ne montre aucun prix (blocs Coût, « Confirmer ce prix », montant masqués). */
export function formatSansPrix(formatId: string | null | undefined): boolean {
  return !!formatId && trouverFormat(formatId)?.sansPrix === true;
}

/** Accord de prix d'un lancement : donné d'office pour un format sans prix, sinon celui de Will tel quel. */
export function accordDuFormat<A>(formatId: string | null | undefined, accord: A): A | true {
  return formatSansPrix(formatId) ? true : accord;
}

/** Taille maximale d'une prise envoyée (octets) : 4 Go, sauf format qui en déclare plus (facecam : 15 Go). */
export const TAILLE_MAX_ENVOI = 4 * 1024 * 1024 * 1024;
export function tailleMaxEnvoi(formatIds: (string | null | undefined)[]): number {
  return Math.max(TAILLE_MAX_ENVOI, ...formatIds.map((id) => (id && trouverFormat(id)?.tailleMaxEnvoiOctets) || 0));
}
