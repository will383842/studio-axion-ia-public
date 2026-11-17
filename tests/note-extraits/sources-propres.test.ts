import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { EntreesDemo } from "@/moteurs/montage-demo-facecam/entrees";
import type { EtatCaptures } from "@/moteurs/montage-cas-concret/captures";
import { DUREE_CAPTURE_SEC } from "@/moteurs/montage-cas-concret/captures";
import { noter } from "@/briques/note-extraits/noter";
import {
  CHIFFRES_REELS_CAPTURE, appliquerPlafond, momentsCaptures, momentsEcranDemo, usagesPermis,
} from "@/briques/note-extraits/sources-propres";

const plan = () => JSON.parse(readFileSync(join(__dirname, "fixtures/plan-demo.json"), "utf8"));
const src = { cle: "ecran/a.mp4", dureeSec: 20, largeur: 1920, hauteur: 1080 };
const demo = (o: Partial<EntreesDemo>): EntreesDemo =>
  ({ facecam: { cle: "f.mp4", largeur: 1080, hauteur: 1920 }, ecran: src, synchro: { mode: "audio" }, ...o }) as EntreesDemo;
const etat = (ok: boolean): EtatCaptures => ({
  demandes: [{ id: "e1", page: "https://axion-ia.com/", parametres: {} as never, cle: "cap/e1.png" }],
  resultats: { e1: ok ? { ok: true, cle: "cap/e1.png", mime: "image/png", mesures: {} } : { ok: false, raison: "x", reessayable: false } },
  essais: {}, termine: true,
});

describe("X4-09 sources propres", () => {
  it("démo à deux fichiers : moments écran sans visage, clé de l'écran", () => {
    const r = momentsEcranDemo(demo({}), plan(), 0);
    expect(r.moments.length).toBeGreaterThan(0);
    for (const m of r.moments) {
      expect(m.origine).toBe("ecran-demo");
      expect(m.avecVisage).toBe(false);
      expect(m.texteIncruste).toBe(false);
      expect(m.sourceCle).toBe("ecran/a.mp4");
    }
    expect(r.decisionMax).toBe("garde");
  });

  it("synchro fournie : décisions normales", () => {
    expect(momentsEcranDemo(demo({ synchro: { mode: "fourni", decalageSec: 1 } }), plan()).decisionMax).toBe("garde");
  });

  it("synchro fournie de 5 s : temps du plan − 5 s, rien au-delà de la durée de l'écran", () => {
    const sans = momentsEcranDemo(demo({ synchro: { mode: "fourni", decalageSec: 0 } }), plan());
    const avec = momentsEcranDemo(demo({ synchro: { mode: "fourni", decalageSec: 5 } }), plan());
    expect(sans.moments.length).toBeGreaterThan(0);
    expect(avec.moments.length).toBeGreaterThan(0);
    expect(avec.moments[0].debutSec).toBeCloseTo(Math.max(0, sans.moments[0].debutSec - 5), 2);
    for (const m of avec.moments) {
      expect(m.debutSec).toBeGreaterThanOrEqual(0);
      expect(m.finSec).toBeLessThanOrEqual(src.dureeSec);
      expect(m.finSec - m.debutSec).toBeGreaterThanOrEqual(3 - 1e-6);
    }
    expect(avec.decisionMax).toBe("garde");
  });

  it("synchro audio : décalage passé par l'appelant converti ; sans décalage connu : jamais « gardé »", () => {
    const fourni = momentsEcranDemo(demo({ synchro: { mode: "fourni", decalageSec: 5 } }), plan());
    const audio = momentsEcranDemo(demo({ synchro: { mode: "audio" } }), plan(), 5);
    expect(audio.moments).toEqual(fourni.moments);
    expect(audio.decisionMax).toBe("garde");
    const inconnu = momentsEcranDemo(demo({ synchro: { mode: "audio" } }), plan());
    expect(inconnu.decisionMax).toBe("peut-etre");
    for (const m of inconnu.moments) expect(m.finSec).toBeLessThanOrEqual(src.dureeSec);
  });

  it("démo à un fichier : aucun moment écran", () => {
    expect(momentsEcranDemo(demo({ ecran: null }), plan()).moments).toEqual([]);
  });

  it("synchro debut / aucune : jamais « gardé »", () => {
    for (const synchro of [{ mode: "debut" }, { mode: "aucune" }] as const) {
      const r = momentsEcranDemo(demo({ synchro }), plan());
      expect(r.decisionMax).toBe("peut-etre");
      const n = noter(r.moments[0], { sujet: "suivi-commercial" });
      expect(n.decision).toBe("garde"); // la note seule le garderait…
      expect(appliquerPlafond(n, r.decisionMax).decision).toBe("peut-etre"); // …le plafond l'en empêche
      expect(appliquerPlafond({ ...n, decision: "ignore" }, r.decisionMax).decision).toBe("ignore");
    }
  });

  it("sans plan : tranches de 6 s au plus sur la durée de l'écran ; sans durée : rien", () => {
    const r = momentsEcranDemo(demo({}));
    expect(r.moments.length).toBe(4);
    expect(r.moments.every((m) => m.finSec - m.debutSec <= 6)).toBe(true);
    expect(momentsEcranDemo(demo({ ecran: { ...src, dureeSec: undefined } })).moments).toEqual([]);
  });

  it("ids stables, entrée illisible sans erreur", () => {
    expect(momentsEcranDemo(demo({}), plan())).toEqual(momentsEcranDemo(demo({}), plan()));
    expect(momentsEcranDemo(null as never).moments).toEqual([]);
  });

  it("capture déposée = un moment de DUREE_CAPTURE_SEC ; ratée = aucun", () => {
    const ms = momentsCaptures(etat(true));
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ origine: "capture-cas", debutSec: 0, finSec: DUREE_CAPTURE_SEC, avecVisage: false, sourceCle: "cap/e1.png" });
    expect(momentsCaptures(etat(false))).toEqual([]);
    expect(momentsCaptures(null as never)).toEqual([]);
  });

  it("capture : jamais preuve-chiffrée, même avec un chiffre", () => {
    expect(CHIFFRES_REELS_CAPTURE).toBe(false);
    const m = { ...momentsCaptures(etat(true))[0], texte: "12 000 euros par mois" };
    expect(usagesPermis(m, ["ecran", "preuve-chiffree"])).toEqual(["ecran"]);
    expect(usagesPermis({ ...m, origine: "parole" }, ["preuve-chiffree"])).toEqual(["preuve-chiffree"]);
  });

  it("prise v4 : aucun moment, aucune lecture de stockage (garde statique)", () => {
    const code = readFileSync(join(__dirname, "../../src/briques/note-extraits/sources-propres.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/@\/services\//);
    expect(code).not.toMatch(/@\/fournisseurs\//);
    expect(code).not.toMatch(/prise-v4/);
  });
});
