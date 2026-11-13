/**
 * IMAGE → VIDÉO · PORTE UNIQUE (lot L13, plan 50 § 1 [10], § 7). Un seul verdict pour la vidéo, sur TOUTES ses versions
 * (versions courtes comprises) : « prête » seulement si aucune ligne bloquante n'échoue ni ne manque, sur aucune
 * version, et si chaque réseau demandé reçoit une version livrable. Sinon « refusée », avec une phrase simple par
 * défaut pour Will. La mention orange « un peu longue » (plafond du réseau, cas 2) ne bloque pas.
 *
 * Ordre, pour ne rien payer d'inutile :
 *  1. contrôles SANS DÉPENSE de chaque version (carte, script, mise en scène recalculée, mise en page des instants clés,
 *     mesures du fichier, publication, plafonds par réseau) ;
 *  2. si rien n'est déjà refusé : ÉCOUTE de chaque version (transcription de la voix seule, réservée avant l'appel) ;
 *  3. si rien n'est encore refusé : RELECTURE des images finales par Claude (extraction par l'opération existante,
 *     réservée avant chaque appel).
 * Une étape payante non lancée parce que la vidéo est déjà refusée est marquée « non vérifiée » (bloquante) : jamais
 * réussie par défaut. Les transcriptions et relectures obtenues sont rendues pour une reprise sans repayer.
 */
import type { CarteImage } from "@/domaine/image-video/carte";
import type { FicheImage } from "@/domaine/image-video/fiche";
import { PLAFONDS_IV, RESEAUX_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import type { MotHorodate } from "@/domaine/types";
import { bloque, CODES_CONTROLE_IV, CONTROLES_INDICATIFS, controlerVersionIV, LIBELLES_CONTROLE_IV, scriptDeLaVersion, type ContexteControlesIV, type LigneControleIV, type MesuresDeLaPorteIV, type VersionAControlerIV } from "./controles";
import { ecouterVersionIV, type EcouteVersionIV, type OutilsEcouteIV } from "./ecoute";
import type { PlanDesFinsIV } from "./fins";
import { instantsClesIV, relireVersionIV, type InstantCleIV, type OutilsRelectureIV, type RelectureFinale } from "./relecture-finale";
import { verdictReseau, type VerdictReseauIV } from "./reseaux";

/** Codes qui dépendent de l'écoute ou de la relecture (attendus « non vérifiés » avant elles). */
const CODES_APRES_ECOUTE: ReadonlySet<string> = new Set(["Q06", "Q08bis", "CHIFFRES", "Q17", "Q18", "Q19", "Q26"]);

/** Contrôles pas à pas : chaque transcription et chaque relecture obtenue est confiée à l'appelant (`garder`) puis la main est rendue. */
export interface PasAPasPorteIV {
  garder: (obtenu: { transcriptions: Record<string, MotHorodate[]>; relectures: Record<string, RelectureFinale> }) => void;
}

export type OutilsPorteIV = OutilsEcouteIV & Omit<OutilsRelectureIV, "budget"> & { pasAPas?: PasAPasPorteIV };

/** Main rendue entre deux contrôles : une attente (`enCours`), reprise au tour suivant avec ce qui est déjà obtenu. */
class ControleSuivantIV extends Error {
  readonly enCours = true;
  constructor() {
    super("Les vérifications finales continuent au tour suivant.");
    this.name = "RenduEnCoursIV";
  }
}

export interface EntreePorteIV extends Omit<ContexteControlesIV, "ficheValidee"> {
  videoId: string;
  carte: CarteImage;
  /** Fiche validée par Will (longue). */
  fiche: FicheImage;
  /** Réseaux demandés : chacun doit recevoir une version livrable. */
  reseaux: readonly ReseauIV[];
  plan: Pick<PlanDesFinsIV, "fins" | "sansFin">;
  versions: readonly VersionAControlerIV[];
  /** Reprise sans repayer : transcriptions par empreinte de piste, relectures par fichier final relu (`cleRelectureIV`). */
  deja?: { transcriptions?: Readonly<Record<string, MotHorodate[]>>; relectures?: Readonly<Record<string, RelectureFinale>> };
}

export interface VersionJugeeIV {
  version: string;
  reseaux: ReseauIV[];
  courte: boolean;
  ok: boolean;
  /** Clé de la version (même valeur que `version`), pour le verdict par version. */
  cle: string;
  /** Une phrase par ligne bloquante de cette version (vide si elle est bonne). */
  phrases: string[];
  instants: InstantCleIV[];
  lignes: LigneControleIV[];
}

/**
 * Verdict d'un réseau demandé : livrable si toutes les versions de son fichier principal (le 9:16 s'il existe, sinon le 4:5)
 * sont sans ligne bloquante. Un fil 4:5 refusé d'un réseau qui a son 9:16 n'empêche pas ce réseau : il est seulement retiré.
 */
export interface VerdictReseauPorteIV {
  reseau: ReseauIV;
  ok: boolean;
  /** Phrases des lignes bloquantes du fichier principal (ou, si le réseau est livrable, du fil refusé). */
  phrases: string[];
  /** Versions refusées (fichier principal si le réseau n'est pas livrable, sinon fil 4:5 à retirer). */
  versionsRefusees: string[];
}

export interface VerdictPorteIV {
  ok: boolean;
  statut: "prete" | "refusee";
  /** Une phrase pour Will. */
  phrase: string;
  /** Une phrase par défaut bloquant (vide si prête). */
  phrases: string[];
  /** Seulement si refusée : « faute » (une ligne bloquante échouée, ou un défaut général) ; « non-fait » (toutes les lignes qui bloquent n'ont pas pu être vérifiées : panne d'outil, mesure absente) → reprise possible sans rien repayer. */
  nature?: "faute" | "non-fait";
  /** Mentions orange, non bloquantes (« un peu longue », hors charte, calculs de l'image, débit). */
  mentions: string[];
  /** Défauts de la vidéo entière (réseau sans version, version manquante…). */
  generaux: string[];
  reseaux: VerdictReseauIV[];
  versions: VersionJugeeIV[];
  /** Verdict par réseau demandé (livrable ou non). */
  parReseau: VerdictReseauPorteIV[];
  /** Vrai si la vidéo est refusée pour certaines versions seulement : les réseaux dont les versions sont bonnes se livrent, les autres sortent « non livrés » (jamais si la faute est commune à toutes les versions, ni si une vérification n'a pas pu se faire). */
  partielle: boolean;
  /** À garder pour une reprise sans repayer. */
  transcriptions: Record<string, MotHorodate[]>;
  relectures: Record<string, RelectureFinale>;
  appelsPayes: number;
}

const nomReseaux = (r: readonly ReseauIV[]) => r.map((x) => PLAFONDS_IV[x].nom).join(", ");

/** Verdict des plafonds de chaque réseau demandé, lu sur les durées MESURÉES (fichier final) de ses versions. */
export function plafondsDesReseaux(reseaux: readonly ReseauIV[], versions: readonly VersionAControlerIV[], scriptColle = false): { verdicts: VerdictReseauIV[]; manques: string[] } {
  const verdicts: VerdictReseauIV[] = [];
  const manques: string[] = [];
  for (const r of RESEAUX_IV.filter((x) => reseaux.includes(x))) {
    const longue = versions.find((v) => !v.courte && v.reseaux.includes(r));
    if (!longue) {
      manques.push(`${PLAFONDS_IV[r].nom} : aucune version n'a été fabriquée.`);
      continue;
    }
    const courte = versions.find((v) => v.courte && v.reseaux.includes(r));
    verdicts.push(verdictReseau(r, longue.ligne.dureeSec, courte ? courte.ligne.dureeSec : null, scriptColle));
  }
  return { verdicts, manques };
}

/**
 * La porte unique. Ne lève pas pour un défaut de la vidéo (il devient une ligne) ; seules les pannes de programmation
 * remontent.
 */
export async function porteUniqueIV(e: EntreePorteIV, o: OutilsPorteIV): Promise<VerdictPorteIV> {
  const ctx: ContexteControlesIV = { carte: e.carte, ficheValidee: e.fiche, ...(e.regles ? { regles: e.regles } : {}), voix: e.voix, publication: e.publication, liens: e.liens, ...(e.appelCommentaire ? { appelCommentaire: e.appelCommentaire } : {}), ...(e.scriptColle ? { scriptColle: true } : {}) };
  const generaux: string[] = [];
  if (!e.reseaux.length) generaux.push("aucun réseau demandé : la vidéo n'a nulle part où partir.");
  if (!e.versions.length) generaux.push("aucune version de la vidéo n'a été fournie aux contrôles.");
  // Réseau sans fin : remarque (la vidéo sort sans question de commentaire), jamais un blocage.
  const remarquesGenerales: string[] = [];
  for (const s of e.plan.sansFin) if (s.reseaux.some((r) => e.reseaux.includes(r))) remarquesGenerales.push(`${nomReseaux(s.reseaux)} : ${s.raison}`);
  const vus = new Set<string>();
  for (const v of e.versions) {
    if (vus.has(v.version)) generaux.push(`la version ${v.version} est fournie deux fois.`);
    vus.add(v.version);
  }
  const { verdicts, manques } = plafondsDesReseaux(e.reseaux, e.versions, e.scriptColle === true);
  generaux.push(...manques);

  // 1. Sans dépense : instants clés, mise en page (Q21, mesurée par les contrôles), et toutes les lignes qui ne dépendent pas de l'écoute.
  const instants = new Map(e.versions.map((v) => [v.version, instantsClesIV(v.ligne, e.carte)]));
  const mesures = (v: VersionAControlerIV, plus: Partial<MesuresDeLaPorteIV> = {}): MesuresDeLaPorteIV => ({ plafonds: verdicts.filter((x) => v.reseaux.includes(x.reseau)), ...plus });
  const dejaRefusee = (lignes: readonly LigneControleIV[]) => lignes.some((l) => bloque(l) && !(l.etat === "non-fait" && CODES_APRES_ECOUTE.has(l.code)));
  // Refus avant l'écoute, version par version : une version refusée n'est ni écoutée ni relue (aucune dépense) ; les autres continuent.
  const refusAvantV = new Map(e.versions.map((v) => [v.version, generaux.length > 0 || dejaRefusee(controlerVersionIV(v, ctx, mesures(v)))]));

  // 2. Écoute de chaque version (réservée), seulement si rien n'est déjà refusé ; reprise sans repayer sinon.
  const transcriptions: Record<string, MotHorodate[]> = { ...(e.deja?.transcriptions ?? {}) };
  const ecoutes = new Map<string, EcouteVersionIV>();
  let appelsPayes = 0;
  for (const v of e.versions) {
    const r = await ecouterVersionIV(
      {
        videoId: e.videoId,
        script: scriptDeLaVersion(v),
        piste: v.piste,
        final: { dureeSec: v.ligne.dureeSec, finVoixSec: v.ligne.finVoixSec, empreinteVoixMixee: v.mixage?.voix?.empreinte },
        ...(transcriptions[v.piste.empreinte] ? { deja: transcriptions[v.piste.empreinte] } : {}),
        depenseAutorisee: !refusAvantV.get(v.version),
      },
      o,
    );
    if (r.appelPaye) appelsPayes++;
    const nouvelle = !!r.transcription?.length && !transcriptions[v.piste.empreinte];
    if (r.transcription?.length) transcriptions[v.piste.empreinte] = r.transcription;
    ecoutes.set(v.version, r);
    // Pas à pas : la transcription obtenue est gardée tout de suite, puis la main est rendue.
    if (nouvelle && o.pasAPas) {
      o.pasAPas.garder({ transcriptions, relectures: { ...(e.deja?.relectures ?? {}) } });
      throw new ControleSuivantIV();
    }
  }
  const refusEcouteV = new Map(e.versions.map((v) => [v.version, refusAvantV.get(v.version)! || controlerVersionIV(v, ctx, mesures(v, { ecoute: ecoutes.get(v.version) })).some((l) => bloque(l) && l.code !== "Q26")]));

  // 3. Relecture des images finales (réservée), seulement si tout le reste passe.
  // Rendu suspect : le fichier final a une anomalie de mesure d'image (noir, figé, largeur, hauteur) ou une ligne Q24 bloquante, jamais un volume ni une crête ; sans aucune image lue, la vidéo n'est alors pas livrée.
  const renduSuspect = (v: VersionAControlerIV) => controlerVersionIV(v, ctx, mesures(v, { ecoute: ecoutes.get(v.version) })).some((l) => l.code === "Q24" && l.etat !== "reussi" && (bloque(l) || l.details.some((d) => /image noire|largeur|hauteur/.test(d))));
  const relectures: Record<string, RelectureFinale> = { ...(e.deja?.relectures ?? {}) };
  const relues = new Map<string, Awaited<ReturnType<typeof relireVersionIV>>>();
  for (const [i, v] of e.versions.entries()) {
    const r = await relireVersionIV(
      { videoId: e.videoId, version: v.version, reseaux: v.reseaux, carte: e.carte, fichierCle: v.fichier.cle, ...(v.fichier.empreinte ? { empreinteFichier: v.fichier.empreinte } : {}), instants: instants.get(v.version)!, deja: relectures, depenseAutorisee: !refusEcouteV.get(v.version), renduSuspect: renduSuspect(v) },
      o,
    );
    appelsPayes += r.appels;
    const nouvelleRelecture = !!r.relecture && !!r.cle && !relectures[r.cle];
    if (r.relecture && r.cle) relectures[r.cle] = r.relecture;
    relues.set(v.version, r);
    // Pas à pas : la relecture obtenue est gardée tout de suite ; la main est rendue sauf après la dernière version.
    if (nouvelleRelecture && o.pasAPas) {
      o.pasAPas.garder({ transcriptions, relectures });
      if (i < e.versions.length - 1) throw new ControleSuivantIV();
    }
  }

  // 4. Lignes finales, sur TOUTES les versions.
  const jugees: VersionJugeeIV[] = e.versions.map((v) => {
    const r = relues.get(v.version)!;
    const lignes = controlerVersionIV(v, ctx, mesures(v, { ecoute: ecoutes.get(v.version), relecture: { q26: r.q26, indications: r.indications, remarques: r.remarques } }));
    // Garde-fou : un contrôle absent bloque (jamais sauté en silence).
    for (const code of CODES_CONTROLE_IV) {
      if (!lignes.some((l) => l.code === code)) lignes.push({ code, version: v.version, reseaux: [...v.reseaux], etat: "non-fait", bloquant: !CONTROLES_INDICATIFS.has(code), phrase: `${LIBELLES_CONTROLE_IV[code]} (non vérifié) : contrôle absent.`, details: ["contrôle absent."] });
    }
    return { version: v.version, cle: v.version, reseaux: [...v.reseaux], courte: v.courte, ok: !lignes.some(bloque), phrases: lignes.filter(bloque).map((l) => l.phrase), instants: instants.get(v.version)!, lignes };
  });

  const phrases = [
    ...generaux.map((g) => g.charAt(0).toUpperCase() + g.slice(1)),
    ...jugees.flatMap((j) => j.lignes.filter(bloque).map((l) => `${nomReseaux(j.reseaux)}${j.courte ? " (version courte)" : ""} · ${l.phrase}`)),
  ];
  const mentions = [
    ...remarquesGenerales.map((g) => g.charAt(0).toUpperCase() + g.slice(1)),
    ...verdicts.filter((x) => x.verdict === "mention").map((x) => `${x.nom} : ${x.phrase}`),
    // Plafond de durée dépassé : remarque (la vidéo sort, Will décide de la publier ou de la raccourcir).
    ...verdicts.filter((x) => x.bloquant).map((x) => x.phrase ?? `${x.nom} : non livrée.`),
    ...jugees.flatMap((j) => j.lignes.filter((l) => !l.bloquant && l.etat !== "reussi").map((l) => `${nomReseaux(j.reseaux)} · ${l.phrase}`)),
    ...e.versions.flatMap((v) => (relues.get(v.version)?.indications ?? []).map((i) => `${nomReseaux(v.reseaux)} · ${i}`)),
  ];
  const ok = phrases.length === 0;
  const faute = generaux.length > 0 || jugees.some((j) => j.lignes.some((l) => bloque(l) && l.etat !== "non-fait"));
  // Livraison partielle : seulement une faute PROPRE à certaines versions (aucun défaut général, aucune version dont le seul blocage est une vérification qui n'a pas pu se faire (une version déjà refusée par une vraie faute n'est pas écoutée : ses lignes d'écoute « non faites » sont attendues),
  // aucun code bloquant commun à toutes les versions : voix, script, chiffre faux du corps commun) et un réseau au moins livrable.
  const parReseau: VerdictReseauPorteIV[] = RESEAUX_IV.filter((r) => e.reseaux.includes(r)).map((r) => {
    const siennes = jugees.filter((j) => j.reseaux.includes(r));
    const cadre = (j: VersionJugeeIV) => e.versions.find((v) => v.version === j.version)!.ligne;
    const est45 = (j: VersionJugeeIV) => cadre(j).hauteur < cadre(j).largeur * 1.5;
    const principales = siennes.some((j) => !est45(j)) ? siennes.filter((j) => !est45(j)) : siennes;
    const refusees = (principales.some((j) => !j.ok) ? principales : siennes.filter((j) => !principales.includes(j))).filter((j) => !j.ok);
    return { reseau: r, ok: principales.length > 0 && principales.every((j) => j.ok), phrases: refusees.flatMap((j) => j.lignes.filter((l) => bloque(l) && l.etat !== "non-fait").map((l) => l.phrase)), versionsRefusees: refusees.map((j) => j.version) };
  });
  const codesCommuns = jugees.length ? jugees[0]!.lignes.filter(bloque).map((l) => l.code).filter((c) => jugees.every((j) => j.lignes.some((l) => bloque(l) && l.code === c))) : [];
  const partielle = !ok && faute && generaux.length === 0 && !jugees.some((j) => !j.lignes.some((l) => bloque(l) && l.etat !== "non-fait") && j.lignes.some(bloque)) && codesCommuns.length === 0 && parReseau.some((x) => x.ok);
  return {
    ok,
    ...(ok ? {} : { nature: faute ? ("faute" as const) : ("non-fait" as const) }),
    statut: ok ? "prete" : "refusee",
    phrase: ok
      ? `La vidéo est prête pour ${nomReseaux(verdicts.map((x) => x.reseau))}${mentions.length ? ` (${mentions.length} remarque${mentions.length > 1 ? "s" : ""} sans gravité)` : ""}.`
      : partielle
        ? `La vidéo est prête pour ${nomReseaux(parReseau.filter((x) => x.ok).map((x) => x.reseau))}${parReseau.some((x) => !x.ok) ? ` ; non livrée pour ${nomReseaux(parReseau.filter((x) => !x.ok).map((x) => x.reseau))}` : ""} : ${phrases[0]}`
        : `La vidéo est refusée : ${phrases.length} défaut${phrases.length > 1 ? "s" : ""} à corriger. ${phrases[0]}`,
    phrases,
    mentions,
    generaux,
    reseaux: verdicts,
    versions: jugees,
    parReseau,
    partielle,
    transcriptions,
    relectures,
    appelsPayes,
  };
}
