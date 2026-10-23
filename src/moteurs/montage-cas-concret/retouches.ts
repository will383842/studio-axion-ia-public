/**
 * RETOUCHES PAR OPÉRATIONS DU CAS CONCRET (tâche P2-02), côté moteur. Patron : `montage-tableau/retouches.ts`.
 *
 * Une LISTE FERMÉE d'opérations nommées : changer une phrase dite, changer un chiffre (parmi les valeurs de son fait),
 * retirer ou déplacer une étape, changer le mot à commenter, passer « sans le mot ». Chacune est PURE : (fiche, réglages
 * des fins, paramètres) → nouvelle fiche et nouveaux réglages ; puis la fiche entière repasse la validation complète
 * (`validerFicheEcrans` : schéma R01, document promis, règles R02 à R22) avec le plan des fins qui en découle. Aucune
 * saisie libre de coordonnées : une opération désigne un écran par son identifiant (« e06 ») ; la fin n'est jamais
 * écrite (elle vient de la table des fins).
 *
 * `apercuRetoucheCasConcret` rend, SANS RIEN LANCER, ce qui serait refait en comparant l'avant et l'après :
 *  - la voix : le corps n'est relu que si son texte change ; une fin n'est relue que si son texte n'est pas déjà lu
 *    (prises gardées de la version d'avant) ; changer le mot ne relit donc que les fins qui le disent ;
 *  - les écrans : ceux dont l'empreinte change : ce qu'ils MONTRENT (le texte dit n'est pas dessiné) et leurs heures,
 *    apparitions comprises, ESTIMÉES au débit de la recette (un écran décalé est refait). Une nouvelle lecture du corps
 *    peut, en vrai, décaler d'autres écrans de quelques images : la chaîne rend alors ceux-là aussi (clé par empreinte),
 *    sans rien payer de plus.
 *
 * Aucun accès base ni réseau : le cas, la table des fins et les interdits arrivent par le contexte.
 */
import { z } from "zod";
import { jsonCanonique, texteObligatoire } from "@/briques/fiche-scenes";
import type { FinTable } from "@/briques/fins";
import type { ContexteAxion } from "@/domaine/types";
import type { ReseauCas } from "@/formats/cas-concret";
import type { CasConcret } from "@/formats/cas-concret/cas";
import { regrouperFins } from "./etapes";
import { cadreDeFicheEcrans, cleMot, idEcranAttendu, motsLus, texteDuCorps, type CadreEcrans, type Ecran, type EcranCorps, type FicheEcrans, type PlanDesFins } from "./fiche";
import { motValide, planDesFins } from "./fins";
import { ETAPES, MOTS_INTERDITS_FORMAT, nombresDe, tempsEcrans, validerFicheEcrans, type TempsEcran } from "./regles";

/* ------------------------------------------------------------------ */
/* Liste fermée                                                          */
/* ------------------------------------------------------------------ */

/** Un écran du corps (« e01 »…) ; la fin n'est jamais retouchée écran par écran. */
const ecranId = z.string().regex(/^e\d{2}$/, { message: "identifiant d'écran du corps attendu (« e01 »…)" });

export const schemaOperationRetoucheCasConcret = z.discriminatedUnion("type", [
  /** Remplace une phrase (ou un morceau de phrase) DITE sur un écran. */
  z.strictObject({ type: z.literal("changer-phrase"), ecranId, avant: texteObligatoire(400), apres: texteObligatoire(400) }),
  /** Change le chiffre d'un écran `chiffre`, ou d'une barre d'un écran `resultat`, pour une autre valeur de son fait. */
  z.strictObject({ type: z.literal("changer-chiffre"), ecranId, valeur: z.number().finite(), barre: z.enum(["avant", "maintenant"]).optional() }),
  z.strictObject({ type: z.literal("retirer-etape"), ecranId }),
  /** Échange l'étape avec l'étape d'avant ou d'après. */
  z.strictObject({ type: z.literal("deplacer-etape"), ecranId, vers: z.enum(["avant", "apres"]) }),
  /** Le mot à commenter (forme écrite « IA », forme lue « I.A. ») ; remet le mot s'il était retiré. */
  z.strictObject({ type: z.literal("changer-mot"), mot: z.string(), motDit: texteObligatoire(40).optional() }),
  z.strictObject({ type: z.literal("sans-le-mot") }),
]);

export type OperationRetoucheCasConcret = z.infer<typeof schemaOperationRetoucheCasConcret>;
export type TypeOperationRetoucheCasConcret = OperationRetoucheCasConcret["type"];

/** Ce qu'une opération touche : le corps (sa voix est relue) ou les fins seulement. */
export interface DescriptionOperationCasConcret {
  /** Texte du bouton, en français simple. */
  libelle: string;
  touche: "corps" | "fins";
}

export const CATALOGUE_RETOUCHES_CAS_CONCRET: Readonly<Record<TypeOperationRetoucheCasConcret, DescriptionOperationCasConcret>> = {
  "changer-phrase": { libelle: "Changer une phrase", touche: "corps" },
  "changer-chiffre": { libelle: "Changer un chiffre", touche: "corps" },
  "retirer-etape": { libelle: "Retirer une étape", touche: "corps" },
  "deplacer-etape": { libelle: "Déplacer une étape", touche: "corps" },
  "changer-mot": { libelle: "Changer le mot à commenter", touche: "fins" },
  "sans-le-mot": { libelle: "Sans le mot", touche: "fins" },
};

export const TYPES_OPERATION_RETOUCHE_CAS_CONCRET = Object.keys(CATALOGUE_RETOUCHES_CAS_CONCRET) as TypeOperationRetoucheCasConcret[];

/** Vrai si `type` est une opération de la liste. */
export function estOperationRetoucheCasConcret(type: unknown): type is TypeOperationRetoucheCasConcret {
  return typeof type === "string" && Object.prototype.hasOwnProperty.call(CATALOGUE_RETOUCHES_CAS_CONCRET, type);
}

/** Lit une opération brute (bouton, service, discussion) ; `null` : hors liste ou forme fausse. */
export function lireOperationRetoucheCasConcret(brute: unknown): OperationRetoucheCasConcret | null {
  const r = schemaOperationRetoucheCasConcret.safeParse(brute);
  return r.success ? r.data : null;
}

/* ------------------------------------------------------------------ */
/* Contexte et résultat                                                  */
/* ------------------------------------------------------------------ */

/** Réglages des fins portés par la vidéo (`entrees.casConcret`). */
export interface ReglagesFins {
  mot: string;
  motDit?: string;
  avecMot: boolean;
}

export interface ContexteRetoucheCasConcret extends ReglagesFins {
  cas: CasConcret;
  reseaux: readonly ReseauCas[];
  /** Réseaux cochés où le mot est branché (`motBranchePour`) : le mot n'est dit que là. Absent : nulle part. */
  motSur?: readonly ReseauCas[];
  table: readonly FinTable[];
  /** Mots interdits en clair (ceux de Will). */
  motsInterdits?: readonly string[];
  interdits?: ContexteAxion["interdits"];
  debitMotsParSeconde?: number;
  /** Texte tel que la voix le lit (prononciations substituées) : comparé aux prises gardées et compté. */
  lire?: (texte: string) => string;
  /**
   * Textes déjà lus et gardés (prises de la version d'avant). Absent : ceux de la fiche et des fins d'avant ; `null` :
   * aucune prise gardée, tout est relu.
   */
  voixGardee?: { corps?: string; fins: readonly string[] } | null;
}

export interface ApercuRetoucheCasConcret {
  ok: boolean;
  /** La nouvelle fiche (sans heures : le calage les repose) ; refusée : la fiche de départ, sans heures. */
  fiche: FicheEcrans;
  reglages: ReglagesFins;
  /** Plan des fins regroupé (celui de la chaîne). */
  plan: PlanDesFins;
  corpsRelu: boolean;
  /** Fins relues (identifiants du plan regroupé). */
  finsRelues: string[];
  /** Textes envoyés à la voix (corps puis fins), pour le coût. */
  textesARelire: string[];
  caracteresARelire: number;
  /** Écrans refaits : « e06 » pour le corps, « fin-facebook-f01 » pour une fin. */
  ecransRefaits: string[];
  /** Refus en phrases claires pour Will (vide si acceptée). */
  refus: string[];
}

/* ------------------------------------------------------------------ */
/* Opérations                                                            */
/* ------------------------------------------------------------------ */

class RefusRetouche extends Error {}

const refuser = (phrase: string): never => {
  throw new RefusRetouche(phrase);
};

interface Etat {
  fiche: FicheEcrans;
  reglages: ReglagesFins;
}

const nombreFr = (n: number) => String(n).replace(".", ",");

function trouverEcran(fiche: FicheEcrans, id: string): { ecran: EcranCorps; i: number } {
  const i = fiche.ecrans.findIndex((e) => e.id === id);
  if (i < 0) refuser(`L'écran ${id} n'existe pas dans cette vidéo.`);
  return { ecran: fiche.ecrans[i], i };
}

/**
 * Une étape et les écrans « objet » qui la prolongent (même titre, juste après : ce qu'elle évite, son détail, ses
 * faits) : rangs [debut, fin[. Ils se retirent et se déplacent ensemble.
 */
function blocEtape(ecrans: readonly EcranCorps[], i: number): [number, number] {
  const titre = (ecrans[i] as Extract<EcranCorps, { type: "etape" }>).titre;
  let j = i + 1;
  while (j < ecrans.length && ecrans[j].type === "objet" && (ecrans[j] as Extract<EcranCorps, { type: "objet" }>).titre === titre) j++;
  return [i, j];
}

/** Écrans renumérotés « e01 »… et étapes renumérotées « Étape 1 / n ». */
function renumeroter(ecrans: EcranCorps[]): EcranCorps[] {
  const total = ecrans.filter((e) => e.type === "etape").length;
  let n = 0;
  return ecrans.map((e, i) => (e.type === "etape" ? { ...e, id: idEcranAttendu(i), numero: ++n, total } : { ...e, id: idEcranAttendu(i) }));
}

/** Un morceau de texte entier (ni coupé au milieu d'un mot) trouvé une seule fois : son rang de caractère. */
function placeDe(texte: string, morceau: string): number | null {
  const m = morceau.trim();
  const ok = (i: number) => (i === 0 || /\s/.test(texte[i - 1])) && !/[\p{L}\p{N}]/u.test(texte[i + m.length] ?? "");
  const places: number[] = [];
  for (let i = texte.indexOf(m); i >= 0; i = texte.indexOf(m, i + 1)) if (ok(i)) places.push(i);
  return places.length === 1 ? places[0] : null;
}

function changerPhrase(etat: Etat, op: Extract<OperationRetoucheCasConcret, { type: "changer-phrase" }>): void {
  const { ecran, i } = trouverEcran(etat.fiche, op.ecranId);
  const avant = op.avant.trim();
  const apres = op.apres.trim().replace(/\s+/g, " ");
  const place = placeDe(ecran.texteDit, avant);
  if (place === null) refuser(`La phrase « ${avant} » n'est pas dite telle quelle sur l'écran ${ecran.id} : recopiez-la exactement.`);
  const nApres = motsLus(apres).length;
  if (!nApres) refuser("La nouvelle phrase ne contient aucun mot.");
  // Les apparitions gardent leur mot : après la phrase, elles suivent le décalage ; dedans, elles restent dans la phrase.
  const debut = motsLus(ecran.texteDit.slice(0, place!)).length;
  const nAvant = motsLus(avant).length;
  const evenements = ecran.evenements.map((ev) => {
    if (ev.surMot < debut) return ev;
    if (ev.surMot >= debut + nAvant) return { ...ev, surMot: ev.surMot + nApres - nAvant };
    return { ...ev, surMot: debut + Math.min(ev.surMot - debut, nApres - 1) };
  });
  const texteDit = `${ecran.texteDit.slice(0, place!)}${apres}${ecran.texteDit.slice(place! + avant.length)}`;
  etat.fiche.ecrans[i] = { ...ecran, texteDit, evenements } as EcranCorps;
}

/** Champs d'un écran qui ne sont jamais du texte montré ou dit. */
const CLES_TECHNIQUES = new Set(["id", "type", "fond", "marque", "faitId", "cible", "sorte", "objet", "repli"]);

/** Remplace un nombre écrit en chiffres (« 15 », « 1,5 ») par un autre, dans le texte dit et les textes de l'écran. */
function remplacerNombre<T>(valeur: T, ancien: number, nouveau: number, cle?: string): T {
  if (typeof valeur === "string") {
    if (cle && CLES_TECHNIQUES.has(cle)) return valeur;
    const motif = new RegExp(`(?<![\\p{N},.])${nombreFr(ancien).replace(/[.,]/g, "[.,]")}(?![\\p{N}]|[.,]\\p{N})`, "gu");
    return valeur.replace(motif, nombreFr(nouveau)) as T;
  }
  if (Array.isArray(valeur)) return valeur.map((v) => remplacerNombre(v, ancien, nouveau, cle)) as T;
  if (valeur && typeof valeur === "object") return Object.fromEntries(Object.entries(valeur).map(([k, v]) => [k, remplacerNombre(v, ancien, nouveau, k)])) as T;
  return valeur;
}

function changerChiffre(etat: Etat, op: Extract<OperationRetoucheCasConcret, { type: "changer-chiffre" }>, cas: CasConcret): void {
  const { ecran, i } = trouverEcran(etat.fiche, op.ecranId);
  let ancien: number;
  let faitId: string | undefined;
  if (ecran.type === "chiffre") {
    if (op.barre) refuser(`L'écran ${ecran.id} n'a pas de barres : changez son chiffre sans choisir de barre.`);
    ancien = ecran.valeur;
    faitId = ecran.faitId;
  } else if (ecran.type === "resultat") {
    if (!op.barre) refuser(`Choisissez la barre de l'écran ${ecran.id} à changer : « avant » ou « maintenant ».`);
    ancien = ecran[op.barre!].valeur;
    faitId = ecran[op.barre!].faitId;
    if (!faitId) refuser(`La barre « ${op.barre} » de l'écran ${ecran.id} ne vient d'aucun fait : sa valeur ne peut pas changer.`);
  } else return refuser(`L'écran ${ecran.id} ne montre aucun chiffre.`);
  const fait = cas.faits.find((f) => f.id === faitId) ?? refuser(`Le chiffre de l'écran ${ecran.id} ne vient d'aucun fait du cas.`);
  if (!fait.valeurs.includes(op.valeur)) {
    refuser(`« ${nombreFr(op.valeur)} » n'est pas une valeur du fait « ${fait.enonce} » : choisissez parmi ${fait.valeurs.map((v) => `« ${nombreFr(v)} »`).join(", ")}.`);
  }
  const remplace = remplacerNombre(ecran, ancien!, op.valeur);
  const nouvel: EcranCorps =
    remplace.type === "chiffre" ? { ...remplace, valeur: op.valeur } : remplace.type === "resultat" ? { ...remplace, [op.barre!]: { ...remplace[op.barre!], valeur: op.valeur } } : remplace;
  // Dit en toutes lettres : la voix dirait encore l'ancien nombre.
  if (ancien! !== op.valeur && nombresDe(nouvel.texteDit).includes(ancien!)) {
    refuser(`Le chiffre « ${nombreFr(ancien!)} » est dit en toutes lettres sur l'écran ${ecran.id} : changez plutôt la phrase.`);
  }
  etat.fiche.ecrans[i] = nouvel;
}

function retirerEtape(etat: Etat, op: Extract<OperationRetoucheCasConcret, { type: "retirer-etape" }>): void {
  const { ecran } = trouverEcran(etat.fiche, op.ecranId);
  if (ecran.type !== "etape") refuser(`L'écran ${ecran.id} n'est pas une étape.`);
  if (etat.fiche.ecrans.filter((e) => e.type === "etape").length <= ETAPES.min) refuser(`Une vidéo garde au moins ${ETAPES.min} étapes : celle-ci ne peut pas être retirée.`);
  // L'étape part avec ses écrans « objet » ; chaque place restante garde son fond (alternance des fonds).
  const [debut, fin] = blocEtape(etat.fiche.ecrans, etat.fiche.ecrans.indexOf(ecran));
  const fonds = etat.fiche.ecrans.map((e) => e.fond);
  const restants = etat.fiche.ecrans.filter((_, k) => k < debut || k >= fin).map((e, k) => ({ ...e, fond: fonds[k] }) as EcranCorps);
  etat.fiche.ecrans = renumeroter(restants) as FicheEcrans["ecrans"];
}

function deplacerEtape(etat: Etat, op: Extract<OperationRetoucheCasConcret, { type: "deplacer-etape" }>): void {
  const { ecran, i } = trouverEcran(etat.fiche, op.ecranId);
  if (ecran.type !== "etape") refuser(`L'écran ${ecran.id} n'est pas une étape.`);
  const rangs = etat.fiche.ecrans.flatMap((e, k) => (e.type === "etape" ? [k] : []));
  const ici = rangs.indexOf(i);
  const j = rangs[op.vers === "avant" ? ici - 1 : ici + 1];
  if (j === undefined) refuser(op.vers === "avant" ? "C'est déjà la première étape." : "C'est déjà la dernière étape.");
  // Chaque place garde son fond (alternance des fonds) ; l'étape emporte son texte, son visuel et ses apparitions.
  // Chaque étape emporte ses écrans « objet » (`blocEtape`).
  const tous = etat.fiche.ecrans;
  const [a, b] = blocEtape(tous, Math.min(i, j!));
  const [c, d] = blocEtape(tous, Math.max(i, j!));
  const ecrans = [...tous.slice(0, a), ...tous.slice(c, d), ...tous.slice(b, c), ...tous.slice(a, b), ...tous.slice(d)].map((e, k) => ({ ...e, fond: tous[k].fond }) as EcranCorps);
  etat.fiche.ecrans = renumeroter(ecrans) as FicheEcrans["ecrans"];
}

function changerMot(etat: Etat, op: Extract<OperationRetoucheCasConcret, { type: "changer-mot" }>, contexte: ContexteRetoucheCasConcret): void {
  const mot = op.mot.trim();
  if (!motValide(mot)) refuser("Le mot doit faire 2 à 24 lettres ou chiffres, sans espace.");
  const interdits = [...MOTS_INTERDITS_FORMAT, ...(contexte.motsInterdits ?? [])].map(cleMot);
  if (interdits.includes(cleMot(mot)) || (op.motDit && interdits.includes(cleMot(op.motDit)))) refuser(`Le mot « ${mot} » fait partie des mots interdits.`);
  // Sans forme lue, le mot est dit comme il est écrit (jamais la forme lue de l'ancien mot).
  etat.reglages = { mot, motDit: op.motDit?.trim() || mot, avecMot: true };
}

/** Applique UNE opération sur l'état (copie). Lève `RefusRetouche` avec une phrase pour Will. */
function appliquer(etat: Etat, op: OperationRetoucheCasConcret, contexte: ContexteRetoucheCasConcret): void {
  switch (op.type) {
    case "changer-phrase":
      return changerPhrase(etat, op);
    case "changer-chiffre":
      return changerChiffre(etat, op, contexte.cas);
    case "retirer-etape":
      return retirerEtape(etat, op);
    case "deplacer-etape":
      return deplacerEtape(etat, op);
    case "changer-mot":
      return changerMot(etat, op, contexte);
    case "sans-le-mot":
      etat.reglages = { ...etat.reglages, avecMot: false };
      return;
  }
}

/* ------------------------------------------------------------------ */
/* Ce qui est refait                                                     */
/* ------------------------------------------------------------------ */

/** La fiche sans les heures du calage (une fiche gardée par la version d'avant est calée). */
export function sansHeures(fiche: FicheEcrans): FicheEcrans {
  return {
    ...fiche,
    ecrans: fiche.ecrans.map((e) => {
      const { debutMs: _d, finMs: _f, ...reste } = e;
      void _d;
      void _f;
      return reste;
    }) as FicheEcrans["ecrans"],
  };
}

function planDe(reglages: ReglagesFins, contexte: ContexteRetoucheCasConcret): PlanDesFins {
  const { mot, motDit, avecMot } = reglages;
  const { cas } = contexte;
  return regrouperFins(planDesFins({ reseaux: [...contexte.reseaux], offre: cas.offre, ...(cas.nature ? { nature: cas.nature } : {}), mot, ...(motDit ? { motDit } : {}), avecMot, motSur: [...(contexte.motSur ?? [])], table: contexte.table }));
}

export const texteDeFin = (f: PlanDesFins["fins"][number]) => f.ecrans.map((e) => e.texteDit.trim()).join(" ");

/**
 * Empreinte de chaque écran rendu (ce qu'il montre, cadre, heures estimées de l'écran et de ses apparitions), nommé comme
 * la chaîne nomme ses écrans.
 */
function empreintesEcrans(fiche: FicheEcrans, plan: PlanDesFins, debit: number | undefined): Map<string, string> {
  const cadre: CadreEcrans = cadreDeFicheEcrans(fiche);
  const cle = (t: TempsEcran) => {
    const { texteDit: _dit, avanceMs: _avance, evenements, ...montre } = t.ecran as Ecran;
    void _dit;
    void _avance;
    const apparitions = evenements.map((ev) => ({ cible: ev.cible, ms: Math.round((t.motsMs[ev.surMot] ?? t.debutMs) - ev.avanceMs) }));
    return jsonCanonique({ cadre, montre, apparitions, debutMs: Math.round(t.debutMs), finMs: Math.round(t.finMs) });
  };
  const res = new Map<string, string>();
  for (const t of tempsEcrans(fiche.ecrans, debit)) res.set(t.ecran.id, cle(t));
  for (const f of plan.fins) for (const t of tempsEcrans([...fiche.ecrans, ...f.ecrans], debit).slice(fiche.ecrans.length)) res.set(`${f.id}-${t.ecran.id}`, cle(t));
  return res;
}

/* ------------------------------------------------------------------ */
/* Aperçu                                                                */
/* ------------------------------------------------------------------ */

const vide = (): Pick<ApercuRetoucheCasConcret, "corpsRelu" | "finsRelues" | "textesARelire" | "caracteresARelire" | "ecransRefaits"> => ({ corpsRelu: false, finsRelues: [], textesARelire: [], caracteresARelire: 0, ecransRefaits: [] });

/**
 * Aperçu d'une ou plusieurs opérations, appliquées dans l'ordre, SANS rien lancer : la nouvelle fiche validée, les
 * réglages des fins, ce qui serait relu et refait. Refusée : la fiche de départ et les raisons en phrases claires.
 */
export function apercuRetoucheCasConcret(fiche: FicheEcrans, operations: unknown, contexte: ContexteRetoucheCasConcret): ApercuRetoucheCasConcret {
  const depart: Etat = { fiche: sansHeures(fiche), reglages: { mot: contexte.mot, ...(contexte.motDit ? { motDit: contexte.motDit } : {}), avecMot: contexte.avecMot } };
  const planAvant = planDe(depart.reglages, contexte);
  const refus = (raisons: string[]): ApercuRetoucheCasConcret => ({ ok: false, fiche: depart.fiche, reglages: depart.reglages, plan: planAvant, ...vide(), refus: raisons });

  const liste: readonly unknown[] = Array.isArray(operations) ? operations : [operations];
  if (!liste.length) return refus(["Aucune retouche n'est demandée."]);
  const etat: Etat = structuredClone(depart);
  try {
    for (const brute of liste) {
      const op = lireOperationRetoucheCasConcret(brute) ?? refuser("Cette retouche ne fait pas partie de la liste proposée.");
      appliquer(etat, op, contexte);
    }
  } catch (err) {
    if (err instanceof RefusRetouche) return refus([err.message]);
    // Une fiche gardée mal formée ne se retouche pas.
    return refus(["La fiche d'écrans de cette vidéo est illisible : la retouche n'est pas possible."]);
  }
  if (jsonCanonique(etat) === jsonCanonique(depart)) return refus(["Cette retouche ne change rien à la vidéo."]);

  const plan = planDe(etat.reglages, contexte);
  // Le mot n'est dit que là où il est branché : le changer ailleurs ne change aucune fin.
  const finsDites = (p: PlanDesFins) => jsonCanonique(p.fins.map((f) => [f.reseaux, texteDeFin(f)]));
  if (jsonCanonique(etat.fiche) === jsonCanonique(depart.fiche) && finsDites(plan) === finsDites(planAvant)) return refus(["Cette retouche ne change rien à la vidéo."]);
  if (!plan.fins.length) return refus(plan.sansFin.length ? plan.sansFin.map((s) => s.raison) : ["Aucune fin possible pour ces réseaux."]);
  const validation = validerFicheEcrans(etat.fiche, {
    cas: contexte.cas,
    // Le texte dit est la référence : il devient le nouveau script (contrôles du script repassés sur lui).
    texteScript: texteDuCorps(etat.fiche),
    ...(contexte.interdits ? { interdits: contexte.interdits } : {}),
    motsInterdits: [...(contexte.motsInterdits ?? [])],
    ...(contexte.debitMotsParSeconde ? { debitMotsParSeconde: contexte.debitMotsParSeconde } : {}),
    fins: plan.fins,
  });
  if (!validation.ok) return refus(validation.problemes.map((p) => `Cette retouche n'est pas possible. ${p.message}`));

  // Voix : seul ce qui n'est pas déjà lu est relu.
  const lire = contexte.lire ?? ((t: string) => t);
  const gardee = contexte.voixGardee === undefined ? { corps: lire(texteDuCorps(depart.fiche)), fins: planAvant.fins.map((f) => lire(texteDeFin(f))) } : (contexte.voixGardee ?? { fins: [] });
  const corps = lire(texteDuCorps(validation.fiche));
  const corpsRelu = corps !== gardee.corps;
  const finsRelues = plan.fins.filter((f) => !gardee.fins.includes(lire(texteDeFin(f))));
  const textesARelire = [...(corpsRelu ? [corps] : []), ...finsRelues.map((f) => lire(texteDeFin(f)))];

  // Écrans : ceux dont l'empreinte n'existe pas déjà.
  const avant = new Set(empreintesEcrans(depart.fiche, planAvant, contexte.debitMotsParSeconde).values());
  const ecransRefaits = [...empreintesEcrans(validation.fiche, plan, contexte.debitMotsParSeconde)].filter(([, e]) => !avant.has(e)).map(([nom]) => nom);

  return {
    ok: true,
    fiche: validation.fiche,
    reglages: etat.reglages,
    plan,
    corpsRelu,
    finsRelues: finsRelues.map((f) => f.id),
    textesARelire,
    caracteresARelire: textesARelire.reduce((n, t) => n + t.length, 0),
    ecransRefaits,
    refus: [],
  };
}
