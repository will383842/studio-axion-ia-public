/**
 * CHAÎNE DU TUTORIEL D'OUTIL (lot I) — script → voix → calage → plan de scènes → montage 4:5 → autres formats.
 * Pilotée PAS À PAS : `avancerEtape` fait UN pas de l'étape demandée et rend le nouvel état (gardé dans le travail par le
 * moteur). Rien n'est attendu longtemps : un rendu en cours rend l'état tel quel.
 *
 * Pièces réutilisées, sans rien changer :
 *  - voix : la sous-machine `voix-maitre` (lecture HeyGen épinglée, payée une fois, calage des mots, nettoyage) ; la voix
 *    est contrôlée AVANT la lecture (`exigerVoixMaitre`) ;
 *  - calage et sous-titres : `fabriquerSousTitres` (report des mots lus sur le texte validé, groupes) et `donneesCalque` ;
 *  - plan : `genererPlan` (lot C, Opus 5.5, fournisseur injecté) puis `validerPlan` (repli par scène, jamais de refus) ;
 *    niveau 3 interdit (le validateur le replie), pas de visage (`facecam: false`) ;
 *  - rendu : la composition Remotion `TutorielOutil` (plan + voix + sous-titres + carte de fin Axion), opération
 *    `composition` de `studio-rendu`.
 * Retouche « parties touchées seulement » : le plan de la version d'avant est repris tel quel si le texte et le minutage
 * n'ont pas changé ; sinon chaque scène dont les mots sont les mêmes garde sa pièce et ses paramètres, et seules les
 * scènes à l'empreinte changée sont comptées « touchées » (`scenesARerendre`).
 * Jamais d'échec pour une qualité : les remarques deviennent des réserves « À vérifier · … » sur la vidéo.
 */
import { empreinteAudioMaitre } from "@/briques/empreinte-audio";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import { genererPlan } from "@/briques/plan-scenes/generateur";
import { fnv1a64, jsonCanonique, scenesARerendre } from "@/briques/plan-scenes/empreinte";
import type { MotMinute, PlanValide, SceneValide } from "@/briques/plan-scenes/schema";
import { validerPlan, type Remarque } from "@/briques/plan-scenes/validateur";
import { baseRetenue, donneesCalque, fabriquerSousTitres } from "@/briques/sous-titres";
import { avancerVoixMaitre, type EtatVoixMaitre, type OutilsVoixMaitre } from "@/briques/voix-maitre/machine";
import { exigerVoixMaitre, VOIX_MAITRE_HEYGEN_ID } from "@/briques/voix-maitre/voix-epinglee";
import type { AudioMaitre } from "@/briques/voix-maitre/types";
import { horodaterTexte } from "@/domaine/derivations";
import type { BaseSousTitres, CommandeFabrication, IntensiteSousTitres, MotHorodate, Ratio, SegmentSousTitres, ValeurStyleSousTitres } from "@/domaine/types";
import { ErreurRendu, suivreRendu } from "@/fournisseurs/rendu/client";
import type { DemandeRendu, ServiceRendu } from "@/fournisseurs/types";
import { lireEntreesTutoriel } from "./entrees";
import { CARTE_FIN_AXION, COMPOSITION_TUTORIEL, DUREE_CARTE_FIN_MS, formatDuRatio, type ProprietesTutorielOutil } from "./proprietes";
import { ecrireScript, MOTS_PAR_SECONDE, remarquesScript, scriptRetenu, type SourceScript } from "./script";

export const ETAPES_TUTORIEL = ["script", "voix", "calage", "plan", "montage", "exports"] as const;
export type CleEtapeTutoriel = (typeof ETAPES_TUTORIEL)[number];

/** Nouvelles demandes au rendu après un échec passager, avant de rendre l'étape en échec (réessayable). */
export const ESSAIS_RENDU_TUTORIEL = 3;

/* ------------------------------------------------------------------ */
/* Outils injectés (services réels, ou doubles des tests)               */
/* ------------------------------------------------------------------ */

/** La voix : mêmes outils que la sous-machine `voix-maitre` (comme le tableau animé), plus la clé des fichiers. */
export type OutilsVoixTutoriel = Pick<
  OutilsVoixMaitre,
  "voix" | "stockage" | "aligneur" | "rendu" | "renduEstSimule" | "idVoix" | "reglages" | "tauxUsdEur" | "fournisseurVoix" | "caler" | "regles" | "erreurStockage" | "ressemblance" | "avantLecture"
> & { cle: (nom: string) => string };

export interface OutilsTutoriel {
  /** Absente : aucune voix reliée (la vidéo sort muette, avec une réserve). */
  voix?: OutilsVoixTutoriel;
  /** Claude (écriture du script depuis une idée, plan de scènes) : un double dans les tests. */
  claude: AppelClaude;
  rendu: {
    service: () => ServiceRendu;
    /** Adresses signées : lectures (par nom d'entrée) et dépôt du résultat. */
    signer: (lectures: Record<string, string>, depot: { cle: string; mime: string }) => Promise<{ lectures: Record<string, string>; urlDepot: string }>;
    /** Clé de stockage d'un fichier de la vidéo. */
    cle: (nom: string) => string;
  };
  /** Style des sous-titres résolu par le studio ; absent : style par défaut. */
  sousTitres?: { style?: ValeurStyleSousTitres | null; base?: BaseSousTitres; intensite?: IntensiteSousTitres };
}

/* ------------------------------------------------------------------ */
/* État gardé dans le travail                                           */
/* ------------------------------------------------------------------ */

export interface AudioTutoriel {
  /** Absent : aucune voix (vidéo muette). */
  fichierCle?: string;
  dureeSec: number;
  mots: MotHorodate[];
  empreinte: string;
  reutilise: boolean;
  coutCentimes: number;
  caracteres: number;
  fournisseur: string;
  approximatif?: boolean;
}

export interface PlanRetenu {
  plan: PlanValide;
  remarques: Remarque[];
  source: "llm" | "repli" | "repris";
  /** Empreinte de l'entrée du plan (texte, minutage, format) : la même = plan repris sans appel. */
  empreinteEntree: string;
  /** Scènes nouvelles ou changées par rapport à la version d'avant (toutes pour une première fabrication). */
  scenesTouchees: string[];
}

export interface RenduTutoriel {
  ratio: Ratio;
  demande: DemandeRendu;
  essai: number;
  sortie?: { fichierCle: string; dureeSec: number; taille: number };
}

export interface EtatTutoriel {
  script?: { texte: string; source: SourceScript; remarques: string[] };
  /** Script écrit depuis l'idée, en attente de la relecture de Williams. */
  proposition?: string;
  voix?: EtatVoixMaitre;
  audio?: AudioTutoriel;
  sousTitres?: SegmentSousTitres[];
  motsPlan?: MotMinute[];
  plan?: PlanRetenu;
  /** Formats à rendre, dans l'ordre (le premier est le maître). */
  ratios: Ratio[];
  rendus: RenduTutoriel[];
  reserves: string[];
  /** Version d'avant (retouche, réexport) : ce qui peut être repris sans être refait ni repayé. */
  parent?: { plan?: PlanValide; audio?: AudioTutoriel };
  echecSimuleFait?: boolean;
}

/** Ordre des formats : 4:5 d'abord, puis les autres formats demandés, dans leur ordre. */
export function ratiosTutoriel(ratios: readonly Ratio[]): Ratio[] {
  const demandes = ratios.length ? ratios : (["4:5"] as Ratio[]);
  return demandes.includes("4:5") ? ["4:5", ...demandes.filter((r) => r !== "4:5")] : [...demandes];
}

export function etatInitial(commande: Pick<CommandeFabrication, "ratios">): EtatTutoriel {
  return { ratios: ratiosTutoriel(commande.ratios), rendus: [], reserves: [] };
}

/* ------------------------------------------------------------------ */
/* Résultat d'un pas                                                    */
/* ------------------------------------------------------------------ */

export type PasTutoriel =
  | { statut: "faite"; etat: EtatTutoriel }
  | { statut: "en-cours"; etat: EtatTutoriel }
  /** Attente de Williams (script à valider) ou d'un outil : pause claire, jamais un échec. */
  | { statut: "pause"; etat: EtatTutoriel; code: string; message: string };

/** Erreur d'une étape (typée, lisible) : le moteur la rend en échec d'étape réessayable ou non. */
export class ErreurTutoriel extends Error {
  constructor(
    readonly code: string,
    readonly messagePourWill: string,
    readonly reessayable: boolean,
  ) {
    super(messagePourWill);
    this.name = "ErreurTutoriel";
  }
}

/* ------------------------------------------------------------------ */
/* Étapes                                                               */
/* ------------------------------------------------------------------ */

const texteLu = (texte: string, prononciations: readonly { mot: string; prononciation: string }[]): string =>
  prononciations.reduce((t, p) => t.replace(new RegExp(`(?<![\\p{L}\\p{N}])${p.mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "giu"), p.prononciation), texte);

async function pasScript(etat: EtatTutoriel, commande: CommandeFabrication, outils: OutilsTutoriel): Promise<PasTutoriel> {
  if (etat.script) return { statut: "faite", etat };
  const r = scriptRetenu(commande.script.texteComplet, lireEntreesTutoriel(commande.entrees));
  if ("texte" in r) return { statut: "faite", etat: { ...etat, script: { texte: r.texte, source: r.source, remarques: remarquesScript(r.texte) } } };
  if ("vide" in r) return { statut: "pause", etat, code: "TO_SCRIPT_ABSENT", message: "Aucun script ni idée : collez votre script ou donnez un titre. Rien n'a échoué." };
  if (etat.proposition) return { statut: "pause", etat, code: "TO_SCRIPT_A_VALIDER", message: "Relisez le script, modifiez-le si besoin, puis validez : la vidéo se fabrique ensuite." };
  const proposition = await ecrireScript(r.aEcrire, outils.claude);
  if (!proposition) return { statut: "pause", etat, code: "TO_SCRIPT_NON_ECRIT", message: "Le script n'a pas pu être écrit pour l'instant : collez votre script, ou relancez plus tard. Rien n'a échoué." };
  return { statut: "pause", etat: { ...etat, proposition }, code: "TO_SCRIPT_A_VALIDER", message: "Relisez le script, modifiez-le si besoin, puis validez : la vidéo se fabrique ensuite." };
}

function audioDe(a: AudioMaitre): AudioTutoriel {
  return { fichierCle: a.fichierCle, dureeSec: a.dureeSec, mots: a.mots, empreinte: a.empreinte, reutilise: a.reutilise, coutCentimes: a.coutCentimes, caracteres: a.caracteres, fournisseur: a.fournisseur, ...(a.sousTitresApproximatifs ? { approximatif: true } : {}) };
}

/** Outils complets de la sous-machine voix : texte lu, empreinte, voix épinglée contrôlée avant la lecture payante. */
export function outilsVoixMaitre(o: OutilsVoixTutoriel, commande: CommandeFabrication, texte: string, existant?: AudioTutoriel): OutilsVoixMaitre {
  const empreinte = empreinteAudioMaitre({ ...commande, script: { ...commande.script, texteComplet: texte } });
  return {
    ...o,
    idBase: `to-${commande.videoId}`,
    texte: () => texteLu(texte, commande.prononciations),
    empreinte: () => empreinte,
    ...(existant?.fichierCle ? { existant: { fichierCle: existant.fichierCle, empreinte: existant.empreinte, mots: existant.mots, dureeSec: existant.dureeSec } } : {}),
    avantLecture: async () => {
      // Voix HeyGen épinglée, rien d'autre (L1-05) : refus avant toute dépense.
      exigerVoixMaitre(o.fournisseurVoix ?? "heygen", o.idVoix);
      await o.avantLecture?.();
    },
  };
}

async function pasVoix(etat: EtatTutoriel, commande: CommandeFabrication, outils: OutilsTutoriel): Promise<PasTutoriel> {
  if (etat.audio) return { statut: "faite", etat };
  const texte = etat.script!.texte;
  if (!outils.voix || !commande.distribution.length) {
    const mots = horodaterTexte(texte, MOTS_PAR_SECONDE);
    const audio: AudioTutoriel = { dureeSec: mots.at(-1)?.finSec ?? 1, mots, empreinte: "sans-voix", reutilise: false, coutCentimes: 0, caracteres: 0, fournisseur: "aucune" };
    const reserves = commande.distribution.length ? [...etat.reserves, "À vérifier · Voix : aucune voix n'est reliée, la vidéo sort muette."] : etat.reserves;
    return { statut: "faite", etat: { ...etat, audio, reserves } };
  }
  // Seule la voix HeyGen épinglée parle : refus clair avant tout appel (aucune dépense).
  if (outils.voix.idVoix !== VOIX_MAITRE_HEYGEN_ID) exigerVoixMaitre(outils.voix.fournisseurVoix ?? "heygen", outils.voix.idVoix);
  const o = outilsVoixMaitre(outils.voix, commande, texte, etat.parent?.audio);
  const suivant = await avancerVoixMaitre(etat.voix ?? { phase: "a-lire" }, o);
  if (suivant.phase !== "faite") return { statut: "en-cours", etat: { ...etat, voix: suivant } };
  const audio = audioDe(suivant.audio);
  const reserves = audio.approximatif ? [...etat.reserves, "À vérifier · Sous-titres : les mots suivent une estimation du son."] : etat.reserves;
  return { statut: "faite", etat: { ...etat, voix: undefined, audio, reserves } };
}

function pasCalage(etat: EtatTutoriel, commande: CommandeFabrication, outils: OutilsTutoriel): PasTutoriel {
  if (etat.sousTitres && etat.motsPlan) return { statut: "faite", etat };
  const audio = etat.audio!;
  const st = outils.sousTitres;
  const sousTitres = fabriquerSousTitres({
    texte: etat.script!.texte,
    dureeSec: audio.dureeSec,
    mots: audio.mots,
    prononciations: commande.prononciations,
    ratio: etat.ratios[0],
    ...(st?.style !== undefined ? { style: st.style } : {}),
    ...(st?.base ? { base: st.base } : {}),
    ...(st?.intensite ? { intensite: st.intensite } : {}),
  });
  const motsPlan: MotMinute[] = sousTitres.flatMap((s) => s.mots).map((m) => ({ texte: m.mot, debutMs: Math.round(m.debutSec * 1000), finMs: Math.max(Math.round(m.debutSec * 1000), Math.round(m.finSec * 1000)) }));
  return { statut: "faite", etat: { ...etat, sousTitres, motsPlan } };
}

/** Texte des mots couverts par une scène (sert à retrouver la même scène d'une version à l'autre). */
function motsDeScene(s: Pick<SceneValide, "mots">, mots: readonly MotMinute[]): string {
  return mots
    .slice(s.mots.premier, s.mots.dernier + 1)
    .map((m) => m.texte.toLowerCase())
    .join(" ");
}

/** Garde le contenu des scènes d'avant dont les mots n'ont pas changé (nouveau minutage), puis revalide. */
function fusionnerAvecParent(nouveau: PlanValide, parent: PlanValide): PlanValide {
  const avant = new Map(parent.scenes.map((s) => [motsDeScene(s, parent.mots), s]));
  const scenes = nouveau.scenes.map((s) => {
    const p = avant.get(motsDeScene(s, nouveau.mots));
    if (!p) return s;
    const { empreinte: _e, ...contenu } = p;
    void _e;
    return { ...contenu, id: s.id, version: p.version, mots: s.mots, debutMs: s.debutMs, finMs: s.finMs };
  });
  return validerPlan({ ...nouveau, scenes }, { mots: nouveau.mots, format: nouveau.format, facecam: false, dureeMs: nouveau.dureeMs }).plan;
}

async function pasPlan(etat: EtatTutoriel, outils: OutilsTutoriel): Promise<PasTutoriel> {
  if (etat.plan) return { statut: "faite", etat };
  const texte = etat.script!.texte;
  const mots = etat.motsPlan!;
  const format = formatDuRatio(etat.ratios[0] as "4:5");
  const empreinteEntree = fnv1a64(jsonCanonique({ texte, mots, format }));
  const parent = etat.parent?.plan;
  // Retouche sans changement de texte ni de minutage : le plan d'avant, tel quel, sans appel.
  if (parent && fnv1a64(jsonCanonique({ texte, mots: parent.mots, format: parent.format })) === empreinteEntree) {
    return { statut: "faite", etat: { ...etat, plan: { plan: parent, remarques: [], source: "repris", empreinteEntree, scenesTouchees: [] } } };
  }
  const r = await genererPlan({ script: texte, mots, format, facecam: false }, outils.claude);
  const plan = parent ? fusionnerAvecParent(r.plan, parent) : r.plan;
  const scenesTouchees = parent ? scenesARerendre(parent, plan) : plan.scenes.map((s) => s.id);
  const reserves = r.source === "repli" ? [...etat.reserves, `À vérifier · Plan de scènes : ${r.remarques[0]?.message ?? "plan simple."}`] : etat.reserves;
  return { statut: "faite", etat: { ...etat, plan: { plan, remarques: r.remarques, source: r.source, empreinteEntree, scenesTouchees }, reserves } };
}

/** Le plan au format d'un ratio (positions en %, revalidé : empreintes du format). */
export function planPourRatio(plan: PlanValide, ratio: Ratio): PlanValide {
  const format = formatDuRatio(ratio);
  if (format.largeur === plan.format.largeur && format.hauteur === plan.format.hauteur) return plan;
  return validerPlan({ ...plan, format }, { mots: plan.mots, format, facecam: false, dureeMs: plan.dureeMs }).plan;
}

/** Propriétés de la composition pour un ratio (l'adresse de la voix arrive par l'entrée « audio »). */
export function proprietesTutoriel(etat: EtatTutoriel, ratio: Ratio, avecSousTitres: boolean, outils: Pick<OutilsTutoriel, "sousTitres">): Omit<ProprietesTutorielOutil, "audio"> {
  const st = outils.sousTitres;
  const sousTitres =
    avecSousTitres && etat.sousTitres?.length ? donneesCalque({ segments: etat.sousTitres, base: baseRetenue(st?.base, st?.style ?? null), ratio, ...(st?.style ? { style: st.style } : {}) }) : undefined;
  return { plan: planPourRatio(etat.plan!.plan, ratio), ...(sousTitres ? { sousTitres } : {}), fin: { ...CARTE_FIN_AXION }, finMs: DUREE_CARTE_FIN_MS };
}

const nomRatio = (r: Ratio) => r.replace(":", "x");

async function demandeRendu(etat: EtatTutoriel, ratio: Ratio, essai: number, commande: CommandeFabrication, outils: OutilsTutoriel, travailId: string): Promise<DemandeRendu> {
  const cle = outils.rendu.cle(`tutoriel-${nomRatio(ratio)}.mp4`);
  const lectures: Record<string, string> = etat.audio?.fichierCle ? { audio: etat.audio.fichierCle } : {};
  const signe = await outils.rendu.signer(lectures, { cle, mime: "video/mp4" });
  return {
    idRendu: `${travailId}-${nomRatio(ratio)}-${essai}`,
    operation: "composition",
    file: "longue",
    entrees: signe.lectures,
    sortie: { urlDepot: signe.urlDepot, cle },
    parametres: { composition: COMPOSITION_TUTORIEL, proprietes: proprietesTutoriel(etat, ratio, commande.briques["sous-titres"] !== false, outils) },
  };
}

/** Un pas de rendu d'un ratio : soumettre, suivre, ressoumettre après un échec passager. */
async function pasRendu(etat: EtatTutoriel, ratio: Ratio, commande: CommandeFabrication, outils: OutilsTutoriel, travailId: string): Promise<EtatTutoriel> {
  const service = outils.rendu.service();
  const courant = etat.rendus.find((r) => r.ratio === ratio);
  const remplacer = (r: RenduTutoriel) => ({ ...etat, rendus: [...etat.rendus.filter((x) => x.ratio !== ratio), r] });
  if (!courant) {
    const demande = await demandeRendu(etat, ratio, 0, commande, outils, travailId);
    await service.soumettre(demande);
    return remplacer({ ratio, demande, essai: 0 });
  }
  if (courant.sortie) return etat;
  const e = await suivreRendu(service, courant.demande);
  if (e.statut === "echec") {
    const essai = courant.essai + 1;
    if (!e.erreur.reessayable || essai >= ESSAIS_RENDU_TUTORIEL) throw new ErreurRendu(e.erreur);
    const demande = await demandeRendu(etat, ratio, essai, commande, outils, travailId);
    await service.soumettre(demande);
    return remplacer({ ratio, demande, essai });
  }
  if (e.statut !== "termine") return etat;
  const dureeAttendue = (etat.plan!.plan.dureeMs + DUREE_CARTE_FIN_MS) / 1000;
  const dureeSec = typeof e.mesures?.dureeSec === "number" ? e.mesures.dureeSec : dureeAttendue;
  return remplacer({ ...courant, sortie: { fichierCle: e.sortieCle, dureeSec, taille: typeof e.mesures?.taille === "number" ? e.mesures.taille : 0 } });
}

async function pasMontage(etat: EtatTutoriel, ratios: Ratio[], commande: CommandeFabrication, outils: OutilsTutoriel, travailId: string): Promise<PasTutoriel> {
  let e = etat;
  for (const ratio of ratios) {
    if (e.rendus.find((r) => r.ratio === ratio)?.sortie) continue;
    e = await pasRendu(e, ratio, commande, outils, travailId);
  }
  const fait = ratios.every((r) => e.rendus.find((x) => x.ratio === r)?.sortie);
  return { statut: fait ? "faite" : "en-cours", etat: e };
}

/** Un pas de l'étape `cle`. Lève `ErreurTutoriel`, une erreur de la voix ou du rendu : le moteur la rend lisible. */
export async function avancerEtape(cle: CleEtapeTutoriel, etat: EtatTutoriel, commande: CommandeFabrication, outils: OutilsTutoriel, travailId: string): Promise<PasTutoriel> {
  switch (cle) {
    case "script":
      return pasScript(etat, commande, outils);
    case "voix":
      return pasVoix(etat, commande, outils);
    case "calage":
      // Sans étape « voix » (aucune distribution), le calage part de l'estimation du texte.
      return pasCalage(etat.audio ? etat : (await pasVoix(etat, commande, outils)).etat, commande, outils);
    case "plan":
      return pasPlan(etat, outils);
    case "montage":
      return pasMontage(etat, etat.ratios.slice(0, 1), commande, outils, travailId);
    case "exports":
      return pasMontage(etat, etat.ratios.slice(1), commande, outils, travailId);
  }
}
