/**
 * RELIRE LE SCRIPT, brique 6 : les CONTRÔLES RÉELS de l'assistant « Votre vidéo », relancés pendant la relecture.
 * GRATUIT : du code seulement (aucun appel à Claude ni à un fournisseur). Mêmes contrôles par code que le générateur
 * (`domaine/controles-script`), limités à ceux qui ont un sens sur un texte collé ou choisi : accroche (C3 bis, C8),
 * tu / vous (C4), tournures interdites et tics (C5, C5 bis), affirmations datées (C37), boucle annoncée (C40), C42.
 * Chaque phrase est lue au barème de son auteur : « will » si Will l'a modifiée, « machine » sinon (`NIVEAUX`).
 * EXCEPTION (18/10) : le texte que Will colle ou importe lui-même (blocs `colle-…`) n'est JAMAIS contrôlé ici : ni point
 * bloquant ni avis de style ; seule « Phrase vide. » reste (limite technique, la voix n'a rien à dire).
 */
import "server-only";
import { analyser, Collecte, type Analyse } from "@/domaine/controles-script/analyse";
import { phraseControle } from "@/domaine/controles-script/phrases";
import { c8 } from "@/domaine/controles-script/structure";
import { c4, controlesDeStyle } from "@/domaine/controles-script/style";
import type { Auteur, EntreeControle, TournureControle, ViolationControle } from "@/domaine/controles-script/types";
import { estBlocColle, type PastilleControle, type ScriptRelu } from "@/domaine/relecture-script";
import type { Adresse, BlocScript } from "@/domaine/types";
import { DRAPEAUX_TOURNURES } from "@/donnees/generateur/tournures-calibrees";
import { parametresGenerateur } from "@/donnees/generateur/parametres-generateur";
import { obtenirFormat } from "@/formats";
import { depots, maintenant } from "./_commun";

/** Les blocs tels que relus : chaque segment prend la phrase et le titre de sa ligne (même vides, pour les contrôler). */
function blocsRelus(blocs: readonly BlocScript[], script: ScriptRelu): BlocScript[] {
  const parId = new Map(script.lignes.map((l) => [l.id, l]));
  return blocs.map((b) => ({
    ...b,
    segments: b.segments.map((s) => {
      const l = parId.get(`${b.id}/${s.id}`);
      if (!l) return s;
      const titre = l.ecrits?.[0]?.texte;
      return { ...s, texte: l.dit, ...(titre !== undefined && s.titreEcran !== undefined ? { titreEcran: titre } : {}) };
    }),
  }));
}

function violations(e: EntreeControle, a: Analyse): ViolationControle[] {
  const col = new Collecte(e);
  c4(e, a, col);
  c8(e, a, col);
  return [...col.violations, ...controlesDeStyle(e, a)];
}

async function tournuresActives(): Promise<TournureControle[]> {
  return (await depots().tournesInterdites.lister((t) => !t.archiveLe)).map((t) => ({ id: t.id, motif: t.motif, regex: t.regex, drapeaux: DRAPEAUX_TOURNURES, niveau: t.niveau, portee: t.portee }));
}

/** Les pastilles de la relecture : phrase vide (bloquante), puis les contrôles par code, au barème de chaque phrase. */
export async function controlerScriptAssistant(p: { formatId: string; blocs: readonly BlocScript[]; script: ScriptRelu; adresse: Adresse }): Promise<PastilleControle[]> {
  const { script } = p;
  const pastilles: PastilleControle[] = script.lignes.filter((l) => !l.dit.trim()).map((l) => ({ ligneId: l.id, niveau: "bloquant", texte: "Phrase vide." }));
  const format = obtenirFormat(p.formatId);
  const parametres = parametresGenerateur(p.formatId);
  // Le texte de Will (blocs collés ou importés) est pris tel quel : seuls les blocs du générateur passent par les contrôles.
  const duGenerateur = blocsRelus(p.blocs, script).filter((b) => !estBlocColle(b.id));
  if (!duGenerateur.length) return pastilles;
  const blocs = duGenerateur.map((b) => ({ ...b, segments: b.segments.filter((s) => s.texte.trim()) }));
  // Indices des segments contrôlés (les phrases vides sont retirées) → identifiant de leur ligne.
  const lignes = blocs.flatMap((b) => b.segments.map((s) => `${b.id}/${s.id}`));
  const base = {
    mode: "avatar" as const,
    adresse: p.adresse,
    debit: parametres.debitParMode?.avatar ?? format.recetteScript.motsParSeconde,
    ouverture: [],
    corps: blocs,
    fin: [],
    recette: parametres.recette,
    preuves: [],
    matieres: [],
    tournures: await tournuresActives(),
    maintenant: maintenant(),
  };
  const vus = new Set<string>();
  for (const auteur of ["machine", "will"] as Auteur[]) {
    const e: EntreeControle = { ...base, auteur };
    for (const v of violations(e, analyser(e))) {
      const ligneId = v.segmentIndex !== undefined ? lignes[v.segmentIndex] : undefined;
      // Une phrase : le barème de son auteur ; le script entier : celui de la machine.
      if ((ligneId ? (script.auteurs[ligneId] ?? "machine") : "machine") !== auteur) continue;
      const texte = phraseControle(v);
      const cle = `${ligneId ?? ""}|${v.controle}|${texte}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      pastilles.push({ niveau: v.niveau, texte, code: v.controle, ...(ligneId ? { ligneId } : {}) });
    }
  }
  return pastilles;
}
