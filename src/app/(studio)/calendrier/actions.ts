"use server";

/**
 * Actions du calendrier. Chaque action commence par exigerSession() : sans session, rien n'est lu ni écrit.
 * Rien ne part d'ici : ces actions n'appellent jamais l'outil de publication et ne valident rien.
 * Une action par geste ; les règles (clé, verrou, saisie) sont celles de la fiche, dans FicheEntree.tsx.
 */
import { revalidatePath } from "next/cache";
import { lireCleFiche, PHRASES_VERROU, verifierSaisie, verrouFiche, type CleFiche, type EntreeFiche, type FicheEnregistree, type SaisieFiche } from "@/components/calendrier/FicheEntree";
import { etatDepuisStatut } from "@/components/calendrier/PastilleStatutPlan";
import { heureAffichageParis, transitionner } from "@/domaine/plan-editorial/statuts";
import type { CreneauEditorial } from "@/domaine/plan-editorial/types";
import type { Publication } from "@/domaine/types";
import { cleJour } from "@/lib/dates";
import { exigerSession } from "@/services/auth";
import { creerVerrou, depots, ecrireParametre, ErreurStudio, essayer, lireParametre, type Resultat } from "@/services/_commun";

/** Une fiche à la fois : entre la relecture de l'entrée et l'écriture, rien d'autre ne passe par ici. */
const unALaFois = creerVerrou();

const INTROUVABLE = "Cette publication est introuvable dans le calendrier. Rechargez la page.";
const ETATS_ENVOI_CONFIES: readonly string[] = ["en-cours", "envoye", "a-verifier"];

type Source = { origine: "publication"; publication: Publication } | { origine: "creneau"; creneau: CreneauEditorial };
interface FicheChargee {
  cle: CleFiche;
  source: Source;
  entree: EntreeFiche;
}

/** Texte et premier commentaire saisis dans la fiche, par entrée et par réseau. */
const cleStockage = (cle: CleFiche) => `calendrier.fiche.${cle.cle}`;
const chaine = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

async function lireStockage(cle: CleFiche): Promise<{ texte?: string; premierCommentaire?: string }> {
  const brut = await lireParametre<unknown>(cleStockage(cle), null);
  const o = brut && typeof brut === "object" && !Array.isArray(brut) ? (brut as Record<string, unknown>) : {};
  return { texte: chaine(o.texte), premierCommentaire: chaine(o.premierCommentaire) };
}

/** « HH:MM » à Paris, ou rien si l'instant est illisible. */
function heureParis(instant: string | undefined): string | undefined {
  if (!instant || Number.isNaN(Date.parse(instant))) return undefined;
  return heureAffichageParis(instant);
}

/** Relit l'entrée là où elle vit et la présente comme la fiche la montre. Lève « introuvable » sinon. */
async function charger(cleBrute: unknown): Promise<FicheChargee> {
  const cle = lireCleFiche(cleBrute);
  if (!cle) throw new ErreurStudio("FICHE_INTROUVABLE", INTROUVABLE);
  const garde = await lireStockage(cle);
  if (cle.origine === "publication") {
    const p = await depots().publications.obtenir(cle.id);
    const etat = p && p.reseau === cle.reseau ? etatDepuisStatut(p.statut) : null;
    if (!p || !etat) throw new ErreurStudio("FICHE_INTROUVABLE", INTROUVABLE);
    const lisible = !Number.isNaN(Date.parse(p.date));
    const confiee = p.statut === "programmee" || Boolean(p.idExterne) || ETATS_ENVOI_CONFIES.includes(p.etatEnvoi ?? "");
    return {
      cle,
      source: { origine: "publication", publication: p },
      entree: { cle: cle.cle, jour: lisible ? cleJour(p.date) : "", reseau: cle.reseau, type: p.visuelId ? "carrousel" : "video", etat, heure: heureParis(p.date), texte: p.texte ?? "", premierCommentaire: garde.premierCommentaire, confiee },
    };
  }
  const c = await depots().creneauxEditoriaux.obtenir(cle.id);
  // Même règle que la vue du calendrier : un réseau sans heure n'est pas une entrée.
  const etat = c && c.heuresParReseau[cle.reseau] ? etatDepuisStatut(c.statut) : null;
  if (!c || !etat) throw new ErreurStudio("FICHE_INTROUVABLE", INTROUVABLE);
  return {
    cle,
    source: { origine: "creneau", creneau: c },
    entree: { cle: cle.cle, jour: c.jourVise, reseau: cle.reseau, type: c.visuelId ? "carrousel" : "video", etat, heure: heureParis(c.heuresParReseau[cle.reseau]), texte: garde.texte ?? "", premierCommentaire: garde.premierCommentaire, confiee: c.statut === "programme" },
  };
}

/** Lit la fiche d'une entrée (clé d'une carte : « creneau:<id>|<réseau> » ou « publication:<id>|<réseau> »). */
export async function lireFicheEntreeAction(cle: string): Promise<Resultat<EntreeFiche>> {
  await exigerSession();
  return essayer(async () => (await charger(cle)).entree);
}

/**
 * Enregistre le texte et le premier commentaire d'une entrée, tant que rien n'est envoyé. Refusé pour une entrée
 * publiée, passée (jour de Paris), programmée ou déjà confiée. Le statut ne change pas, sauf pour une entrée déjà
 * validée dont le contenu change : elle repasse « à valider » (une validation ne vaut que pour ce qui a été lu).
 */
export async function enregistrerFicheEntreeAction(cle: string, saisie: SaisieFiche): Promise<Resultat<FicheEnregistree>> {
  await exigerSession();
  return essayer(() =>
    unALaFois(async () => {
      const fiche = await charger(cle);
      const verrou = verrouFiche(fiche.entree, cleJour(new Date()));
      if (verrou) throw new ErreurStudio("FICHE_VERROUILLEE", PHRASES_VERROU[verrou]);
      const verifiee = verifierSaisie(saisie, fiche.cle.reseau);
      if (!verifiee.ok) throw new ErreurStudio("FICHE_FORMAT", verifiee.message);

      const avant = { texte: fiche.entree.texte, premierCommentaire: fiche.entree.premierCommentaire ?? "" };
      const apres = { texte: verifiee.saisie.texte, premierCommentaire: verifiee.saisie.premierCommentaire ?? avant.premierCommentaire };
      const rendu = { cle: fiche.cle.cle, texte: apres.texte, premierCommentaire: apres.premierCommentaire || null };
      if (apres.texte === avant.texte && apres.premierCommentaire === avant.premierCommentaire) return { ...rendu, modifie: false, aRevalider: false };

      let aRevalider = false;
      if (fiche.source.origine === "publication") {
        if (apres.texte !== avant.texte) await depots().publications.modifier(fiche.source.publication.id, { texte: apres.texte });
        await ecrireParametre(cleStockage(fiche.cle), { premierCommentaire: apres.premierCommentaire });
      } else {
        await ecrireParametre(cleStockage(fiche.cle), apres);
        if (fiche.source.creneau.statut === "valide") {
          const retour = transitionner(fiche.source.creneau, "a_valider", "studio");
          if (!retour.ok) throw new ErreurStudio("FICHE_VERROUILLEE", PHRASES_VERROU.etat);
          await depots().creneauxEditoriaux.enregistrer(retour.creneau);
          aRevalider = true;
        }
      }
      revalidatePath("/calendrier");
      return { ...rendu, modifie: true, aRevalider };
    }),
  );
}
