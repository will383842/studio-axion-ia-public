/**
 * LOGIQUE PURE de l'écran « Votre vidéo » (lot M3 ; plan PARTIE A §2 et §3, B.9). Importable côté client, testée.
 * Chaque cas du tableau A.3 (« les cas où il faut vous aider ») a ici sa fonction, et son test.
 */
import { decorAVerifier, decorParDefaut } from "@/domaine/decors";
import { postureDe, resoudreVisagesParAngle, tenueDe } from "@/domaine/distribution";
import type { AngleVisage, BlocScript, Distribution, ElementBibliotheque, Montant, Personnage, PostureVisage, StatutPreparation, ValeurDecor, Visage, Voix } from "@/domaine/types";
import { voixPourFormat } from "@/domaine/voix-format";
import { repartitionDepuisReglages } from "@/formats/communs";
import type { PastilleDistribution } from "@/fournisseurs";
import { formaterMontant } from "@/lib/montants";

/* ------------------------------------------------------------------ */
/* Blocs et mode pas à pas                                             */
/* ------------------------------------------------------------------ */

export const BLOCS_EXPRESS = ["script", "plateau", "voix", "style", "cout"] as const;
export type BlocExpress = (typeof BLOCS_EXPRESS)[number];

/** Mode « pas à pas » : les mêmes feuilles, enchaînées avec « Suivant ». Dernier bloc → null (on fabrique). */
export function blocSuivant(bloc: BlocExpress): BlocExpress | null {
  const i = BLOCS_EXPRESS.indexOf(bloc);
  return i >= 0 && i < BLOCS_EXPRESS.length - 1 ? BLOCS_EXPRESS[i + 1] : null;
}

/* ------------------------------------------------------------------ */
/* Script                                                              */
/* ------------------------------------------------------------------ */

/** Le sujet est facultatif : le titre vient de l'accroche (B.9). 80 caractères au plus, sans ponctuation finale. */
export function sujetDepuisScript(blocs: BlocScript[]): string {
  const accroche = blocs.find((b) => b.blocRecette === "accroche") ?? blocs[0];
  const texte = (accroche?.segments.find((s) => s.texte.trim())?.texte ?? blocs.flatMap((b) => b.segments).find((s) => s.texte.trim())?.texte ?? "").trim().replace(/\s+/g, " ");
  if (texte.length <= 80) return texte.replace(/[\s.…:;,]+$/, "");
  const coupe = texte.slice(0, 80);
  return `${coupe.slice(0, Math.max(coupe.lastIndexOf(" "), 40)).replace(/[\s.…:;,]+$/, "")}…`;
}

export function aDuTexte(blocs: BlocScript[]): boolean {
  return blocs.some((b) => b.segments.some((s) => s.texte.trim()));
}

/** « Mes scripts » : ceux du format, triés par note puis par date (B.0 §16). */
export function trierMesScripts<S extends { formatId: string; notes?: { globale: number }; modifieLe: string }>(scripts: S[], formatId: string): S[] {
  return scripts.filter((s) => s.formatId === formatId).sort((a, b) => (b.notes?.globale ?? -1) - (a.notes?.globale ?? -1) || b.modifieLe.localeCompare(a.modifieLe));
}

/* ------------------------------------------------------------------ */
/* Plateau : décor, tenue, posture, angles                            */
/* ------------------------------------------------------------------ */

type VisageVue = Visage & { vignette?: string | null };

/** Un visage utilisable : prêt, ou à vérifier (look généré, signalé, jamais lancé sans accord). */
function utilisable(statut: StatutPreparation): boolean {
  return statut === "pret" || statut === "a_verifier";
}

export interface TenueProposee {
  id: string;
  nom: string;
  vignette: string | null;
  /** Tenue fabriquée depuis une image (elle bouge moins naturellement) ou à vérifier. */
  generee: boolean;
}

/** Tenues du personnage, une par tenue normalisée (B.0 §3). */
export function tenuesDisponibles(visages: VisageVue[]): TenueProposee[] {
  const parTenue = new Map<string, TenueProposee>();
  for (const v of visages) {
    if (!utilisable(v.statut)) continue;
    const id = tenueDe(v);
    if (!id) continue;
    const deja = parTenue.get(id);
    const generee = v.origine === "genere" || v.statut === "a_verifier";
    if (!deja) parTenue.set(id, { id, nom: v.tenue, vignette: v.vignette ?? null, generee });
    else if (!deja.vignette && v.vignette) deja.vignette = v.vignette;
  }
  return [...parTenue.values()];
}

export interface PostureProposee {
  posture: PostureVisage;
  libelle: string;
  /** Filmée dans cette tenue : sinon vignette grisée « à filmer (1 vidéo, 10 min) » et repli proposé. */
  filmee: boolean;
  repli?: PostureVisage;
}

/** Assis / Debout pour une tenue : une posture non filmée est grisée, avec son repli (A.3). */
export function posturesDisponibles(visages: VisageVue[], tenueId: string | undefined): PostureProposee[] {
  const deLaTenue = visages.filter((v) => utilisable(v.statut) && (!tenueId || tenueDe(v) === tenueId));
  const filmee = (p: PostureVisage) => deLaTenue.some((v) => postureDe(v) === p);
  return (["assis", "debout"] as const).map((p) => ({
    posture: p,
    libelle: p === "assis" ? "Assis" : "Debout",
    filmee: filmee(p),
    repli: filmee(p) ? undefined : filmee(p === "assis" ? "debout" : "assis") ? (p === "assis" ? "debout" : "assis") : undefined,
  }));
}

/**
 * Visage principal pour une tenue et une posture : l'angle principal de la recette d'abord, sinon l'autre angle ;
 * jamais inventé. Absent : rien ne correspond (le bloc Plateau passe en orange).
 * Correcteur 4 : changer de tenue ou de posture ne bascule pas sur un autre avatar. Le visage `actuel` est gardé s'il
 * convient ; sinon un visage du même fournisseur (jamais un avatar HeyGen remplacé par un visage d'essai).
 */
export function visagePour(
  visages: VisageVue[],
  tenueId: string | undefined,
  posture: PostureVisage | undefined,
  options: { actuel?: Pick<Visage, "id" | "fournisseur">; anglePrincipal?: AngleVisage } = {},
): VisageVue | undefined {
  const candidats = visages.filter((v) => utilisable(v.statut) && (!tenueId || tenueDe(v) === tenueId) && (!posture || postureDe(v) === posture));
  const prets = candidats.filter((v) => v.statut === "pret");
  const angle = options.anglePrincipal ?? "trois-quarts";
  const { actuel } = options;
  const memeAvatar = (v: VisageVue) => !actuel || v.fournisseur === actuel.fournisseur;
  return (
    prets.find((v) => v.id === actuel?.id) ??
    prets.find((v) => v.angle === angle && memeAvatar(v)) ??
    prets.find((v) => memeAvatar(v)) ??
    prets.find((v) => v.angle === angle) ??
    prets[0] ??
    candidats[0]
  );
}

export interface EtatAngles {
  mode: "deux-angles" | "un-angle";
  /** Petite mention affichée en mode un angle (A.3). */
  mention: string | null;
  visagesParAngle: Partial<Record<AngleVisage, string>>;
}

/** Deux angles seulement si les deux doubles ont la même tenue et la même posture ; sinon recadrage (A.3). */
export function etatAngles(visages: Visage[], principal: Visage | undefined, reglages: Record<string, unknown>, imposes?: Partial<Record<AngleVisage, string>>): EtatAngles {
  if (!principal) return { mode: "un-angle", mention: null, visagesParAngle: {} };
  const r = resoudreVisagesParAngle({ visages, principal, partSecond: repartitionDepuisReglages(reglages).second, imposes });
  const voulu = repartitionDepuisReglages(reglages).second > 0;
  return { mode: r.modeAngles, mention: r.modeAngles === "un-angle" && voulu ? "1 angle · effet 2 caméras par recadrage" : null, visagesParAngle: r.visagesParAngle };
}

/* ------------------------------------------------------------------ */
/* Toute première fois                                                 */
/* ------------------------------------------------------------------ */

export interface CasePremiereFois {
  cle: "voix" | "face" | "trois-quarts";
  libelle: string;
  pret: boolean;
  /** Temps et prix indicatifs (A.3). */
  detail: string;
}

/**
 * Carte à 3 cases (Voix · Double presque de face · Trois-quarts) quand rien n'est encore prêt (A.3).
 * Null dès que la voix et au moins un double sont prêts.
 */
export function premiereFois(visages: Pick<Visage, "angle" | "statut">[], voix: Pick<Voix, "statut">[]): CasePremiereFois[] | null {
  const voixPrete = voix.some((v) => v.statut === "pret");
  const face = visages.some((v) => v.angle === "face" && v.statut === "pret");
  const troisQuarts = visages.some((v) => v.angle === "trois-quarts" && v.statut === "pret");
  if (voixPrete && (face || troisQuarts)) return null;
  return [
    { cle: "voix", libelle: "Voix", pret: voixPrete, detail: voixPrete ? "Prête" : "Relier ma voix HeyGen · 1 min" },
    { cle: "face", libelle: "Double presque de face", pret: face, detail: face ? "Prêt" : "Même séance de tournage · 10 min" },
    { cle: "trois-quarts", libelle: "Trois-quarts", pret: troisQuarts, detail: troisQuarts ? "Prêt" : "Même séance de tournage · 10 min" },
  ];
}

/* ------------------------------------------------------------------ */
/* État des blocs (tableau A.3)                                        */
/* ------------------------------------------------------------------ */

export type TonBloc = "pret" | "orange" | "attente";

export interface EtatBloc {
  ton: TonBloc;
  /** La ligne sous le titre du bloc. */
  ligne: string;
  /** Ce qui est à vérifier (pastille ambre). */
  alerte?: string;
}

export interface EntreeEtats {
  blocs: BlocScript[];
  distribution: Distribution[];
  visages: VisageVue[];
  voix: Voix[];
  decor?: Pick<ElementBibliotheque, "id" | "nom" | "valeur"> | null;
}

/** Le double choisi a disparu (archivé, plus prêt) entre-temps : le bloc passe en orange (A.3, « vous quittez »). */
export function doubleIntrouvable(d: Distribution | undefined, visages: Pick<Visage, "id" | "statut">[]): boolean {
  if (!d?.visageId || d.source !== "double") return false;
  const v = visages.find((x) => x.id === d.visageId);
  return !v || !utilisable(v.statut);
}

export function voixIntrouvable(d: Distribution | undefined, voix: Pick<Voix, "id" | "statut">[]): boolean {
  if (!d?.voixId) return true;
  const v = voix.find((x) => x.id === d.voixId);
  return !v || v.statut !== "pret";
}

export function etatPlateau(e: EntreeEtats): EtatBloc {
  const d = e.distribution[0];
  if (!d?.personnageId) return { ton: "orange", ligne: "Choisissez qui parle" };
  if (doubleIntrouvable(d, e.visages)) return { ton: "orange", ligne: "Votre double n'est plus disponible : choisissez-en un autre" };
  const v = e.visages.find((x) => x.id === d.visageId);
  if (d.source === "double" && !v) return { ton: "orange", ligne: "Choisissez votre double" };
  const decor = e.decor?.valeur.type === "decor" ? (e.decor.valeur as ValeurDecor) : null;
  const parties = [e.decor?.nom, v?.tenue, v ? (postureDe(v) === "debout" ? "Debout" : "Assis") : undefined].filter(Boolean);
  const alerte = decorAVerifier(decor) ? "Décor à vérifier" : v?.statut === "a_verifier" ? "Tenue à vérifier" : undefined;
  return { ton: "pret", ligne: parties.join(" · ") || "Réglé", alerte };
}

export function etatVoix(e: EntreeEtats): EtatBloc {
  const d = e.distribution[0];
  if (voixIntrouvable(d, e.voix)) return { ton: "orange", ligne: "Choisissez une voix" };
  return { ton: "pret", ligne: e.voix.find((v) => v.id === d?.voixId)?.nom ?? "Votre voix" };
}

/* ------------------------------------------------------------------ */
/* Lancement et budget                                                 */
/* ------------------------------------------------------------------ */

/** Ce qui est encore à vérifier par Will : on ne lance pas sans sa confirmation (B.9). */
export function elementsAVerifier(params: { decor?: Pick<ElementBibliotheque, "nom" | "valeur"> | null; visages: Pick<Visage, "id" | "nom" | "statut">[]; visageIds: (string | undefined)[] }): string[] {
  const liste: string[] = [];
  if (params.decor && params.decor.valeur.type === "decor" && decorAVerifier(params.decor.valeur)) liste.push(`Décor « ${params.decor.nom} »`);
  for (const id of new Set(params.visageIds.filter(Boolean))) {
    const v = params.visages.find((x) => x.id === id);
    if (v?.statut === "a_verifier") liste.push(`Double « ${v.nom} »`);
  }
  return liste;
}

export type DecisionLancement =
  | { genre: "direct" }
  | { genre: "confirmer"; raisons: string[] }
  | { genre: "budget"; resteCentimes: number; coutCentimes: number }
  /** TEST-UI-REEL U6 : il manque « qui parle » ou la voix ; on les demande avant (vraie vidéo). */
  | { genre: "completer"; bloc: BlocManquant }
  /** TEST-UI-REEL U6 : vidéo d'essai sans « qui parle » ou sans voix : on dit qu'une vidéo de démonstration les remplace. */
  | { genre: "essai-demonstration"; manques: BlocManquant[] };

export type BlocManquant = "plateau" | "voix";

/** TEST-UI-REEL U6 (CORRECTEUR UI2) : ce qui reste à choisir avant de fabriquer (blocs Plateau et Voix en orange). */
export function manquesAvantFabrication(plateau: Pick<EtatBloc, "ton">, voix: Pick<EtatBloc, "ton">): BlocManquant[] {
  return [plateau.ton === "orange" ? ("plateau" as const) : null, voix.ton === "orange" ? ("voix" as const) : null].filter((b): b is BlocManquant => !!b);
}

/** « qui parle et la voix », « qui parle », « la voix ». */
export function libelleManques(manques: BlocManquant[]): string {
  const mots = manques.map((m) => (m === "plateau" ? "qui parle" : "la voix"));
  return mots.length > 1 ? `${mots.slice(0, -1).join(", ")} et ${mots.at(-1)}` : (mots[0] ?? "");
}

/**
 * TEST-UI-REEL U6 (CORRECTEUR UI2) : texte du bouton « Fabriquer ». Une vidéo d'essai (rien n'est payé) dit « Essai
 * gratuit », jamais un montant en euros qui ferait croire à un paiement ; le vrai prix se lit en petit (`prixEnVrai`).
 */
export function libelleBoutonFabriquer(p: { montant?: Montant | null; dureeFabricationSec?: number; essaiGratuit: boolean }): string {
  if (!p.montant || p.dureeFabricationSec === undefined) return "Fabriquer";
  const duree = libelleDureeCourte(p.dureeFabricationSec);
  if (p.essaiGratuit) return `Fabriquer · Essai gratuit · prête en ~${duree}`;
  return `Fabriquer · ≈ ${formaterMontant(p.montant, { court: true })} · prête en ~${duree}`;
}

/** Petite ligne sous le bouton d'un essai : « En vrai : ≈ 1,03 € » (rien n'est payé maintenant). */
export function prixEnVrai(montant: Montant | null | undefined): string | null {
  if (!montant || montant.centimes <= 0) return null;
  return `En vrai : ≈ ${formaterMontant(montant, { court: true })}`;
}

/** Même écriture que `libelleDuree` des formats (« 24 s », « 2 min 05 »), sans dépendre du registre des formats. */
function libelleDureeCourte(sec: number): string {
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} min ${String(s).padStart(2, "0")}` : `${m} min`;
}

/**
 * « Fabriquer » part directement si le coût est sous le seuil ET que rien n'est à vérifier ; sinon une confirmation.
 * Au-delà du budget du mois : la carte « Version économique · Relever le plafond » (A.3).
 * TEST-UI-REEL U6 : il manque « qui parle » ou la voix → on les demande (vraie vidéo) ; en essai gratuit, on dit qu'une
 * vidéo de démonstration les remplace, et Will choisit (`manquesAcceptes`). Le prix d'une vraie vidéo se confirme toujours.
 */
export function decisionLancement(p: { coutCentimes: number; seuilCentimes: number; resteCentimes: number; aVerifier: string[]; montageReel?: boolean; double?: boolean; manques?: BlocManquant[]; essaiGratuit?: boolean; manquesAcceptes?: boolean; budgetIndicatif?: boolean }): DecisionLancement {
  const manques = p.manques ?? [];
  if (manques.length && !p.essaiGratuit) return { genre: "completer", bloc: manques[0] };
  if (manques.length && !p.manquesAcceptes) return { genre: "essai-demonstration", manques };
  // Mode indicatif : le budget du mois est un repère (bandeau ambre), jamais une carte qui bloque.
  if (!p.budgetIndicatif && p.coutCentimes > p.resteCentimes) return { genre: "budget", resteCentimes: p.resteCentimes, coutCentimes: p.coutCentimes };
  const raisons = [...p.aVerifier];
  if (p.coutCentimes > p.seuilCentimes) raisons.unshift("Plus cher que d'habitude");
  // CORRECTEUR FINAL A (VERIF-E2E-1 n° 6) : une vidéo montée pour de vrai, ou où votre avatar parle, fait toujours
  // confirmer son prix (même règle que le serveur), avec la vraie raison.
  if (p.double) raisons.unshift("Votre avatar parle dans cette vidéo : HeyGen sera payé");
  if (p.montageReel) raisons.unshift("Cette vidéo sera montée pour de vrai : elle sera payée");
  return raisons.length ? { genre: "confirmer", raisons } : { genre: "direct" };
}

/**
 * Relire le script (brique 6) : quand une voix de synthèse dit le texte (`relectureAExiger`), « Fabriquer » ouvre la
 * relecture à CHAQUE vidéo, même sous le seuil (« direct ») ; les raisons de « confirmer » y sont rappelées. Il manque
 * quelque chose, ou le budget est dépassé : pas encore. Vidéo déjà filmée : jamais (lancement comme avant).
 */
export function ouvreLaRelecture(d: DecisionLancement, relectureExigee: boolean): boolean {
  return relectureExigee && (d.genre === "direct" || d.genre === "confirmer");
}

/* ------------------------------------------------------------------ */
/* Valeurs initiales                                                   */
/* ------------------------------------------------------------------ */

/** Décor de départ d'un nouveau brouillon : le choix déjà fait, sinon N1 Halo orange pour l'avocat. */
export function decorInitial(formatId: string, decorChoisi: string | undefined, elements: Pick<ElementBibliotheque, "id" | "archiveLe">[], defautFormat?: string): string | undefined {
  return decorChoisi ?? decorParDefaut(formatId, elements, defautFormat);
}

/**
 * Voix de départ (pour une distribution sans voix) : la voix du FORMAT pour ce personnage, sinon sa voix par défaut,
 * sinon la première prête (`voixPourFormat`, seul point de résolution, 02/10).
 */
export function voixInitiale(voix: Voix[], personnage: Pick<Personnage, "voixParDefautId" | "voixParFormat">, formatId: string): string | undefined {
  return voixPourFormat(voix, personnage, formatId)?.id;
}

/* ------------------------------------------------------------------ */
/* Saisie libre « Décrivez »                                           */
/* ------------------------------------------------------------------ */

/** Texte d'une pastille : « Bureau ✓ », « Costume bleu · à créer (≈ 0,25 €) », « Debout · pas encore filmé → Assis ». */
export function libellePastille(p: PastilleDistribution): string {
  if (p.etat === "trouve") return `${p.libelle} ✓`;
  if (p.etat === "a-creer") return `${p.libelle} · à créer (≈ ${formaterMontant(p.coutEstime, { court: true })})`;
  return `${p.libelle} · pas encore filmé → ${p.repli === "assis" ? "Assis" : "Debout"}`;
}
