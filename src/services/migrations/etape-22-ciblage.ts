/**
 * MIGRATION — étape 22 (ciblage des scripts, 09/11) : les scripts de l'ancien atelier (ceux sans sujet du générateur)
 * reçoivent un ciblage DÉDUIT de leur `cible` (qui n'est jamais modifiée), un type d'automatisation déduit du sujet et du
 * texte, la marque « ancien » (« avant-ciblage », ou « hors-sujet » pour les scripts avocat hors du domaine d'Axion) et
 * leurs doublons possibles. Les vidéos recopient ciblage et type depuis leur script. Idempotente, AUCUNE suppression ;
 * renvoie null au second passage. Les scripts liés à une vidéo publiée ne sont pas marqués anciens.
 * Jouée UNE SEULE FOIS (repère `migrations.ciblage`) : la migration tourne à chaque démarrage, et un script écrit après
 * elle ne doit jamais devenir « ancien ».
 */
import type { Depots } from "@/domaine/depots";
import { deduireCiblage, deduireTypeAutomatisation } from "@/domaine/ciblage/controles";
import { doublonsPossibles } from "@/domaine/ciblage/doublons";
import type { Script } from "@/domaine/types";
import { lectureDuSens } from "@/donnees/generateur/domaine-axion";

const REFERENCES_HORS_SUJET = new Set(["script-ref-fiche-radar", "script-ref-fiche-controle", "script-ref-fiche-6-points"]);

const texteDe = (s: Script) => s.blocs.flatMap((b) => b.segments.map((x) => x.texte)).join(" ");

const REPERE = "migrations.ciblage";

export async function etape22Ciblage(d: Depots, maintenant: string): Promise<Record<string, unknown> | null> {
  if (await d.parametres.obtenir(REPERE)) return null;
  const publiees = new Set((await d.videos.lister((v) => v.etapeEditoriale === "publiee" && !!v.scriptId)).map((v) => v.scriptId!));
  const anciens: string[] = [];
  const horsSujet: string[] = [];
  let modifies = 0;

  const atelier = await d.scripts.lister((s) => !s.scriptMaitreId);
  const apres = new Map<string, Script>();
  for (const s of atelier) {
    const suite: Script = { ...s };
    if (!suite.ciblage && suite.cible) {
      const c = deduireCiblage(suite.cible);
      if (c) suite.ciblage = c;
    }
    if (!suite.typeAutomatisation) {
      const t = deduireTypeAutomatisation(`${suite.sujet} ${texteDe(suite)}`);
      if (t) suite.typeAutomatisation = t;
    }
    if (!suite.ancien && !publiees.has(s.id)) {
      const hors = REFERENCES_HORS_SUJET.has(s.id) || (s.formatId === "avocat" && !!lectureDuSens(`${s.sujet} ${texteDe(s)}`).etranger);
      suite.ancien = { depuis: maintenant, raison: hors ? "hors-sujet" : "avant-ciblage" };
      (hors ? horsSujet : anciens).push(s.id);
    }
    apres.set(s.id, suite);
  }

  const groupes = doublonsPossibles([...apres.values()]);
  const voisins = new Map<string, string[]>();
  for (const g of groupes) for (const id of g) voisins.set(id, g.filter((x) => x !== id));
  for (const [id, suite] of apres) {
    const v = voisins.get(id);
    if (v) suite.doublonsPossibles = v;
    else if (suite.doublonsPossibles?.length) delete suite.doublonsPossibles;
  }

  for (const s of atelier) {
    const suite = apres.get(s.id)!;
    if (JSON.stringify(suite) === JSON.stringify(s)) continue;
    await d.scripts.enregistrer({ ...suite, modifieLe: maintenant });
    modifies += 1;
  }

  let videos = 0;
  for (const v of await d.videos.lister((x) => !!x.scriptId && (!x.ciblage || !x.typeAutomatisation))) {
    const s = apres.get(v.scriptId!) ?? (await d.scripts.obtenir(v.scriptId!));
    if (!s) continue;
    const patch: Partial<typeof v> = {};
    if (!v.ciblage && s.ciblage) patch.ciblage = s.ciblage;
    if (!v.typeAutomatisation && s.typeAutomatisation) patch.typeAutomatisation = s.typeAutomatisation;
    if (!Object.keys(patch).length) continue;
    await d.videos.enregistrer({ ...v, ...patch, modifieLe: maintenant });
    videos += 1;
  }

  await d.parametres.enregistrer({ id: REPERE, valeur: { appliqueeLe: maintenant }, creeLe: maintenant, modifieLe: maintenant });
  if (!modifies && !videos) return null;
  return { scriptsAnciens: anciens.length, scriptsHorsSujet: horsSujet.length, groupesDoublons: groupes.length, videosCompletees: videos };
}
