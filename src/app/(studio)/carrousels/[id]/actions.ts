"use server";

/** Actions de la fiche d'un carrousel. Session exigée ; seuls l'identifiant, le motif, la page et le commentaire sont lus. */
import { RESEAUX_VISUEL_CLASSIQUES } from "@/domaine/reseaux-visuel-envoi";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { Reseau } from "@/briques/visuels/reseaux";
import type { MotifRefus } from "@/domaine/visuels/visuel";
import { programmerEnUnClic } from "@/components/visuels/BoutonProgrammerVisuel";
import { normaliserLegende, verifierLegende } from "@/components/visuels-texte/compteur";
import { texteDesPages } from "@/domaine/ecriture-post/contenu-source";
import { texteDeterministeVisuel } from "@/generateur/roles/publication-visuel";
import { depots, journaliser, maintenant, sousVerrou } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { appliquerLot } from "@/donnees/memoire";
import { legendesEnregistrees, modifierTexteSansRetrait, reporterLegendeSurCreneau } from "@/services/legende-vers-creneau";
import { retirerVisuel, type DepotsPasserelle } from "@/services/plan-vers-publication";
import { ErreurVisuel, lancerRendu, lireVisuel, preparerPourReseaux, PHRASE_GENERATEUR_ETEINT, refaire, refuser, valider, type DependancesCarrousels } from "@/visuels/services/carrousels";
import { mettreALaCorbeille, restaurer } from "@/visuels/services/corbeille";
import { codeErreur, dependancesCarrousels, lireIdFormulaire } from "@/visuels/services/production";

const MOTIFS: readonly string[] = ["texte", "mise_en_page", "sujet", "ton", "autre"];

/** Joue l'action, puis revient sur la fiche (avec un code d'erreur le cas échéant). `redirect` est appelé hors du try. */
async function agir(donnees: FormData, f: (id: string, deps: DependancesCarrousels) => Promise<unknown>, rendreEnSuite = false): Promise<void> {
  const id = lireIdFormulaire(donnees);
  if (!id) redirect("/carrousels");
  let erreur: string | undefined;
  let completer = "";
  try {
    const res = (await f(id, dependancesCarrousels())) as { aCompleter?: string[] } | undefined;
    if (res && Array.isArray(res.aCompleter) && res.aCompleter.length > 0) completer = res.aCompleter.join(",");
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
  redirect(`/carrousels/${encodeURIComponent(id)}${erreur ? `?erreur=${erreur}` : completer ? `?completer=${completer}` : ""}`);
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
  return agir(donnees, async (id, deps) => {
    const d = depots();
    const passerelle: DepotsPasserelle = {
      creneaux: d.creneauxEditoriaux as unknown as DepotsPasserelle["creneaux"],
      journal: d.journalDecalages,
      publications: d.publications,
      visuels: d.visuels,
      envoisPlanifies: d.envoisPlanifies,
    };
    try {
      // Seules les légendes relues et enregistrées par la personne partent sur le créneau ; le texte automatique reste de côté.
      const reseaux = (await d.visuels.obtenir(id))?.reseaux ?? [];
      const textes = await legendesEnregistrees(reseaux, (r) => deps.lireParametre<unknown>(cleLegende(id, r as ReseauLegende), null));
      return await programmerEnUnClic(passerelle, id, typeof jour === "string" ? jour : "", maintenant(), textes);
    } catch (e) {
      if (e instanceof ErreurVisuel) throw e;
      throw new ErreurVisuel("PROGRAMMER_REFUSE", e instanceof Error ? e.message : "Programmation refusée");
    }
  });
}

const RESEAUX_LEGENDE = RESEAUX_VISUEL_CLASSIQUES;
type ReseauLegende = (typeof RESEAUX_LEGENDE)[number];
const cleLegende = (id: string, reseau: ReseauLegende) => `visuels.legende.${id}.${reseau}`;
const clePrecedente = (id: string, reseau: ReseauLegende) => `visuels.legende-precedente.${id}.${reseau}`;

/** Historique « rien n'est supprimé » : chaque ancien texte est AJOUTÉ à la liste (l'ancienne valeur unique est reprise comme premier élément). */
async function archiverAncien(deps: DependancesCarrousels, id: string, reseau: ReseauLegende, ancien: unknown): Promise<void> {
  const cle = clePrecedente(id, reseau);
  const avant = await deps.lireParametre<unknown>(cle, null);
  const liste = Array.isArray(avant) ? avant : avant ? [avant] : [];
  await deps.ecrireParametre(cle, [...liste, ancien]);
}

function lireReseauLegende(donnees: FormData): ReseauLegende | null {
  const r = donnees.get("reseau");
  return RESEAUX_LEGENDE.find((x) => x === r) ?? null;
}

/**
 * Enregistre le texte relu d'un réseau (L4-13). Trop long ou vide : retour sur la fiche avec l'erreur, RIEN n'est enregistré.
 * Réseau inconnu ou identifiant mal formé : rien n'est lu ni écrit.
 */
export async function enregistrerLegendeAction(donnees: FormData): Promise<void> {
  await exigerSession();
  const id = lireIdFormulaire(donnees);
  const reseau = lireReseauLegende(donnees);
  if (!id) redirect("/carrousels");
  if (!reseau) redirect(`/carrousels/${encodeURIComponent(id)}`);
  const brut = donnees.get("texte");
  const texte = typeof brut === "string" ? normaliserLegende(brut).trim() : "";
  const verdict = verifierLegende(texte, reseau);
  if (!verdict.ok) redirect(`/carrousels/${encodeURIComponent(id)}?legende=${verdict.code}&reseau=${reseau}`);
  let erreur: string | undefined;
  let reportRefuse = false;
  try {
    const deps = dependancesCarrousels();
    await lireVisuel(id, deps);
    await deps.verrou(async () => {
      const ancien = await deps.lireParametre<unknown>(cleLegende(id, reseau), null);
      // Rejeu du même texte : rien à écrire, rien à archiver.
      if ((ancien as { texte?: string } | null)?.texte === texte) return;
      if (ancien) await archiverAncien(deps, id, reseau, ancien);
      await deps.ecrireParametre(cleLegende(id, reseau), { texte, le: deps.maintenant() });
    });
    await journaliser("legende", `Texte relu et enregistré pour ${reseau}.`, { type: "visuel", id });
    // Visuel déjà programmé : le texte relu est reporté sur son créneau (garde de l'envoi relue, rien n'est changé si elle refuse).
    const d = depots();
    const passerelle: DepotsPasserelle = {
      creneaux: d.creneauxEditoriaux as unknown as DepotsPasserelle["creneaux"],
      journal: d.journalDecalages,
      publications: d.publications,
      visuels: d.visuels,
      envoisPlanifies: d.envoisPlanifies,
    };
    const report = await sousVerrou(async () =>
      reporterLegendeSurCreneau({ passerelle, modifierTexte: modifierTexteSansRetrait }, id, reseau, texte, maintenant()),
    );
    if (!report.ok) reportRefuse = true;
  } catch (e) {
    erreur = codeErreur(e);
  }
  revalidatePath(`/carrousels/${id}`);
  redirect(`/carrousels/${encodeURIComponent(id)}${erreur ? `?erreur=${erreur}` : reportRefuse ? `?report=refus` : ""}`);
}

/**
 * « Réécrire » (L4-13) : SIMULATION, aucun appel à un service externe. Le texte automatique prend la place du texte actuel,
 * qui est gardé de côté (rien n'est supprimé) ; la réécriture est écrite au journal, sans montant.
 */
export async function reecrireLegendeAction(donnees: FormData): Promise<void> {
  await exigerSession();
  const id = lireIdFormulaire(donnees);
  const reseau = lireReseauLegende(donnees);
  if (!id) redirect("/carrousels");
  if (!reseau) redirect(`/carrousels/${encodeURIComponent(id)}`);
  let erreur: string | undefined;
  try {
    const deps = dependancesCarrousels();
    const v = await lireVisuel(id, deps);
    if (!v.spec) throw new ErreurVisuel("TRANSITION_REFUSEE", "Ce carrousel n'a pas de texte à réécrire");
    const propose = texteDeterministeVisuel({ reseau, titre: v.titre, texteDesPages: texteDesPages(v.spec), pages: v.spec.pages.length });
    const verdict = verifierLegende(propose.texte, reseau);
    if (!verdict.ok) throw new ErreurVisuel("TRANSITION_REFUSEE", verdict.phrase);
    await deps.verrou(async () => {
      const ancien = await deps.lireParametre<unknown>(cleLegende(id, reseau), null);
      if (ancien) await archiverAncien(deps, id, reseau, ancien);
      await deps.ecrireParametre(cleLegende(id, reseau), { texte: propose.texte.trim(), le: deps.maintenant(), simulation: true });
    });
    await journaliser("legende", `Réécriture en simulation du texte pour ${reseau} : texte automatique, aucun appel externe.`, { type: "visuel", id });
  } catch (e) {
    erreur = codeErreur(e);
  }
  revalidatePath(`/carrousels/${id}`);
  redirect(`/carrousels/${encodeURIComponent(id)}${erreur ? `?erreur=${erreur}` : ""}`);
}

/** « Retirer du calendrier » : défait la programmation tant que rien n'est parti (lignes du Studio seulement). */
export async function retirerDuCalendrierAction(donnees: FormData): Promise<void> {
  await exigerSession();
  await agir(donnees, async (id) => {
    if (donnees.get("confirmation") !== "retirer") throw new ErreurVisuel("RETIRER_REFUSE", "Confirmez d'abord le retrait.");
    const d = depots();
    const passerelle: DepotsPasserelle = {
      creneaux: d.creneauxEditoriaux as unknown as DepotsPasserelle["creneaux"],
      journal: d.journalDecalages,
      publications: d.publications,
      visuels: d.visuels,
      evenements: d.evenements,
    };
    try {
      await sousVerrou(() => retirerVisuel(passerelle, id, maintenant(), appliquerLot));
    } catch (e) {
      if (e instanceof ErreurVisuel) throw e;
      throw new ErreurVisuel("RETIRER_REFUSE", e instanceof Error ? e.message : "Retrait refusé");
    }
  });
}
