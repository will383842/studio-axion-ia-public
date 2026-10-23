"use server";

/** Actions de « Ma voix » (générateur, lot G2). Chaque action commence par exigerSession(). */
import { revalidatePath } from "next/cache";
import type { Id, TourneInterdite } from "@/domaine/types";
import { exigerSession } from "@/services/auth";
import { essayer, type Resultat } from "@/services/_commun";
import { ajouterPilier, confirmerInterdit, retirerPilier, validerExpression, validerPilier } from "@/services/contexte-axion";
import {
  ajouterTexteWill,
  ajouterTournure,
  basculerTexteRetenu,
  changerNiveauTournure,
  marquerRegleRelue,
  rangerTournure,
  validerFicheStyle,
  validerPrononciation,
  validerSigleTelQuel,
} from "@/services/voix";

async function agir(f: () => Promise<unknown>): Promise<Resultat> {
  await exigerSession();
  const r = await essayer(async () => {
    await f();
    return undefined;
  });
  if (r.ok) {
    revalidatePath("/ecrire/voix");
    revalidatePath("/ecrire");
  }
  return r;
}

export async function ajouterTexteAction(texte: string): Promise<Resultat> {
  return agir(() => ajouterTexteWill(texte, "post-dicte"));
}
export async function texteRetenuAction(id: Id, retenu: boolean): Promise<Resultat> {
  return agir(() => basculerTexteRetenu(id, retenu));
}
export async function validerFicheAction(): Promise<Resultat> {
  return agir(() => validerFicheStyle());
}
export async function validerExpressionAction(expression: string, texteSourceId: Id): Promise<Resultat> {
  return agir(() => validerExpression(expression, texteSourceId));
}
export async function validerPilierAction(id: string): Promise<Resultat> {
  return agir(() => validerPilier(id));
}
export async function retirerPilierAction(id: string): Promise<Resultat> {
  return agir(() => retirerPilier(id));
}
export async function ajouterPilierAction(nom: string): Promise<Resultat> {
  return agir(() => ajouterPilier(nom));
}
export async function confirmerInterditAction(id: string): Promise<Resultat> {
  return agir(() => confirmerInterdit(id));
}
export async function ajouterTournureAction(motif: string, niveau: TourneInterdite["niveau"]): Promise<Resultat> {
  return agir(() => ajouterTournure(motif, niveau));
}
export async function niveauTournureAction(id: Id, niveau: TourneInterdite["niveau"]): Promise<Resultat> {
  return agir(() => changerNiveauTournure(id, niveau));
}
export async function rangerTournureAction(id: Id): Promise<Resultat> {
  return agir(() => rangerTournure(id));
}
export async function regleRelueAction(id: Id): Promise<Resultat> {
  return agir(() => marquerRegleRelue(id));
}
export async function sigleTelQuelAction(sigle: string): Promise<Resultat> {
  return agir(() => validerSigleTelQuel(sigle));
}
export async function prononciationEcouteeAction(id: Id): Promise<Resultat> {
  return agir(() => validerPrononciation(id));
}
