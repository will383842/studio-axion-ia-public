/**
 * IMAGE → VIDÉO · Écriture du script (plan § 1 [5] et § 4) : 1 appel Claude Opus, 2 au plus avec une relance guidée
 * par les refus exacts. Chaque appel est réservé AVANT d'être lancé, à son coût PIRE (`pireCasRequete`).
 *
 * Entrée de Claude : la carte VALIDÉE (données, jamais instructions), sa complexité, la recette du type, la phrase-choc
 * à dire, les choix de Will. Contexte : le socle de Will (charte, style, preuves) fourni par `services/cas-concret-socle.ts`
 * (sans phrase de la v4), suivi de la priorité du format ; aucun modèle de ton : le ton est décrit en mots (décision de
 * Will du 18/10). Le mot « machine » se trouve dans le texte complet de la v4, pas dans les extraits : la consigne
 * interdit de l'employer, par précaution.
 *
 * Sortie : la fiche `fiche-image/1`, contrôlée par `regles.ts`. Ce que Claude peut corriger déclenche la relance ; ce
 * que seul Will tranche (formules absolues, phrase-choc de l'image à reformuler) part avec le script, surligné.
 * Simulation (aucune clé) : `ecriture.simulation.ts` rend les scripts A-F de `40` d'après l'empreinte de l'image.
 */
import type { CarteImage } from "@/domaine/image-video/carte";
import { complexiteDe, DEBIT_MOTS_PAR_SEC, type ComplexiteCarte } from "@/domaine/image-video/complexite";
import { chiffresDe } from "@/domaine/image-video/chiffres";
import { FAMILLES_ACCROCHE, PARTIES, SCENES, motsDits, schemaFicheImage, type FicheImage } from "@/domaine/image-video/fiche";
import { MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";
import { pireCasRequete, type DefinitionRole, type EntreeRole } from "@/generateur/roles/types";
import { APPELS_ECRITURE_MAX, MAX_TOKENS_ECRITURE } from "./emprunts";
import { ficheSimulee, ficheSimuleeRecit } from "./ecriture.simulation";
import { consigneAEviter, parcoursDeCode, type ChoixParcoursIV } from "./parcours-varies";
import { reparerPhrasesLonguesIV } from "./reparation-script";
import { ANNONCE_SITUATION_TYPE, ETIQUETTE_SITUATION_TYPE, PARCOURS_RECIT, RECETTES, annonceAttendue, lireDecoupage, scenesPermises, type CodeRecit } from "./recettes";
import {
  ACCROCHE_IV_MOTS_MAX,
  INTERDITS_PERMANENTS,
  MOTS_PAR_PHRASE_MAX,
  QUESTION_MOTS_MAX,
  TOLERANCE_DUREE_IV,
  aCorrigerParClaude,
  aTrancherParWill,
  empreinteDeCarte,
  lectureChiffres,
  phraseChocAttendue,
  verifierScript,
  type ChiffreDit,
  type ContexteRegles,
  type Manquement,
  type VerdictScript,
} from "./regles";

/** Au plus 2 appels (le premier, et une relance guidée par les refus) et le plafond de jetons du cas concret (24 000 depuis le 15/10). */
export { APPELS_ECRITURE_MAX, MAX_TOKENS_ECRITURE };
export const ETAPE_ECRITURE = "Image → vidéo · écriture";
export const PREFIXE_APPEL_ECRITURE = "ivecr";

/** Le mot « machine » (déjà vu dans un ancien exemple de ton) : jamais employé. */
export const CONSIGNE_MOT_MACHINE = "N'emploie jamais le mot « machine » (dis « automatisation »).";
/** Dite entre la charte de Will et les règles du format. */
export const PRIORITE_REGLES_IMAGE_VIDEO = "Pour ce format, les règles « image → vidéo » (la consigne) passent avant la charte générale quand elles diffèrent.";

const liste = (xs: readonly string[]) => xs.map((x) => `« ${x} »`).join(", ");

/** Consigne fixe du rôle (en cache côté service). Les règles sont celles de `regles.ts`. */
export const CONSIGNE_ECRITURE_IV = `Tu écris le CORPS d'une vidéo verticale « image → vidéo » : une infographie d'Axion-IA prend vie, une voix dit le texte pendant que l'image se reconstruit à l'écran, bloc par bloc. La carte de l'image, validée par Will, est dans <carte> : c'est ta seule source.

TON (celui de la vidéo de référence, la v4) : on PARLE, on n'écrit pas. Phrases courtes, concrètes, au présent, en « vous » ; chaque phrase montre une action ; aucun adjectif creux. La promesse redite juste après l'accroche (« Oui, le premier. »), une bascule courte (« Maintenant… »). Aucune vidéo existante n'est donnée en exemple : le ton est décrit ici en mots, écris chaque script comme s'il n'existait aucun autre.
${CONSIGNE_MOT_MACHINE}

OSSATURE (6 parties, dans l'ordre, chaque écran porte sa partie) : ${liste(PARTIES)}.
- accroche : ${ACCROCHE_IV_MOTS_MAX} mots dits au plus, finie avant 3 s ; deux accroches de familles différentes (${liste(FAMILLES_ACCROCHE)}) dans "accroches" ; le premier écran dit la première.
- douleur : ce que vit le public sans la solution.
- début de réponse : la bascule ; il annonce le nombre quand <annonce> le donne (« deux chemins », « cinq choses »), avant le premier élément.
- <a_eviter>, si elle est présente (partie variable), liste des scènes à éviter d'employer, sauf si l'ossature ou le contenu l'oblige.
- explication : l'image de bout en bout, en suivant <recette>. Image d'automatisation (<situation_type> = oui) : le premier écran de l'explication commence par « ${ANNONCE_SITUATION_TYPE} » et affiche « ${ETIQUETTE_SITUATION_TYPE} » ; jamais un vrai client.
- résultat : les chiffres du bandeau, dits tels qu'écrits.
- phrase-choc : <phrase_choc>, MOT POUR MOT, en dernier.
Déroulé du récit : quand <recit> est présent, il fixe la place des parties et la façon de raconter ; il passe avant l'ordre ci-dessus, jamais avant les règles.
Après le corps, hors des écrans : "questionCommentaire", UNE question en « vous » propre au contenu de l'image, ${QUESTION_MOTS_MAX} mots au plus, sans mot à écrire en commentaire, sans lien, sans promesse (ex. « Et chez vous, combien de messages attendent jusqu'au lendemain ? »).

RÈGLES (le script est refusé sinon) :
- Rien d'oublié : chaque chiffre de la carte marqué à dire est dit ; chaque bloc est cité dans les "refs" d'un écran (sauf une photo de personnes, jamais reprise).
- Rien d'inventé : aucun nombre hors de la carte (la numérotation « un… cinq » et les comptes visibles sont permis) ; aucune promesse absente de l'image.
- Interdits, prioritaires même sur le mot pour mot : ${liste(INTERDITS_PERMANENTS)}, faux client (« un client a… »), nom d'exemple sans « par exemple », toute phrase d'appel (commentaire, lien, abonnement, diagnostic) dans le corps : la fin vient d'ailleurs.
- Un nombre SEUL sur l'image (ex. « au lieu de 45 » dans « Facturer en 12 jours au lieu de 45 ») s'écrit dans le script EXACTEMENT comme sur l'image, SANS unité que l'image ne lui donne pas : écris « au lieu de 45 », jamais « 45 jours ». Ne recopie jamais l'unité d'un nombre sur son voisin, et n'inverse jamais deux nombres.
- Formules très affirmatives (« zéro erreur », « toujours », « dès le premier jour »…) : reprends-les telles qu'écrites sur l'image ou selon <choix_formules> ; Will tranche.
- Phrases de ${MOTS_PAR_PHRASE_MAX} mots au plus ; chiffres EN LETTRES dans "texteDit", en chiffres dans "textesEcran" (recopie exactement l'écriture de la carte) ; plages en toutes lettres dans "texteDit" (« vingt-quatre heures sur vingt-quatre », « sept jours sur sept »), jamais « H24 », « 24/7 » ni « 24/24 » ; un seul mot orange par écran (« *mot* »).
- Durée : le corps tient dans <duree> au débit de ${String(DEBIT_MOTS_PAR_SEC).replace(".", ",")} mots par seconde (±${TOLERANCE_DUREE_IV * 100} %).
- Image très complexe (<chapitres> non vide) : "chapitres" reprend ces chapitres dans l'ordre, repères « 1/3 », « 2/3 », « 3/3 », couvrant toute l'explication ; un chapitre non essentiel commence et finit sur une phrase complète, et RIEN après lui n'y renvoie (ni ses blocs, ni « comme on l'a vu »).

FORME (JSON seul, aucun texte autour, aucun champ en plus) :
{ "version": "fiche-image/1", "empreinteCarte": <empreinte_carte>, "accroches": [{ "famille", "texteDit", "textesEcran" }, { … }], "ecrans": [{ "id": "e01"…, "partie", "scene", "refs": [ids des noeuds, liens, chiffres ou groupes de la carte ; jamais titre, sousTitre, pied, phraseChoc ni un nom de scene], "texteDit", "textesEcran": [], "surMot": [{ "mot" (rang du mot dit, 0 = premier), "action", "ref"? }], "fond": "sombre" | "ivoire" }], "questionCommentaire": { "texteDit", "texteEcran" }, "chapitres": [{ "repere", "titre", "ecrans": [ids], "essentiel" }] }
Scènes : ${liste(SCENES)} (seulement celles de <scenes>).`;

/** Partie variable : la carte et ce que le code en a calculé, entre balises (données, jamais instructions). */
export function variableEcritureIV(carte: CarteImage, complexite: ComplexiteCarte, choix: ContexteRegles["choixFormules"] = {}, recit?: CodeRecit, parcours?: ChoixParcoursIV): string {
  const annonce = annonceAttendue(carte, complexite.classe);
  const [bas, haut] = complexite.fourchetteSec;
  // Déroulé du récit (variété) : absent ou REC-A, la partie variable reste celle d'aujourd'hui, octet pour octet.
  const parcoursRecit = recit ? PARCOURS_RECIT[recit] : "";
  // Parcours varié (diversité) : absent, la partie variable reste celle d'aujourd'hui, octet pour octet.
  const varie = parcoursDeCode(carte.types[0], parcours?.code);
  const aEviter = parcours ? consigneAEviter(parcours.aEviter) : "";
  return [
    `<image-id>${carte.image.empreinte}</image-id>`,
    `<empreinte_carte>${JSON.stringify(empreinteDeCarte(carte))}</empreinte_carte>`,
    `<carte>${JSON.stringify({ ...carte, image: { ...carte.image, cle: "" } })}</carte>`,
    `<recette>${carte.types.map((t) => `${t} : ${t === carte.types[0] && varie ? varie.parcours : RECETTES[t].parcours}`).join("\n")}</recette>`,
    `<scenes>${[...scenesPermises(carte.types)].join(", ")}</scenes>`,
    `<situation_type>${carte.automatisation ? "oui" : "non"}</situation_type>`,
    `<annonce>${annonce ? annonce.nombre : "aucune"}</annonce>`,
    `<duree>classe ${complexite.classe} : ${bas} à ${haut} s (${complexite.motsCorps[0]} à ${complexite.motsCorps[1]} mots)</duree>`,
    `<chapitres>${JSON.stringify(complexite.chapitres)}</chapitres>`,
    `<phrase_choc>${phraseChocAttendue(carte, choix)}</phrase_choc>`,
    `<choix_formules>${JSON.stringify(choix)}</choix_formules>`,
    ...(parcoursRecit ? [`<recit>${recit} · ${parcoursRecit}</recit>`] : []),
    ...(aEviter ? [`<a_eviter>${aEviter}</a_eviter>`] : []),
  ].join("\n");
}

/** Relance guidée : la même demande, la réponse précédente et ses refus exacts. */
export function variableRelanceIV(base: string, precedente: string, refus: readonly string[]): string {
  const seuls = nombresSeulsDeLaCarte(base);
  const precisions = new Set<string>();
  for (const r of refus)
    for (const m of r.matchAll(/«\s*(\d+(?:[.,]\d+)?)\s+[^»\s]+\s*»[^«]*?n'est pas sur l'image/g)) {
      const x = m[1]!;
      if (seuls.has(Number(x.replace(",", ".")))) precisions.add(`Écris ${x} tel quel, sans unité (comme sur l'image).`);
    }
  // Un nombre cité seul par un refus alors que l'image le donne avec une unité (« 12 » pour « 12 jours ») : on redit l'unité de l'image.
  const avecUnite = nombresAvecUniteDeLaCarte(base);
  for (const r of refus)
    for (const m of r.matchAll(/«\s*(\d+(?:[.,]\d+)?)\s*»[^«]*?n'est pas sur l'image/g)) {
      const u = avecUnite.get(Number(m[1]!.replace(",", ".")));
      if (u) precisions.add(`N'écris jamais ${m[1]} seul : l'image dit « ${u} », écris « ${u} » avec son unité.`);
    }
  const precision = precisions.size ? `\n${[...precisions].join(" ")}` : "";
  return `${base}\n<reponse_precedente>${precedente}</reponse_precedente>\n<refus>\n${refus.map((r) => `- ${r}`).join("\n")}\n</refus>${precision}\nCorrige chacun de ces refus et rends la fiche entière.`;
}

/** Nombres de la carte écrits AVEC une unité (valeur → « 12 jour »), pour redire l'unité de l'image dans une relance. */
function nombresAvecUniteDeLaCarte(base: string): Map<number, string> {
  const res = new Map<number, string>();
  try {
    const carte = JSON.parse(/<carte>([\s\S]*?)<\/carte>/.exec(base)?.[1] ?? "") as { chiffres?: { valeur: number | null; unite: ChiffreDit["unite"] }[] };
    for (const c of carte.chiffres ?? []) if (c.valeur !== null && c.unite !== "nombre" && !res.has(c.valeur)) res.set(c.valeur, ecritureRelue({ valeur: c.valeur, unite: c.unite }));
  } catch {
    /* carte illisible : aucune précision */
  }
  return res;
}

/** Nombres écrits SANS unité dans les chiffres de la carte (lue dans `<carte>` de la partie variable). */
function nombresSeulsDeLaCarte(base: string): Set<number> {
  try {
    const carte = JSON.parse(/<carte>([\s\S]*?)<\/carte>/.exec(base)?.[1] ?? "") as { chiffres?: { valeur: number | null; unite: string }[] };
    return new Set((carte.chiffres ?? []).filter((c) => c.valeur !== null && c.unite === "nombre").map((c) => c.valeur as number));
  } catch {
    return new Set();
  }
}

/** Lit `<balise>` dans la partie variable (simulation). */
function balise(variable: string, nom: string): string | undefined {
  return new RegExp(`<${nom}>([\\s\\S]*?)</${nom}>`).exec(variable)?.[1];
}

/** Simulation du rôle : la fiche A-F de `40` d'après l'empreinte de l'image (celle du récit demandé s'il en existe une) ; image inconnue → texte vide. */
function simulerEcritureIV(entree: EntreeRole): FicheImage | string {
  const image = balise(entree.variable, "image-id") ?? "";
  const recit = /^(REC-[A-D])\b/.exec(balise(entree.variable, "recit") ?? "")?.[1] as CodeRecit | undefined;
  return (recit ? ficheSimuleeRecit(image, recit) : null) ?? ficheSimulee(image) ?? "";
}

/** Rôle « écriture image → vidéo » : Opus (modèle d'écriture du studio), sortie JSON en texte, sans schéma envoyé. */
export const roleEcritureImageVideo = {
  id: "ecriture-image-video",
  version: 1,
  consigne: CONSIGNE_ECRITURE_IV,
  modele: MODELE_ECRITURE,
  effort: "medium",
  maxTokens: MAX_TOKENS_ECRITURE,
  simuler: simulerEcritureIV,
} satisfies DefinitionRole;

/**
 * Contexte d'un appel : le socle de Will (de `services/cas-concret-socle.ts`), sa charte suivie de la priorité du format
 * et le ton en mots suivi de l'interdiction du mot « machine » (redite voulue de la consigne). Sans socle : rien (jamais bloquant).
 */
export function contexteDuSocleIV(socle: EntreeRole["contexte"] | undefined): EntreeRole["contexte"] {
  if (!socle) return {};
  const charte = socle.contexteAxion?.trim();
  const ton = socle.gagnants?.trim();
  return {
    ...socle,
    ...(charte ? { contexteAxion: `${charte}\n\n${PRIORITE_REGLES_IMAGE_VIDEO}` } : {}),
    ...(ton ? { gagnants: `${ton}\n\n${CONSIGNE_MOT_MACHINE}` } : {}),
  };
}

/** Coût PIRE d'un appel (requête réellement envoyée : socle 1 h, consigne + schéma, entrée + sortie maximale), en dollars. */
export const coutEstimeUsd = pireCasRequete;

// ─── Outils injectés et résultat ─────────────────────────────────────────────────────────────────────────────────────

export type ReponseAppelIV =
  | { ok: true; simule: boolean; donnees?: unknown; texte?: string; stopReason?: string | null; coutUsd?: number }
  | { ok: false; message: string };

export interface OutilsEcritureIV {
  /** UN appel du rôle, branché par le service sur le chemin de dépense du studio (double de test ici). */
  appeler: (role: DefinitionRole, entree: EntreeRole) => Promise<ReponseAppelIV>;
  /** Réserve le coût estimé AVANT l'appel ; refus → aucun appel. */
  budget: { reserver: (d: { appelId: string; videoId: string; etape: string; modele: string; coutEstimeUsd: number }) => Promise<{ ok: true } | { ok: false; message: string }> };
  /** Socle de Will (`blocsSocleWill` via `emprunts.ts`), jamais bloquant. */
  socle?: () => Promise<EntreeRole["contexte"] | undefined>;
}

export interface EntreeEcritureIV extends Omit<ContexteRegles, "complexite"> {
  videoId: string;
  versionId: string;
  /** Réglage du format ; seule valeur : « chapitres ». */
  decoupage?: unknown;
  /** Parcours varié et scènes à éviter, tirés avant l'écriture (absent : le parcours de `recettes.ts`). */
  parcours?: ChoixParcoursIV;
}

export type ResultatEcritureIV =
  | {
      ok: true;
      fiche: FicheImage;
      verdict: VerdictScript;
      /** Ce que Will doit trancher à la validation (surligné, avec une proposition). */
      aTrancher: Manquement[];
      appels: number;
      relance: boolean;
      simule: boolean;
      coutUsd?: number;
    }
  | { ok: false; motif: "reglage" | "budget" | "appel" | "refusee"; message: string; refus: string[]; appels: number }
  /**
   * Script écrit, mais le verdict n'est pas bon : il reste ce que seul Will peut trancher (formules absolues, phrase-choc
   * à reformuler). Il part avec le script, pour Will, sans relance de Claude ; rien n'est validé tant que ce n'est pas tranché.
   */
  | {
      ok: false;
      motif: "a-trancher";
      message: string;
      refus: string[];
      appels: number;
      fiche: FicheImage;
      verdict: VerdictScript;
      aTrancher: Manquement[];
      relance: boolean;
      simule: boolean;
      coutUsd?: number;
    };

export const DEBUT_REFUS_ECRITURE = "Script refusé";
const REPONSE_COUPEE = "La réponse a été coupée avant la fin : rendez une fiche plus courte, JSON seul et complet.";

export const idAppelEcritureIV = (e: Pick<EntreeEcritureIV, "videoId" | "versionId">, essai: number) => `${PREFIXE_APPEL_ECRITURE}-${e.videoId}-${e.versionId}-${essai}`;

/** Texte sans clôture Markdown qui l'enveloppe entièrement. */
function sansCloture(t: string): string {
  const m = /^\s*```[a-zA-Z]*[ \t]*\r?\n([\s\S]*?)\r?\n?[ \t]*```\s*$/.exec(t);
  return m ? m[1]! : t;
}

/** Lit la réponse : objet déjà lu (simulation) ou texte JSON. */
function lire(reponse: Extract<ReponseAppelIV, { ok: true }>): { ok: true; brute: unknown; texte: string } | { ok: false; refus: string; texte: string } {
  const d = reponse.donnees ?? reponse.texte;
  if (d === undefined || d === null || d === "") return { ok: false, refus: "La réponse est vide : aucune fiche rendue.", texte: "" };
  if (typeof d !== "string") return { ok: true, brute: d, texte: JSON.stringify(d) };
  try {
    const nu = sansCloture(d);
    return { ok: true, brute: JSON.parse(nu), texte: nu };
  } catch {
    return { ok: false, refus: "La réponse n'est pas un JSON lisible : rendez le JSON seul, sans texte autour.", texte: d };
  }
}

/** Juge une réponse lue : forme (zod), puis règles. */
export function jugerFicheIV(brute: unknown, ctx: ContexteRegles): { ok: true; fiche: FicheImage; verdict: VerdictScript } | { ok: false; refus: string[] } {
  const forme = schemaFicheImage.safeParse(brute);
  if (!forme.success) return { ok: false, refus: forme.error.issues.slice(0, 20).map((i) => `Champ « ${i.path.join(".") || "fiche"} » : ${i.message}`) };
  const verdict = verifierScript(forme.data, ctx);
  const aCorriger = aCorrigerParClaude(verdict);
  return aCorriger.length ? { ok: false, refus: aCorriger.map((m) => m.message) } : { ok: true, fiche: forme.data, verdict };
}

// ─── Réparation sans appel : chiffre refusé hors image (Q05) ───────────────────────────────────────────────────────────

/** Clé « valeur|unité » comme `regles.ts` la compare (Q05 : valeur ET unité, jamais la valeur seule). */
const cleDe = (c: Pick<ChiffreDit, "valeur" | "unite">) => `${c.valeur}|${c.unite}`;

/** Réécriture d'un chiffre comme `regles.ts` l'écrit dans ses refus (« 2 h », « 80 % », « 3h » pour une heure d'horloge). */
function ecritureRelue(c: Pick<ChiffreDit, "valeur" | "unite">): string {
  if (c.unite === "heure") return `${Math.floor(c.valeur! / 60)}h${c.valeur! % 60 ? String(c.valeur! % 60).padStart(2, "0") : ""}`;
  const unites: Partial<Record<ChiffreDit["unite"], string>> = { "%": " %", "€": " €", sec: " s", min: " min", h: " h", jour: " jour" };
  return `${String(c.valeur).replace(".", ",")}${unites[c.unite] ?? ""}`;
}

/** Clés des chiffres cités par un refus Q05 (« Écran e03 : « 12 », « 3 jour » ne sont pas sur l'image. »), ou null s'ils ne se relisent pas. */
function clesRefusees(message: string): Set<string> | null {
  const bruts = [...message.matchAll(/«\s*([^»]+?)\s*»/g)].map((m) => m[1]!.replace(/\u00a0/g, " "));
  const cles = new Set<string>();
  for (const b of bruts) {
    const lu = chiffresDe(b)[0];
    if (!lu || lu.valeur === null) return null;
    // Une heure pile « 3h » se relit comme une durée « 3 h » : si le chiffre relu ne réécrit pas le texte cité, pas de réparation.
    if (ecritureRelue(lu) !== b) return null;
    cles.add(cleDe(lu));
  }
  return cles.size ? cles : null;
}

/** Phrases d'un texte, ponctuation et espaces conservés (coupe sur . ! ? … suivis d'une espace : « 2,5 h », « Pourquoi ? » ne sont pas coupés). */
const phrasesGardees = (texte: string): string[] => texte.split(/(?<=[.!?…][*»)"']*)\s+(?=\S)/u).filter((p) => p.trim());

/**
 * Texte sans les phrases qui portent un chiffre refusé (même clé valeur + unité, ou opérande d'un calcul) : la phrase entière
 * part, jamais le nombre seul. `null` si une phrase à retirer (hors calcul) porte aussi un autre chiffre (il pourrait être de l'image) ou si
 * le retrait casse une mise en valeur. `disparus` : rang (avant retrait) des mots dits retirés.
 */
function sansPhrases(texte: string, refusees: Set<string>): { texte: string; disparus: Set<number>; change: boolean } | null {
  const phrases = phrasesGardees(texte);
  const garde: string[] = [];
  const disparus = new Set<number>();
  let rang = 0;
  for (const phrase of phrases) {
    const mots = motsDits(phrase).length;
    // Q05 lit l'écran sans ses astérisques (« *25* jours » = « 25 jours ») : la réparation lit pareil.
    const nue = phrase.replace(/\*/g, "");
    const { chiffres, calculs } = lectureChiffres(nue);
    // Opérande refusé d'un calcul : la phrase du calcul part en entier (jamais « 16 + = 20 »).
    const calcul = calculs.some((v) => refusees.has(cleDe({ valeur: v, unite: "nombre" })));
    const refusee = calcul || chiffres.some((c) => refusees.has(cleDe(c)));
    // La lecture de « 2,5 h » rend « 2 » puis « 5 h » : l'entier d'un décimal ne compte pas comme un chiffre à part.
    const entiersDecimaux = new Set([...nue.matchAll(/(?<![\d.,])(\d+)[.,]\d/g)].map((m) => Number(m[1])));
    const autres = chiffres.some((c) => !refusees.has(cleDe(c)) && !(c.unite === "nombre" && entiersDecimaux.has(c.valeur!)));
    if (refusee && !calcul && autres) return null;
    if (refusee) for (let k = 0; k < mots; k++) disparus.add(rang + k);
    else garde.push(phrase);
    rang += mots;
  }
  if (!disparus.size) return { texte, disparus, change: false };
  const propre = garde.join(" ");
  if ((propre.match(/\*/g) ?? []).length % 2) return null;
  return { texte: propre, disparus, change: true };
}

/**
 * Tous les refus restants sont des chiffres hors image (Q05) sur des écrans : on les retire de la fiche, sans appel payant,
 * puis on rejuge. `null` si les refus sont d'une autre nature ou si la fiche réparée ne passe pas.
 */
function reparerChiffresHorsImage(brute: unknown, ctx: ContexteRegles): { fiche: FicheImage; verdict: VerdictScript; retires: string[] } | null {
  const forme = schemaFicheImage.safeParse(brute);
  if (!forme.success) return null;
  const refusees = aCorrigerParClaude(verifierScript(forme.data, ctx));
  if (!refusees.length || !refusees.every((m) => m.regle === "Q05" && m.ecranId && m.message.includes("pas sur l'image"))) return null;

  const fiche = structuredClone(forme.data);
  const retires: string[] = [];
  for (const m of refusees) {
    const ecran = fiche.ecrans.find((e) => e.id === m.ecranId);
    const cles = clesRefusees(m.message);
    if (!ecran || !cles) return null;
    const dit = sansPhrases(ecran.texteDit, cles);
    if (!dit) return null;
    const lignes = ecran.textesEcran.map((t) => sansPhrases(t, cles));
    if (lignes.some((l) => !l)) return null;
    if (!dit.change && !lignes.some((l) => l!.change)) return null;
    // Un écran ne reste jamais sans texte dit : on ne répare pas, le refus actuel s'applique.
    if (dit.change && !motsDits(dit.texte).length) return null;
    // Les mots restants gardent leur animation, décalée du nombre de mots retirés avant eux ; celle d'un mot retiré tombe.
    const total = motsDits(ecran.texteDit).length;
    const rang = new Map<number, number>();
    for (let i = 0, j = 0; i < total; i++) if (!dit.disparus.has(i)) rang.set(i, j++);
    ecran.surMot = ecran.surMot.filter((s) => rang.has(s.mot)).map((s) => ({ ...s, mot: rang.get(s.mot)! }));
    ecran.texteDit = dit.texte;
    ecran.textesEcran = lignes.map((l) => l!.texte).filter((t) => /[\p{L}\p{N}]/u.test(t));
    for (const c of cles) retires.push(`${c.split("|")[0]} (écran ${ecran.id})`);
  }
  const jugement = jugerFicheIV(fiche, ctx);
  return jugement.ok ? { fiche: jugement.fiche, verdict: jugement.verdict, retires } : null;
}

/**
 * Une animation calée sur un mot qui n'est pas dit (rang au-delà du texte dit) n'est qu'un décor : on la retire de la fiche lue,
 * sans appel ni changement d'un mot dit, plutôt que de refuser le script (ordre de Will, 27/10/2026 : contrôles plus souples).
 */
function sansAnimationsHorsMots(brute: unknown): unknown {
  const ecrans = (brute as { ecrans?: unknown } | null)?.ecrans;
  if (!Array.isArray(ecrans)) return brute;
  const copie = structuredClone(brute) as { ecrans: { texteDit?: unknown; surMot?: { mot?: unknown }[] }[] };
  for (const e of copie.ecrans) {
    if (typeof e?.texteDit !== "string" || !Array.isArray(e.surMot)) continue;
    const n = motsDits(e.texteDit).length;
    e.surMot = e.surMot.filter((s) => typeof s?.mot !== "number" || s.mot < n);
  }
  return copie;
}

const marqueRefs = (retirees: string[]): string[] =>
  retirees.length ? [`Réparée sans appel : élément(s) hors de l'image retiré(s) (${retirees.join(", ")}).`] : [];

/**
 * Une référence qui n'est pas un identifiant de la carte (titre, sous-titre, pied, phrase-choc, nom de scène) n'est montrée
 * nulle part : on la retire de la fiche lue, sans appel ni changement d'un mot dit (zéro blocage). Jamais d'ajout hors carte.
 */
export function sansRefsInconnues(
  brute: unknown,
  carte: Pick<CarteImage, "noeuds" | "liens" | "chiffres" | "groupes">,
): { brute: unknown; retirees: string[] } {
  const ecrans = (brute as { ecrans?: unknown } | null)?.ecrans;
  if (!Array.isArray(ecrans)) return { brute, retirees: [] };
  const connus = new Set([...carte.noeuds, ...carte.liens, ...carte.chiffres, ...carte.groupes].map((x) => x.id));
  const normer = (x: unknown): string => (typeof x === "string" ? x.trim().toLowerCase() : "");
  const copie = structuredClone(brute) as { ecrans: { id?: unknown; refs?: unknown; surMot?: { ref?: unknown }[] }[] };
  const retirees: string[] = [];
  for (const e of copie.ecrans) {
    if (!e || !Array.isArray(e.refs)) continue;
    const gardees: string[] = [];
    for (const r of e.refs) {
      const n = normer(r);
      if (connus.has(n)) {
        if (!gardees.includes(n)) gardees.push(n);
      } else retirees.push(`${typeof r === "string" ? r : String(r)} (${String(e.id)})`);
    }
    e.refs = gardees;
    if (!Array.isArray(e.surMot)) continue;
    for (const s of e.surMot) {
      if (!s || typeof s.ref !== "string") continue;
      const n = normer(s.ref);
      if (!connus.has(n)) delete s.ref;
      else {
        s.ref = n;
        if (!gardees.includes(n) && gardees.length < 20) gardees.push(n);
      }
    }
  }
  return { brute: copie, retirees };
}

/**
 * Écrit le script d'une carte validée. Au plus 2 appels, chacun précédé de sa réservation. `ok: false` : la main
 * revient à Will avec les refus en français ; aucun appel si le réglage est refusé.
 */
export async function ecrireScriptIV(entree: EntreeEcritureIV, outils: OutilsEcritureIV): Promise<ResultatEcritureIV> {
  const reglage = lireDecoupage(entree.decoupage);
  if (!reglage.ok) return { ok: false, motif: "reglage", message: reglage.message, refus: [reglage.message], appels: 0 };

  const role = roleEcritureImageVideo;
  const complexite = complexiteDe(entree.carte);
  const ctx: ContexteRegles = { ...entree, complexite };
  const base = variableEcritureIV(entree.carte, complexite, entree.choixFormules, entree.recit, entree.parcours);
  let contexte: EntreeRole["contexte"] = {};
  try {
    contexte = contexteDuSocleIV(outils.socle ? await outils.socle() : undefined);
  } catch {
    contexte = {};
  }

  let variable = base;
  let refus: string[] = [];
  /** Dernière fiche lue mais refusée : gardée pour la réparation sans appel après le dernier essai. */
  let derniere: unknown;
  let appels = 0;
  /** Références hors de la carte retirées de la dernière réponse lue (trace). */
  let refsRetirees: string[] = [];
  /** Simulation de la dernière réponse reçue (la réparation sans appel la garde). */
  let simule = false;
  let coutUsd: number | undefined;
  for (let essai = 1; essai <= APPELS_ECRITURE_MAX; essai++) {
    const entreeRole: EntreeRole = { contexte, variable };
    const appelId = idAppelEcritureIV(entree, essai);
    const reservation = await outils.budget.reserver({ appelId, videoId: entree.videoId, etape: ETAPE_ECRITURE, modele: role.modele, coutEstimeUsd: coutEstimeUsd(role, entreeRole) });
    if (!reservation.ok) return { ok: false, motif: "budget", message: `Écriture non lancée : ${reservation.message}`, refus, appels };

    appels++;
    const reponse = await outils.appeler(role, entreeRole);
    if (!reponse.ok) return { ok: false, motif: "appel", message: `Écriture interrompue : ${reponse.message}`, refus, appels };
    simule = reponse.simule;
    if (reponse.coutUsd !== undefined) coutUsd = (coutUsd ?? 0) + reponse.coutUsd;

    if (reponse.stopReason === "max_tokens") {
      refus = [REPONSE_COUPEE];
      derniere = undefined;
      variable = variableRelanceIV(base, "(réponse coupée, non reprise)", refus);
      continue;
    }
    const lecture = lire(reponse);
    if (lecture.ok) lecture.brute = sansAnimationsHorsMots(lecture.brute);
    refsRetirees = [];
    if (lecture.ok) {
      const nette = sansRefsInconnues(lecture.brute, entree.carte);
      lecture.brute = nette.brute;
      refsRetirees = nette.retirees;
    }
    const jugement = lecture.ok ? jugerFicheIV(lecture.brute, ctx) : { ok: false as const, refus: [lecture.refus] };
    if (jugement.ok) {
      const verdict = { ...jugement.verdict, marques: [...jugement.verdict.marques, ...marqueRefs(refsRetirees)] };
      const aTrancher = aTrancherParWill(verdict);
      const commun = { fiche: jugement.fiche, verdict, aTrancher, appels, relance: essai > 1, simule: reponse.simule, ...(coutUsd !== undefined ? { coutUsd } : {}) };
      // `ok` suit le verdict : un script qui attend un choix de Will n'est jamais rendu « bon ».
      if (!verdict.ok) {
        const refusWill = verdict.manquements.map((m) => m.message);
        return { ok: false, motif: "a-trancher", message: `Script écrit : ${refusWill.length} point(s) à trancher par Will avant validation.`, refus: refusWill, ...commun };
      }
      return { ok: true, ...commun };
    }
    refus = jugement.refus;
    derniere = lecture.ok ? lecture.brute : undefined;
    variable = variableRelanceIV(base, lecture.texte, refus);
    // Phrase trop longue (Q09) : coupée sans appel, sans changer un mot ni la lecture d'un chiffre (`reparation-script.ts`).
    const coupee = lecture.ok ? reparerPhrasesLonguesIV(lecture.brute, ctx) : null;
    if (coupee) {
      if (!coupee.refus.length) {
        const verdict = { ...coupee.verdict, marques: [...coupee.verdict.marques, ...marqueRefs(refsRetirees), `Réparée sans appel : phrase coupée (${coupee.coupes.join(", ")}).`] };
        const aTrancher = aTrancherParWill(verdict);
        const commun = { fiche: coupee.fiche, verdict, aTrancher, appels, relance: essai > 1, simule: reponse.simule, ...(coutUsd !== undefined ? { coutUsd } : {}) };
        if (!verdict.ok) {
          const refusWill = verdict.manquements.map((m) => m.message);
          return { ok: false, motif: "a-trancher", message: `Script écrit : ${refusWill.length} point(s) à trancher par Will avant validation.`, refus: refusWill, ...commun };
        }
        return { ok: true, ...commun };
      }
      // Un autre refus reste : chemin normal, sur la fiche coupée (la coupe est gardée pour la réparation des chiffres).
      refus = coupee.refus;
      derniere = coupee.fiche;
      variable = variableRelanceIV(base, JSON.stringify(coupee.fiche), refus);
    }
  }
  // Jamais d'impasse : chiffres hors image seuls en cause → on les retire (sans appel) et on rejuge.
  const reparee = derniere === undefined ? null : reparerChiffresHorsImage(derniere, ctx);
  if (reparee) {
    const remarque = `Chiffres retirés (hors de l'image) : ${reparee.retires.join(", ")}.`;
    const verdict = { ...reparee.verdict, marques: [...reparee.verdict.marques, remarque] };
    const aTrancher = aTrancherParWill(verdict);
    const commun = { fiche: reparee.fiche, verdict, aTrancher, appels, relance: appels > 1, simule, ...(coutUsd !== undefined ? { coutUsd } : {}) };
    if (!verdict.ok) {
      const refusWill = verdict.manquements.map((m) => m.message);
      return { ok: false, motif: "a-trancher", message: `Script écrit : ${refusWill.length} point(s) à trancher par Will avant validation.`, refus: refusWill, ...commun };
    }
    return { ok: true, ...commun };
  }
  return { ok: false, motif: "refusee", message: `${DEBUT_REFUS_ECRITURE} après ${APPELS_ECRITURE_MAX} essais (${refus.length} refus) : à reprendre à la main.`, refus, appels };
}
