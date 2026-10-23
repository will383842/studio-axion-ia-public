/**
 * « MA VOIX » (générateur, plan v5 B.6.1, B.2.8, lot G2) : mes textes, ma façon de parler, tournures interdites,
 * règles datées, prononciations à valider.
 *
 * - « Ma façon de parler » : la fiche de style (`FicheStyle`) n'est tirée de `style.faconDeParler` que si ce réglage
 *   existe (migration G1a). Valider la fiche écrit une NOUVELLE version ET recopie expressions, mots interdits, tutoiement
 *   et notes dans `style.faconDeParler` : `lireFaconDeParler` et ses appelants restent inchangés.
 * - Tournures : deux niveaux (`bloquant`, `grappe`) ; Will en ajoute, change le niveau, en range une (jamais effacée).
 * - Prononciations : les sigles inconnus vont dans une file « à valider » qui ne bloque jamais (C25).
 */
import "server-only";
import type { DateIso, ExempleStyle, FicheStyle, Id, Prononciation, RegleDatee, TourneInterdite } from "@/domaine/types";
import { appliquerTournures, compterMots, libelleTournure, mesurerTextes, regexDeMotif, siglesInconnus, type ResultatTournures } from "@/domaine/voix";
import { TOURNURES_CALIBREES } from "@/donnees/generateur/tournures-calibrees";
import { nouvelId } from "@/lib/ids";
import { exigerSession } from "./auth";
import { ajouterPrononciation, listerPrononciations, validerEcoute } from "./prononciations";
import type { FaconDeParler } from "./scripts";
import { depots, ecrireParametre, ErreurStudio, horodatage, journaliser, maintenant, sousVerrou } from "./_commun";

/* ------------------------------------------------------------------ */
/* Mes textes (ExempleStyle)                                           */
/* ------------------------------------------------------------------ */

export async function ajouterTexteWill(texte: string, origine: ExempleStyle["origine"] = "post-dicte", options: { estDemo?: boolean } = {}): Promise<ExempleStyle> {
  await exigerSession();
  const t = texte.trim();
  if (!t) throw new ErreurStudio("VIDE", "Dictez ou collez un texte.");
  const e: ExempleStyle = { id: nouvelId("texte"), texte: t, origine, mots: compterMots(t), retenu: true, estDemo: options.estDemo, ...horodatage() };
  await depots().exemplesStyle.enregistrer(e);
  await journaliser("voix", `Texte ajouté (${e.mots} mots)`);
  return e;
}

/** Garder ou écarter un texte (écarté : il ne sert plus d'exemple, il n'est jamais effacé). */
export async function basculerTexteRetenu(id: Id, retenu: boolean): Promise<ExempleStyle> {
  await exigerSession();
  return depots().exemplesStyle.modifier(id, { retenu });
}

export async function listerTextesWill(): Promise<ExempleStyle[]> {
  await exigerSession();
  return (await depots().exemplesStyle.lister((e) => !e.archiveLe)).sort((a, b) => b.creeLe.localeCompare(a.creeLe));
}

/* ------------------------------------------------------------------ */
/* Ma façon de parler (FicheStyle)                                     */
/* ------------------------------------------------------------------ */

export interface VueFiche {
  /** Dernière version (validée ou non). */
  fiche: FicheStyle | null;
  /** `style.faconDeParler` existe-t-il en base ? Sinon la fiche part vide. */
  depuisReglage: boolean;
  /** Mesures proposées depuis les textes retenus (à valider). */
  proposition: ReturnType<typeof mesurerTextes>;
}

async function derniereFiche(): Promise<FicheStyle | null> {
  return (await depots().fichesStyle.lister()).sort((a, b) => b.version - a.version)[0] ?? null;
}

export async function lireFicheStyle(): Promise<VueFiche> {
  await exigerSession();
  const [fiche, reglage, textes] = await Promise.all([derniereFiche(), depots().parametres.obtenir("style.faconDeParler"), depots().exemplesStyle.lister()]);
  return { fiche, depuisReglage: !!reglage, proposition: mesurerTextes(textes) };
}

/**
 * Valide la fiche (un écran, un toucher) : nouvelle version datée, mesures tirées des textes retenus, et recopie dans
 * `style.faconDeParler` pour que `lireFaconDeParler` (et ceux qui l'appellent) lisent la même chose.
 */
export async function validerFicheStyle(changements: Partial<Pick<FicheStyle, "expressions" | "motsBannis" | "notes" | "tutoiementObserve">> = {}): Promise<FicheStyle> {
  await exigerSession();
  const fiche = await sousVerrou(async () => {
    const d = depots();
    const avant = await derniereFiche();
    const mesures = mesurerTextes(await d.exemplesStyle.lister());
    const contexte = (await d.contexteAxion.lister()).sort((a, b) => b.version - a.version)[0];
    const carnet = contexte?.carnetVoix.filter((x) => x.validee).map((x) => x.expression) ?? [];
    const version = (avant?.version ?? 0) + 1;
    const f: FicheStyle = {
      id: `fiche-style-v${version}`,
      version,
      ouvertures: mesures.ouvertures.length ? mesures.ouvertures : (avant?.ouvertures ?? []),
      tournures: avant?.tournures ?? [],
      longueurPhraseMediane: mesures.tireeDe.length ? mesures.longueurPhraseMediane : (avant?.longueurPhraseMediane ?? 0),
      ecartTypeLongueurs: mesures.tireeDe.length ? mesures.ecartTypeLongueurs : (avant?.ecartTypeLongueurs ?? 0),
      expressions: [...new Set([...(changements.expressions ?? avant?.expressions ?? []), ...carnet])],
      motsBannis: changements.motsBannis ?? avant?.motsBannis ?? [],
      tutoiementObserve: changements.tutoiementObserve ?? avant?.tutoiementObserve ?? false,
      notes: changements.notes ?? avant?.notes ?? "",
      tireeDe: mesures.tireeDe,
      valideeParWillLe: maintenant(),
      ...horodatage(),
    };
    await d.fichesStyle.enregistrer(f);
    return f;
  });
  const facon: FaconDeParler = { expressions: fiche.expressions, motsInterdits: fiche.motsBannis, tutoiement: fiche.tutoiementObserve, notes: fiche.notes };
  await ecrireParametre("style.faconDeParler", facon);
  await journaliser("voix", `Façon de parler validée (version ${fiche.version})`);
  return fiche;
}

/* ------------------------------------------------------------------ */
/* Tournures interdites (deux niveaux)                                 */
/* ------------------------------------------------------------------ */

export async function listerTournures(options: { rangees?: boolean } = {}): Promise<(TourneInterdite & { libelle: string })[]> {
  await exigerSession();
  // Vérification E2E n° 1, n° 26 : chaque tournure porte son libellé lisible (accents, apostrophes), pas son motif normalisé.
  const origines = new Map(TOURNURES_CALIBREES.map((t) => [t.id, t.regexOrigine]));
  return (await depots().tournesInterdites.lister((t) => !!t.archiveLe === !!options.rangees))
    .map((t) => ({ ...t, libelle: libelleTournure(t.motif, origines.get(t.id)) }))
    .sort((a, b) => (a.niveau === b.niveau ? a.libelle.localeCompare(b.libelle, "fr") : a.niveau === "bloquant" ? -1 : 1));
}

/** Tournure dictée par Will (`source: "will"`). Id fixe : une tournure rangée n'est jamais recréée en double. */
export async function ajouterTournure(motif: string, niveau: TourneInterdite["niveau"] = "bloquant"): Promise<TourneInterdite> {
  await exigerSession();
  const m = motif.trim();
  if (!m) throw new ErreurStudio("VIDE", "Dictez la tournure à éviter.");
  const id = `tournure-will-${m
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)}`;
  const d = depots();
  const existe = await d.tournesInterdites.obtenir(id);
  if (existe) {
    if (existe.archiveLe) return d.tournesInterdites.modifier(id, { archiveLe: undefined, niveau });
    return existe;
  }
  const t: TourneInterdite = { id, motif: m, regex: regexDeMotif(m), type: "expression", niveau, portee: "partout", raison: "Tournure écartée par Will.", source: "will", ...horodatage() };
  await d.tournesInterdites.enregistrer(t);
  return t;
}

export async function changerNiveauTournure(id: Id, niveau: TourneInterdite["niveau"]): Promise<TourneInterdite> {
  await exigerSession();
  return depots().tournesInterdites.modifier(id, { niveau });
}

/** Range une tournure (elle ne s'applique plus, elle n'est jamais effacée ni recréée par la migration). */
export async function rangerTournure(id: Id, rangee = true): Promise<TourneInterdite> {
  await exigerSession();
  return depots().tournesInterdites.modifier(id, { archiveLe: rangee ? maintenant() : undefined });
}

/** Essai sur un texte : les tournures actives trouvées (pour l'écran « Tournures interdites »). */
export async function essayerTournures(texte: string, options: { post?: boolean } = {}): Promise<ResultatTournures> {
  await exigerSession();
  return appliquerTournures(texte, await depots().tournesInterdites.lister((t) => !t.archiveLe), { seuilGrappe: options.post ? 1 : 2 });
}

/* ------------------------------------------------------------------ */
/* Règles datées                                                       */
/* ------------------------------------------------------------------ */

export interface VueRegle {
  regle: RegleDatee;
  aRevoir: boolean;
}

export async function listerReglesDatees(): Promise<VueRegle[]> {
  await exigerSession();
  const t = maintenant();
  return (await depots().reglesDatees.lister((r) => !r.archiveLe))
    .map((r) => ({ regle: r, aRevoir: !!r.aRevoirLe && r.aRevoirLe <= t }))
    .sort((a, b) => Number(b.aRevoir) - Number(a.aRevoir) || a.regle.reseau.localeCompare(b.regle.reseau) || a.regle.id.localeCompare(b.regle.id));
}

/** Will a relu la source aujourd'hui : `verifieeLe` = maintenant, prochaine revue dans 6 mois. */
export async function marquerRegleRelue(id: Id): Promise<RegleDatee> {
  await exigerSession();
  const le = new Date();
  const revue = new Date(le);
  revue.setUTCMonth(revue.getUTCMonth() + 6);
  return depots().reglesDatees.modifier(id, { verifieeLe: le.toISOString(), aRevoirLe: revue.toISOString() });
}

/* ------------------------------------------------------------------ */
/* Prononciations : file « à valider »                                 */
/* ------------------------------------------------------------------ */

export interface FileAValider {
  /** Entrées du dictionnaire pas encore écoutées par Will. */
  nonEcoutees: Prononciation[];
  /** Sigles des matières, preuves et textes de Will absents du dictionnaire. */
  siglesInconnus: string[];
}

export async function fileAValider(): Promise<FileAValider> {
  await exigerSession();
  const d = depots();
  const [dico, matieres, preuves, textes] = await Promise.all([listerPrononciations(), d.matieres.lister((m) => !m.retrait && !m.archiveLe), d.preuves.lister((p) => !p.retrait && !p.archiveLe), d.exemplesStyle.lister((e) => !e.archiveLe)]);
  return {
    nonEcoutees: dico.filter((p) => !p.ecouteeLe),
    siglesInconnus: siglesInconnus([...matieres.map((m) => m.texte), ...preuves.map((p) => p.enonce), ...textes.map((t) => t.texte)], dico),
  };
}

/** « Se dit comme ça » : le sigle entre au dictionnaire tel quel (la voix ne change rien), validé. */
export async function validerSigleTelQuel(sigle: string): Promise<Id> {
  await exigerSession();
  return ajouterPrononciation(sigle, sigle, { source: "script", ecoutee: true, note: "Validé tel quel (Ma voix)" });
}

/** Valide à l'écoute une entrée existante (délègue au système de prononciation, seul point d'application). */
export async function validerPrononciation(id: Id): Promise<void> {
  await validerEcoute(id);
}

/* ------------------------------------------------------------------ */
/* Résumé de « Ma voix »                                               */
/* ------------------------------------------------------------------ */

export interface ResumeVoix {
  textes: number;
  ficheValideeLe?: DateIso;
  tournures: { bloquant: number; grappe: number };
  regles: number;
  reglesARevoir: number;
  aValider: number;
}

export async function resumeVoix(): Promise<ResumeVoix> {
  await exigerSession();
  const [textes, fiche, tournures, regles, file] = await Promise.all([listerTextesWill(), derniereFiche(), listerTournures(), listerReglesDatees(), fileAValider()]);
  return {
    textes: textes.filter((t) => t.retenu).length,
    ficheValideeLe: fiche?.valideeParWillLe,
    tournures: { bloquant: tournures.filter((t) => t.niveau === "bloquant").length, grappe: tournures.filter((t) => t.niveau === "grappe").length },
    regles: regles.length,
    reglesARevoir: regles.filter((r) => r.aRevoir).length,
    aValider: file.nonEcoutees.length + file.siglesInconnus.length,
  };
}
