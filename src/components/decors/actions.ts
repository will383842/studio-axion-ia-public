"use server";

/**
 * Actions serveur de « Mes décors » (lot B1). Chacune commence par exigerSession() ; les règles sont dans
 * `services/decors.ts` et `domaine/decors.ts`. Rien n'est jamais supprimé : on range.
 */
import { revalidatePath } from "next/cache";
import type { AngleVisage, Id, Montant } from "@/domaine/types";
import { exigerSession } from "@/services/auth";
import { essayer, type Resultat } from "@/services/_commun";
import {
  demanderDecor,
  estimerDemandeDecor,
  estimerLookDecor,
  garderProposition,
  looksHeygenPourDecors,
  mettreEnAvant,
  preparerLookDecor,
  rangerDecor,
  relierLookDecor,
  validerDecor,
  type EstimationDemandeDecor,
  type EstimationLook,
} from "@/services/decors";
import type { LookExistant } from "@/fournisseurs/types";

function rafraichir() {
  revalidatePath("/bibliotheque");
  revalidatePath("/bibliotheque/decor");
}

export async function estimerDemandeDecorAction(texte: string): Promise<Resultat<EstimationDemandeDecor>> {
  await exigerSession();
  return essayer(() => estimerDemandeDecor(String(texte ?? "")));
}

/** CORRECTEUR 1 — B6 : `confirme` vient de l'écran (bouton « Créer … · prix » de la feuille). */
export async function demanderDecorAction(texte: string, confirme?: boolean): Promise<Resultat<{ propositionIds: Id[]; cout: Montant; essai: boolean }>> {
  await exigerSession();
  const r = await essayer(() => demanderDecor(String(texte ?? ""), { confirme: confirme === true }));
  rafraichir();
  return r;
}

export async function garderPropositionAction(id: Id): Promise<Resultat<{ ranges: Id[] }>> {
  await exigerSession();
  const r = await essayer(() => garderProposition(String(id)));
  rafraichir();
  return r;
}

export async function rangerDecorAction(id: Id, ranger: boolean): Promise<Resultat> {
  await exigerSession();
  const r = await essayer(async () => {
    await rangerDecor(String(id), !!ranger);
    return undefined;
  });
  rafraichir();
  return r;
}

export async function mettreEnAvantAction(id: Id, oui: boolean): Promise<Resultat> {
  await exigerSession();
  const r = await essayer(async () => {
    await mettreEnAvant(String(id), !!oui);
    return undefined;
  });
  rafraichir();
  return r;
}

export async function validerDecorAction(id: Id): Promise<Resultat> {
  await exigerSession();
  const r = await essayer(async () => {
    await validerDecor(String(id));
    return undefined;
  });
  rafraichir();
  return r;
}

export async function estimerLookAction(id: Id): Promise<Resultat<EstimationLook>> {
  await exigerSession();
  return essayer(() => estimerLookDecor(String(id)));
}

/** CORRECTEUR 1 — B6 : `confirme` vient de l'écran (bouton « Fabriquer · prix »). */
export async function preparerLookAction(id: Id, confirme?: boolean): Promise<Resultat<{ crees: AngleVisage[]; reutilise: boolean; essai: boolean }>> {
  await exigerSession();
  const r = await essayer(() => preparerLookDecor(String(id), { confirme: confirme === true }));
  rafraichir();
  return r;
}

/** Correcteur réel 2 : les looks du compte HeyGen (lecture gratuite, rien n'est créé). */
export async function looksHeygenAction(): Promise<Resultat<{ branche: boolean; looks: LookExistant[] }>> {
  await exigerSession();
  return essayer(() => looksHeygenPourDecors());
}

/** Correcteur réel 2 : relie un look déjà fait dans HeyGen à ce décor (rien n'est payé ; à valider sur la vignette). */
export async function relierLookAction(id: Id, idExterne: string, angle: AngleVisage): Promise<Resultat> {
  await exigerSession();
  const r = await essayer(async () => {
    await relierLookDecor(String(id), { idExterne: String(idExterne ?? ""), angle: String(angle) as AngleVisage });
    return undefined;
  });
  rafraichir();
  return r;
}
