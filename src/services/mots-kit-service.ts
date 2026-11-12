/**
 * MOTS (PV-5) · service du kit LinkedIn profil et de la file « À traiter ». INERTE : tant que `MOTS_ENABLED` est éteint,
 * rien n'est généré ni écrit (issue « simulé »). La validation est celle de PV-3 : empreinte ENREGISTRÉE par le geste de
 * validation (mots-service) comparée au texte actuel. Aucun appel réseau.
 */
import "server-only";
import { lireParametre, ecrireParametre, sousVerrou, maintenant } from "./_commun";
import { aTraiter, ajouterElement, construireKitLinkedinProfil, marquerFait, type ElementATraiter, type KitLinkedinProfil, type RefusKit } from "./mots-kit";
import { motsActif, PARAM_VALIDATIONS_MOTS } from "./mots-service";
import { ETAT_VALIDE, textesDepuisSaisie, type SaisieMot } from "./mots-textes";

export const PARAM_A_TRAITER_MOTS = "mots.a_traiter";
type Env = Record<string, string | undefined>;

export type ResultatKitService = { issue: "execute"; kit: KitLinkedinProfil } | { issue: "simule"; raison: "interrupteur_eteint" } | { issue: "refuse"; raison: RefusKit };

export async function genererKit(d: { saisie: SaisieMot; lienGuide: string; env?: Env }): Promise<ResultatKitService> {
  if (!motsActif(d.env ?? process.env)) return { issue: "simule", raison: "interrupteur_eteint" };
  const t = textesDepuisSaisie(d.saisie);
  const enregistree = (await lireParametre<Record<string, string>>(PARAM_VALIDATIONS_MOTS, {}))[t.mot] ?? null;
  const r = construireKitLinkedinProfil(enregistree ? { ...t, etat: ETAT_VALIDE, empreinteValidee: enregistree } : t, d.lienGuide);
  return r.ok ? { issue: "execute", kit: r.kit } : { issue: "refuse", raison: r.code };
}

export const lireATraiter = async (): Promise<ElementATraiter[]> => aTraiter(await lireParametre<ElementATraiter[]>(PARAM_A_TRAITER_MOTS, []));

export async function ajouterATraiter(d: { mot: string; repere: string; env?: Env }): Promise<{ issue: "execute" | "simule" | "refuse"; raison: string }> {
  if (!motsActif(d.env ?? process.env)) return { issue: "simule", raison: "interrupteur_eteint" };
  return sousVerrou(async () => {
    const file = await lireParametre<ElementATraiter[]>(PARAM_A_TRAITER_MOTS, []);
    const r = ajouterElement(file, { id: `${d.mot}|${maintenant()}|${file.length}`, mot: d.mot, repere: d.repere, creeLe: maintenant() });
    if (!r.ok) return { issue: "refuse" as const, raison: r.code };
    await ecrireParametre(PARAM_A_TRAITER_MOTS, r.file);
    return { issue: "execute" as const, raison: "ajoute" };
  });
}

export async function marquerElementFait(d: { id: string; env?: Env }): Promise<{ issue: "execute" | "simule"; raison: string }> {
  if (!motsActif(d.env ?? process.env)) return { issue: "simule", raison: "interrupteur_eteint" };
  return sousVerrou(async () => {
    await ecrireParametre(PARAM_A_TRAITER_MOTS, marquerFait(await lireParametre<ElementATraiter[]>(PARAM_A_TRAITER_MOTS, []), d.id));
    return { issue: "execute" as const, raison: "fait" };
  });
}
