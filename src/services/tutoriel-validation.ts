/**
 * T-EXT-33 · GESTES DE L'ÉCRAN DE VALIDATION du tutoriel d'outil (importés par T-EXT-24) : choisir une version du script,
 * corriger quelques phrases, cocher les propositions, faire réécrire, valider. Aucun appel payant, aucune dépense par ces
 * gestes ; le texte de Williams fait foi et n'est jamais réécrit.
 *
 * ÉTAT LU ET ÉCRIT : `travail.parametres.tutoriel.equipe` (forme posée par la fiche d'intégration des rôles ; lue ici de façon
 * tolérante) : `propositionScripts`, `scriptChoisi`, `registre`, et facultativement `parcours`, `textesMaquette`,
 * `conversation`, `propositions` (pour établir le registre). Tant que cette forme n'existe pas (ni proposition, ni script
 * choisi, ni registre) : « Rien à valider pour l'instant », sans rien écrire.
 *
 * L'ACCORD DU DEVIS est écrit par `validerTutoriel`, sur le clic de Williams : `tutorielOutilDevis: { empreinte, le }`, dans
 * les entrées de la vidéo ET dans la commande figée de la version. Sans empreinte : aucune entrée de devis.
 */
import "server-only";
import { empreinte as empreinteLignes, type DifferenceLigne, type LigneScript } from "@/domaine/relecture-script";
import type { Id, Travail } from "@/domaine/types";
import { ENTREE_DEVIS_TUTORIEL } from "@/moteurs/montage-tutoriel-outil/devis-tutoriel";
import { ENTREE_TUTORIEL } from "@/moteurs/montage-tutoriel-outil/entrees";
import { choisirProposition, etablirRegistre, figerRegistre, type RegistreTextes } from "@/moteurs/montage-tutoriel-outil/equipe/registre-textes";
import { figerScriptChoisi, type PropositionScripts, type ScriptChoisi } from "@/moteurs/montage-tutoriel-outil/equipe/scenariste";
import { validerScriptTutoriel } from "@/moteurs/montage-tutoriel-outil/index";
import { CODE_SCRIPT_A_VALIDER } from "@/moteurs/montage-tutoriel-outil/script";
import { depots, maintenant } from "./_commun";
import { exigerSession } from "./auth";

export const PHRASE_RIEN_A_VALIDER = "Rien à valider pour l'instant.";
const PHRASE_CHOISIR_D_ABORD = "Choisissez d'abord une version du script.";
const PHRASE_REGISTRE_FIGE = "Le texte est déjà validé : choisissez ou corrigez à nouveau, puis validez de nouveau.";
const PHRASE_MAX_PHRASE = 600;

export type IssueValidation = { statut: "ok"; phrase: string } | { statut: "refusee"; phrase: string };

/** Forme minimale lue dans `travail.parametres.tutoriel.equipe`. */
export interface EtatEquipeLu {
  propositionScripts?: PropositionScripts;
  scriptChoisi?: ScriptChoisi;
  registre?: RegistreTextes;
  parcours?: { etapes?: { id: string }[] };
  textesMaquette?: { etapeId: string; textes: string[]; creee: boolean }[];
  conversation?: { auteur: "client" | "assistant"; texte: string }[];
  propositions?: { id: string; texte: string; etapeId?: string }[];
  [autre: string]: unknown;
}

const refus = (phrase: string): IssueValidation => ({ statut: "refusee", phrase });
const ok = (phrase: string): IssueValidation => ({ statut: "ok", phrase });
const objet = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

async function derniereFabrication(videoId: Id): Promise<Travail | null> {
  const liste = await depots().travaux.lister((t) => t.cibleId === videoId && t.type === "fabrication");
  return liste.sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0] ?? null;
}

/** L'équipe du travail, ou `null` quand la forme n'existe pas encore (rien à valider). */
function equipeDe(travail: Travail | null): EtatEquipeLu | null {
  const tuto = travail?.parametres?.tutoriel;
  const equipe = objet(tuto) ? tuto.equipe : undefined;
  if (!objet(equipe)) return null;
  return equipe.propositionScripts || equipe.scriptChoisi || equipe.registre ? (equipe as EtatEquipeLu) : null;
}

async function ecrireEquipe(travail: Travail, equipe: EtatEquipeLu, en: Partial<Pick<Travail, "etapes" | "statut" | "parametres">> = {}): Promise<void> {
  const base = en.parametres ?? travail.parametres ?? {};
  const tuto = objet(base.tutoriel) ? base.tutoriel : {};
  await depots().travaux.modifier(travail.id, { ...en, parametres: { ...base, tutoriel: { ...tuto, equipe } } });
}

async function finChoisie(videoId: Id): Promise<"aucune" | "prendre-rendez-vous"> {
  const e = (await depots().videos.obtenir(videoId))?.entrees?.[ENTREE_TUTORIEL];
  return objet(e) && e.fin === "prendre-rendez-vous" ? "prendre-rendez-vous" : "aucune";
}

/** Établit le registre du script choisi (les propositions déjà cochées gardent leur choix). */
function registreDe(equipe: EtatEquipeLu, script: ScriptChoisi, fin: "aucune" | "prendre-rendez-vous", ancien?: RegistreTextes): RegistreTextes {
  const neuf = etablirRegistre({
    script: { phrases: script.phrases.map((p) => p.texte), origine: script.source },
    fin,
    parcours: equipe.parcours ?? {},
    textesMaquette: equipe.textesMaquette ?? [],
    ...(equipe.conversation ? { conversation: equipe.conversation } : {}),
    ...(equipe.propositions ? { propositions: equipe.propositions } : {}),
  });
  if (!ancien) return neuf;
  const gardes = new Map(ancien.entrees.filter((e) => e.origine === "proposition-studio").map((e) => [e.id, e.choisi]));
  return { ...neuf, entrees: neuf.entrees.map((e) => (e.origine === "proposition-studio" && gardes.has(e.id) ? { ...e, choisi: gardes.get(e.id) === true } : e)) };
}

/** Seule pause où les gestes agissent (liste fermée) : le script attend la validation de Williams. */
const CODES_PAUSE_VALIDATION: readonly string[] = [CODE_SCRIPT_A_VALIDER];
function enPauseDeValidation(travail: Travail): boolean {
  const pause = travail.parametres?.pause;
  const code = objet(pause) ? pause.code : undefined;
  // La pause fait foi : la vraie boucle laisse le travail « en_cours » (`ecrireAvancement` ne le remet jamais « en_file »).
  return (travail.statut === "en_file" || travail.statut === "en_cours") && typeof code === "string" && CODES_PAUSE_VALIDATION.includes(code);
}

/** Gestes communs : session, travail, équipe lue ; sinon « Rien à valider », rien n'est écrit. */
async function contexte(videoId: Id): Promise<{ travail: Travail; equipe: EtatEquipeLu } | IssueValidation> {
  await exigerSession();
  if (typeof videoId !== "string" || !videoId) return refus(PHRASE_RIEN_A_VALIDER);
  const travail = await derniereFabrication(videoId);
  const equipe = equipeDe(travail);
  return travail && equipe && enPauseDeValidation(travail) ? { travail, equipe } : refus(PHRASE_RIEN_A_VALIDER);
}
const estIssue = (c: Awaited<ReturnType<typeof contexte>>): c is IssueValidation => "statut" in c && !("travail" in c);

/** Williams choisit la version A ou B : le script choisi est figé ; un registre déjà figé est refait (nouvelle validation exigée). */
export async function choisirVersion(videoId: Id, version: "A" | "B"): Promise<IssueValidation> {
  const c = await contexte(videoId);
  if (estIssue(c)) return c;
  if (version !== "A" && version !== "B") return refus("Choisissez la version A ou la version B.");
  const p = c.equipe.propositionScripts;
  if (!p) return refus(PHRASE_RIEN_A_VALIDER);
  const scriptChoisi = figerScriptChoisi(p, { version });
  const fin = await finChoisie(videoId);
  await ecrireEquipe(c.travail, { ...c.equipe, scriptChoisi, registre: registreDe(c.equipe, scriptChoisi, fin, c.equipe.registre) });
  return ok(`La version ${version} est choisie.`);
}

/** Les phrases du script choisi comme lignes de `RelireScript` (une par phrase dite). */
export function lignesDuScript(script: ScriptChoisi): LigneScript[] {
  return script.phrases.map((p, i) => ({ id: `voix-${i + 1}`, dit: p.texte }));
}

/**
 * Seules les différences de `RelireScript` sont appliquées : le texte de Williams est gardé tel quel (jamais réécrit),
 * les autres phrases restent mot pour mot. Un registre déjà figé est refait : nouvelle validation exigée.
 */
export async function corrigerScript(videoId: Id, diffs: readonly DifferenceLigne[]): Promise<IssueValidation> {
  const c = await contexte(videoId);
  if (estIssue(c)) return c;
  const actuel = c.equipe.scriptChoisi;
  if (!actuel) return refus(PHRASE_CHOISIR_D_ABORD);
  if (!Array.isArray(diffs)) return refus("Aucune correction à garder.");
  const nouvelles = actuel.phrases.map((p) => ({ ...p }));
  let touchees = 0;
  for (const d of diffs) {
    const m = objet(d) && typeof d.id === "string" ? /^voix-(\d+)$/.exec(d.id) : null;
    const i = m ? Number(m[1]) - 1 : -1;
    if (i < 0 || i >= nouvelles.length || typeof d.dit !== "string") continue;
    if (!d.dit.trim() || d.dit.length > PHRASE_MAX_PHRASE) return refus("Une phrase corrigée est vide ou trop longue.");
    if (d.dit === nouvelles[i].texte) continue;
    nouvelles[i] = { texte: d.dit, aRevoir: true };
    touchees++;
  }
  if (!touchees) return refus("Aucune correction à garder.");
  const scriptChoisi: ScriptChoisi = { texte: nouvelles.map((p) => p.texte).join(" "), phrases: nouvelles, source: "corrige", empreinte: empreinteLignes(lignesDuScript({ ...actuel, phrases: nouvelles })) };
  const fin = await finChoisie(videoId);
  await ecrireEquipe(c.travail, { ...c.equipe, scriptChoisi, registre: registreDe(c.equipe, scriptChoisi, fin, c.equipe.registre) });
  return ok("Vos corrections sont gardées, mot pour mot.");
}

/** Coche ou décoche un texte proposé par le Studio (registre de T-EXT-40). Rien ne se dit sans le choix de Williams. */
export async function choisirPropositionRegistre(videoId: Id, id: string, choisi: boolean): Promise<IssueValidation> {
  const c = await contexte(videoId);
  if (estIssue(c)) return c;
  if (typeof id !== "string" || typeof choisi !== "boolean") return refus("Ce choix n'est pas valable.");
  const script = c.equipe.scriptChoisi;
  if (!script) return refus(PHRASE_CHOISIR_D_ABORD);
  const registre = c.equipe.registre ?? registreDe(c.equipe, script, await finChoisie(videoId));
  const r = choisirProposition(registre, id, choisi);
  if (!r.ok) return refus(registre.fige ? PHRASE_REGISTRE_FIGE : "Cette proposition n'existe pas.");
  await ecrireEquipe(c.travail, { ...c.equipe, registre: r.registre });
  return ok(choisi ? "Ce texte sera montré." : "Ce texte ne sera pas montré.");
}

/** « Refaire écrire » : l'étape du script repasse en attente (le scénariste réécrit) ; aucune dépense par ce geste. */
export async function refaireEcrire(videoId: Id): Promise<IssueValidation> {
  const c = await contexte(videoId);
  if (estIssue(c)) return c;
  const { scriptChoisi: _s, registre: _r, ...reste } = c.equipe;
  void _s;
  void _r;
  const { pause: _p, ...sansPause } = c.travail.parametres ?? {};
  void _p;
  await ecrireEquipe(c.travail, reste, {
    statut: "en_file",
    etapes: c.travail.etapes.map((e) => (e.cle === "script" ? { ...e, statut: "en_attente" as const, progression: 0 } : e)),
    parametres: sansPause,
  });
  return ok("Le script va être réécrit.");
}

/**
 * Valide : refus sans version choisie ; fige le registre ; écrit l'accord du devis (si une empreinte est donnée) dans la
 * vidéo ET dans la commande figée de la version ; reprend la fabrication avec le texte choisi.
 */
export async function validerTutoriel(videoId: Id, options: { empreinteDevis?: string } = {}): Promise<IssueValidation> {
  const c = await contexte(videoId);
  if (estIssue(c)) return c;
  const script = c.equipe.scriptChoisi;
  if (!script) return refus(PHRASE_CHOISIR_D_ABORD);
  const empreinteDevis = options?.empreinteDevis;
  if (empreinteDevis !== undefined && (typeof empreinteDevis !== "string" || !empreinteDevis.trim() || empreinteDevis.length > 200)) return refus("L'accord du devis n'est pas valable : rouvrez le devis.");
  const le = maintenant();
  const base = c.equipe.registre ?? registreDe(c.equipe, script, await finChoisie(videoId));
  const fige = base.fige ? { ok: true as const, registre: base } : figerRegistre(base, le);
  if (!fige.ok) return refus(PHRASE_REGISTRE_FIGE);
  const equipe: EtatEquipeLu = { ...c.equipe, registre: fige.registre };

  const d = depots();
  if (empreinteDevis !== undefined) {
    const accord = { empreinte: empreinteDevis.trim(), le };
    const video = await d.videos.obtenir(videoId);
    if (video) await d.videos.modifier(videoId, { entrees: { ...(video.entrees ?? {}), [ENTREE_DEVIS_TUTORIEL]: accord } });
    const version = c.travail.versionId ? await d.versions.obtenir(c.travail.versionId) : null;
    if (version) await d.versions.modifier(version.id, { commande: { ...version.commande, entrees: { ...(version.commande.entrees ?? {}), [ENTREE_DEVIS_TUTORIEL]: accord } } });
  }
  // T-EXT-55 : le moteur exige le registre FIGÉ dans l'équipe du travail qu'il reçoit (le choix de Williams reste le texte déjà figé).
  const tuto0 = objet(c.travail.parametres?.tutoriel) ? c.travail.parametres.tutoriel : {};
  const relance = validerScriptTutoriel({ ...c.travail, parametres: { ...(c.travail.parametres ?? {}), tutoriel: { ...tuto0, equipe } } }, script.texte);
  const tuto = objet(relance.parametres?.tutoriel) ? relance.parametres.tutoriel : {};
  await d.travaux.modifier(c.travail.id, { statut: relance.statut, etapes: relance.etapes, parametres: { ...(relance.parametres ?? {}), tutoriel: { ...tuto, equipe } } });
  return ok("Votre texte est validé : la vidéo reprend.");
}
