/**
 * BR-EXTRAITS-MAISON-a : le réalisateur (vraie `realiser`, `realisateur/index.ts`) ajoute au MESSAGE — jamais à la consigne système —
 * le bloc `axion:` de `blocExtraitsMaison`, seulement si `entree.extraitsMaison === true`. Éteint : message et consigne identiques à ceux
 * d'avant (empreintes sha256 calculées sur master AVANT le changement). L'appel à Claude est un faux gratuit qui capte la requête.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { realiser, type EntreeRealisateur, type RequeteRealisateur } from "@/moteurs/montage-facecam-animee/realisateur";
import { blocExtraitsMaison } from "@/moteurs/montage-facecam-animee/realisateur/consigne-extraits-maison";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const MARQUE = "EXTRAITS DES VIDÉOS DE WILL";
const MARQUE_TEL = "TÉLÉPHONE QUI JOUE UN EXTRAIT";
const MOTS = [
  { w: "bonjour", a: 0.2, f: 0.8 },
  { w: "voici", a: 1.0, f: 1.4 },
  { w: "mon", a: 2.0, f: 2.5 },
  { w: "devis", a: 3.0, f: 3.5 },
];
const BASE: EntreeRealisateur = { mots: MOTS, dureeSec: 6, prise: { src: "prise-montee.mp4", finSec: 6 }, fin: { debut: 6, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: [] } };
const REPLI = { interdites: ["telephone-video"], elementsPrecedents: [], erreurs: ["E1"], essaisMax: 1 };
const occurrences = (t: string, x: string) => t.split(x).length - 1;

async function requete(e: EntreeRealisateur): Promise<RequeteRealisateur> {
  const vus: RequeteRealisateur[] = [];
  await realiser(e, { appeler: async (r) => (vus.push(r), { ok: false as const, message: "faux client" }) });
  expect(vus.length).toBeGreaterThan(0);
  return vus[0];
}

// Empreintes (message, système) calculées sur master AVANT le changement.
const EMPREINTES: Record<string, { message: string; systeme: string }> = {
  "simple": { message: "c562a10715c5fab38bb22f402dceba0c23321215eba6204f8b696f650fece680", systeme: "4a0af6d2fb1a8c7da1fe6a7c88cf0873a3a81021f9f9e9e8017aae8091cc712c" },
  "telephone": { message: "17d9a0107530924acbf53f5ccec4d25a6c8f47a10e0b5eba8ea27b70df24d860", systeme: "4a0af6d2fb1a8c7da1fe6a7c88cf0873a3a81021f9f9e9e8017aae8091cc712c" },
  "repli": { message: "15df1f0d794dab8a2600e362525e77c558304baf5aecb3d15447b8df86108582", systeme: "4a0af6d2fb1a8c7da1fe6a7c88cf0873a3a81021f9f9e9e8017aae8091cc712c" },
  "telephone+repli": { message: "999be854a2d32126743e08b820bc474cd011652646d3e49d8a24f6242bf1f685", systeme: "4a0af6d2fb1a8c7da1fe6a7c88cf0873a3a81021f9f9e9e8017aae8091cc712c" },
};
const CAS: Record<string, EntreeRealisateur> = {
  "simple": BASE,
  "telephone": { ...BASE, telephoneVideo: true },
  "repli": { ...BASE, repli: REPLI },
  "telephone+repli": { ...BASE, telephoneVideo: true, repli: REPLI },
};

describe("BR-EXTRAITS-MAISON-a : realiser → message du réalisateur", () => {
  it("(a) éteint = identique : absent, false, « true », 1, null : message et système = empreintes de master", async () => {
    for (const [nom, entree] of Object.entries(CAS)) {
      for (const valeur of [undefined, false, "true", 1, null] as const) {
        const e = valeur === undefined ? entree : ({ ...entree, extraitsMaison: valeur } as unknown as EntreeRealisateur);
        const r = await requete(e);
        expect(r.message, `${nom} ${String(valeur)}`).not.toContain(MARQUE);
        console.log("H", nom, sha(r.message), sha(r.systeme));
        expect(sha(r.systeme), `${nom} ${String(valeur)}`).toBe(EMPREINTES[nom].systeme);
      }
    }
  });

  it("(b) extraitsMaison: true : le bloc est dans le message UNE fois, après celui du téléphone ; système identique", async () => {
    for (const nom of Object.keys(CAS)) {
      const r = await requete({ ...CAS[nom], extraitsMaison: true });
      expect(occurrences(r.message, MARQUE), nom).toBe(1);
      expect(r.message, nom).toContain(blocExtraitsMaison(true));
      expect(sha(r.systeme), nom).toBe(EMPREINTES[nom].systeme);
      expect(r.systeme).not.toContain(MARQUE);
      if (CAS[nom].telephoneVideo) expect(r.message.indexOf(MARQUE_TEL)).toBeLessThan(r.message.indexOf(MARQUE));
    }
    // Le repli garde ses plaquettes interdites après ce bloc.
    const r = await requete({ ...BASE, repli: REPLI, extraitsMaison: true });
    expect(r.message.indexOf(MARQUE)).toBeLessThan(r.message.indexOf("Plaquettes INTERDITES dans ce plan (aucune vidéo fidèle n'a été trouvée) : telephone-video."));
    });

  it("(c) audit argent : caractères et jetons ajoutés au message quand allumé ; éteint : 0", async () => {
    for (const nom of Object.keys(CAS)) {
      const eteint = (await requete(CAS[nom])).message;
      const allume = (await requete({ ...CAS[nom], extraitsMaison: true })).message;
      const ajoutes = allume.length - eteint.length;
      expect(ajoutes, nom).toBe(blocExtraitsMaison(true).length + 2);
      expect(Math.ceil(ajoutes / 4)).toBeGreaterThan(0);
      if (nom === "simple") console.log(`AUDIT ARGENT : +${ajoutes} caractères, ≈ ${Math.ceil(ajoutes / 4)} jetons par message allumé (éteint : 0)`);
    }
  });
});
