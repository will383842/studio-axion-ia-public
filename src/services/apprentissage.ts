/**
 * APPRENTISSAGE : le branchement des mesures dans l'écriture (plan « socle qualité » § 5.6 : L1, L2, mémoire de la voix).
 *
 * ÉTEINT PAR DÉFAUT : tant que le réglage `generateur.apprentissage` est faux, chaque fonction rend « rien » sans lire
 * les mesures ni écrire quoi que ce soit. Aucun appel payant : tout est du code sur des données déjà là.
 *
 * Cache : `<gagnants>` fait partie des blocs mis en cache (1 h) chez Claude. Le texte est donc figé UNE FOIS PAR JOUR
 * par format (réglage `apprentissage.gagnants.<format>`), jamais recalculé à chaque appel.
 */
import "server-only";
import { assemblerBlocs } from "@/domaine/derivations-generateur";
import { correctionsDeLignes, formeDe, gagnantsDuFormat, jourDe, PARAM_APPRENTISSAGE, poidsDepuisGroupes, rendreGagnantsMesures, type ProfilGagnant } from "@/domaine/apprentissage";
import { regrouper, tousLesRangs } from "@/domaine/mesures-rangs";
import { anonymiser } from "@/domaine/controles-script";
import type { CorrectionWill } from "@/domaine/types";
import type { EntreeChoix } from "@/generateur/choix-combinaison";
import { nomsDuSocle } from "@/generateur/contexte";
import { nouvelId } from "@/lib/ids";
import { depots, ecrireParametre, lireParametre, maintenant } from "./_commun";
import { collecterVideosMesurees, libelleAxe } from "./mesures-completes";

export async function apprentissageActif(): Promise<boolean> {
  return (await lireParametre<boolean>(PARAM_APPRENTISSAGE, false)) === true;
}

interface GagnantsDuJour {
  jour: string;
  /** Vide : repli sur les extraits de Will (moins de 3 vidéos mesurées dans le format). */
  texte: string;
}

const cleGagnants = (formatId: string) => `apprentissage.gagnants.${formatId}`;

async function profilsGagnants(formatId: string): Promise<ProfilGagnant[]> {
  const d = depots();
  const videos = (await collecterVideosMesurees()).filter((v) => !v.exemple);
  const profils: ProfilGagnant[] = [];
  for (const r of gagnantsDuFormat(tousLesRangs(videos), formatId)) {
    const v = await d.variantes.obtenir(r.video.varianteId);
    const s = v ? await d.scripts.obtenir(v.scriptId) : null;
    if (!v || !s) continue;
    const dits = (blocs: ReturnType<typeof assemblerBlocs>) => blocs.flatMap((b) => b.segments.map((g) => g.texte)).filter((t) => t.trim());
    const tout = assemblerBlocs(s, v);
    const corps = tout.slice(v.ouverture.length, tout.length - v.fin.length);
    profils.push({ code: r.video.code, rang: r.rang, sur: r.sur, structure: r.video.structure, ouverture: r.video.ouverture, ...formeDe({ ouverture: dits(v.ouverture), corps: dits(corps), fin: dits(v.fin) }) });
  }
  return profils;
}

/**
 * Le bloc `<gagnants>` mesuré du format, ou `undefined` (apprentissage éteint, ou moins de 3 vidéos mesurées : le
 * générateur garde les extraits de Will). Recalculé au plus UNE fois par jour : deux appels le même jour rendent le même
 * texte, même si une mesure arrive entre-temps (le cache d'1 h reste valable).
 */
export async function gagnantsDuJour(formatId: string): Promise<string | undefined> {
  if (!(await apprentissageActif())) return undefined;
  const jour = jourDe(maintenant());
  const fige = await lireParametre<GagnantsDuJour | null>(cleGagnants(formatId), null);
  if (fige?.jour === jour) return fige.texte || undefined;
  const texte = rendreGagnantsMesures(await profilsGagnants(formatId), (axe, valeur) => libelleAxe(axe, valeur));
  await ecrireParametre(cleGagnants(formatId), { jour, texte } satisfies GagnantsDuJour);
  return texte || undefined;
}

/** Poids de choix tirés de « ce qui marche » (structure et famille d'accroche, ×1,5 au plus), ou `undefined` si éteint. */
export async function poidsApprentissage(): Promise<EntreeChoix["poidsCorrection"] | undefined> {
  if (!(await apprentissageActif())) return undefined;
  const plats = tousLesRangs((await collecterVideosMesurees()).filter((v) => !v.exemple));
  const structure = poidsDepuisGroupes(regrouper(plats, "structure"));
  const famille = poidsDepuisGroupes(regrouper(plats, "ouverture"));
  return Object.keys(structure).length || Object.keys(famille).length ? { structure, famille } : undefined;
}

/**
 * MÉMOIRE DE LA VOIX DE WILL : à l'enregistrement d'une relecture modifiée, garde chaque phrase changée (avant → après).
 * Ajout seul. Rien n'est envoyé à Claude. Les phrases passent par le même masquage des noms sensibles que le socle. Éteint : n'écrit rien. Rend le nombre de phrases gardées.
 */
export async function memoriserCorrectionsWill(avant: readonly { id: string; dit: string }[], apres: readonly { id: string; dit: string }[], contexte: { formatId: string; code?: string }): Promise<number> {
  if (!(await apprentissageActif())) return 0;
  const paires = correctionsDeLignes(avant, apres);
  if (!paires.length) return 0;
  const d = depots();
  const noms = nomsDuSocle({ matieres: await d.matieres.lister(), preuves: await d.preuves.lister(), nomsSensibles: [] });
  const masquer = (texte: string) => anonymiser(texte, { nomsSensibles: noms }).texte;
  const t = maintenant();
  for (const p of paires) {
    const c: CorrectionWill = { id: nouvelId("cor"), ...p, phraseAvant: masquer(p.phraseAvant), phraseApres: masquer(p.phraseApres), formatId: contexte.formatId, date: t, ...(contexte.code ? { code: contexte.code } : {}), creeLe: t, modifieLe: t };
    await d.correctionsWill.enregistrer(c);
  }
  return paires.length;
}
