/**
 * IMAGE → VIDÉO · Fins de secours (15/10, v-dd3049053f88, décisions de Will). PUR, sans service ni fournisseur :
 * importable par la vue de l'écran (`components/formats/image-video/vue.ts`).
 *
 * Prod : la voix de la fin Facebook (« … Le lien est en commentaire. ») s'écartait de la référence (hauteur +17 %) après
 * ses deux lectures, quand le corps et les autres fins passaient. Will valide une reformulation légère de la DERNIÈRE
 * phrase (`fin-fb-lien-premier-commentaire`, décision « A ») ; elle s'écarte à son tour (hauteur +24 %, dynamique +20 %,
 * trav-f2b26bba35ac) : le mot « commentaire » semble faire monter la voix. Will valide alors (« OK fais ce qui est
 * nécessaire ») une 2ᵉ fin de secours (`fin-fb-lien-sous-video`), puis un REPLI sans lecture : Facebook reprend la version
 * Instagram (même fin dite, même son déjà payé et validé, même rendu).
 *
 * CHAÎNE ordonnée par réseau (`FINS_DE_SECOURS_IV`) : fin habituelle → secours 1 → secours 2 → repli.
 * - Jamais choisie d'office : `planDesFinsIV` garde ses choix. Une étape n'est proposée qu'après un arrêt de la voix (Q16)
 *   dont la SEULE cause est la voix d'une ou plusieurs fins de la chaîne (mesure à jour, corps et autres fins acceptés).
 * - Une fin de secours est une lecture payée (réservée par la caisse, plafond tenu), posée par « Refaire cette partie »
 *   (`reprendreIV`) ; le corps et les autres fins payés sont gardés, jamais relus.
 * - Chaque fin de secours est lue AU PLUS UNE FOIS : hors référence ou hésitante, elle est refusée (Q16), jamais relue ;
 *   la chaîne avance toujours (une étape passée ne revient pas).
 * - 19/10 (v-6a3b74364711) : Instagram et YouTube Shorts (qui disent la même fin) ont UNE fin de secours, sans repli ; le lien
 *   reste dans le PROFIL (`lien: "profil"`). Quand la chaîne est épuisée, « Refaire cette partie » peut RELIRE UNE FOIS la
 *   seule fin de secours refusée (lecture neuve du même texte, `voix.ts`), en dernier recours, jamais sans ce clic, sous
 *   le plafond ; une fin de secours déjà relue n'a plus rien (`EtatVoixIV.relues`).
 * - Le repli ne lit rien : il est posé AUTOMATIQUEMENT, dans le même passage (`pasVoix`), dès que la dernière fin de secours
 *   est refusée. Au-delà, plus aucune lecture payante, même après « Relever le plafond ».
 */
import { comparerAReference, TOLERANCES_VOIX, VERSION_MESURE_VOIX, verdictSurMesureAncienne } from "@/briques/voix-maitre/reference";
import { ErreurFin, suiteDeFins, TABLE_FINS_DIAGNOSTIC, type FinChoisie } from "@/briques/fins";
import { REFERENCE_V4_IV } from "@/domaine/image-video/reference-voix";
import { PLAFONDS_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import type { EtatFabricationIV } from "./fabrication";
import type { FinIV, PlanDesFinsIV } from "./fins";
import type { PriseVoix } from "./emprunts";
import { texteDeFinIV } from "./texte-fin";
import type { EtatVoixIV, SegmentFinIV } from "./voix";

/** Chaîne de secours d'un réseau : la ligne habituelle, ses remplaçantes dans l'ordre (banque commune), puis le repli. */
export interface ChaineDeSecoursIV {
  remplace: string;
  chaine: readonly string[];
  /** Réseau dont la version est reprise, sans lecture, quand toute la chaîne a été refusée. */
  repli?: ReseauIV;
  /**
   * Où le lien est posé quand la fin de secours est en service : `premier-commentaire` (Facebook : la phrase le dit),
   * `profil` (Instagram, Shorts : le lien reste dans le profil, publication normale).
   */
  lien: "premier-commentaire" | "profil";
}

export const FINS_DE_SECOURS_IV: Readonly<Partial<Record<ReseauIV, Readonly<ChaineDeSecoursIV>>>> = Object.freeze({
  facebook: Object.freeze({ remplace: "fin-fb-lien-commentaire", chaine: Object.freeze(["fin-fb-lien-premier-commentaire", "fin-fb-lien-sous-video"]), repli: "instagram" as const, lien: "premier-commentaire" as const }),
  // 19/10 : Instagram et Shorts disent la même fin (même lecture) ; chacun a sa ligne (écran propre), sans repli.
  instagram: Object.freeze({ remplace: "fin-ig-lien-profil", chaine: Object.freeze(["fin-ig-lien-profil-secours"]), lien: "profil" as const }),
  "youtube-shorts": Object.freeze({ remplace: "fin-ty-lien-profil", chaine: Object.freeze(["fin-ys-lien-profil-secours"]), lien: "profil" as const }),
});

/** Phrase de l'écran et du rapport quand une version reprend celle d'un autre réseau. */
export function phraseDeRepliIV(reseaux: readonly ReseauIV[], repli: ReseauIV): string {
  const noms = reseaux.map((r) => PLAFONDS_IV[r].nom).join(", ");
  return `${noms} reprend la version ${PLAFONDS_IV[repli].nom} : la voix des fins ${noms} ne ressemblait pas à la référence.`;
}

/** Écarts d'une prise faite qui s'écarte encore de la référence v4 (rapport de la voix maître) ; `null` : elle ressemble. */
export function ecartHorsReference(p: PriseVoix | undefined): string | null {
  if (p?.etat.phase !== "faite") return null;
  const r = p.etat.audio.ressemblance;
  if (!r || r.ressemblante) return null;
  const retenue = r.prises[r.retenue];
  // 23/10 : référence recalibrée sur la nouvelle voix : la prise retenue, mesurée à la version courante, est rejugée sur sa mesure gardée (gratuit, aucune lecture, retenue inchangée). Un « oui » enregistré n'est jamais rejugé.
  if (retenue?.mesure && (retenue.versionMesure ?? 1) >= VERSION_MESURE_VOIX) {
    const c = comparerAReference(retenue.mesure, REFERENCE_V4_IV);
    return c.ressemblante ? null : c.ecarts.map((e) => e.libelle).join(", ");
  }
  const ecarts = retenue?.ecarts ?? [];
  return ecarts.length ? ecarts.join(", ") : "écart à la référence";
}

/**
 * Écarts d'une FIN qui s'écarte encore de la référence ; `null` : elle ressemble. 18/10 (v-dcc902c3f3dd) : une fin qui
 * commence par une question monte naturellement (+12 % puis +9 % de la v4) alors qu'elle est à +7 % / +5 % du corps de la
 * MÊME vidéo. La HAUTEUR d'une fin est donc jugée par rapport au corps retenu (même tolérance, 8 %) ; les cinq autres
 * mesures restent jugées contre la v4. Corps sans mesure lisible : jugement contre la v4, comme avant. Le corps, lui,
 * reste jugé contre la v4 (`ecartHorsReference`). PUR.
 */
export function ecartFinHorsReference(fin: PriseVoix | undefined, corps: PriseVoix | undefined): string | null {
  if (fin?.etat.phase !== "faite") return null;
  const r = fin.etat.audio.ressemblance;
  if (!r || r.ressemblante) return null;
  const mesureFin = r.prises[r.retenue]?.mesure;
  const rc = corps?.etat.phase === "faite" ? corps.etat.audio.ressemblance : undefined;
  const mesureCorps = rc?.prises[rc.retenue]?.mesure;
  const h = mesureFin?.hauteurHz;
  const hc = mesureCorps?.hauteurHz;
  if (!mesureFin || !mesureCorps || !Number.isFinite(h) || !Number.isFinite(hc) || !hc) return ecartHorsReference(fin);
  const autres = comparerAReference(mesureFin, REFERENCE_V4_IV).ecarts.filter((e) => e.mesure !== "hauteurHz").map((e) => e.libelle);
  const e = h! / hc - 1;
  const tol = TOLERANCES_VOIX.hauteurHz;
  if (Math.abs(e) > tol) autres.unshift(`hauteur ${e >= 0 ? "+" : ""}${Math.round(e * 100)} % par rapport au corps (toléré ${Math.round(tol * 100)} %)`);
  return autres.length ? autres.join(", ") : null;
}

/** L'étape suivante de la chaîne pour une fin du plan : la nouvelle fin, si elle demande une lecture payée, sa phrase. */
export interface EtapeDeSecoursIV {
  fin: FinIV;
  /** Vrai : une fin de secours à lire (une lecture payée) ; faux : repli, rien n'est lu. */
  lecture: boolean;
  /** Phrase dite de la fin de secours, ou phrase du repli. */
  phrase: string;
  /** Repli seulement : identifiant de la fin du plan dont la version est reprise. */
  source?: string;
}

/**
 * Étape suivante de la chaîne de secours de la fin `finId` ; `null` : rien (fin muette, déjà en repli, réseau sans chaîne,
 * ligne absente, remplaçante non validée ou pas marquée de secours, réseau du repli sans version). PUR.
 */
export function etapeDeSecoursIV(plan: Pick<PlanDesFinsIV, "fins">, finId: string): EtapeDeSecoursIV | null {
  const f = plan.fins.find((x) => x.id === finId);
  if (!f || f.muet || f.repli || !f.reseaux.length) return null;
  const s = FINS_DE_SECOURS_IV[f.reseaux[0]];
  if (!s || f.reseaux.some((r) => FINS_DE_SECOURS_IV[r] !== s)) return null;
  const i = f.appels.findIndex((a) => a.id === s.remplace || s.chaine.includes(a.id));
  if (i < 0) return null;
  // Rang dans la chaîne : 0 = fin habituelle ; k = k-ième fin de secours (déjà posée, donc déjà lue ou à lire).
  const rang = f.appels[i].id === s.remplace ? 0 : s.chaine.indexOf(f.appels[i].id) + 1;
  if (rang > 0 !== !!f.secours) return null;
  if (rang < s.chaine.length) {
    const par = s.chaine[rang];
    if (!TABLE_FINS_DIAGNOSTIC.find((l) => l.id === par)?.secours) return null;
    let appel: FinChoisie;
    try {
      // Contrôlée pour chaque réseau de la fin (validée, longueurs, réseau couvert).
      [appel] = f.reseaux.map((r) => suiteDeFins(r, [par], {}, TABLE_FINS_DIAGNOSTIC)[0]);
    } catch (e) {
      if (e instanceof ErreurFin) return null;
      throw e;
    }
    const appels = [...f.appels];
    appels[i] = appel;
    return { fin: { ...f, appels, secours: true }, lecture: true, phrase: appel.dit };
  }
  if (!s.repli) return null;
  // Repli : la version du réseau nommé, telle qu'elle est (question et fin dites, écrans) ; son segment est déjà lu.
  // 19/10 : cette version peut être elle-même en fin de secours (Instagram), sa voix acceptée.
  const source = plan.fins.find((x) => !x.muet && !x.repli && x.reseaux.includes(s.repli!));
  if (!source) return null;
  const { secours: _secours, question: _question, ...reste } = f;
  const fin: FinIV = { ...reste, ...(source.question ? { question: structuredClone(source.question) } : {}), appels: structuredClone(source.appels), repli: s.repli };
  return { fin, lecture: false, phrase: phraseDeRepliIV(f.reseaux, s.repli), source: source.id };
}

/**
 * 19/10 : vrai si la fin `finId` est en fin de secours, au bout de sa chaîne et sans repli : sa voix refusée peut être
 * RELUE une fois (« Refaire cette partie »). Jamais pour une fin habituelle (elle a d'abord sa fin de secours), ni
 * pour une fin dont le repli existe (Facebook : le repli prime, il ne coûte rien). PUR.
 */
export function peutRelireIV(plan: Pick<PlanDesFinsIV, "fins">, finId: string): boolean {
  const f = plan.fins.find((x) => x.id === finId);
  if (!f || f.muet || f.repli || !f.secours || !f.reseaux.length) return false;
  const s = FINS_DE_SECOURS_IV[f.reseaux[0]];
  if (!s || s.repli || f.reseaux.some((r) => FINS_DE_SECOURS_IV[r] !== s)) return false;
  const derniere = s.chaine.at(-1);
  return !!derniere && f.appels.some((a) => a.id === derniere);
}

/**
 * Segments de fin dont la voix est refusée SEULEMENT parce qu'elle s'écarte de la référence (voix finie, corps retenu et
 * ressemblant, aucune fin hésitante, aucune mesure ancienne à refaire). Vide : rien qu'une fin de secours puisse régler.
 */
export function finsHorsReferenceIV(etat: Pick<EtatVoixIV, "voix"> | undefined): string[] {
  const v = etat?.voix;
  if (!v || v.issue?.statut !== "faite" || !v.corps.retenu || ecartHorsReference(v.corps.prise)) return [];
  const prises = [v.corps.prise, ...v.fins.map((f) => f.prise)];
  if (prises.some((p) => p?.etat.phase === "faite" && verdictSurMesureAncienne(p.etat.audio))) return [];
  if (v.fins.some((f) => !f.prise?.controle || "rejet" in f.prise.controle)) return [];
  return v.fins.filter((f) => ecartFinHorsReference(f.prise, v.corps.prise)).map((f) => f.id);
}

/**
 * Voix finie, corps retenu et ressemblant, toutes les fins contrôlées sans hésitation et ressemblantes SELON LA RÈGLE
 * ACTUELLE (hauteur d'une fin jugée par rapport au corps), aucune mesure ancienne : un arrêt Q16 gardé avant cette règle
 * (hauteur de la fin jugée contre la v4) se « Refait » alors sans aucune lecture, le verdict est refait sur le son payé. PUR.
 */
export function voixAcceptableParLaRegleDesFinsIV(etat: Pick<EtatVoixIV, "voix"> | undefined): boolean {
  const v = etat?.voix;
  if (!v || v.issue?.statut !== "faite" || !v.corps.retenu || v.corps.prise?.etat.phase !== "faite" || ecartHorsReference(v.corps.prise)) return false;
  if ([v.corps.prise, ...v.fins.map((f) => f.prise)].some((p) => p?.etat.phase === "faite" && verdictSurMesureAncienne(p.etat.audio))) return false;
  return v.fins.every((f) => f.prise?.etat.phase === "faite" && !!f.prise.controle && !("rejet" in f.prise.controle) && !ecartFinHorsReference(f.prise, v.corps.prise));
}

const SUITE_REFUS = "Aucune autre lecture n'est faite : une nouvelle lecture payante demande l'accord de Will.";

/** Refus Q16 d'UN segment de secours lu une fois (hors référence ou hésitant), sinon `null`. PUR. */
function refusDuSecours(etat: Pick<EtatVoixIV, "voix">, s: SegmentFinIV): string | null {
  const f = etat.voix.fins.find((x) => x.id === s.id);
  const p = f?.prise;
  if (!s.secours || !f || !p) return null;
  const nom = s.reseaux.join(", ");
  if (p.etat.phase === "a-relire") {
    const ecarts = p.etat.prises.at(-1)?.ecarts ?? [];
    return `La voix de la fin de secours pour ${nom} ne ressemble pas non plus à la voix de référence (${ecarts.length ? ecarts.join(", ") : "écart à la référence"}). ${SUITE_REFUS}`;
  }
  const ecart = ecartFinHorsReference(p, etat.voix.corps.prise);
  if (ecart) return `La voix de la fin de secours pour ${nom} ne ressemble pas non plus à la voix de référence (${ecart}). ${SUITE_REFUS}`;
  if ((f.lectures ?? 1) > 1 || (p.controle && "rejet" in p.controle)) {
    const detail = p.controle && "rejet" in p.controle ? ` (${p.controle.detail})` : "";
    return `La fin de secours pour ${nom} hésite${detail}. ${SUITE_REFUS}`;
  }
  return null;
}

/**
 * Fin de secours lue une fois et refusée (hors référence ou hésitante) : la phrase du refus Q16, AVANT toute nouvelle
 * lecture ; `null` sinon. PUR.
 */
export function refusFinDeSecoursIV(etat: Pick<EtatVoixIV, "segments" | "voix">): string | null {
  for (const s of etat.segments.fins) {
    const refus = refusDuSecours(etat, s);
    if (refus) return refus;
  }
  return null;
}

/**
 * Segments de secours lus une fois et refusés, quand c'est la SEULE cause de l'arrêt : corps retenu et ressemblant, toute
 * autre fin finie, contrôlée sans hésitation et ressemblante, aucune mesure ancienne. Vide sinon. PUR.
 */
export function finsDeSecoursRefuseesIV(etat: Pick<EtatVoixIV, "segments" | "voix"> | undefined): string[] {
  if (!etat) return [];
  const v = etat.voix;
  const refusees = etat.segments.fins.filter((s) => refusDuSecours(etat, s)).map((s) => s.id);
  if (!refusees.length || !v.corps.retenu || v.corps.prise?.etat.phase !== "faite" || ecartHorsReference(v.corps.prise)) return [];
  if ([v.corps.prise, ...v.fins.map((f) => f.prise)].some((p) => p?.etat.phase === "faite" && verdictSurMesureAncienne(p.etat.audio))) return [];
  const autres = v.fins.filter((f) => !refusees.includes(f.id));
  // 19/10 : une autre fin pas encore lue (sa fin de secours vient d'être posée) n'est pas une cause d'arrêt : elle sera lue
  // au tour suivant. Seule une fin lue et mauvaise (hésitante, hors référence, non contrôlée) l'est.
  const pasLue = (f: (typeof autres)[number]) => !f.prise || f.prise.etat.phase === "a-lire";
  if (autres.some((f) => !pasLue(f) && (f.prise?.etat.phase !== "faite" || !f.prise.controle || "rejet" in f.prise.controle || ecartFinHorsReference(f.prise, v.corps.prise)))) return [];
  return refusees;
}

export interface SecoursIV {
  /** Le plan des fins avec l'étape suivante de chaque chaîne posée. */
  plan: PlanDesFinsIV;
  /** Réseaux dont la fin change (fin de secours ou repli). */
  reseaux: ReseauIV[];
  /** Phrases dites des fins de secours à lire (vide : repli ou relecture seuls). */
  phrases: string[];
  /** Phrases des replis (aucune lecture). */
  replis: string[];
  /** 19/10 : TEXTES de fin de secours refusés, à relire une fois chacun (lecture neuve du même texte). */
  relire: string[];
  /** 19/10 : réseaux dont la fin est relue (sans changer de texte). */
  reseauxRelire: ReseauIV[];
  /** Vrai : au moins une lecture payée (fin de secours ou relecture) ; faux : repli seul, posé sans lecture ni accord. */
  lecture: boolean;
  /** 19/10 : coût maximal de TOUTES les lectures de cette étape (tarif observé de la vidéo × longueur des textes × lectures permises). */
  coutMaxCentimes: number;
  /** 19/10 : la part de ce coût qui revient aux seules relectures. */
  coutRelireCentimes: number;
  /** 19/10 : nombre total de lectures payées au plus après ce clic (fins de secours neuves, relectures, fins de secours déjà posées et pas encore lues). */
  nbLectures: number;
}

/** Tarif observé de la voix (centimes par caractère) sur les lectures déjà payées de la vidéo ; 0,03 si aucune. */
const TARIF_PAR_DEFAUT_CENTIMES = 0.03;
function tarifObserve(voix: Pick<EtatVoixIV, "voix">): number {
  const payees = voix.voix.payees.filter((p) => p.caracteres > 0 && p.coutCentimes > 0);
  const caracteres = payees.reduce((n, p) => n + p.caracteres, 0);
  return caracteres > 0 ? payees.reduce((n, p) => n + p.coutCentimes, 0) / caracteres : TARIF_PAR_DEFAUT_CENTIMES;
}

/**
 * Étape suivante après un arrêt de la voix (Q16) dû SEULEMENT à des fins de la chaîne (fin habituelle hors référence, ou
 * fin de secours refusée) : le nouveau plan, sinon `null`. Raisonne version par version (19/10) :
 * - la version a une étape suivante (fin de secours, ou repli) : elle est posée ;
 * - sinon, si c'est une fin de secours au bout de sa chaîne, sans repli (Instagram, Shorts) : son texte est à RELIRE, une
 *   seule fois (`relues`) ;
 * - sinon (fin sans chaîne, relecture déjà faite) : `null`, la vidéo s'arrête. Une version en repli suit le segment de sa
 *   source ; un repli dont la source est elle-même refusée attend (`null`). PUR.
 */
export function secoursApresArretIV(voix: Pick<EtatVoixIV, "segments" | "voix"> & Partial<Pick<EtatVoixIV, "relues">>, plan: PlanDesFinsIV): SecoursIV | null {
  const segments = [...new Set([...finsHorsReferenceIV(voix), ...finsDeSecoursRefuseesIV(voix)])];
  if (!segments.length) return null;
  const relues = voix.relues ?? [];
  let suivant: PlanDesFinsIV = plan;
  const reseaux: ReseauIV[] = [];
  const phrases: string[] = [];
  const replis: string[] = [];
  const relire: string[] = [];
  const reseauxRelire: ReseauIV[] = [];
  // Textes à lire (fin de secours neuve : 1 lecture ; relecture : 1 lecture), une fois chacun même partagés.
  const aLire = new Map<string, "secours" | "relecture">();
  const segmentDe = (id: string) => voix.segments.versions.find((x) => x.id === id)?.segment;
  for (const segment of segments) {
    const ids = voix.segments.versions.filter((x) => x.segment === segment).map((x) => x.id);
    if (!ids.length) return null;
    let traitee = false;
    for (const id of ids) {
      if (suivant.fins.find((x) => x.id === id)?.repli) continue; // suit le son de sa source
      const etape = etapeDeSecoursIV(suivant, id);
      if (etape) {
        const sourceRefusee = etape.source !== undefined && segments.includes(segmentDe(etape.source) ?? "");
        if (sourceRefusee) return null;
        suivant = { ...suivant, fins: suivant.fins.map((x) => (x.id === id ? etape.fin : x)) };
        reseaux.push(...etape.fin.reseaux);
        if (etape.lecture) {
          phrases.push(etape.phrase);
          aLire.set(texteDeFinIV(etape.fin), "secours");
        } else replis.push(etape.phrase);
        traitee = true;
        continue;
      }
      const texte = voix.segments.fins.find((x) => x.id === segment)?.texte;
      if (texte && peutRelireIV(suivant, id) && !relues.includes(texte)) {
        if (!relire.includes(texte)) relire.push(texte);
        reseauxRelire.push(...(suivant.fins.find((x) => x.id === id)?.reseaux ?? []));
        if (!aLire.has(texte)) aLire.set(texte, "relecture");
        traitee = true;
        continue;
      }
      return null;
    }
    if (!traitee) return null;
  }
  // Une fin de secours déjà posée et pas encore lue sera lue au même passage : elle compte dans l'argent annoncé.
  for (const s of voix.segments.fins) {
    const f = voix.voix.fins.find((x) => x.id === s.id);
    if (s.secours && f && (!f.prise || f.prise.etat.phase === "a-lire") && !aLire.has(s.texte)) aLire.set(s.texte, "secours");
  }
  const tarif = tarifObserve(voix);
  const cout = (genre?: "secours" | "relecture") => Math.ceil([...aLire].filter(([, g]) => !genre || g === genre).reduce((n, [t]) => n + t.length * tarif, 0) - 1e-9);
  return {
    plan: suivant,
    reseaux,
    phrases: [...new Set(phrases)],
    replis: [...new Set(replis)],
    relire,
    reseauxRelire: [...new Set(reseauxRelire)],
    lecture: phrases.length > 0 || relire.length > 0,
    coutMaxCentimes: cout(),
    coutRelireCentimes: cout("relecture"),
    nbLectures: aLire.size,
  };
}

/** `secoursApresArretIV` sur l'arrêt gardé de la fabrication (IV_VOIX), sinon `null`. PUR. */
export function planDeSecoursIV(etat: Pick<EtatFabricationIV, "refus" | "voix" | "plan">): SecoursIV | null {
  if (etat.refus?.etape !== "voix" || etat.refus.code !== "IV_VOIX" || !etat.voix || !etat.plan) return null;
  // L'arrêt gardé a retiré `issue` de la voix (`pasVoix`) : la voix du cas concret, elle, la garde.
  return secoursApresArretIV(etat.voix, etat.plan);
}
