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

export type OutilsPorteIV = OutilsEcouteIV & Omit<OutilsRelectureIV, "budget">;

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
  instants: InstantCleIV[];
  lignes: LigneControleIV[];
}

export interface VerdictPorteIV {
  ok: boolean;
  statut: "prete" | "refusee";
  /** Une phrase pour Will. */
  phrase: string;
  /** Une phrase par défaut bloquant (vide si prête). */
  phrases: string[];
  /** Mentions orange, non bloquantes (« un peu longue », hors charte, calculs de l'image, débit). */
  mentions: string[];
  /** Défauts de la vidéo entière (réseau sans version, version manquante…). */
  generaux: string[];
  reseaux: VerdictReseauIV[];
  versions: VersionJugeeIV[];
  /** À garder pour une reprise sans repayer. */
  transcriptions: Record<string, MotHorodate[]>;
  relectures: Record<string, RelectureFinale>;
  appelsPayes: number;
}

const nomReseaux = (r: readonly ReseauIV[]) => r.map((x) => PLAFONDS_IV[x].nom).join(", ");

/** Verdict des plafonds de chaque réseau demandé, lu sur les durées MESURÉES (fichier final) de ses versions. */
export function plafondsDesReseaux(reseaux: readonly ReseauIV[], versions: readonly VersionAControlerIV[]): { verdicts: VerdictReseauIV[]; manques: string[] } {
  const verdicts: VerdictReseauIV[] = [];
  const manques: string[] = [];
  for (const r of RESEAUX_IV.filter((x) => reseaux.includes(x))) {
    const longue = versions.find((v) => !v.courte && v.reseaux.includes(r));
    if (!longue) {
      manques.push(`${PLAFONDS_IV[r].nom} : aucune version n'a été fabriquée.`);
      continue;
    }
    const courte = versions.find((v) => v.courte && v.reseaux.includes(r));
    verdicts.push(verdictReseau(r, longue.ligne.dureeSec, courte ? courte.ligne.dureeSec : null));
  }
  return { verdicts, manques };
}

/**
 * La porte unique. Ne lève pas pour un défaut de la vidéo (il devient une ligne) ; seules les pannes de programmation
 * remontent.
 */
export async function porteUniqueIV(e: EntreePorteIV, o: OutilsPorteIV): Promise<VerdictPorteIV> {
  const ctx: ContexteControlesIV = { carte: e.carte, ficheValidee: e.fiche, ...(e.regles ? { regles: e.regles } : {}), voix: e.voix, publication: e.publication, liens: e.liens };
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
  const { verdicts, manques } = plafondsDesReseaux(e.reseaux, e.versions);
  generaux.push(...manques);

  // 1. Sans dépense : instants clés, mise en page (Q21, mesurée par les contrôles), et toutes les lignes qui ne dépendent pas de l'écoute.
  const instants = new Map(e.versions.map((v) => [v.version, instantsClesIV(v.ligne, e.carte)]));
  const mesures = (v: VersionAControlerIV, plus: Partial<MesuresDeLaPorteIV> = {}): MesuresDeLaPorteIV => ({ plafonds: verdicts.filter((x) => v.reseaux.includes(x.reseau)), ...plus });
  const dejaRefusee = (lignes: readonly LigneControleIV[]) => lignes.some((l) => bloque(l) && !(l.etat === "non-fait" && CODES_APRES_ECOUTE.has(l.code)));
  const refusAvant = generaux.length > 0 || e.versions.some((v) => dejaRefusee(controlerVersionIV(v, ctx, mesures(v))));

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
        depenseAutorisee: !refusAvant,
      },
      o,
    );
    if (r.appelPaye) appelsPayes++;
    if (r.transcription?.length) transcriptions[v.piste.empreinte] = r.transcription;
    ecoutes.set(v.version, r);
  }
  const refusEcoute = refusAvant || e.versions.some((v) => controlerVersionIV(v, ctx, mesures(v, { ecoute: ecoutes.get(v.version) })).some((l) => bloque(l) && l.code !== "Q26"));

  // 3. Relecture des images finales (réservée), seulement si tout le reste passe.
  // Rendu suspect : le fichier final a une anomalie de mesure d'image (noir, figé, largeur, hauteur) ou une ligne Q24 bloquante, jamais un volume ni une crête ; sans aucune image lue, la vidéo n'est alors pas livrée.
  const renduSuspect = (v: VersionAControlerIV) => controlerVersionIV(v, ctx, mesures(v, { ecoute: ecoutes.get(v.version) })).some((l) => l.code === "Q24" && l.etat !== "reussi" && (bloque(l) || l.details.some((d) => /image noire|image figée|largeur|hauteur/.test(d))));
  const relectures: Record<string, RelectureFinale> = { ...(e.deja?.relectures ?? {}) };
  const relues = new Map<string, Awaited<ReturnType<typeof relireVersionIV>>>();
  for (const v of e.versions) {
    const r = await relireVersionIV(
      { videoId: e.videoId, version: v.version, reseaux: v.reseaux, carte: e.carte, fichierCle: v.fichier.cle, ...(v.fichier.empreinte ? { empreinteFichier: v.fichier.empreinte } : {}), instants: instants.get(v.version)!, deja: relectures, depenseAutorisee: !refusEcoute, renduSuspect: renduSuspect(v) },
      o,
    );
    appelsPayes += r.appels;
    if (r.relecture && r.cle) relectures[r.cle] = r.relecture;
    relues.set(v.version, r);
  }

  // 4. Lignes finales, sur TOUTES les versions.
  const jugees: VersionJugeeIV[] = e.versions.map((v) => {
    const r = relues.get(v.version)!;
    const lignes = controlerVersionIV(v, ctx, mesures(v, { ecoute: ecoutes.get(v.version), relecture: { q26: r.q26, indications: r.indications, remarques: r.remarques } }));
    // Garde-fou : un contrôle absent bloque (jamais sauté en silence).
    for (const code of CODES_CONTROLE_IV) {
      if (!lignes.some((l) => l.code === code)) lignes.push({ code, version: v.version, reseaux: [...v.reseaux], etat: "non-fait", bloquant: !CONTROLES_INDICATIFS.has(code), phrase: `${LIBELLES_CONTROLE_IV[code]} (non vérifié) : contrôle absent.`, details: ["contrôle absent."] });
    }
    return { version: v.version, reseaux: [...v.reseaux], courte: v.courte, ok: !lignes.some(bloque), instants: instants.get(v.version)!, lignes };
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
  return {
    ok,
    statut: ok ? "prete" : "refusee",
    phrase: ok
      ? `La vidéo est prête pour ${nomReseaux(verdicts.map((x) => x.reseau))}${mentions.length ? ` (${mentions.length} remarque${mentions.length > 1 ? "s" : ""} sans gravité)` : ""}.`
      : `La vidéo est refusée : ${phrases.length} défaut${phrases.length > 1 ? "s" : ""} à corriger. ${phrases[0]}`,
    phrases,
    mentions,
    generaux,
    reseaux: verdicts,
    versions: jugees,
    transcriptions,
    relectures,
    appelsPayes,
  };
}
