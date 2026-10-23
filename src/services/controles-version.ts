/**
 * CONTRÔLES D'UNE VERSION PAR RÉSEAU, côté serveur (relecture du script, grande chaîne). Une seule entrée des contrôles
 * pour une version stockée ou relue : après une retouche (`retoucherVariante`, `reporterCorps`), pendant la relecture
 * (contrôle en direct, gratuit) et après la fabrication (horodatage réel). Le barème suit l'auteur de chaque phrase
 * (`controlerSelonAuteurs`). Aucun appel payant.
 */
import "server-only";
import type { EntreeControle, ResultatVersion } from "@/domaine/controles-script";
import { controlerSelonAuteurs } from "@/domaine/relecture-generateur";
import type { Adresse, BlocScript, ModeDiction, ScriptMaitre, VarianteReseau } from "@/domaine/types";
import { assemblerBlocs } from "@/domaine/derivations-generateur";
import { parametresGenerateur } from "@/donnees/generateur/parametres-generateur";
import { DRAPEAUX_TOURNURES } from "@/donnees/generateur/tournures-calibrees";
import { formatGenerateur } from "@/formats";
import { depots, maintenant } from "./_commun";

/** Entrée des contrôles d'une version sur des blocs donnés (ouverture, corps de SON réseau, fin). */
export async function entreeControleDeBlocs(
  v: VarianteReseau,
  m: ScriptMaitre,
  blocs: { ouverture: BlocScript[]; corps: BlocScript[]; fin: BlocScript[] },
  options: { mode?: ModeDiction; adresse?: Adresse } = {},
): Promise<EntreeControle> {
  const p = parametresGenerateur(v.formatId);
  const mode = options.mode ?? "avatar";
  const debit = p.debitParMode?.[mode] ?? formatGenerateur(v.formatId).recette.debitParMode[mode];
  return {
    auteur: "machine",
    mode,
    adresse: options.adresse ?? "vous",
    debit,
    ouverture: blocs.ouverture,
    corps: blocs.corps,
    fin: blocs.fin,
    recette: p.recette,
    reseau: p.reseau(v.reseau),
    structure: p.recette.structures.find((s) => s.id === m.choix?.structure),
    objectif: m.brief.objectif,
    appel: v.appel,
    boucle: v.boucle,
    motCle: m.motCle,
    motCleSource: m.motCleSource ?? "hypothese",
    encadre: v.encadre,
    publication: v.publication,
    maitre: { exception: m.exception, appuiPrincipal: m.appuiPrincipal, ancrages: m.ancrages, envoi: m.envoi, pointDeVue: m.pointDeVue, emotion: m.emotion, angle: m.angle, brief: m.brief },
    preuves: await depots().preuves.lister(),
    matieres: await depots().matieres.lister(),
    // Mêmes tournures que la chaîne (`tournuresActives`).
    tournures: (await depots().tournesInterdites.lister((t) => !t.archiveLe)).map((t) => ({ id: t.id, motif: t.motif, regex: t.regex, drapeaux: DRAPEAUX_TOURNURES, niveau: t.niveau, portee: t.portee })),
    maintenant: maintenant(),
  };
}

/** Contrôles d'une version STOCKÉE (texte assemblé avec son corps), au barème de chaque phrase. */
export async function controlerVersionStockee(v: VarianteReseau): Promise<ResultatVersion | null> {
  const d = depots();
  const [m, script] = await Promise.all([d.scriptsMaitres.obtenir(v.scriptMaitreId), d.scripts.obtenir(v.scriptId)]);
  if (!m || !script) return null;
  const tout = assemblerBlocs(script, v);
  const corps = tout.slice(v.ouverture.length, tout.length - v.fin.length);
  const entree = await entreeControleDeBlocs(v, m, { ouverture: v.ouverture, corps, fin: v.fin }, { mode: script.mode, adresse: script.adresse });
  return controlerSelonAuteurs(entree);
}
