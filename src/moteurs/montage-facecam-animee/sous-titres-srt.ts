/**
 * SOUS-TITRES (.srt) DE LA FACE CAMÉRA ANIMÉE v4 — PUR, sans dépendance de service.
 *
 * La composition de rendu dessine les mots du plan par groupes de 1 à 2 mots (`groupesDuPlan` puis `grouperMots`,
 * `studio-rendu/compositions/interface-claire/VideoAnimeeV4.tsx` et `motion-v4/communs/briques-v4.tsx`). Le studio ne peut pas importer la composition
 * à l'exécution : ce fichier en est une COPIE, gardée identique par `tests/facecam-animee/srt-identique.test.ts` (mêmes groupes, mêmes instants à 1 ms).
 * Seul le texte écrit diffère : on garde le mot d'origine (casse et ponctuation de la transcription), la vidéo l'affiche en capitales sans ponctuation.
 */
import type { MotHorodate, SegmentSousTitres } from "@/domaine/types";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { indicesMotsInterditsEcran, ponctuationFinale } from "./realisateur/mots";

type MotPlan = PlanFacecamAnimee["groupes"][number]["mots"][number];
interface MotSrt { origine: string; mot: string; debut: number; fin: number; fort: boolean }

/** Mots de liaison : jamais seuls dans un groupe (copie de `LIAISON` de briques-v4.tsx, test d'égalité : srt-identique.test.ts). */
const LIAISON = new Set(["DE", "DU", "DES", "LA", "LE", "LES", "UN", "UNE", "ET", "À", "EN", "AU", "AUX", "QUE", "QUI", "SUR", "POUR", "PAR", "MON", "MA", "MES", "SES", "VOS", "VOTRE", "CE", "CA", "ÇA", "JE", "IL", "ON", "OU", "SE", "NE", "N'", "L'", "D'", "J'", "C'"]);

/** Recolle les élisions coupées (« l » + « 'IA » → « l'IA »), comme la composition : le mot fort se transmet au mot recollé. */
function recoller(mots: readonly MotPlan[]): MotPlan[] {
  const sortie: MotPlan[] = [];
  for (const m of mots) {
    if (!/^['’]/.test(m.w)) { sortie.push({ ...m }); continue; }
    const prec = sortie[sortie.length - 1];
    if (prec && ponctuationFinale(prec.w) === null) sortie[sortie.length - 1] = { ...prec, w: prec.w + m.w, ...(m.fort || prec.fort ? { fort: true } : {}) };
    else sortie.push({ ...m, w: m.w.replace(/^['’]+/, "") });
  }
  return sortie;
}

/** Les groupes du plan → segments de sous-titres : 1 à 2 mots (3 si le 3ᵉ fait ≤ 3 lettres), mêmes débuts et mêmes fins que la vidéo. */
export function segmentsSrtV4(groupes: PlanFacecamAnimee["groupes"], duree: number): SegmentSousTitres[] {
  const plats = recoller(groupes.flatMap((g) => g.mots));
  const interdits = indicesMotsInterditsEcran(plats);
  const mots: MotSrt[] = plats
    .map((m, k) => {
      const suivant = plats[k + 1]?.a ?? duree;
      const brut = m.w.replace(/[.,;:!?…«»"“”()]/g, "").trim();
      return { origine: m.w.trim(), mot: brut.toUpperCase(), debut: m.a, fin: Math.min(suivant, m.a + 0.7), fort: !!m.fort };
    })
    .filter((m, k) => m.mot.length > 0 && !interdits.has(k));
  const lots: MotSrt[][] = [];
  let i = 0;
  while (i < mots.length) {
    const g = [mots[i]];
    i++;
    if (i < mots.length && LIAISON.has(g[0].mot.replace(/[.,!?]/g, "")) && !g[0].mot.endsWith(".")) {
      g.push(mots[i]);
      i++;
      if (i < mots.length && mots[i].mot.replace(/[^A-ZÀ-Ü0-9]/g, "").length <= 3 && !g[1].mot.endsWith(".") && !g[0].mot.endsWith(".")) {
        g.push(mots[i]);
        i++;
      }
    }
    lots.push(g);
  }
  return lots.map((g, k) => ({
    id: `st-v4-${k}`,
    debutSec: g[0].debut,
    finSec: k + 1 < lots.length ? lots[k + 1][0].debut : Math.min(duree, g[g.length - 1].fin + 0.2),
    mots: g.map<MotHorodate>((m) => ({ mot: m.origine, debutSec: m.debut, finSec: m.fin, ...(m.fort ? { enValeur: true } : {}) })),
  }));
}
