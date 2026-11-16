/**
 * C6-H24a · T1 (étape 10 du plan) : constat des raccords entre illustrations, avant de coder H24b / H24c.
 * Test de CONSTAT : il décrit l'existant (`expect` sur la valeur constatée), aucun code de production touché.
 *
 * ── 1. COMPTE : raccords illustration ↔ illustration et carte ↔ carte, par vidéo ───────────────────────────────────
 * Méthode : `morceaux()` (`studio-rendu/src/composition/image-ffmpeg.ts:93`) découpe les plans comme le fait le montage
 * FFmpeg ; un « raccord » est une paire de morceaux voisins (c'est là que `concat`, `image-ffmpeg.ts:367`, coupe franc).
 * Jeux d'essai de l'avocat déjà présents dans les tests (plans recopiés, mêmes durées, 25 i/s) :
 *   - m4b-montage (`tests/m4b-montage.test.ts:81-87` + 197) : 5 plans, 1 illustration (3,96 → 6 s) entre deux doubles ;
 *   - a2-fabrication-avocat (`tests/a2-fabrication-avocat.test.ts:263-266`) : 2 plans doubles ;
 *   - r7-double-heygen (`tests/r7-double-heygen.test.ts:205`) : 6 plans doubles, deux angles, aucune illustration ;
 *   - face caméra (`plansZoomEtCarte`, `studio-rendu/src/controle-ffmpeg.ts:189`) : double / carte plein écran / double.
 * Compte constaté : illustration ↔ illustration = 0, carte ↔ carte = 0 pour CHAQUE vidéo (cf. `COMPTE` ci-dessous).
 * Ce que cela signifie : « proche de zéro » (PLAN-FINAL § 5.6) — sur ces jeux, une illustration est toujours entourée de
 * plans du double (le montage alterne : parole, illustration, parole). T1 ne se verrait presque pas : le gain attendu
 * est celui des seuls raccords double ↔ illustration (qui existent, 2 dans m4b, 2 en face caméra) ; le compte doit être
 * refait sur de vraies vidéos de production avant d'allumer H24c, et H24c ne doit rien changer d'autre à ces vidéos.
 *
 * ── 2. PROPOSITION DE MÉCANISME (commentaire, aucun code ; AM-07) ─────────────────────────────────────────────────
 * Problème : `concat` met les morceaux bout à bout, chacun borné par `trim=start_frame/end_frame` (`image-ffmpeg.ts`,
 * graphe par morceau). Pendant un fondu il faut des images des DEUX côtés en même temps : le morceau A doit être lu
 * `n` images PLUS LOIN que sa fin, et le morceau B `n` images PLUS TÔT que son début (le recouvrement). Les pistes sont
 * continues (décor, double, accessoire), donc ces images existent ; pour une illustration, `fixe()` (boucle d'une image
 * fixe, `size=1`) ou une vidéo de carte (`tpad` clone) donnent aussi autant d'images que demandé.
 *  a) `xfade` (fondu `transition=fade`, ou `wipeleft`) : `[A][B]xfade=transition=fade:duration=d:offset=oA`. Il remplace
 *     le `concat` pour UN raccord : A (rallongé de `n = d × fps` images) et B (idem, avant) partent d'un seul `xfade`, le
 *     reste du `concat` est inchangé. Les deux entrées doivent avoir même taille, même `fps`, même base de temps (déjà
 *     `settb=1/fps,setpts=N`) et MÊME format de pixels : `gbrp` en 8 bits, `gbrp10le` en 10 bits (`ffmpeg.ts:44-46`,
 *     `chaineCouleurs` ; `FORMATS_10_BITS`, `image-ffmpeg.ts:188`) — `xfade` accepte ces formats, mais la recette doit
 *     être mesurée en 10 bits (le filet `arguments-ffmpeg-fige.test.ts` fige les deux variantes). `wipeleft` : même
 *     branchement, `transition=wipeleft`.
 *  b) Flou : réutiliser `gblur` (`studio-rendu/src/operations/composition.ts:156`, `gblur=sigma=…`) et `boxblur`
 *     (`studio-rendu/src/operations/traitement-image.ts:39`, `boxblur=rayon:3`), déjà en production. Idée : flouter la fin
 *     de A et le début de B avec `gblur=sigma=S:enable='between(t,a,b)'` (`t` en secondes, fenêtre = le recouvrement),
 *     puis fondre. Sigma croissant n'est pas possible avec `enable` seul (le sigma est constant) : deux fenêtres, ou un
 *     seul palier ; `boxblur` est moins cher mais plus carré. Risque : `enable` ne change pas l'état d'un `loop`.
 *  c) EFFET SUR LA DURÉE : en `xfade` les deux morceaux se chevauchent, la vidéo raccourcit de `d` par raccord. Pour
 *     garder EXACTEMENT `images` images (« la vidéo a exactement `images` images », `image-ffmpeg.ts`, fin du graphe) il
 *     faut prendre le recouvrement SUR le morceau voisin (A lu plus loin, B lu plus tôt) sans toucher aux bornes des
 *     autres morceaux : somme des morceaux inchangée. Sinon le son glisse.
 *  d) EFFET SUR L'AUDIO : aucun, tant que la durée totale est conservée : le son est une entrée unique, mise en double
 *     mono (`-af pan=…`), hors du graphe d'image. Les lèvres restent synchrones parce que les morceaux du double sont
 *     coupés PAR NUMÉRO d'image (jamais décalés). Un fondu où le double est visible d'un côté le ferait voir moins net
 *     ou doublé ; d'où la règle e).
 *  e) INTERDIT (Q7) : jamais un raccord dont un côté est un plan « double » ou une prise (type `double`, `camera`,
 *     `angle: second`) : fondre le visage superposerait deux bouches. Seuls les raccords illustration ↔ illustration et
 *     carte ↔ carte sont éligibles (les `ecranPartage` / `miseEnPage` restent en coupe franche).
 *  f) Éteint par défaut (seul `true` allume, `lireParametre`, `src/services/_commun.ts:47`) ; éteint = les arguments du
 *     test `arguments-ffmpeg-fige.test.ts`, caractère pour caractère. Le mécanisme se code en H24b (décision, K3) puis
 *     H24c (graphe, K7) ; aucun fichier `recette-xfade.ts` à part (AM-07).
 */
import { describe, expect, it } from "vitest";
import type { PlanScene } from "../../src/briques/composition/scene";
import { morceaux } from "../../studio-rendu/src/composition/image-ffmpeg";
import { plansZoomEtCarte } from "../../studio-rendu/src/controle-ffmpeg";

const FPS = 25;
const CADRAGE = { valeur: "large", zoom: 1, zoomFin: 1, pointX: 0.5, pointY: 0.38 } as const;
const double = (debutSec: number, finSec: number, extra: Partial<PlanScene> = {}): PlanScene => ({ debutSec, finSec, type: "double", angle: "principal", cadrage: CADRAGE, ...extra });
const illustration = (debutSec: number, finSec: number, extra: Partial<PlanScene> = {}): PlanScene => ({ debutSec, finSec, type: "illustration", angle: "principal", cadrage: CADRAGE, illustration: { url: "entree:illu", video: false }, ...extra });
const carte = (debutSec: number, finSec: number): PlanScene => illustration(debutSec, finSec, { sansLook: true, illustration: { url: "entree:carte-pe-1", video: true } });

interface Video { nom: string; plans: PlanScene[]; duree: number }
const VIDEOS: Video[] = [
  { nom: "avocat m4b-montage", duree: 10, plans: [double(0, 2.26), double(2.26, 3.96), illustration(3.96, 6), double(6, 8.5), double(8.5, 10)] },
  { nom: "avocat a2-fabrication", duree: 4, plans: [double(0, 2.26), double(2.26, 4)] },
  { nom: "avocat r7-double-heygen", duree: 30, plans: [double(0, 4), double(4, 6, { angle: "second" }), double(6, 7.5), double(7.5, 9, { angle: "second" }), double(20, 22, { angle: "second" }), double(22, 30)] },
  { nom: "facecam carte plein écran", duree: 1, plans: plansZoomEtCarte(1) },
];

type Genre = "illustration" | "carte" | "double";
const genre = (p: PlanScene): Genre => (p.type !== "illustration" ? "double" : p.sansLook || p.illustration?.url.startsWith("entree:carte") ? "carte" : "illustration");

/** Compte les paires de morceaux voisins (les raccords de `concat`) par couple de genres. */
export function compterRaccords(plans: PlanScene[], duree: number) {
  const m = morceaux(plans, Math.round(duree * FPS), FPS);
  const c = { raccords: Math.max(0, m.length - 1), illuIllu: 0, carteCarte: 0, doubleIllu: 0 };
  for (let i = 1; i < m.length; i++) {
    const a = genre(m[i - 1].plan);
    const b = genre(m[i].plan);
    if (a === "illustration" && b === "illustration") c.illuIllu++;
    else if (a === "carte" && b === "carte") c.carteCarte++;
    else if ((a === "double") !== (b === "double")) c.doubleIllu++;
  }
  return c;
}

describe("C6-H24a · constat : raccords illustration ↔ illustration et carte ↔ carte, par vidéo", () => {
  const COMPTE: Record<string, ReturnType<typeof compterRaccords>> = {
    "avocat m4b-montage": { raccords: 4, illuIllu: 0, carteCarte: 0, doubleIllu: 2 },
    "avocat a2-fabrication": { raccords: 1, illuIllu: 0, carteCarte: 0, doubleIllu: 0 },
    "avocat r7-double-heygen": { raccords: 5, illuIllu: 0, carteCarte: 0, doubleIllu: 0 },
    "facecam carte plein écran": { raccords: 2, illuIllu: 0, carteCarte: 0, doubleIllu: 2 },
  };

  for (const v of VIDEOS) {
    it(`${v.nom} : compte constaté`, () => {
      expect(compterRaccords(v.plans, v.duree)).toEqual(COMPTE[v.nom]);
    });
  }

  it("total : 0 raccord illustration ↔ illustration et 0 carte ↔ carte sur les jeux d'essai (« proche de zéro » : T1 se verra peu)", () => {
    const t = VIDEOS.map((v) => compterRaccords(v.plans, v.duree));
    expect(t.reduce((s, c) => s + c.illuIllu, 0)).toBe(0);
    expect(t.reduce((s, c) => s + c.carteCarte, 0)).toBe(0);
  });

  it("le compteur voit bien un raccord quand il existe (témoin synthétique, hors constat)", () => {
    expect(compterRaccords([double(0, 1), illustration(1, 2), illustration(2, 3), carte(3, 4), carte(4, 5), double(5, 6)], 6)).toEqual({ raccords: 5, illuIllu: 1, carteCarte: 1, doubleIllu: 2 });
  });
});
