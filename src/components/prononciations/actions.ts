"use server";

/**
 * Actions serveur des PRONONCIATIONS (lot A1). Chacune commence par exigerSession() ; les règles sont dans
 * `services/prononciations.ts` et `domaine/prononciations.ts`.
 */
import { revalidatePath } from "next/cache";
import type { LigneCollee, MotARisque } from "@/domaine/prononciations";
import type { Id, Prononciation, SourcePrononciation } from "@/domaine/types";
import { exigerSession } from "@/services/auth";
import { essayer, ErreurStudio, type Resultat } from "@/services/_commun";
import {
  ajouterListeCollee,
  ajouterPrononciation,
  apercuListeCollee,
  detecterDansScript,
  ecouterPrononciation,
  modifierPrononciation,
  rangerPrononciation,
  remettrePrononciation,
  validerEcoute,
  type Ecoute,
} from "@/services/prononciations";

function rafraichir() {
  revalidatePath("/bibliotheque");
  revalidatePath("/bibliotheque/prononciations");
}

export interface DonneesPrononciation {
  mot: string;
  prononciation: string;
  ecriture?: string;
  portee?: Prononciation["portee"];
  source?: SourcePrononciation;
  note?: string;
  ecoutee?: boolean;
}

const SOURCES: SourcePrononciation[] = ["manuel", "script", "video", "lot", "depart"];

function verifier(d: DonneesPrononciation): DonneesPrononciation {
  if (!String(d.mot ?? "").trim() || !String(d.prononciation ?? "").trim()) throw new ErreurStudio("VIDE", "Indiquez le mot et comment le dire.");
  return {
    mot: String(d.mot),
    prononciation: String(d.prononciation),
    ecriture: d.ecriture ? String(d.ecriture) : undefined,
    portee: d.portee ? { voixId: d.portee.voixId ? String(d.portee.voixId) : undefined, personnageId: d.portee.personnageId ? String(d.portee.personnageId) : undefined } : undefined,
    source: d.source && SOURCES.includes(d.source) ? d.source : "manuel",
    note: d.note ? String(d.note) : undefined,
    ecoutee: !!d.ecoutee,
  };
}

/** ▶ Avant / ▶ Après : la phrase type lue par la voix par défaut (ou la voix choisie). */
export async function ecouterPrononciationAction(mot: string, prononciation: string, moment: "avant" | "apres", voixId?: Id): Promise<Resultat<Ecoute>> {
  await exigerSession();
  return essayer(() => ecouterPrononciation(String(mot).slice(0, 60), String(prononciation ?? "").slice(0, 120), moment === "avant" ? "avant" : "apres", { voixId: voixId || undefined }));
}

export async function ajouterPrononciationAction(donnees: DonneesPrononciation): Promise<Resultat<{ id: Id }>> {
  await exigerSession();
  return essayer(async () => {
    const d = verifier(donnees);
    const id = await ajouterPrononciation(d.mot, d.prononciation, d);
    rafraichir();
    return { id };
  });
}

export async function modifierPrononciationAction(id: Id, donnees: DonneesPrononciation): Promise<Resultat<{ id: Id }>> {
  await exigerSession();
  return essayer(async () => {
    const d = verifier(donnees);
    const nouveau = await modifierPrononciation(String(id), { ...d, mot: d.mot, prononciation: d.prononciation });
    rafraichir();
    return { id: nouveau };
  });
}

export async function validerEcouteAction(id: Id): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await validerEcoute(String(id));
    rafraichir();
    return undefined;
  });
}

export async function rangerPrononciationAction(id: Id): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await rangerPrononciation(String(id));
    rafraichir();
    return undefined;
  });
}

export async function remettrePrononciationAction(id: Id): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await remettrePrononciation(String(id));
    rafraichir();
    return undefined;
  });
}

/** Aperçu d'une liste collée (rien n'est enregistré). */
export async function apercuListeAction(texte: string): Promise<Resultat<LigneCollee[]>> {
  await exigerSession();
  return essayer(() => apercuListeCollee(String(texte ?? "")));
}

export async function ajouterListeAction(texte: string): Promise<Resultat<{ ajoutes: number; ignores: number }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await ajouterListeCollee(String(texte ?? ""));
    if (!r.ajoutes) throw new ErreurStudio("RIEN", "Aucun mot nouveau dans cette liste.");
    rafraichir();
    return r;
  });
}

/** Mots à risque d'un script (pastilles de l'étape Script). */
export async function detecterMotsAction(texte: string): Promise<Resultat<MotARisque[]>> {
  await exigerSession();
  return essayer(() => detecterDansScript(String(texte ?? "")));
}
