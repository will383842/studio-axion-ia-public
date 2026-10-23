/**
 * CORRECTEUR RÉEL 2 · E (04/10) : « la fin coupe comme si la vidéo n'était pas terminée » (v-c10c010142eb : dernier mot
 * à 25,59 s, vidéo de 26,04 s, 0,45 s après). Désormais, par défaut :
 *  - une vraie respiration de fin ≈ 1,2 s après le dernier mot (si le son la contient) ;
 *  - le son maître envoyé à l'avatar reçoit un silence de fin (≈ 1,3 s au total après le dernier mot) : bouche fermée ;
 *  - l'image et le son s'éteignent en fondu (au noir) sur la fin, sans écran de fin ni visage figé ;
 *  - la fin « en boucle » (0,4-0,6 s, sans fondu) reste une option.
 */
import { describe, expect, it } from "vitest";
import { horodaterTexte } from "@/domaine/derivations";
import { formatAvocat, RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import { STYLE_MONTAGE_AVOCAT } from "@/donnees/elements-avocat";
import { decouperEnPlans, type EntreeDecoupage, type SegmentDecoupage } from "@/moteurs/montage-avocat/decoupage";
import { calculerCoupures } from "@/moteurs/montage-avocat/nettoyage";
import { preparerTexteVoix, reporterHorodatages } from "@/moteurs/montage-avocat/report";
import { fonduDeFin } from "@/briques/composition/parametres";
import { filtresFonduFin } from "../studio-rendu/src/composition/image-ffmpeg";
import { ajouterSilenceFin } from "../studio-rendu/src/operations/nettoyage-audio";

const S = (id: string, bloc: string, texte: string): SegmentDecoupage => ({ id, bloc, texte });
const SCRIPT = [S("a1", "accroche", "Vous perdez des heures dans Excel ?"), S("c1", "coeur", "Un outil remplit vos fichiers tout seul, chaque matin, sans erreur."), S("b1", "boucle", "Et vous gardez vos heures pour vos clients, pas pour Excel.")];

function entree(o: Partial<EntreeDecoupage> = {}): EntreeDecoupage {
  const t = preparerTexteVoix(SCRIPT, []);
  return { mots: reporterHorodatages(t, horodaterTexte(t.texte, 3.4)), segments: SCRIPT, plansIndicatifs: [], recette: RECETTE_MONTAGE_AVOCAT, style: STYLE_MONTAGE_AVOCAT, repartition: { principal: 1, second: 0 }, deuxAngles: false, ouvertureSurIllustration: false, illustrations: false, personnageId: "p", ...o };
}
const ecartFin = (e: EntreeDecoupage) => decouperEnPlans(e).at(-1)!.finSec - e.mots.at(-1)!.finSec;

describe("RÉEL 2 · E — une vraie fin", () => {
  it("par défaut : la vidéo finit ≈ 1,2 s après le dernier mot quand le son le permet", () => {
    const e = entree();
    const dernier = e.mots.at(-1)!.finSec;
    const ecart = ecartFin({ ...e, dureeAudioSec: dernier + 1.3 });
    expect(ecart).toBeGreaterThanOrEqual(1.1 - 1e-6);
    expect(ecart).toBeLessThanOrEqual(1.3 + 1e-6);
  });

  it("son trop court (vidéo déjà rendue) : la fin ne dépasse jamais le son, au moins 0,4 s", () => {
    const e = entree();
    const dernier = e.mots.at(-1)!.finSec;
    expect(ecartFin({ ...e, dureeAudioSec: dernier + 0.45 })).toBeCloseTo(0.45, 2);
  });

  it("option « Fin en boucle » : 0,4 à 0,6 s, comme avant", () => {
    expect((formatAvocat.reglages.schema.parse({}) as { finEnBoucle?: boolean }).finEnBoucle).toBe(false);
    const e = entree({ finEnBoucle: true });
    const ecart = ecartFin({ ...e, dureeAudioSec: e.mots.at(-1)!.finSec + 1.3 });
    expect(ecart).toBeGreaterThanOrEqual(0.4 - 1e-6);
    expect(ecart).toBeLessThanOrEqual(0.6 + 1e-6);
  });

  it("le son maître reçoit un silence de fin : ≈ 1,3 s après le dernier mot au total (l'avatar finit bouche fermée)", () => {
    const mots = [{ mot: "Bonjour", debutSec: 0.1, finSec: 0.6 }, { mot: "Excel.", debutSec: 0.7, finSec: 1.2 }];
    const p = calculerCoupures({ mots, dureeSec: 1.5 });
    expect(p.dureeSortieSec - p.mots.at(-1)!.finSec + p.silenceFinSec).toBeCloseTo(1.3, 2);
    const x = ajouterSilenceFin(new Float32Array(48000).fill(0.5), 0.8);
    expect(x.length).toBe(48000 + 38400);
    expect(x[x.length - 1]).toBe(0);
    expect(ajouterSilenceFin(new Float32Array(10), 99).length).toBe(10 + 48000 * 3);
  });

  it("fondu de fin (image au noir et son) : au plus 1 s, jamais avant le dernier mot ; aucun en boucle", () => {
    expect(fonduDeFin({ dureeSec: 26.04, dernierMotSec: 25.59, finEnBoucle: false, maxSec: 1 })).toBeCloseTo(0.45, 3);
    expect(fonduDeFin({ dureeSec: 30, dernierMotSec: 28.8, finEnBoucle: false, maxSec: 1 })).toBe(1);
    expect(fonduDeFin({ dureeSec: 30, dernierMotSec: 28.8, finEnBoucle: true, maxSec: 1 })).toBeUndefined();
    const f = filtresFonduFin(30, 1);
    expect(f.video).toBe("fade=t=out:st=29.000:d=1.000:color=black");
    expect(f.audio).toBe("afade=t=out:st=29.000:d=1.000");
  });
});
