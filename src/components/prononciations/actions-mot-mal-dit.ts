"use server";

/**
 * Actions serveur du panneau « Ce mot est mal dit » (PRONONCIATION-b-v21m). Chacune commence par exigerSession().
 * Le calcul (phrases touchées, texte lu avant / après, ajouter ou remplacer) est celui du module pur
 * `domaine/prononciation-video` ; l'écriture passe par les services EXISTANTS de la base de prononciations :
 * `ajouterPrononciation`, ou `modifierPrononciation` qui archive l'ancienne (rien n'est jamais effacé).
 * Le texte ÉCRIT (script, sous-titres) ne bouge pas. Le calcul est refait ICI : on ne croit jamais l'aperçu du navigateur.
 */
import { revalidatePath } from "next/cache";
import { preparerMotMalDit, type MotMalDit } from "@/domaine/prononciation-video";
import type { Id } from "@/domaine/types";
import { exigerSession } from "@/services/auth";
import { essayer, type Resultat } from "@/services/_commun";
import { ajouterPrononciation, listerPrononciations, modifierPrononciation } from "@/services/prononciations";

export type ApercuMotMalDit = MotMalDit;

export interface DemandeMotMalDitAction {
  /** Phrases de la vidéo (texte lu), une par plan. */
  plans: { id: string; texte: string }[];
  mot: string;
  prononciation: string;
  /** Réservé à une voix ou à un personnage (sinon : toutes les voix). */
  portee?: { voixId?: Id; personnageId?: Id };
}

export interface ResultatEnregistrementMotMalDit {
  action: MotMalDit["action"];
  /** Entrée active après l'écriture (absent si rien n'a été écrit). */
  id?: Id;
  message: string;
}

const MAX_PLANS = 400;
const MAX_TEXTE = 2000;

/** Nettoie ce qui vient du navigateur : types, longueurs, au plus 400 phrases. */
function nettoyer(d: DemandeMotMalDitAction) {
  const plans = (Array.isArray(d?.plans) ? d.plans : [])
    .slice(0, MAX_PLANS)
    .map((p) => ({ id: String(p?.id ?? "").slice(0, 80), texte: String(p?.texte ?? "").slice(0, MAX_TEXTE) }))
    .filter((p) => p.id && p.texte);
  const voixId = d?.portee?.voixId ? String(d.portee.voixId) : undefined;
  const personnageId = d?.portee?.personnageId ? String(d.portee.personnageId) : undefined;
  return {
    plans,
    mot: String(d?.mot ?? "").trim().slice(0, 60),
    prononciation: String(d?.prononciation ?? "").trim().slice(0, 120),
    portee: voixId || personnageId ? { voixId, personnageId } : undefined,
  };
}

async function preparer(d: DemandeMotMalDitAction) {
  const n = nettoyer(d);
  const liste = await listerPrononciations();
  const calcul = preparerMotMalDit({ plans: n.plans, liste, mot: n.mot, prononciation: n.prononciation, ...(n.portee ? { portee: n.portee } : {}) });
  return { n, calcul };
}

/** Ce qui changerait : les phrases touchées, le texte lu avant / après. N'écrit rien. */
export async function previsualiserMotMalDitAction(demande: DemandeMotMalDitAction): Promise<Resultat<ApercuMotMalDit>> {
  await exigerSession();
  return essayer(async () => (await preparer(demande)).calcul);
}

/** Enregistre dans la base existante : ajoute, ou remplace (l'ancienne est archivée) ; « rien » n'écrit rien. */
export async function enregistrerMotMalDitAction(demande: DemandeMotMalDitAction): Promise<Resultat<ResultatEnregistrementMotMalDit>> {
  await exigerSession();
  return essayer(async () => {
    const { n, calcul } = await preparer(demande);
    if (calcul.action === "rien") return { action: "rien" as const, message: calcul.message };
    const options = { source: "video" as const, ...(n.portee ? { portee: n.portee } : {}) };
    const id =
      calcul.action === "modifier" && calcul.entreeExistante
        ? await modifierPrononciation(calcul.entreeExistante.id, { mot: n.mot, prononciation: n.prononciation, ...options })
        : await ajouterPrononciation(n.mot, n.prononciation, options);
    revalidatePath("/bibliotheque");
    revalidatePath("/bibliotheque/prononciations");
    return { action: calcul.action, id, message: calcul.message };
  });
}

/** Le réglage « refaire la voix avec la prononciation » est-il allumé ? Seul `false` écrit l'éteint ; lecture en panne : éteint. */
export async function refaireVoixAllumeeAction(): Promise<boolean> {
  await exigerSession();
  try {
    const { lireParametre } = await import("@/services/_commun");
    const { PARAM_REFAIRE_AVEC_PRONONCIATION } = await import("@/services/refaire-voix");
    return (await lireParametre<unknown>(PARAM_REFAIRE_AVEC_PRONONCIATION, true)) !== false;
  } catch {
    return false;
  }
}

export interface DemandeRefaireVoixMotMalDit {
  videoId: string;
  /** Phrases de la vidéo (texte lu), une par plan. */
  plans: { id: string; texte: string }[];
  /** Les plans à refaire (ceux que l'aperçu a montrés). */
  planIds: string[];
  mot: string;
  prononciation: string;
}

/**
 * « Refaire la voix » : passe par `refaireVoixAvecPrononciation` (S2-16-b) qui garde le plafond par vidéo et la
 * réservation de la retouche. Le refus « plafond » revient en phrase SANS montant. Les phrases visées sont relues ICI
 * dans les plans nettoyés, jamais reprises telles quelles du navigateur.
 */
export async function refaireVoixMotMalDitAction(demande: DemandeRefaireVoixMotMalDit): Promise<Resultat<{ ok: true } | { ok: false; phrase: string }>> {
  await exigerSession();
  return essayer(async () => {
    const n = nettoyer({ plans: demande.plans, mot: demande.mot, prononciation: demande.prononciation });
    const ids = new Set((Array.isArray(demande.planIds) ? demande.planIds : []).map((i) => String(i)));
    const visees = n.plans.filter((p) => ids.has(p.id));
    if (!visees.length) return { ok: false as const, phrase: "Aucune phrase à refaire." };
    const { refaireVoixAvecPrononciation } = await import("@/services/refaire-voix");
    const r = await refaireVoixAvecPrononciation(
      String(demande.videoId ?? ""),
      visees.map((p) => p.id),
      `Prononciation : « ${n.mot} » se dit « ${n.prononciation} »`,
      { phrasesVisees: visees.map((p) => p.texte) },
    );
    revalidatePath(`/videos/${String(demande.videoId ?? "")}`);
    return r.ok ? { ok: true as const } : { ok: false as const, phrase: r.phrase };
  });
}
