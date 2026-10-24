/**
 * ÉTAPES DU MOTEUR « CAS CONCRET » (tâche M8, plan cas concret § 5) : le graphe déclaré au moteur, avec les libellés du
 * plan, la lecture des entrées de la vidéo (`entrees.casConcret`) et les pièces PURES que les étapes de la chaîne
 * (`fabriquer.ts`) assemblent :
 *
 *   ecriture  « L'écriture »        n° 1 — sautée quand une fiche est fournie (`entrees.casConcret.ficheCle`)
 *   fiche     « La relecture »      n° 2 — schéma et règles R02 à R22, plan des fins
 *   captures  « Les vrais écrans »  n° 3
 *   voix      « La voix »           n° 4 — corps, puis une prise par fin, puis l'assemblage de chaque fin
 *   calage    « Le calage »         n° 5
 *   ecrans    « Les écrans »        n° 6 — un fichier par écran, clé par empreinte
 *   montage   « Les finitions »     n° 7 — une composition `complet` par fin
 *   controle  « La vérification »   n° 8 — toujours refaite
 *
 * Pièces pures : fins regroupées par contenu, texte dit reporté après une reformulation, écrans de la fiche mis à la forme
 * de la brique `ecrans-motion`. N'importe AUCUN autre moteur.
 */
import type { CaptureEcran, ContenuEcran, EcranCale, EvenementCale as EvenementBrique, VisuelCale } from "@/briques/ecrans-motion";
import type { CommandeFabrication } from "@/domaine/types";
import { nombreEnLettres } from "@/domaine/prononciations";
import type { ReseauCas } from "@/formats/cas-concret";
import type { FaitCas } from "@/formats/cas-concret/cas";
import type { EvenementCale } from "./calage";
import { cleMot, motsDe, motsLus, type Ecran, type EcranCorps, type FicheEcrans, type FinPlanifiee, type Origine, type PlanDesFins } from "./fiche";
import { ETAPES_CAS_CONCRET, type EtapeCasConcret } from "./outils";

/* Contrat commun des moteurs (TYPES seulement) : lu par `import()` de type, comme le patron. */
type DefinitionEtapeMoteur = import("@/moteurs/types").DefinitionEtapeMoteur;

/* ------------------------------------------------------------------ */
/* Entrées de la vidéo                                                   */
/* ------------------------------------------------------------------ */

/** Clé des entrées de la vidéo (et donc de la commande) propres au format. */
export const ENTREE_CAS_CONCRET = "casConcret";

const RESEAUX: readonly ReseauCas[] = ["facebook", "instagram", "tiktok", "linkedin"];

/** `Video.entrees.casConcret` (plan § 5, « Données gardées »), plus la fiche fournie qui fait sauter l'écriture. */
export interface EntreesCasConcret {
  casId?: string;
  empreinteCas?: string;
  porte: Origine;
  mot?: string;
  motDit?: string;
  avecMot: boolean;
  /** Réseaux où le mot est branché, posés au lancement (X6) : le mot n'est dit que là. Absent : nulle part. */
  motSur: ReseauCas[];
  reseaux: ReseauCas[];
  essai: boolean;
  codeSuivi?: string;
  /**
   * LOT F · « Nouveau script (autre structure) » : numéro du script validé que cette vidéo NE rejoue PAS (1 : celui du
   * catalogue ou d'avant l'historique). Claude écrit un script neuf (une écriture), la vidéo s'arrête à « Script à valider ».
   * Dès que Will valide un script plus récent que ce numéro, c'est lui qui est rejoué (aucune écriture de plus).
   */
  nouveauScript?: number;
  /**
   * PRIX EXACT · le script validé RELU par Will, figé dans la vidéo au lancement (porte A seulement, objet brut relu par
   * `lireScriptValide`). L'estimation (feuille, lancement, moteur) compte alors SON texte et aucune ligne « Écriture », et la
   * fabrication le rejoue, jamais une réécriture non réservée. Absent (anciennes commandes) : le prix est celui d'avant.
   */
  scriptFige?: unknown;
  /** Fiche d'écrans déjà écrite (stockage) : l'écriture est sautée. */
  ficheCle?: string;
  /** P2S · porte B : le cas construit depuis la description (brut, validé par `casDesEntrees`), jamais au catalogue. */
  cas?: unknown;
  /** P2S · porte B : le texte libre de Will dont le cas vient (la garde d'honnêteté est rejouée avant le prix). */
  description?: string;
  /** P2S · porte B : les faits « à confirmer » que Will a confirmés. */
  faitsConfirmes?: string[];
}

const texteNonVide = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** Lecture tolérante de `entrees.casConcret` (au moindre doute : la valeur par défaut). */
export function lireEntreesCasConcret(entrees: CommandeFabrication["entrees"] | undefined): EntreesCasConcret {
  const brut = (entrees as Record<string, unknown> | undefined)?.[ENTREE_CAS_CONCRET];
  const b = brut && typeof brut === "object" ? (brut as Record<string, unknown>) : {};
  const porte: Origine = b.porte === "porte-b" || b.porte === "b" ? "porte-b" : "porte-a";
  const reseaux = Array.isArray(b.reseaux) ? [...new Set(b.reseaux.filter((r): r is ReseauCas => RESEAUX.includes(r as ReseauCas)))] : [];
  return {
    ...(texteNonVide(b.casId) ? { casId: b.casId.trim() } : {}),
    ...(texteNonVide(b.empreinteCas) ? { empreinteCas: b.empreinteCas } : {}),
    porte,
    ...(texteNonVide(b.mot) ? { mot: b.mot.trim() } : {}),
    ...(texteNonVide(b.motDit) ? { motDit: b.motDit.trim() } : {}),
    // Sans action de Will, la fin « diagnostic » (X4, X6) : le mot n'est dit que s'il est demandé et branché.
    avecMot: b.avecMot === true,
    motSur: Array.isArray(b.motSur) ? [...new Set(b.motSur.filter((r): r is ReseauCas => reseaux.includes(r as ReseauCas)))] : [],
    reseaux,
    essai: b.essai === true,
    ...(texteNonVide(b.codeSuivi) ? { codeSuivi: b.codeSuivi.trim() } : {}),
    ...(texteNonVide(b.ficheCle) ? { ficheCle: b.ficheCle } : {}),
    ...(typeof b.nouveauScript === "number" && Number.isInteger(b.nouveauScript) && b.nouveauScript >= 1 ? { nouveauScript: b.nouveauScript } : {}),
    ...(porte === "porte-a" && b.scriptFige && typeof b.scriptFige === "object" && !Array.isArray(b.scriptFige) ? { scriptFige: b.scriptFige } : {}),
    ...(porte === "porte-b" && b.cas && typeof b.cas === "object" ? { cas: b.cas } : {}),
    ...(porte === "porte-b" && texteNonVide(b.description) ? { description: b.description } : {}),
    ...(porte === "porte-b" && Array.isArray(b.faitsConfirmes) ? { faitsConfirmes: b.faitsConfirmes.filter(texteNonVide) } : {}),
  };
}

/** Une fiche d'écrans est fournie : l'écriture est sautée. */
export function ficheFournie(commande: Pick<CommandeFabrication, "entrees">): boolean {
  return !!lireEntreesCasConcret(commande.entrees).ficheCle;
}

/* ------------------------------------------------------------------ */
/* Graphe                                                                */
/* ------------------------------------------------------------------ */

/** Libellés des étapes (plan § 5). */
export const LIBELLES_ETAPES_CAS_CONCRET: Readonly<Record<EtapeCasConcret, string>> = {
  ecriture: "L'écriture",
  fiche: "La relecture",
  captures: "Les vrais écrans",
  voix: "La voix",
  calage: "Le calage",
  ecrans: "Les écrans",
  montage: "Les finitions",
  controle: "La vérification",
};

const ICONES: Readonly<Record<EtapeCasConcret, string>> = {
  ecriture: "crayon",
  fiche: "liste",
  captures: "ecran",
  voix: "micro",
  calage: "horloge",
  ecrans: "page",
  montage: "film",
  controle: "bouclier",
};

/** Durée de rendu d'un écran, en secondes de file [supposé d'après l'essai du tableau : ≈ 9 s]. */
const SECONDES_PAR_ECRAN = 9;
/** Écrans d'une vidéo, fins comprises [supposé : 19 dans la référence, plus 3 par fin]. */
const ECRANS_ESTIMES = 22;
/** Durée d'une composition `complet` (s) [supposé]. */
const SECONDES_PAR_FIN = 90;

const DUREES: Readonly<Record<EtapeCasConcret, (fins: number) => number>> = {
  ecriture: () => 60,
  fiche: () => 2,
  captures: () => 60,
  voix: (fins) => 20 * (1 + fins),
  calage: () => 2,
  ecrans: (fins) => (ECRANS_ESTIMES + 3 * Math.max(0, fins - 1)) * SECONDES_PAR_ECRAN,
  montage: (fins) => SECONDES_PAR_FIN * fins,
  controle: () => 2,
};

/** Fins attendues pour des réseaux (au plus une par réseau ; deux réseaux à la même suite partagent la leur). */
function finsAttendues(reseaux: readonly ReseauCas[]): number {
  return Math.max(1, reseaux.length);
}

/** Graphe des étapes pour cette commande : l'écriture n'y est pas quand une fiche est fournie. */
export function etapesCasConcret(commande: Pick<CommandeFabrication, "entrees">): DefinitionEtapeMoteur[] {
  const e = lireEntreesCasConcret(commande.entrees);
  const fins = finsAttendues(e.reseaux);
  const cles = ETAPES_CAS_CONCRET.filter((c) => c !== "ecriture" || !e.ficheCle);
  return cles.map((cle, i) => ({ cle, nom: LIBELLES_ETAPES_CAS_CONCRET[cle], icone: ICONES[cle], dependDe: i ? [cles[i - 1]] : [], dureeEstimeeSec: DUREES[cle](fins) }));
}

/* ------------------------------------------------------------------ */
/* Fins regroupées par contenu                                           */
/* ------------------------------------------------------------------ */

/** Ce qu'une fin dit et montre : deux fins qui disent et montrent la même chose font un seul fichier. */
const contenuDeFin = (f: FinPlanifiee) => JSON.stringify(f.appels.map((a) => [a.type, a.dit, a.ecran]));

/**
 * Regroupe les fins qui disent et montrent la même chose (une suite réduite de Facebook et celle de LinkedIn, par
 * exemple) : un seul fichier pour leurs réseaux. Les lignes et les écrans sont ceux de la première ; `reduites` et
 * `sansFin` sont gardés tels quels.
 */
export function regrouperFins(plan: PlanDesFins): PlanDesFins {
  const groupes = new Map<string, FinPlanifiee>();
  for (const f of plan.fins) {
    const cle = contenuDeFin(f);
    const deja = groupes.get(cle);
    if (deja) deja.reseaux = [...deja.reseaux, ...f.reseaux];
    else groupes.set(cle, { ...f, reseaux: [...f.reseaux] });
  }
  const fins = [...groupes.values()].map((f) => ({ ...f, id: `fin-${f.reseaux.join("-")}` }));
  return { fins, reduites: plan.reduites, sansFin: plan.sansFin };
}

/* ------------------------------------------------------------------ */
/* Texte dit après une reformulation                                     */
/* ------------------------------------------------------------------ */

/**
 * Reporte dans les `texteDit` des écrans le texte du corps tel que la voix l'a lu (après reformulation). Seuls les mots
 * changés bougent : préfixe et suffixe communs sont gardés écran par écran, les mots du milieu sont répartis sur les
 * écrans qu'ils touchaient, au prorata. Un événement qui viserait un mot disparu se pose sur le dernier mot de l'écran.
 * `null` : le nouveau texte ne se répartit pas (un écran resterait sans mot lu).
 */
export function reporterTexteDit(fiche: FicheEcrans, texte: string): FicheEcrans | null {
  const parEcran = fiche.ecrans.map((e) => motsDe(e.texteDit));
  const anciens = parEcran.flat();
  const nouveaux = motsDe(texte);
  if (anciens.join(" ") === nouveaux.join(" ")) return fiche;
  let p = 0;
  while (p < anciens.length && p < nouveaux.length && anciens[p] === nouveaux[p]) p++;
  let s = 0;
  while (s < anciens.length - p && s < nouveaux.length - p && anciens[anciens.length - 1 - s] === nouveaux[nouveaux.length - 1 - s]) s++;
  const finAncien = anciens.length - s;
  const milieuAncien = finAncien - p;
  const milieuNouveau = nouveaux.length - s - p;

  const res: string[][] = [];
  let debut = 0;
  let pris = 0;
  let cumul = 0;
  for (const mots of parEcran) {
    const a = debut;
    const b = debut + mots.length;
    debut = b;
    const avant = Math.max(0, Math.min(b, p) - a);
    const recouvre = Math.max(0, Math.min(b, finAncien) - Math.max(a, p));
    const apres = Math.max(0, b - Math.max(a, finAncien));
    cumul += recouvre;
    const jusqua = milieuAncien ? Math.round((cumul * milieuNouveau) / milieuAncien) : 0;
    const milieu = nouveaux.slice(p + pris, p + jusqua);
    pris = jusqua;
    const suffixe = apres ? nouveaux.slice(nouveaux.length - s + (Math.max(a, finAncien) - finAncien), nouveaux.length - s + (b - finAncien)) : [];
    res.push([...mots.slice(0, avant), ...milieu, ...suffixe]);
  }
  if (res.some((m) => motsLus(m.join(" ")).length === 0) || res.flat().join(" ") !== nouveaux.join(" ")) return null;
  const ecrans = fiche.ecrans.map((e, i) => {
    const n = motsLus(res[i].join(" ")).length;
    return { ...e, texteDit: res[i].join(" "), evenements: e.evenements.map((ev) => (ev.surMot < n ? ev : { ...ev, surMot: n - 1 })) };
  });
  return { ...fiche, ecrans: ecrans as FicheEcrans["ecrans"] };
}

/* ------------------------------------------------------------------ */
/* Écrans de la fiche → écrans calés de la brique                        */
/* ------------------------------------------------------------------ */

/** Étiquette et titre de la liste « avant » (la fiche n'en porte pas : textes de la vidéo de référence). */
export const ETIQUETTE_LISTE_AVANT = "Avant";
export const TITRE_LISTE_AVANT = "C'était *ça.*";
export const ETIQUETTE_RESULTAT = "Résultat";
export const SIGNATURE_LIEN = "Axion-*IA*";
/** Début de la phrase dite du cadeau quand l'écran ne la reprend pas. */
const INVITE_PROMESSE = "On vous envoie";

/** Balise `*mot*` le premier mot entier de chaque liste dont la forme sans casse ni accent est demandée. */
export function baliserMots(lignes: readonly string[], orange: readonly string[]): string[] {
  const restants = new Set(orange.map(cleMot).filter(Boolean));
  return lignes.map((l) =>
    l
      .split(/(\s+)/)
      .map((m) => {
        const cle = cleMot(m);
        if (!cle || !restants.has(cle)) return m;
        restants.delete(cle);
        return `*${m}*`;
      })
      .join(""),
  );
}

/** Mots orange d'un écran (sous-titres en valeur, « pop » des bruitages). */
export function motsOrange(e: Ecran): string[] {
  if (e.type === "accroche") return [e.motOrange];
  if (e.type === "titre") return [...(e.orange ?? [])];
  return [];
}

/* ------------------------------------------------------------------ */
/* Textes tirés du cas et du texte dit                                   */
/* ------------------------------------------------------------------ */

type Barre = Extract<EcranCorps, { type: "resultat" }>["avant"];

/** Unités abrégées sur une barre (« 15 MIN », « +1 H ») ; une autre unité est écrite telle quelle. */
const UNITES_BARRE: Readonly<Record<string, string>> = Object.freeze({ minute: "MIN", minutes: "MIN", heure: "H", heures: "H", seconde: "S", secondes: "S", jour: "J", jours: "J", semaine: "SEM", semaines: "SEM" });

/** Le mot écrit (chiffres ou lettres, « d'une » compris) dit-il la valeur `v` ? */
function motDitValeur(mot: string, v: number): boolean {
  const m = mot.replace(/^[dl]['’]/i, "").replace(/[^\p{L}\p{N}]+/gu, "");
  if (/^\d+$/.test(m)) return Number(m) === v;
  const cle = cleMot(m);
  return cle !== "" && (cle === cleMot(nombreEnLettres(v)) || (v === 1 && cle === "une"));
}

/**
 * Texte d'une barre du résultat, TIRÉ DU FAIT du cas qu'elle désigne (`faitId`), jamais calculé : sa valeur, l'unité
 * qui la suit dans l'énoncé (abrégée), « + » quand l'énoncé dit « plus d'… ». Sans fait désigné, ou valeur absente du
 * fait : chaîne vide (aucun nombre affiché ; un autre fait qui aurait la même valeur n'est jamais pris).
 */
export function texteBarre(barre: Barre, faits: readonly FaitCas[]): string {
  const fait = barre.faitId ? faits.find((f) => f.id === barre.faitId) : undefined;
  if (!fait || !fait.valeurs.includes(barre.valeur)) return "";
  const mots = fait.enonce.split(/\s+/);
  const i = mots.findIndex((m) => motDitValeur(m, barre.valeur));
  const plus = i >= 0 && /^plus$/i.test(mots[i - 1] ?? "") && /^d['’]/i.test(mots[i]) ? "+" : "";
  const unite = i >= 0 ? (mots[i + 1] ?? "").replace(/[^\p{L}%]+/gu, "").toLowerCase() : "";
  const ecrite = unite ? (UNITES_BARRE[unite] ?? unite.toUpperCase()) : "";
  return `${plus}${barre.valeur}${ecrite ? ` ${ecrite}` : ""}`;
}

/** Une affiche garde le point final de son texte dit (« MINUTES. ») ; jamais doublé, posé dans l'accent qui la finit. */
export function avecPointFinal(texteDit: string, affiche: string): string {
  if (!/\.$/.test(texteDit.trim()) || /[.!?…:]\**$/.test(affiche.trim())) return affiche;
  const m = /^([^]*?)(\**)$/.exec(affiche.trimEnd())!;
  return `${m[1]}.${m[2]}`;
}

/** Décalage de départ (part de la hauteur de la page) du vrai écran de l'écran `id`, s'il en porte un. */
export function departDePage(fiche: Pick<FicheEcrans, "ecrans">, id: string): number | undefined {
  const e = fiche.ecrans.find((x) => x.id === id);
  return e && (e.type === "etape" || e.type === "objet") && e.visuel.sorte === "ecran" ? e.visuel.departPage : undefined;
}

/**
 * Capture d'un vrai écran telle que la composition la lit : celle de la brique, plus le décalage de départ d'une page
 * entière (`departY`, part de sa hauteur). La brique recopie la capture entière : le champ arrive à la composition.
 */
export type CaptureVraiEcran = CaptureEcran & { departY?: number };

/** Ligne de la table montrée par un écran de fin. */
function ligneDeFin(fin: Pick<FinPlanifiee, "appels">, ids: readonly string[], type: string) {
  return fin.appels.find((a) => ids.includes(a.id) && a.type === type) ?? fin.appels.find((a) => a.type === type);
}

/** Objets dessinés qui ne montrent RIEN sans leurs textes (une fiche blanche) : jamais rendus sans contenu. */
const OBJETS_VIDES_SANS_TEXTES: ReadonlySet<string> = new Set(["liste-taches", "programme"]);

/**
 * Contenu de la brique pour un écran de la fiche (corps ou fin), le visuel réel désigné par la clé de sa capture.
 * `surTitre` : l'étiquette tirée du cas (`surTitreDuCas`) des écrans qui n'en ont pas de propre (lien, appel au mot,
 * preuve). TOUJOURS posée quand elle est donnée : une étiquette absente prenait celle des propriétés par défaut de la
 * composition (l'accroche d'exemple, « RECRUTEMENT · CAS RÉEL », vue sur la fin de la vidéo blog v-275dc041c303).
 */
export function contenuEcran(e: Ecran, fin: Pick<FinPlanifiee, "appels"> | null, captures: Readonly<Record<string, { cle: string }>>, faits: readonly FaitCas[] = [], surTitre?: string): ContenuEcran<VisuelCale> {
  type Contenu = ContenuEcran<VisuelCale>;
  const etiquette = surTitre ? { etiquette: surTitre } : {};
  const visuel = (v: { sorte: "objet"; objet: string; textes?: string[] } | { sorte: "ecran"; etapeCas: number; repli: string }): VisuelCale => {
    // V4-1 : un téléphone dont l'écran a une image (celle que déclare le cas) la montre, au lieu d'un écran vide.
    if (v.sorte === "objet" && v.objet === "telephone-capture" && captures[e.id]) return { capture: { cle: captures[e.id].cle } };
    // Une liste sans texte serait une fiche blanche : elle porte au moins la ligne (ou le titre) de l'écran.
    if (v.sorte === "objet" && OBJETS_VIDES_SANS_TEXTES.has(v.objet) && !v.textes?.some((t) => t.trim()) && (e.type === "etape" || e.type === "objet")) {
      const repli = (e.ligne ?? e.titre).replace(/\*/g, "").replace(/[\s.!?…]+$/u, "").trim();
      return { objet: v.objet as never, textes: [repli] };
    }
    if (v.sorte === "objet") return { objet: v.objet as never, ...(v.textes ? { textes: [...v.textes] } : {}) };
    const c = captures[e.id];
    if (!c) throw new Error(`Écran ${e.id} · le vrai écran n'a pas de capture : son repli aurait dû le remplacer.`);
    return { capture: { cle: c.cle } };
  };
  switch (e.type) {
    case "accroche":
      return { type: "accroche", etiquette: e.etiquette, lignes: baliserMots(e.lignes, [e.motOrange]) } as Contenu;
    case "chiffre":
      return { type: "chiffre", nombre: e.valeur, unite: avecPointFinal(e.texteDit, e.unite), pastilles: [...e.pastilles], compteur: e.variante === "compteur" } as Contenu;
    case "liste-avant":
      return { type: "liste-avant", etiquette: ETIQUETTE_LISTE_AVANT, titre: TITRE_LISTE_AVANT, taches: [...e.taches], ...(e.total ? { total: { valeur: e.total } } : {}) } as Contenu;
    case "titre": {
      const lignes = baliserMots(e.lignes, e.orange ?? []);
      return { type: "titre", lignes: lignes.map((l, i) => (i === lignes.length - 1 ? avecPointFinal(e.texteDit, l) : l)) } as Contenu;
    }
    case "etape":
      return { type: "etape", numero: e.numero, nombreEtapes: e.total, titre: e.titre, ligne: e.ligne, visuel: visuel(e.visuel), puces: [...e.puces] } as Contenu;
    case "objet":
      return { type: "objet", titre: e.titre, ...(e.ligne ? { ligne: e.ligne } : {}), visuel: visuel(e.visuel) } as Contenu;
    case "preuve":
      return { type: "preuve", ...etiquette, titre: e.titre, puces: [...e.puces] } as Contenu;
    case "resultat":
      // Sans fait désigné, la barre porte son libellé : jamais un nombre absent des faits (la brique refuse un texte vide).
      return { type: "resultat", etiquette: ETIQUETTE_RESULTAT, titre: e.titre, avant: texteBarre(e.avant, faits) || e.avant.libelle, maintenant: texteBarre(e.maintenant, faits) || e.maintenant.libelle, ligne: e.ligne } as Contenu;
    case "question":
      return { type: "question", lignes: [...e.lignes], question: e.question } as Contenu;
    case "appel-mot": {
      const ligne = fin ? ligneDeFin(fin, e.fins, "commentaire") : undefined;
      const ecrit = ligne?.ecran ?? `Écrivez ${e.mot} en commentaire`;
      const i = ecrit.toLowerCase().indexOf(e.mot.toLowerCase());
      const invite = i > 0 ? ecrit.slice(0, i).trim() : "Écrivez";
      const reste = (i >= 0 ? ecrit.slice(i + e.mot.length) : "en commentaire").trim();
      const mots = reste.split(/\s+/).filter(Boolean);
      const suite = mots.length > 1 ? `${mots.slice(0, -1).join(" ")} *${mots.at(-1)}*` : mots.length ? `*${mots[0]}*` : "";
      return { type: "appel-mot", ...etiquette, invite, mot: e.mot, suite } as Contenu;
    }
    case "promesse": {
      const ligne = fin ? ligneDeFin(fin, e.fins, "cadeau") : undefined;
      const dit = ligne?.dit ?? "";
      const j = dit.toLowerCase().indexOf(e.cadeau.toLowerCase());
      // Un écrit qui porte déjà son invite (« Je vous envoie la structure complète ») : l'invite, puis le cadeau.
      const porte = j <= 0 ? /^(.*?\benvoie)\s+(.+)$/i.exec(e.cadeau) : null;
      const invite = porte ? porte[1] : j > 0 ? dit.slice(0, j).trim() : INVITE_PROMESSE;
      // Comme la référence : le cadeau en orange jusqu'au premier « de », la suite et la ligne en dessous.
      const ecrit = porte ? porte[2] : j > 0 ? e.cadeau.charAt(0).toLowerCase() + e.cadeau.slice(1) : e.cadeau;
      const coupe = /\s(?=d(?:e\s|')|du\s|des\s)/i.exec(ecrit);
      // Sans « de » à couper et sans ligne (« la structure complète ») : deux mots en orange, la suite en ligne.
      const mots = ecrit.split(/\s+/);
      const enDeux = !coupe && !e.ligne && mots.length > 2;
      const tete = coupe ? ecrit.slice(0, coupe.index) : enDeux ? mots.slice(0, 2).join(" ") : ecrit;
      const reste = coupe ? ecrit.slice(coupe.index + 1) : enDeux ? mots.slice(2).join(" ") : "";
      const suite = e.ligne ? e.ligne.charAt(0).toLowerCase() + e.ligne.slice(1) : "";
      return { type: "promesse", invite, cadeau: `*${tete}*`, ligne: [reste, suite].filter(Boolean).join(", ") } as Contenu;
    }
    case "diagnostic": {
      // Dessiné par le type `promesse` de la brique : « Faites votre », « *diagnostic gratuit* » en accent, la ligne dessous.
      const mots = e.titre.trim().split(/\s+/);
      const n = mots.length > 2 ? 2 : Math.max(1, mots.length - 1);
      return { type: "promesse", invite: mots.slice(0, mots.length - n).join(" "), cadeau: `*${mots.slice(mots.length - n).join(" ")}*`, ligne: e.ligne ?? "" } as Contenu;
    }
    case "lien": {
      const rdv = fin ? ligneDeFin(fin, e.fins, "rendez-vous") : undefined;
      const ou = rdv && /^ou\s/i.test(rdv.dit.trim());
      return { type: "lien", ...(ou ? { etiquette: "Ou" } : etiquette), titre: e.titre, lien: e.bulle, signature: SIGNATURE_LIEN } as Contenu;
    }
  }
}

/**
 * Premier texte de chaque type d'écran qui n'a rien d'autre à montrer à son début (ni étiquette, ni nombre) : tant qu'il
 * n'est pas entré, l'écran est vide (fond et marque seuls).
 */
export const PREMIER_ELEMENT: Readonly<Partial<Record<Ecran["type"], string>>> = Object.freeze({ titre: "titre-1", question: "titre-1", objet: "titre", promesse: "invite", diagnostic: "invite", lien: "titre" });
/**
 * Un écran ne reste jamais vide plus que ce temps (ms) : un premier élément posé plus tard entre au début de l'écran
 * (vidéo blog v-275dc041c303 : « Et maintenant ? » posé sur le 6e mot, écran ivoire vide près de 2 s).
 */
export const ECRAN_VIDE_MAX_MS = 400;

/**
 * Écrans calés de la fiche (et d'une fin), à la forme de la brique : heures sur l'horloge de la vidéo, événements calés
 * (plus l'éclair au début de l'écran qui le porte), vrai écran désigné par la clé de sa capture. Le premier élément d'un
 * écran (`PREMIER_ELEMENT`) prévu plus de `ECRAN_VIDE_MAX_MS` après son début entre au début (les bruitages, qui lisent
 * ces écrans calés, suivent). `surTitre` : voir `contenuEcran`.
 */
export function ecransCales(
  ecrans: readonly Ecran[],
  evenements: readonly EvenementCale[],
  fin: Pick<FinPlanifiee, "appels"> | null,
  captures: Readonly<Record<string, { cle: string }>>,
  faits: readonly FaitCas[] = [],
  surTitre?: string,
): EcranCale[] {
  return ecrans.map((e) => {
    if (e.debutMs === undefined || e.finMs === undefined) throw new Error(`Écran ${e.id} · pas encore calé sur la voix.`);
    const debut = e.debutMs;
    const fin_ = e.finMs;
    const borne = (ms: number) => Math.min(fin_ - 40, Math.max(debut, ms));
    const premier = PREMIER_ELEMENT[e.type];
    const evs: EvenementBrique[] = evenements
      .filter((ev) => ev.ecranId === e.id)
      .map((ev) => {
        const ms = borne(ev.debutMs);
        return { cible: ev.cible, ms: ev.cible === premier && ms - debut > ECRAN_VIDE_MAX_MS ? debut : ms };
      });
    if (e.eclair && !evs.some((ev) => ev.cible === "eclair")) evs.unshift({ cible: "eclair", ms: debut });
    return { id: e.id, fond: e.fond, debutMs: debut, finMs: fin_, evenements: evs, ...contenuEcran(e, fin, captures, faits, surTitre) } as EcranCale;
  });
}

/** Capture prête pour la brique : l'adresse signée est lue par le rendu, la clé désigne le fichier. */
export type CapturesPretes = Readonly<Record<string, CaptureEcran>>;
