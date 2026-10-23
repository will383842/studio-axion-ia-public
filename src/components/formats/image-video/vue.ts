/**
 * VUE DE L'ONGLET « IMAGE → VIDÉO » (lot L16, plan § 8) : ce que les 5 écrans montrent, en libellés clairs, tiré de
 * l'état de la machine (lot L15). PUR : aucun accès au serveur, importable par les composants client et par les tests.
 *
 * Jamais d'identifiant technique à l'écran : chaque valeur interne (type d'image, réseau, offre, scène, partie, étape)
 * passe par un libellé de ce fichier.
 */
import type { CarteImage, NoeudCarte, TypeImage } from "@/domaine/image-video/carte";
import { complexiteDe } from "@/domaine/image-video/complexite";
import type { FicheImage, Partie, Scene } from "@/domaine/image-video/fiche";
import { avecVersionsPrudentes } from "@/domaine/image-video/versions-prudentes";
import { LOT_MAX_IV } from "@/domaine/image-video/lot";
import { PLAFONDS_IV, RESEAUX_IV, RESEAUX_IV_HISTORIQUE, type ReseauIV } from "@/domaine/image-video/plafonds";
import { verdictSurMesureAncienne } from "@/briques/voix-maitre/reference";
import type { Offre } from "@/formats/cas-concret/cas";
import { AXES_VARIETE, type AxeVariete, type RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { EtapeChaineIV, EtatFabricationIV, FormuleATrancherIV, LivraisonReseauIV, PrixIV } from "@/moteurs/montage-image-video/fabrication";
import { COUPE_EN_PLEIN_SON_IV, SUITE_REFUS_WAV_IV } from "@/moteurs/montage-image-video/phrases-assemblage";
import { texteDeFinIV } from "@/moteurs/montage-image-video/texte-fin";
import { etapeDeSecoursIV, peutRelireIV, planDeSecoursIV, voixAcceptableParLaRegleDesFinsIV } from "@/moteurs/montage-image-video/secours";

// ─── Libellés ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Côté minimal d'une image lisible (même seuil que la lecture, lot L5). */
export const COTE_MIN_IMAGE_PX = 800;

export const LIBELLES_TYPE: Readonly<Record<TypeImage, string>> = {
  benefices: "Liste de bénéfices",
  chaine: "Chaîne d'étapes",
  embranchement: "Image à embranchement",
  entonnoir: "Entonnoir",
  "avant-apres": "Avant / après",
  convergence: "Sources qui convergent",
  "tableau-de-bord": "Tableau de bord",
  chronologie: "Chronologie",
};

export const OFFRES_IV: readonly { valeur: Offre; libelle: string }[] = [
  { valeur: "formation", libelle: "Formation" },
  { valeur: "audit", libelle: "Audit" },
  { valeur: "integration", libelle: "Intégration" },
  { valeur: "coaching", libelle: "Coaching" },
];

/** Les quatre réseaux proposés, cochés par défaut, avec leur nom montré. */
export const RESEAUX_ECRAN_IV: readonly { valeur: ReseauIV; libelle: string }[] = RESEAUX_IV.map((r) => ({ valeur: r, libelle: PLAFONDS_IV[r].nom }));

export const nomReseau = (r: ReseauIV): string => PLAFONDS_IV[r]?.nom ?? "Réseau";

export const LIBELLES_PARTIE_IV: Readonly<Record<Partie, string>> = {
  accroche: "Accroche",
  douleur: "Le problème",
  "debut-reponse": "La réponse",
  explication: "L'explication",
  resultat: "Le résultat",
  "phrase-choc": "La phrase-choc",
};

const LIBELLES_SCENE: Readonly<Record<Scene, string>> = {
  accroche: "Texte qui claque",
  chiffre: "Chiffre géant",
  titre: "Titre",
  toile: "Le schéma, bloc par bloc",
  embranchement: "Le fil qui se sépare",
  entonnoir: "Les objets qui tombent",
  nuee: "Les objets cochés un à un",
  "ecran-partage": "Avant / après côte à côte",
  additionneur: "Les minutes qui s'additionnent",
  "carte-benefice": "Carte du bénéfice",
  "micro-objet": "Petit dessin animé",
  "bandeau-chiffres": "Les chiffres-clés",
  recherche: "La recherche qui se tape",
  alerte: "L'alerte qui tombe",
  email: "L'e-mail qui se remplit",
  dossiers: "Les dossiers qui se rangent",
  sources: "Les sources qui convergent",
  "phrase-choc": "Phrase-choc mot à mot",
  ensemble: "Vue d'ensemble",
};

/** « 1,05 € ». */
export const euros = (centimes: number): string => `${(Math.max(0, Math.ceil(centimes)) / 100).toFixed(2).replace(".", ",")} €`;

// ─── Écran 1 · Déposer ───────────────────────────────────────────────────────────────────────────────────────────────

/** Refus clair d'une image trop petite ; `null` : elle convient. */
export function refusDimensions(largeur: number, hauteur: number): string | null {
  if (!(largeur > 0) || !(hauteur > 0)) return "Cette image ne s'ouvre pas. Déposez un fichier PNG, JPEG ou WebP.";
  if (Math.min(largeur, hauteur) >= COTE_MIN_IMAGE_PX) return null;
  return `Image trop petite (${Math.round(largeur)} × ${Math.round(hauteur)} px). Il faut ${COTE_MIN_IMAGE_PX} px de côté au moins.`;
}

/** Types de fichiers acceptés au dépôt. */
export const TYPES_IMAGE_ACCEPTES = "image/png,image/jpeg,image/webp";

/** Poids maximal d'une image déposée (même valeur pour le navigateur et le serveur). */
export const TAILLE_MAX_IMAGE_OCTETS = 25 * 1024 * 1024;
export const PHRASE_IMAGE_TROP_LOURDE = "Cette image dépasse 25 Mo : enregistrez-la plus légère.";

export function refusFichier(f: { type: string; size: number }): string | null {
  if (!TYPES_IMAGE_ACCEPTES.split(",").includes(f.type)) return "Déposez une image PNG, JPEG ou WebP.";
  if (f.size > TAILLE_MAX_IMAGE_OCTETS) return PHRASE_IMAGE_TROP_LOURDE;
  return null;
}

// ─── Écran 2 · Ce que j'ai compris ───────────────────────────────────────────────────────────────────────────────────

export interface BlocCarte {
  id: string;
  numero: number;
  libelle: string;
  detail?: string;
  couleur: NoeudCarte["couleur"];
  /** Chiffres portés par le bloc (texte exact). */
  chiffres: string[];
  /** Les deux lectures ne sont pas d'accord sur ce bloc : surligné. */
  ecart: boolean;
  /** Photo de vraies personnes : jamais reprise (dit à l'écran). */
  photo: boolean;
}

export interface BrancheCarte {
  id: string;
  titre: string;
  majoritaire: boolean;
  blocs: BlocCarte[];
}

export interface VueCarte {
  bandeau: string;
  titre: string;
  phraseChoc: string;
  /** Blocs hors branche, dans l'ordre de lecture. */
  blocs: BlocCarte[];
  branches: BrancheCarte[];
  chiffres: { id: string; brut: string; aDire: boolean; unSeul: boolean }[];
  calculs: { calcul: string; ok: boolean }[];
  formules: { cle: string; texte: string; proposition: string; choix?: "garder" | "reformuler" }[];
  doutes: string[];
}

const SORTES_BRANCHE = new Set(["branche", "avant", "apres", "colonne", "sources", "sorties"]);

/** Ids des nœuds sur lesquels les deux lectures divergent (« noeuds.n03 », « noeuds.n03.libelle »). */
export function noeudsEnEcart(carte: Pick<CarteImage, "lecture">): Set<string> {
  return new Set(carte.lecture.ecarts.filter((e) => e.champ.startsWith("noeuds.")).map((e) => e.champ.split(".")[1]).filter(Boolean));
}

/** Bandeau : « Image à embranchement · vidéo d'environ 55 s ». */
export function bandeauDeLaCarte(carte: CarteImage): string {
  let duree = "";
  try {
    duree = ` · vidéo d'environ ${Math.round(complexiteDe(carte).dureeCibleSec)} s`;
  } catch {
    duree = "";
  }
  return `${LIBELLES_TYPE[carte.types[0]] ?? "Image"}${duree}`;
}

export function vueDeLaCarte(carte: CarteImage, doutes: readonly string[] = []): VueCarte {
  const ecarts = noeudsEnEcart(carte);
  const tries = [...carte.noeuds].sort((a, b) => a.ordre - b.ordre || a.id.localeCompare(b.id));
  const chiffresDe = (id: string) => carte.chiffres.filter((c) => c.dansNoeud === id).map((c) => c.brut);
  const bloc = (n: NoeudCarte, i: number): BlocCarte => ({
    id: n.id,
    numero: i + 1,
    libelle: n.libelle,
    ...(n.detail ? { detail: n.detail } : {}),
    couleur: n.couleur,
    chiffres: [...new Set(chiffresDe(n.id))],
    ecart: ecarts.has(n.id),
    photo: !!n.photoPersonnes,
  });
  const numerotes = tries.map(bloc);
  const parId = new Map(numerotes.map((b) => [b.id, b]));
  const groupes = carte.groupes.filter((g) => SORTES_BRANCHE.has(g.sorte));
  const dansBranche = new Set(groupes.flatMap((g) => g.noeuds));
  const branches = groupes.map((g, i) => ({
    id: g.id,
    titre: g.titre ?? `${g.sorte === "avant" ? "Avant" : g.sorte === "apres" ? "Après" : "Branche"} ${g.sorte === "avant" || g.sorte === "apres" ? "" : i + 1}`.trim(),
    majoritaire: !!g.majoritaire,
    blocs: g.noeuds.map((id) => parId.get(id)).filter((b): b is BlocCarte => !!b),
  }));
  return {
    bandeau: bandeauDeLaCarte(carte),
    titre: carte.titre,
    phraseChoc: carte.phraseChocValidee ?? carte.phraseChoc,
    blocs: numerotes.filter((b) => !dansBranche.has(b.id)),
    branches,
    chiffres: carte.chiffres.map((c) => ({ id: c.id, brut: c.brut, aDire: c.aDire, unSeul: c.lu === "une-seule" })),
    calculs: carte.coherence.map((c) => ({ calcul: c.calcul, ok: c.ok })),
    formules: carte.formulesAbsolues.map((f) => ({ cle: `${f.ou}|${f.texte}`, texte: f.texte, proposition: f.proposition, ...(f.choixWill ? { choix: f.choixWill } : {}) })),
    doutes: [...doutes],
  };
}

/** Corrections de Will sur la carte (rien d'autre n'est envoyé). */
export interface CorrectionsCarte {
  libelles: Record<string, string>;
  /** Chiffres passés en « affiché seulement » (aDire = false) ou remis à dire. */
  aDire: Record<string, boolean>;
  /** Choix sur les formules absolues, par clé « où|texte ». */
  formules: Record<string, "garder" | "reformuler">;
}

export const AUCUNE_CORRECTION: CorrectionsCarte = { libelles: {}, aDire: {}, formules: {} };

export function carteACorriger(c: CorrectionsCarte): boolean {
  return Object.keys(c.libelles).length + Object.keys(c.aDire).length + Object.keys(c.formules).length > 0;
}

/** La carte corrigée par Will ; `undefined` : aucune correction (la carte proposée est validée telle quelle). */
export function carteCorrigeeParWill(carte: CarteImage, c: CorrectionsCarte): CarteImage | undefined {
  if (!carteACorriger(c)) return undefined;
  const libelles = Object.fromEntries(Object.entries(c.libelles).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
  return {
    ...carte,
    noeuds: carte.noeuds.map((n) => (libelles[n.id] !== undefined && libelles[n.id] !== n.libelle ? { ...n, libelle: libelles[n.id], ajoutWill: true } : n)),
    chiffres: carte.chiffres.map((x) => (c.aDire[x.id] !== undefined ? { ...x, aDire: c.aDire[x.id] } : x)),
    formulesAbsolues: carte.formulesAbsolues.map((f) => (c.formules[`${f.ou}|${f.texte}`] ? { ...f, choixWill: c.formules[`${f.ou}|${f.texte}`] } : f)),
  };
}

// ─── Écran 3 · Le script ─────────────────────────────────────────────────────────────────────────────────────────────

export interface LigneScript {
  id: string;
  rang: number;
  partie: string;
  texteDit: string;
  ecrits: string[];
  anime: string;
  /** Une formule trop affirmative est dans cet écran. */
  aTrancher: boolean;
}

export function lignesDuScript(fiche: FicheImage, formules: readonly FormuleATrancherIV[] = []): LigneScript[] {
  const surlignes = new Set(formules.map((f) => f.ecranId));
  return fiche.ecrans.map((e, i) => ({
    id: e.id,
    rang: i + 1,
    partie: LIBELLES_PARTIE_IV[e.partie] ?? "Écran",
    texteDit: e.texteDit,
    ecrits: [...e.textesEcran],
    anime: LIBELLES_SCENE[e.scene] ?? "Animation",
    aTrancher: surlignes.has(e.id),
  }));
}

/** Morceaux d'un texte d'écran : le mot entre deux * en orange. */
export function morceauxEcrit(t: string): { texte: string; orange: boolean }[] {
  return t.split(/(\*[^*]+\*)/).filter(Boolean).map((m) => (m.startsWith("*") && m.endsWith("*") && m.length > 2 ? { texte: m.slice(1, -1), orange: true } : { texte: m, orange: false }));
}

/** Ce que Will a changé dans le script (rien d'autre n'est envoyé). */
export interface ModificationsScript {
  /** Texte dit et textes affichés, par écran. */
  ecrans: Record<string, { texteDit?: string; ecrits?: string[] }>;
  question?: string;
  /** Vrai : la seconde accroche passe en premier (son texte remplace celui du premier écran). */
  autreAccroche?: boolean;
  /** Choix sur les formules trop affirmatives, par clé. */
  formules: Record<string, "garder" | "reformuler">;
}

export const AUCUNE_MODIFICATION: ModificationsScript = { ecrans: {}, formules: {} };

/**
 * Le script tel que Will le valide : modifications en place, accroche choisie, question. Rend `fiche` absent si rien
 * n'a changé (le script proposé est validé tel quel) et les choix sur les formules. Une « version prudente » est posée
 * dans chaque texte où la formule est écrite (même repérage que les contrôles) ; le serveur refait le même geste (sans effet).
 */
export function scriptValideParWill(fiche: FicheImage, formules: readonly FormuleATrancherIV[], m: ModificationsScript): { fiche?: FicheImage; choixFormules: Record<string, "garder" | "reformuler">; ajoutsWill: string[] } {
  const f: FicheImage = structuredClone(fiche);
  let change = false;
  const ajouts: string[] = [];
  if (m.autreAccroche) {
    const [a, b] = f.accroches;
    const premier = f.ecrans.findIndex((e) => e.partie === "accroche");
    if (premier >= 0) f.ecrans[premier] = { ...f.ecrans[premier], texteDit: b.texteDit, textesEcran: [...b.textesEcran] };
    f.accroches = [b, a];
    change = true;
  }
  for (const [id, x] of Object.entries(m.ecrans)) {
    const i = f.ecrans.findIndex((e) => e.id === id);
    if (i < 0) continue;
    const e = f.ecrans[i];
    const texteDit = x.texteDit !== undefined && x.texteDit.trim() && x.texteDit.trim() !== e.texteDit ? x.texteDit.trim() : e.texteDit;
    const textesEcran = x.ecrits ? e.textesEcran.map((t, k) => (x.ecrits![k] !== undefined && x.ecrits![k].trim() ? x.ecrits![k].trim() : t)) : e.textesEcran;
    if (texteDit !== e.texteDit || textesEcran.some((t, k) => t !== e.textesEcran[k])) {
      change = true;
      if (texteDit !== e.texteDit) ajouts.push(texteDit);
      ajouts.push(...textesEcran.filter((t, k) => t !== e.textesEcran[k]));
      f.ecrans[i] = { ...e, texteDit, textesEcran };
    }
  }
  if (m.question !== undefined && m.question.trim() && m.question.trim() !== f.questionCommentaire.texteDit) {
    f.questionCommentaire = { texteDit: m.question.trim(), texteEcran: m.question.trim().slice(0, 80) };
    change = true;
  }
  const choixFormules: Record<string, "garder" | "reformuler"> = {};
  for (const formule of formules) if (m.formules[formule.cle]) choixFormules[formule.cle] = m.formules[formule.cle];
  // La version prudente est posée ICI aussi (fonction pure) : l'écran et les contrôles voient le vrai texte.
  const prudente = avecVersionsPrudentes(f, choixFormules);
  return { ...(change || prudente ? { fiche: prudente ?? f } : {}), choixFormules, ajoutsWill: [...new Set(ajouts)] };
}

/** Formules encore à trancher : le bouton « Valider » attend que chacune ait un choix. */
export const formulesNonTranchees = (formules: readonly FormuleATrancherIV[], m: Pick<ModificationsScript, "formules">) => formules.filter((f) => !m.formules[f.cle]);

/** « environ 1,05 €, au plus 2,20 € ». */
export function phrasePrix(p: Pick<PrixIV, "habituelCentimes" | "auPlusCentimes">): string {
  return p.auPlusCentimes > p.habituelCentimes ? `environ ${euros(p.habituelCentimes)}, au plus ${euros(p.auPlusCentimes)}` : `environ ${euros(p.habituelCentimes)}`;
}

// ─── Écran 4 · Fabrication ───────────────────────────────────────────────────────────────────────────────────────────

export type EtatPas = "fait" | "en-cours" | "a-venir" | "arrete";

export interface PasFabrication {
  cle: EtapeChaineIV;
  nom: string;
  etat: EtatPas;
}

const NOMS_PAS: Readonly<Record<EtapeChaineIV, string>> = {
  lecture: "Lecture de l'image",
  "carte-a-valider": "Votre carte",
  ecriture: "Écriture du script",
  "script-a-valider": "Votre script",
  voix: "La voix",
  "mise-en-scene": "La mise en scène",
  rendu: "Le rendu",
  controles: "Les vérifications",
  livraison: "Les versions par réseau",
};

const ORDRE_PAS: readonly EtapeChaineIV[] = ["lecture", "carte-a-valider", "ecriture", "script-a-valider", "voix", "mise-en-scene", "rendu", "controles", "livraison"];

export interface VueFabrication {
  pas: PasFabrication[];
  /** Déjà engagé (pire coût réservé), plafond de la vidéo. */
  engageCentimes: number;
  plafondCentimes: number;
  /** Voix réellement payée. */
  payeCentimes: number;
  /** Un fournisseur travaille (rendu en cours) : la suite reprend seule. */
  attente: boolean;
  refus?: { phrase: string; details: string[]; reessayable: boolean };
}

/** Dite à côté du bouton « Refaire » d'un refus de mise en scène (déterministe : même entrée, même refus). */
export const PHRASE_REFAIRE_MISE_EN_SCENE_IV = "« Refaire » n'a d'effet qu'après une correction du moteur : la mise en scène donne le même résultat tant que rien n'a changé (gratuit, aucune voix repayée).";

/**
 * 15/10 (v-dd3049053f88) : un arrêt de la voix (Q16) dont une prise payée a une mesure de ressemblance d'une version
 * antérieure se « Refait » : la reprise RE-MESURE (gratuit), elle ne relit pas la voix. Une fin hors référence qui a sa fin
 * de secours (15/10, `secours.ts`) se « Refait » aussi : la reprise lit seulement la fin de secours. Un arrêt Q17 de
 * l'assemblage (son brut MP3 pas lisible en WAV) après une voix FINIE se « Refait » : la reprise convertit le son et
 * assemble, sans lecture ni réservation de voix (y compris un arrêt gardé avant le 15/10, marqué non réessayable). PUR.
 */
export function refusReessayableIV(etat: Pick<EtatFabricationIV, "refus" | "voix"> & Partial<Pick<EtatFabricationIV, "plan" | "script" | "rendus">>): boolean {
  const r = etat.refus;
  if (!r) return false;
  if (r.reessayable) return true;
  if (planDeSecoursIV(etat)) return true;
  if (r.code === "IV_VOIX" && etat.voix?.issue?.statut === "faite" && r.message.includes(SUITE_REFUS_WAV_IV)) return true;
  // 15/10 (v-dd3049053f88) : voix faite, assemblage arrêté pour une coupe « en plein son » (seuil fixe −45 dB sur une voix
  // à bruit de fond) : « Refaire » reprend l'assemblage avec la mesure adaptée, sans lecture ni réservation de voix.
  if (r.code === "IV_VOIX" && r.etape === "voix" && etat.voix?.issue?.statut === "faite" && r.message.includes(COUPE_EN_PLEIN_SON_IV)) return true;
  // 18/10 (v-dcc902c3f3dd) : arrêt Q16 d'une fin TikTok à +12 % de la v4 mais à +7 % du corps : la hauteur d'une fin se juge
  // maintenant par rapport au corps ; « Refaire » refait le verdict sur le son déjà payé, sans lecture.
  if (r.code === "IV_VOIX" && r.etape === "voix" && voixAcceptableParLaRegleDesFinsIV(etat.voix)) return true;
  // 18/10 : refus des vérifications (IV_CONTROLES) ou de la mise en scène (IV_MISE_EN_SCENE) alors que le script et la voix
  // sont FAITS : « Refaire » reprend à la mise en scène (`reprendreIV`), script, voix et transcriptions gardés, rien de la
  // voix repayé. Le contrôle gratuit qui échoue bloque avant toute relecture payante (`porte.ts`), et seules les relectures
  // d'images dont le fichier ou les instants ont changé sont payées de nouveau.
  // Un contrôle refusé : chaque rendu doit avoir son empreinte, sinon sa relecture payée n'est jamais gardée (clé nulle) et
  // chaque « Refaire » la repaierait.
  const rendus = Object.values(etat.rendus ?? {});
  const controlesReprenables = r.etape === "controles" && r.code === "IV_CONTROLES" && rendus.length > 0 && rendus.every((x) => !!x.empreinte);
  // La mise en scène est déterministe : « Refaire » n'a d'effet qu'après une correction du moteur (gratuit sinon).
  const miseEnSceneReprenable = r.etape === "mise-en-scene" && r.code === "IV_MISE_EN_SCENE";
  if ((controlesReprenables || miseEnSceneReprenable) && !!etat.script && etat.voix?.issue?.statut === "faite") return true;
  const v = etat.voix?.voix;
  return r.code === "IV_VOIX" && !!v && [v.corps.prise, ...v.fins.map((f) => f.prise)].some((p) => p?.etat.phase === "faite" && verdictSurMesureAncienne(p.etat.audio));
}

/** Ce que « Refaire cette partie » fera quand une étape de secours est proposée (une phrase), sinon rien. PUR. */
function detailsSecours(etat: Pick<EtatFabricationIV, "refus" | "voix"> & Partial<Pick<EtatFabricationIV, "plan">>): string[] {
  const s = planDeSecoursIV(etat);
  if (!s) return [];
  if (!s.lecture) return [`${s.replis.join(" ")} « Refaire cette partie » reprend ce son déjà payé et validé : aucune lecture.`];
  const details: string[] = [];
  if (s.phrases.length) {
    // Après cette fin de secours, l'étape qui suivrait un refus (repli sans lecture), annoncée d'avance.
    const apres = s.plan.fins.flatMap((f) => (f.secours ? [etapeDeSecoursIV(s.plan, f.id)] : [])).find((x) => x && !x.lecture);
    // 19/10 : sans repli (Instagram, Shorts), la dernière carte est une relecture de la seule fin.
    const relues = etat.voix?.relues ?? [];
    const relirePossible = s.plan.fins.some((f) => f.secours && !etapeDeSecoursIV(s.plan, f.id) && peutRelireIV(s.plan, f.id) && !relues.includes(texteDeFinIV(f)));
    const plusieurs = s.phrases.length > 1;
    details.push(
      `Fin de secours validée par Will pour ${s.reseaux.join(", ")} : « ${s.phrases.join(" ")} ». « Refaire cette partie » lit seulement ${plusieurs ? `ces fins (${s.phrases.length} lectures payées)` : "cette fin (une lecture payée)"} ; le corps et les autres fins déjà payés sont gardés.${apres ? ` Si elle ne ressemble pas non plus à la référence ou hésite, ${apres.fin.reseaux.map(nomReseau).join(", ")} reprend la version ${nomReseau(apres.fin.repli!)}, sans autre lecture.` : ""}${!apres && relirePossible ? " Si elle ne ressemble pas non plus à la référence, « Refaire cette partie » pourra la relire une dernière fois (une lecture payée)." : ""}`,
    );
  }
  if (s.relire.length) {
    const n = s.nbLectures;
    details.push(
      `Relecture de la seule fin pour ${s.reseauxRelire.join(", ")} : « Refaire cette partie » la relit à l'identique (${n} lecture${n > 1 ? "s" : ""} payée${n > 1 ? "s" : ""} au plus${n > 1 ? " avec les fins de secours déjà prévues" : ""}, environ ${euros(s.coutMaxCentimes)}) ; le corps et les autres fins déjà payés sont gardés. Si elle ne ressemble toujours pas à la référence, la vidéo s'arrête pour de bon.`,
    );
  }
  for (const r of s.replis) details.push(`${r} Aucune lecture : le son déjà payé et validé est repris.`);
  return details;
}

export function vueFabrication(etat: Pick<EtatFabricationIV, "etape" | "caisse" | "refus" | "attente" | "voix"> & Partial<Pick<EtatFabricationIV, "plan">>): VueFabrication {
  const courante = etat.etape === "prete" ? ORDRE_PAS.length : etat.etape === "refusee" ? ORDRE_PAS.indexOf(etat.refus?.etape ?? "lecture") : ORDRE_PAS.indexOf(etat.etape);
  const pas = ORDRE_PAS.map((cle, i): PasFabrication => ({
    cle,
    nom: NOMS_PAS[cle],
    etat: i < courante ? "fait" : i === courante ? (etat.etape === "refusee" ? "arrete" : "en-cours") : "a-venir",
  }));
  return {
    pas,
    engageCentimes: etat.caisse.reservations.reduce((s, r) => s + r.centimes, 0),
    plafondCentimes: etat.caisse.plafondCentimes,
    payeCentimes: (etat.voix?.voix.payees ?? []).reduce((s, p) => s + p.coutCentimes, 0),
    attente: !!etat.attente,
    ...(etat.etape === "refusee" && etat.refus ? { refus: { phrase: etat.refus.message, details: [...detailsSecours(etat), ...(etat.refus.etape === "mise-en-scene" && refusReessayableIV(etat) ? [PHRASE_REFAIRE_MISE_EN_SCENE_IV] : []), ...(etat.refus.phrases ?? [])].slice(0, 6), reessayable: refusReessayableIV(etat) } } : {}),
  };
}

// ─── Écran 3 · La recette de variété (lot F) ─────────────────────────────────────────────────────────────────────────

/** Nom de chaque axe à l'écran. */
const NOMS_AXES: Readonly<Record<AxeVariete, string>> = {
  ouverture: "Ouverture",
  recit: "Déroulé",
  chiffres: "Chiffres",
  camera: "Caméra",
  texte: "Écrans de texte",
  apparition: "Apparition du schéma",
  transitions: "Transitions",
  fin: "Fin",
  matiere: "Matière",
  sousTitres: "Sous-titres",
};

/** Libellé de chaque variante (doc 72) : jamais le code à l'écran. */
export const LIBELLES_VARIANTES: Readonly<Record<string, string>> = {
  "OUV-A": "Le résultat d'abord",
  "OUV-B": "Avant / après d'un coup",
  "OUV-C": "Une situation précise",
  "OUV-D": "La question à l'écran",
  "OUV-E": "Un détail, puis le recul",
  "REC-A": "Dans l'ordre",
  "REC-B": "Le résultat, puis « comment »",
  "REC-C": "Le parcours d'un cas",
  "REC-D": "En trois étapes annoncées",
  "CHI-A": "Compteur",
  "CHI-B": "Jauge",
  "CHI-C": "Duel de tailles",
  "CHI-D": "Chiffre géant",
  "CHI-E": "En objets",
  "CAM-A": "Suivi",
  "CAM-B": "Vue d'ensemble d'abord",
  "CAM-C": "Le voyage du message",
  "CAM-D": "Plan fixe",
  "CAM-E": "Branche par branche",
  "TYP-A": "Mot par mot",
  "TYP-B": "Un mot géant à la fois",
  "TYP-C": "Lignes qui glissent",
  "TYP-D": "Le mot devient l'objet",
  "APP-A": "Surgit avec rebond",
  "APP-B": "Tracé au feutre",
  "APP-C": "Fantôme qui s'allume",
  "APP-D": "Cartes qui tombent",
  "TRA-A": "Coupe franche",
  "TRA-B": "Raccord d'objet",
  "TRA-C": "Balayage orange",
  "TRA-D": "On entre dedans",
  "TRA-E": "Poussée",
  "FIN-A": "Phrase-choc seule",
  "FIN-B": "Tout le schéma, puis la phrase",
  "FIN-C": "Boucle",
  "FIN-D": "Le chiffre qui reste",
  "MAT-A": "Net et plat",
  "MAT-B": "Papier",
  "MAT-C": "Trait fait main",
  "MAT-D": "Profondeur douce",
  "SOU-A": "Calmes",
  "SOU-B": "Équilibrés",
  "SOU-C": "Appuyés",
};
export const libelleVariante = (code: string): string => LIBELLES_VARIANTES[code] ?? "Variante";

export interface LigneVarieteIV {
  axe: AxeVariete;
  nom: string;
  /** Code choisi (valeur du choix, jamais montrée) et son libellé. */
  code: string;
  libelle: string;
  /** Autres choix possibles sur cette image (vide : un seul possible). */
  choix: { code: string; libelle: string }[];
  /** Faux : le déroulé, déjà dans le script (il ne change plus après l'écriture). */
  modifiable: boolean;
}

/** La recette de la vidéo, axe par axe (PUR) : `possibles` = les variantes que l'image permet (moteur). */
export function lignesVarieteIV(recette: RecetteVarieteIV, possibles: Readonly<Record<AxeVariete, readonly string[]>>, changes: Partial<RecetteVarieteIV> = {}): LigneVarieteIV[] {
  return AXES_VARIETE.map((axe) => {
    const code = changes[axe] ?? recette[axe];
    const modifiable = axe !== "recit";
    const codes = modifiable ? [...new Set([recette[axe], ...possibles[axe]])] : [recette[axe]];
    return { axe, nom: NOMS_AXES[axe], code, libelle: libelleVariante(code), choix: codes.length > 1 ? codes.map((c) => ({ code: c, libelle: libelleVariante(c) })) : [], modifiable };
  });
}

/** Changements de Will à envoyer avec le script (seulement ce qui diffère de la recette tirée). PUR. */
export function changementsVarieteIV(recette: RecetteVarieteIV, changes: Partial<RecetteVarieteIV>): Partial<RecetteVarieteIV> | undefined {
  const d = Object.fromEntries(AXES_VARIETE.filter((a) => a !== "recit" && changes[a] !== undefined && changes[a] !== recette[a]).map((a) => [a, changes[a]]));
  return Object.keys(d).length ? (d as Partial<RecetteVarieteIV>) : undefined;
}

// ─── Écran 5 · Vos vidéos ────────────────────────────────────────────────────────────────────────────────────────────

export interface CarteReseauIV {
  reseau: ReseauIV;
  nom: string;
  ton: "vert" | "orange" | "rouge";
  /** Verdict en une phrase. */
  phrase: string;
  duree?: string;
  fichierCle?: string;
  /** Format du fichier principal (absent : 9:16 ; 4:5 pour le fil Facebook et les anciennes vidéos LinkedIn). */
  format?: "4:5";
  /** Facebook : la vidéo du fil en 4:5, son texte et l'endroit du lien (en plus du Reel 9:16). */
  fil?: { fichierCle: string; duree?: string; texte?: string; consigneLien?: string };
  texte?: string;
  premierCommentaire?: string;
  titre?: string;
  consigneLien?: string;
  lien?: string;
}

export function cartesReseaux(livraison: readonly LivraisonReseauIV[]): CarteReseauIV[] {
  const ordre = (r: ReseauIV) => RESEAUX_IV_HISTORIQUE.indexOf(r);
  return [...livraison]
    .sort((a, b) => ordre(a.reseau) - ordre(b.reseau))
    .map((l) => {
      const nom = nomReseau(l.reseau);
      const base = { reseau: l.reseau, nom, ...(l.dureeSec ? { duree: `${Math.round(l.dureeSec)} s` } : {}) };
      if (l.version === "aucune") return { ...base, ton: "rouge" as const, phrase: l.mention ?? `Pas de version pour ${nom}.` };
      const phrase = l.version === "courte" ? "Version courte, prête à publier." : l.mention ? `Prête, ${l.mention.replace(/[.\s]+$/, "")}.` : "Prête à publier.";
      return {
        ...base,
        ton: l.version === "courte" || l.mention ? ("orange" as const) : ("vert" as const),
        phrase,
        ...(l.fichierCle ? { fichierCle: l.fichierCle } : {}),
        ...(l.format === "4:5" ? { format: "4:5" as const } : {}),
        ...(l.fichierCleFil ? { fil: { fichierCle: l.fichierCleFil, ...(l.dureeSecFil ? { duree: `${Math.round(l.dureeSecFil)} s` } : {}), ...(l.texteFil ? { texte: l.texteFil } : {}), ...(l.consigneLienFil ? { consigneLien: l.consigneLienFil } : {}) } } : {}),
        ...(l.texte ? { texte: l.texte } : {}),
        ...(l.premierCommentaire ? { premierCommentaire: l.premierCommentaire } : {}),
        ...(l.titre ? { titre: l.titre } : {}),
        ...(l.consigneLien ? { consigneLien: l.consigneLien } : {}),
        ...(l.lien ? { lien: l.lien } : {}),
      };
    });
}

// ─── Aiguillage ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type EcranIV = "carte" | "script" | "fabrication" | "videos";

/** L'écran à montrer pour un état de la machine. */
export function ecranDe(etat: Pick<EtatFabricationIV, "etape" | "propositionCarte" | "propositionScript">): EcranIV {
  if (etat.etape === "carte-a-valider" && etat.propositionCarte) return "carte";
  if (etat.etape === "script-a-valider" && etat.propositionScript) return "script";
  if (etat.etape === "prete") return "videos";
  return "fabrication";
}

/** L'étape allumée dans la barre : la lecture mène à la carte, l'écriture au script (même pendant le travail). */
export function barreDe(etat: Pick<EtatFabricationIV, "etape" | "refus">): EcranIV {
  const etape = etat.etape === "refusee" ? (etat.refus?.etape ?? "lecture") : etat.etape;
  if (etape === "prete") return "videos";
  if (etape === "lecture" || etape === "carte-a-valider") return "carte";
  if (etape === "ecriture" || etape === "script-a-valider") return "script";
  return "fabrication";
}

export const ETAPES_ECRANS: readonly { ecran: EcranIV | "depot"; nom: string }[] = [
  { ecran: "depot", nom: "L'image" },
  { ecran: "carte", nom: "Ce que j'ai compris" },
  { ecran: "script", nom: "Le script" },
  { ecran: "fabrication", nom: "Fabrication" },
  { ecran: "videos", nom: "Vos vidéos" },
];

// ─── Lot d'images ────────────────────────────────────────────────────────────────────────────────────────────────────

export const PHRASE_LOT_TROP_GRAND = `${LOT_MAX_IV} images au plus par lot.`;

/** Les images gardées d'un dépôt multiple : `LOT_MAX_IV` au plus, la phrase est dite si des images sont écartées. PUR. */
export function garderLeLot<T>(fichiers: readonly T[]): { gardes: T[]; phrase?: string } {
  return fichiers.length > LOT_MAX_IV ? { gardes: fichiers.slice(0, LOT_MAX_IV), phrase: PHRASE_LOT_TROP_GRAND } : { gardes: [...fichiers] };
}

/** Texte du bouton du lot : le nombre de vidéos et le prix total « au plus ». */
export const libelleBoutonLot = (n: number, parVideoCentimes: number): string => `Fabriquer les ${n} vidéos · au plus ${euros(n * parVideoCentimes)}`;

/** La phrase unique sous le bouton du lot. */
export const messageDuLot = (n: number): string => `Au plus ce prix pour les ${n} vidéos. Aucun arrêt : une vidéo douteuse est mise de côté sans payer sa voix.`;
