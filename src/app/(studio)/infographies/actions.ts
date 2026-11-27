"use server";

/**
 * Actions des écrans de l'infographie (INF-01). Session exigée. Créer garde un BROUILLON ; Valider le passe à « validée ».
 * Aucun rendu, aucun envoi, aucune programmation : ces gestes ne sont pas dans cette fiche.
 */
import { RESEAUX_VISUEL_CLASSIQUES } from "@/domaine/reseaux-visuel-envoi";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EtatInfographie, FicheInfographieStockee, ReseauInfographie, StyleInfographie } from "@/components/visuels/FicheInfographie";
import { InfographieSpec } from "@/domaine/visuels/schema-infographie";
import { ecrireParametre, journaliser, lireParametre, maintenant, sousVerrou } from "@/services/_commun";
import { exigerSession } from "@/services/auth";

const STYLES: readonly StyleInfographie[] = ["liste", "avant", "chiffre"];
const RESEAUX: readonly ReseauInfographie[] = RESEAUX_VISUEL_CLASSIQUES;
const FORME_ID = /^inf_[0-9a-f-]{36}$/;

/** Cle du dossier de l'infographie et de la liste des identifiants, dans les paramètres du studio. */
const cleFiche = (id: string) => `infographies.fiche.${id}`;
const CLE_INDEX = "infographies.index";

function lireChamp(donnees: FormData, nom: string): string {
  const v = donnees.get(nom);
  return typeof v === "string" ? v : "";
}

/** Création : un brouillon est écrit, puis l'écran d'aperçu s'ouvre. Une erreur rend une phrase et n'écrit rien. */
export async function creerInfographieAction(_etat: EtatInfographie, donnees: FormData): Promise<EtatInfographie> {
  await exigerSession();
  const titre = lireChamp(donnees, "titre").trim().replace(/\s+/g, " ");
  const points = lireChamp(donnees, "points").split("\n").map((l) => l.trim()).filter(Boolean);
  const styleBrut = lireChamp(donnees, "style");
  const style = STYLES.find((s) => s === styleBrut) ?? "liste";
  const reseaux = RESEAUX.filter((r) => donnees.getAll("reseau").includes(r));
  if (!titre) return { erreur: "Écrivez un titre." };
  if (points.length < 3) return { erreur: "Il faut au moins trois points clés, un par ligne." };
  if (points.length > 5) return { erreur: "Cinq points clés au plus : gardez les plus importants." };
  if (reseaux.length === 0) return { erreur: "Choisissez au moins un réseau." };
  // Même porte que le rendu futur : textes courts, sans lien.
  const verdict = InfographieSpec.safeParse({
    version: "infographie/1",
    alt: titre.slice(0, 125),
    titre,
    blocs: points.map((p) => ({ titre: p.slice(0, 60), texte: p })),
  });
  if (!verdict.success) return { erreur: "Le titre ou un point est trop long, ou contient un lien. Raccourcissez-le, sans adresse, puis réessayez." };
  const id = `inf_${randomUUID()}`;
  const date = maintenant();
  const fiche: FicheInfographieStockee = { id, titre, points, style, reseaux, statut: "brouillon", creeLe: date, modifieLe: date };
  await sousVerrou(async () => {
    await ecrireParametre(cleFiche(id), fiche);
    const index = await lireParametre<string[]>(CLE_INDEX, []);
    await ecrireParametre(CLE_INDEX, [...index, id]);
  });
  await journaliser("infographie", "Infographie créée en brouillon.", { type: "infographie", id });
  revalidatePath("/infographies");
  // `redirect` lève une exception : appelé en dernier.
  redirect(`/infographies/${encodeURIComponent(id)}`);
}

/** « Valider » : seul un brouillon se valide. Ne programme ni n'envoie rien. */
export async function validerInfographieAction(donnees: FormData): Promise<void> {
  await exigerSession();
  const id = lireChamp(donnees, "id");
  if (!FORME_ID.test(id)) redirect("/infographies");
  let trouve = false;
  await sousVerrou(async () => {
    const fiche = await lireParametre<FicheInfographieStockee | null>(cleFiche(id), null);
    if (!fiche || fiche.statut !== "brouillon") return;
    trouve = true;
    const date = maintenant();
    await ecrireParametre(cleFiche(id), { ...fiche, statut: "valide", valideLe: date, modifieLe: date });
  });
  if (trouve) await journaliser("infographie", "Infographie validée : rien n'est programmé ni envoyé.", { type: "infographie", id });
  revalidatePath(`/infographies/${id}`);
  redirect(`/infographies/${encodeURIComponent(id)}`);
}
