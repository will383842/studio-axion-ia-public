/**
 * SCRIPT FOURNI PAR WILL : vérifier, enregistrer, revenir au script de l'IA. SERVEUR UNIQUEMENT. Les règles sont dans
 * `moteurs/montage-cas-concret/script-fourni.ts` (pur). Ce service ne fabrique rien, ne dépense rien, n'appelle ni Claude ni
 * aucun fournisseur : il n'écrit que les réglages des scripts validés (`casConcret.scriptsValides` et son historique), par une
 * NOUVELLE version, jamais en réécrivant ni en effaçant une version gardée. Un script fourni enregistré est le script validé
 * du cas (pour sa version courante) : la fabrication le rejoue mot pour mot, sans écriture par l'IA.
 */
import "server-only";
import { VERSION_CHARTE_DUO } from "@/briques/habillage/charte-duo";
import { dureesDesFins, ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { apercuDesEcrans, problemesScriptValide, scriptDeFiche, type EcranApercu } from "@/moteurs/montage-cas-concret/script-valide";
import { bornesDesFins, controlerTexteFourni, NOMS_FORMES, TEXTE_FOURNI_MAX, texteFourniDesEcrans, type FormeLigne } from "@/moteurs/montage-cas-concret/script-fourni";
import { creerVerrou, ecrireParametre, ErreurStudio, journaliser, lireParametre } from "./_commun";
import { exigerSession } from "./auth";
import { CLE_SCRIPTS_VALIDES, empreinteScriptValide, garderNouvelleVersion, historiqueScriptsValides, motsInterditsDeWill, scriptValideCourant, scriptValideDuStudio } from "./cas-concret-scripts";
import { trouverCasAutorise } from "./cas-concret-stock-acces";

const verrou = creerVerrou();

/** Un écran de l'aperçu, avec la forme de la ligne de Will qui l'a produit. */
export type EcranApercuFourni = EcranApercu & { forme: FormeLigne; nomForme: string };

export interface ApercuScriptFourni {
  ok: boolean;
  /** Vide si le script est refusé. */
  apercu: EcranApercuFourni[];
  /** Durée estimée de la vidéo entière (secondes) selon la fin la plus courte et la plus longue. */
  dureeSec?: { min: number; max: number };
  /** « Ligne N : … », avec le geste à faire. */
  refus: { ligne?: number; message: string }[];
}

async function cadre(casId: unknown, texte: unknown) {
  await exigerSession();
  if (typeof casId !== "string" || !casId || casId.length > 120) throw new ErreurStudio("CAS_INCONNU", "Ce cas n'existe plus.");
  if (typeof texte !== "string") throw new ErreurStudio("SCRIPT_FOURNI_REFUSE", "Le script doit être un texte.");
  if (texte.length > TEXTE_FOURNI_MAX) throw new ErreurStudio("SCRIPT_FOURNI_REFUSE", `Le script est trop long : ${TEXTE_FOURNI_MAX} caractères au plus (il en compte ${texte.length}).`);
  const cas = await trouverCasAutorise(casId);
  if (!cas) throw new ErreurStudio("CAS_INCONNU", "Ce cas n'existe plus.");
  return cas;
}

/** Vérifie le script (gratuit, n'écrit rien) : l'aperçu écran par écran, ou les refus en « Ligne N : … ». */
export async function controlerScriptFourni(casId: string, texte: string): Promise<ApercuScriptFourni> {
  const cas = await cadre(casId, texte);
  const r = controlerTexteFourni(texte, cas, { motsInterdits: await motsInterditsDeWill() });
  if (!r.ok) return { ok: false, apercu: [], ...(r.dureeMs ? { dureeSec: { min: Math.round(r.dureeMs.min / 1000), max: Math.round(r.dureeMs.max / 1000) } } : {}), refus: r.refus };
  const apercu = apercuDesEcrans(r.ecrans).map((e, i) => ({ ...e, forme: r.lignes[i].forme, nomForme: NOMS_FORMES[r.lignes[i].forme] }));
  return { ok: true, apercu, dureeSec: { min: Math.round(r.dureeMs.min / 1000), max: Math.round(r.dureeMs.max / 1000) }, refus: [] };
}

/**
 * Enregistre le script comme script validé de la version COURANTE du cas (validation implicite). Refusé : rien n'est écrit.
 * Le même texte une deuxième fois ne crée aucune version.
 */
export async function enregistrerScriptFourni(casId: string, texte: string, dependances: { maintenant?: number } = {}): Promise<{ casId: string; numero: number; empreinte: string; modifie: boolean }> {
  const cas = await cadre(casId, texte);
  const r = controlerTexteFourni(texte, cas, { motsInterdits: await motsInterditsDeWill() });
  if (!r.ok) throw new ErreurStudio("SCRIPT_FOURNI_REFUSE", r.refus.map((x) => x.message).join(" "));
  const valideLe = new Date(dependances.maintenant ?? Date.now()).toISOString().slice(0, 10);
  const candidat = scriptDeFiche({ casId: cas.id, ecrans: r.ecrans as never }, { versionCas: cas.version, valideLe, source: "Script fourni par Will (tapé ou collé dans le studio).", fourni: true, texteFourni: texte });
  return verrou(async () => {
    const actuel = await scriptValideCourant(cas);
    const empreinte = empreinteScriptValide(candidat);
    if (actuel?.fourni && empreinteScriptValide(actuel) === empreinte) return { casId: cas.id, numero: actuel.numero ?? 1, empreinte, modifie: false };
    const gardee = await garderNouvelleVersion(cas, candidat);
    await journaliser("cas-concret", `Script fourni enregistré (version ${gardee.numero ?? 1}) : ${cas.titre}`, { type: "cas-concret", id: cas.id });
    return { casId: cas.id, numero: gardee.numero ?? 1, empreinte, modifie: true };
  });
}

/**
 * Revient au script de l'IA. La dernière version SANS « fourni » écrite pour la version courante du cas est recopiée en
 * nouvelle version ; s'il n'y en a pas, un marqueur rend le cas « sans script validé » (l'IA écrira au lancement). Rien n'est
 * effacé : l'historique garde tout, y compris le script de Will.
 */
export async function revenirAuScriptDeLIA(casId: string, dependances: { maintenant?: number } = {}): Promise<{ casId: string; modifie: boolean }> {
  const cas = await cadre(casId, "");
  const valideLe = new Date(dependances.maintenant ?? Date.now()).toISOString().slice(0, 10);
  return verrou(async () => {
    const actuel = await scriptValideCourant(cas);
    if (!actuel?.fourni) return { casId: cas.id, modifie: false };
    const ancien = (await historiqueScriptsValides(cas.id)).filter((s) => !s.fourni && s.versionCas === cas.version).at(-1);
    if (ancien) {
      const { fourni: _f, texteFourni: _t, ...base } = structuredClone(ancien);
      void _f;
      void _t;
      const gardee = await garderNouvelleVersion(cas, { ...base, valideLe, source: `Reprise du script écrit par l'IA (version ${ancien.numero ?? 1}).` });
      await journaliser("cas-concret", `Retour au script de l'IA (version ${gardee.numero ?? 1}) : ${cas.titre}`, { type: "cas-concret", id: cas.id });
    } else {
      const gardes = await lireParametre<Record<string, unknown>>(CLE_SCRIPTS_VALIDES, {});
      // Marqueur illisible par `lireScriptValide` : « aucun script » (l'historique garde tout, rien n'est effacé).
      await ecrireParametre(CLE_SCRIPTS_VALIDES, { ...gardes, [cas.id]: { casId: cas.id, desactiveLe: valideLe, remplace: actuel.numero ?? 1 } });
      await journaliser("cas-concret", `Script de l'IA rétabli (aucun script validé) : ${cas.titre}`, { type: "cas-concret", id: cas.id });
    }
    return { casId: cas.id, modifie: true };
  });
}

export interface DepartMonScript {
  /** Le texte proposé dans la zone de saisie. */
  texte: string;
  /** D'où il vient : le texte de Will, le script validé (de l'IA), ou le gabarit du cas (gratuit). */
  origine: "fourni" | "valide" | "gabarit";
  /** Vrai : le script de Will a été écrit pour une version précédente du cas (à revérifier). */
  perime: boolean;
  /** Vrai : le script validé COURANT est celui de Will (le bouton « Revenir au script écrit par l'IA » a un sens). */
  courantFourni: boolean;
}

/** Le texte de départ de la page « Mon script » : le texte de Will (même périmé), sinon le script validé courant, sinon le gabarit du cas. */
export async function departMonScript(casId: string): Promise<DepartMonScript> {
  const cas = await cadre(casId, "");
  const studio = await scriptValideDuStudio(cas.id);
  if (studio?.fourni && studio.texteFourni) {
    const perime = problemesScriptValide(studio, cas).length > 0;
    return { texte: studio.texteFourni, origine: "fourni", perime, courantFourni: !perime };
  }
  const courant = await scriptValideCourant(cas);
  if (courant) return { texte: texteFourniDesEcrans(courant.ecrans, cas), origine: "valide", perime: false, courantFourni: false };
  const b = bornesDesFins(cas);
  const gabarit = ficheParGabarit(cas, { videoId: "relecture", versionId: "relecture", habillage: VERSION_CHARTE_DUO, origine: "porte-a" }, dureesDesFins([b.courte, b.longue]));
  return { texte: texteFourniDesEcrans(gabarit.ecrans, cas), origine: "gabarit", perime: false, courantFourni: false };
}
