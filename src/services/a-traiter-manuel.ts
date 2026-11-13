/**
 * À TRAITER · traitement des commentaires LinkedIn et TikTok (file manuelle). RIEN n'est branché au crochet dans ce lot.
 * Règles : jamais de réponse ni de message automatique (aucun appel au port, aucun import du port ni des branchements) ;
 * un stop gagne partout ; au moindre doute (registre illisible, secret absent) rien n'est écrit et l'événement est repris plus tard ;
 * rien n'est supprimé ; les cartes ne contiennent jamais de texte libre (extrait = le mot seul). Journaux : compteurs seulement.
 * CONTRAT DU FUTUR PRODUCTEUR des événements `zernio.commentaire_manuel` (charge : etat « a_faire », reseau, repere, idCompte, idAuteur, motSeul, proprio) :
 *  - `motSeul` doit déjà porter la forme canonique d'un « stop » (y compris en phrase, ex. « stop, merci ») : ce service ne relit aucun texte ;
 *  - `idAuteur` doit être renseigné : sans lui l'opposition ne peut être inscrite et l'événement est clos « écarté », sans carte ni opposition ;
 *  - au raccord : `injecterDepotATraiter(creerDepotParametre())` au démarrage (le dépôt par défaut d'a-traiter.ts est une mémoire de processus),
 *    et chaque écrivain lit puis écrit sous le même verrou (la fusion du dépôt garde les cartes, mais la version écrite l'emporte).
 * Réglage neuf = ÉTEINT : seule la valeur booléenne `true` l'allume (absent, illisible ou autre valeur = éteint).
 */
import "server-only";
import { candidatsEmpreinte, lireClesEmpreinte } from "@/domaine/guide-reseau/empreinte-personne";
import { proposerCarte, dejaTraitePourMot, type ReseauManuel } from "@/domaine/guide-reseau/carte-manuelle";
import { classerOpposition } from "@/domaine/guide-reseau/opposition";
import type { EvenementFournisseur } from "@/domaine/types";
import { depots, lireParametre } from "./_commun";
import { aTraiterActif, enregistrerATraiter, type DepotATraiter } from "./a-traiter";
import { creerDepotParametre } from "./a-traiter-depot";
import { motsActifsPourReseau } from "./mots-lecture";
import { chargerTextesFichier, PARAM_VALIDATIONS_MOTS } from "./mots-service";
import { empreinteTextes } from "./mots-textes";
import {
  ESPACE_CONTACT_ZERNIO,
  ESPACES_TOUS,
  ErreurOppositionIllisible,
  enregistrerOpposition,
  personneOpposeePartout,
} from "./oppositions-mots";

export const PARAM_RESEAUX_MANUELS = "a_traiter.reseaux_manuels";
export const TYPE_COMMENTAIRE_MANUEL = "zernio.commentaire_manuel";
const LOT_MAX = 20;
const ATTENTE_REPORT_MS = 5 * 60_000;

type Env = Record<string, string | undefined>;
export interface RapportManuel {
  actif: boolean;
  traites: number;
  reportes: number;
}

/** Vrai SEULEMENT pour la valeur booléenne true ; toute panne = éteint. */
async function reglageAllume(): Promise<boolean> {
  try {
    return (await lireParametre<unknown>(PARAM_RESEAUX_MANUELS, false)) === true;
  } catch {
    return false;
  }
}

const texte = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** Réponse proposée : textes du mot validés (empreinte ENREGISTRÉE par le geste de validation = textes actuels). Doute = null. */
async function reponseValidee(mot: string): Promise<string | null> {
  try {
    const enregistree = (await lireParametre<Record<string, string>>(PARAM_VALIDATIONS_MOTS, {}))[mot];
    const f = await chargerTextesFichier(mot);
    if (!enregistree || !f || !f.ok || empreinteTextes(f.textes) !== enregistree) return null;
    return f.textes.reponsePublique || null;
  } catch {
    return null;
  }
}

/** Empreintes opaques de la personne (jamais l'identifiant), pour savoir si ce mot lui a déjà été traité. */
function empreintesDe(id: string): string[] {
  const c = lireClesEmpreinte(process.env);
  if (!c.ok) return [];
  return [...new Set(ESPACES_TOUS.flatMap((e) => candidatsEmpreinte(c, e, id)))];
}

async function clore(ev: EvenementFournisseur, etat: string): Promise<void> {
  await depots().evenementsFournisseurs.modifier(ev.id, {
    traite: true,
    charge: { ...ev.charge, etat, prochainEssaiLe: null },
  });
}
async function reporter(ev: EvenementFournisseur, maintenantMs: number): Promise<void> {
  await depots().evenementsFournisseurs.modifier(ev.id, {
    traite: false,
    charge: { ...ev.charge, etat: "a_faire", prochainEssaiLe: maintenantMs + ATTENTE_REPORT_MS },
  });
}

type Issue = "traite" | "reporte";

async function traiterUn(ev: EvenementFournisseur, o: { env: Env; depot: DepotATraiter; maintenantMs: number }): Promise<Issue> {
  const c = ev.charge;
  const reseauEvt = c.reseau === "tiktok" ? "tiktok" : c.reseau === "linkedin_page" || c.reseau === "linkedin" ? "linkedin_page" : null;
  if (!reseauEvt) {
    await clore(ev, "refuse");
    return "traite";
  }
  const reseau: ReseauManuel = reseauEvt;
  const idAuteur = texte(c.idAuteur);
  const motSeul = texte(c.motSeul);
  if (c.proprio === true) {
    await clore(ev, "propre_compte");
    return "traite";
  }
  // 1. Un mot d'opposition : inscription de l'opposition (rien n'est supprimé), puis clos. Aucune carte.
  if (motSeul !== null && classerOpposition(motSeul) !== "non") {
    if (idAuteur) {
      try {
        await enregistrerOpposition(idAuteur, ESPACE_CONTACT_ZERNIO);
      } catch {
        await reporter(ev, o.maintenantMs);
        return "reporte";
      }
    }
    await clore(ev, "opposition");
    return "traite";
  }
  // 2. « Stop partout » : le doute (registre illisible, secret absent) reporte, rien n'est écrit.
  let opposee: boolean;
  try {
    opposee = (await personneOpposeePartout({ idsBruts: [idAuteur] }, { douteBloque: true })).opposee;
  } catch (e) {
    // Aucun identifiant : la vérification restera impossible à chaque essai. Mis de côté pour de bon (rien supprimé, aucune carte).
    if (e instanceof ErreurOppositionIllisible && e.code === "personne_inconnue") {
      await clore(ev, "ecarte");
      return "traite";
    }
    await reporter(ev, o.maintenantMs);
    return "reporte";
  }
  // 3. Décision de carte (domaine pur) : mots actifs du réseau, réponse validée seulement.
  const motsDuReseau = await motsActifsPourReseau(reseau === "tiktok" ? "tiktok" : "linkedin");
  const empreintes = idAuteur ? empreintesDe(idAuteur) : [];
  const dejaTraite = motSeul !== null && dejaTraitePourMot(await o.depot.lire(), empreintes, motSeul);
  const p = proposerCarte({ reseau, motSeul, motsDuReseau, opposee, dejaTraite });
  if (p.action === "silence") {
    await clore(ev, p.raison);
    return "traite";
  }
  const reponse = p.reponseAProposer ? await reponseValidee(p.mot) : null;
  const r = await enregistrerATraiter(
    {
      idEvenement: ev.idEvenement,
      reseau: reseau === "tiktok" ? "tiktok" : "linkedin",
      post: String(c.repere ?? ""),
      lienPost: texte(c.lienPost),
      mot: p.mot,
      motif: p.motif,
      commentaire: p.mot, // l'extrait est le mot seul : aucun texte libre n'entre dans la carte
      reponse,
      idContact: idAuteur,
      idCompte: texte(c.idCompte) ?? undefined,
      cible: texte(c.repere) ?? undefined,
      titreCible: motsDuReseau.find((m) => m.mot === p.mot)?.titreCible ?? undefined,
      message: p.message,
      raisonSansMessage: p.raisonSansMessage ?? undefined,
    },
    { env: o.env, depot: o.depot },
  );
  if (r.issue === "simule") {
    await reporter(ev, o.maintenantMs);
    return "reporte";
  }
  await clore(ev, r.issue === "refuse" ? "refuse" : "traite");
  return "traite";
}

/** Traite un lot (20 au plus) d'événements `zernio.commentaire_manuel` à l'état « a_faire ». Inerte si éteint. */
export async function traiterCommentairesManuels(
  o: { env?: Env; maintenantMs?: number; depot?: DepotATraiter } = {},
): Promise<RapportManuel> {
  const env = o.env ?? process.env;
  if (!aTraiterActif(env) || !(await reglageAllume())) return { actif: false, traites: 0, reportes: 0 };
  const maintenantMs = o.maintenantMs ?? Date.now();
  const depot = o.depot ?? creerDepotParametre();
  const rapport: RapportManuel = { actif: true, traites: 0, reportes: 0 };
  const dus = await depots().evenementsFournisseurs.lister(
    (e) =>
      e.type === TYPE_COMMENTAIRE_MANUEL &&
      !e.traite &&
      e.charge.etat === "a_faire" &&
      (typeof e.charge.prochainEssaiLe !== "number" || e.charge.prochainEssaiLe <= maintenantMs),
  );
  dus.sort((a, b) => String(a.recuLe).localeCompare(String(b.recuLe)));
  for (const ev of dus.slice(0, LOT_MAX)) {
    try {
      if ((await traiterUn(ev, { env, depot, maintenantMs })) === "reporte") rapport.reportes++;
      else rapport.traites++;
    } catch {
      rapport.reportes++; // panne imprévue : rien n'est clos, l'événement reste à refaire
    }
  }
  return rapport;
}
