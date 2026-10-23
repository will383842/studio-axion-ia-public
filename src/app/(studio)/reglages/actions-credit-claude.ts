"use server";

/** Crédit Claude restant estimé (Réglages) : saisie du cycle et du relevé. Affichage seulement ; chaque action commence par exigerSession(). */
import { revalidatePath } from "next/cache";
import { dateIsoValide, instantDebut } from "@/domaine/credit-claude";
import { SOURCES_ABONNEMENT, type SourceAbonnement } from "@/domaine/source-claude";
import { ErreurStudio, essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { enregistrerCycleCredit, enregistrerReleveCredit } from "@/services/credit-claude";

function rafraichir() {
  revalidatePath("/reglages");
  revalidatePath("/");
}

function sourceAbonnement(s: unknown): SourceAbonnement {
  const trouve = SOURCES_ABONNEMENT.find((x) => x.id === s);
  if (!trouve) throw new ErreurStudio("SOURCE_INVALIDE", "Ce compte n'existe pas : seuls les comptes 1, 2 et 3 ont un crédit à suivre.");
  return trouve.id;
}

function montant(dollars: unknown): number {
  if (typeof dollars !== "number" || !Number.isFinite(dollars) || dollars < 0 || dollars > 1000) throw new ErreurStudio("MONTANT_INVALIDE", "Indiquez un montant entre 0 et 1 000 $.");
  return Math.round(dollars * 100);
}

function dateOptionnelle(v: unknown, nom: string): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (!dateIsoValide(v)) throw new ErreurStudio("DATE_INVALIDE", `La date « ${nom} » n'est pas valide (jour AAAA-MM-JJ, entre 2024 et 2100).`);
  return v;
}

export async function definirCycleCreditClaudeAction(source: string, cycle: { dollars: number; debut: string; expireLe?: string | null; prochainLe?: string | null }): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    const s = sourceAbonnement(source);
    const montantCentimes = montant(cycle?.dollars);
    const debut = dateOptionnelle(cycle?.debut, "début");
    if (!debut) throw new ErreurStudio("DATE_INVALIDE", "Indiquez le début du cycle.");
    const expireLe = dateOptionnelle(cycle?.expireLe, "expiration");
    const prochainLe = dateOptionnelle(cycle?.prochainLe, "prochain crédit");
    if (expireLe && !(instantDebut(expireLe) > instantDebut(debut))) throw new ErreurStudio("DATE_INVALIDE", "L'expiration doit venir après le début du cycle.");
    if (prochainLe && !(instantDebut(prochainLe) > instantDebut(debut))) throw new ErreurStudio("DATE_INVALIDE", "Le prochain crédit doit venir après le début du cycle.");
    await enregistrerCycleCredit(s, { montantCentimes, debut, expireLe, prochainLe });
    rafraichir();
    return undefined;
  });
}

export async function releverCreditClaudeAction(source: string, dollars: number): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    const s = sourceAbonnement(source);
    await enregistrerReleveCredit(s, montant(dollars));
    rafraichir();
    return undefined;
  });
}
