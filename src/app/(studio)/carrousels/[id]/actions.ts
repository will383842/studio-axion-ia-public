"use server";

/** Actions de la fiche d'un carrousel. Session exigée ; seuls l'identifiant, le motif, la page et le commentaire sont lus. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { Reseau } from "@/briques/visuels/reseaux";
import type { MotifRefus } from "@/domaine/visuels/visuel";
import { programmerEnUnClic } from "@/components/visuels/BoutonProgrammerVisuel";
import { exigerSession } from "@/services/auth";
import type { DepotsPasserelle } from "@/services/plan-vers-publication";
import { ErreurVisuel, lancerRendu, preparerPourReseaux, PHRASE_GENERATEUR_ETEINT, refaire, refuser, valider, type DependancesCarrousels } from "@/visuels/services/carrousels";
import { mettreALaCorbeille, restaurer } from "@/visuels/services/corbeille";
import { codeErreur, dependancesCarrousels, lireIdFormulaire } from "@/visuels/services/production";
import { depots, maintenant } from "@/services/_commun";

const MOTIFS: readonly string[] = ["texte", "mise_en_page", "sujet", "ton", "autre"];

/** Joue l'action, puis revient sur la fiche (avec un code d'erreur le cas échéant). `redirect` est appelé hors du try. */
async function agir(donnees: FormData, f: (id: string, deps: DependancesCarrousels) => Promise<unknown>, rendreEnSuite = false): Promise<void> {
  const id = lireIdFormulaire(donnees);
  if (!id) redirect("/carrousels");
  let erreur: string | undefined;
  try {
    await f(id, dependancesCarrousels());
  } catch (e) {
    erreur = codeErreur(e);
  }
  if (rendreEnSuite && !erreur) {
    after(async () => {
      try {
        await lancerRendu(id, dependancesCarrousels());
      } catch {
        // Bloqué par la porte ou éteint : la fiche l'explique.
      }
    });
  }
  revalidatePath(`/carrousels/${id}`);
  redirect(`/carrousels/${encodeURIComponent(id)}${erreur ? `?erreur=${erreur}` : ""}`);
}

export async function validerAction(donnees: FormData): Promise<void> {
  await exigerSession();
  await agir(donnees, valider);
}

export async function refuserAction(donnees: FormData): Promise<void> {
  await exigerSession();
  const motif = donnees.get("motif");
  const page = donnees.get("page");
  const commentaire = donnees.get("commentaire");
  await agir(donnees, (id, deps) =>
    refuser(
      id,
      (typeof motif === "string" && MOTIFS.includes(motif) ? motif : "autre") as MotifRefus,
      typeof page === "string" && page !== "" ? Number(page) : undefined,
      typeof commentaire === "string" && commentaire.trim() !== "" ? commentaire : undefined,
      deps,
    ),
  );
}

export async function refaireAction(donnees: FormData): Promise<void> {
  await exigerSession();
  await agir(donnees, refaire, true);
}

export async function relancerRenduAction(donnees: FormData): Promise<void> {
  await exigerSession();
  // Relancer = fabriquer un rendu : générateur éteint, on le dit tout de suite au lieu de l'avaler dans `after`.
  await agir(
    donnees,
    async () => {
      if (!(await dependancesCarrousels().allume())) throw new ErreurVisuel("GENERATEUR_ETEINT", PHRASE_GENERATEUR_ETEINT);
    },
    true,
  );
}

export async function corbeilleAction(donnees: FormData): Promise<void> {
  await exigerSession();
  await agir(donnees, (id, deps) => mettreALaCorbeille([id], deps));
}

export async function restaurerAction(donnees: FormData): Promise<void> {
  await exigerSession();
  await agir(donnees, (id, deps) => restaurer([id], deps));
}

/** « Préparer pour les réseaux » : les cases cochées (linkedin, instagram, facebook) ; tout autre valeur est ignorée. */
export async function preparerReseauxAction(donnees: FormData): Promise<void> {
  await exigerSession();
  const reseaux = donnees.getAll("reseau").filter((r): r is Reseau => r === "linkedin" || r === "instagram" || r === "facebook");
  await agir(donnees, (id, deps) => preparerPourReseaux(id, reseaux, deps));
}

/** « Programmer » : un clic crée le créneau du plan et programme le visuel (lignes du Studio seulement, aucun envoi). */
export async function programmerAction(donnees: FormData): Promise<void> {
  await exigerSession();
  const jour = donnees.get("jour");
  await agir(donnees, async (id) => {
    const d = depots();
    const passerelle: DepotsPasserelle = {
      creneaux: d.creneauxEditoriaux as unknown as DepotsPasserelle["creneaux"],
      journal: d.journalDecalages,
      publications: d.publications,
      visuels: d.visuels,
    };
    await programmerEnUnClic(passerelle, id, typeof jour === "string" ? jour : "", maintenant());
  });
}
