/**
 * GV-N7 : quand le calage au mot est allumé, le message du réalisateur numérote les mots (#k, indice dans la liste NON triée)
 * et demande « motIndex ». Réglage éteint (défaut) : le message est identique au caractère près.
 */
import { describe, expect, it } from "vitest";
import { entreeRealisateurV4, etatInitialV4, type EtatChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { messageRealisateur, type EntreeRealisateur } from "@/moteurs/montage-facecam-animee/realisateur";

// Liste volontairement NON triée par début.
const MOTS = [
  { w: "deux", a: 1.0, f: 1.4 },
  { w: "un", a: 0.2, f: 0.8 },
  { w: "trois", a: 2.0, f: 2.5 },
];
const ENTREE: EntreeRealisateur = { mots: MOTS, dureeSec: 6, titre: "Titre", prise: { src: "prise-montee.mp4", finSec: 6 }, fin: { debut: 6, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: [] } };

describe("GV-N7 : message du réalisateur et calage au mot", () => {
  it("réglage éteint : message strictement identique, sans numérotation ni « motIndex »", () => {
    const avant = messageRealisateur(ENTREE);
    expect(messageRealisateur({ ...ENTREE, calageAuMot: false })).toBe(avant);
    expect(avant).not.toContain("#");
    expect(avant).not.toContain("motIndex");
    expect(avant).toContain("0.20–0.80 un\n1.00–1.40 deux\n2.00–2.50 trois");
  });

  it("réglage allumé : #k pointe vers le bon mot même non trié, et la phrase motIndex est présente", () => {
    const m = messageRealisateur({ ...ENTREE, calageAuMot: true });
    expect(m).toContain("#1 0.20–0.80 un");
    expect(m).toContain("#0 1.00–1.40 deux");
    expect(m).toContain("#2 2.00–2.50 trois");
    expect(m).toContain("motIndex");
    expect(m).toContain("elementsV4");
  });

  it("entreeRealisateurV4 porte calageAuMot seulement s'il est vrai", () => {
    const etat: EtatChaineV4 = { ...etatInitialV4({ videoId: "v", versionId: "x", priseCle: "p", texteValide: "t" } as never), coupes: { mots: MOTS, dureeSec: 6 } as never };
    expect("calageAuMot" in entreeRealisateurV4(etat)).toBe(false);
    expect("calageAuMot" in entreeRealisateurV4(etat, { calageAuMot: false })).toBe(false);
    expect(entreeRealisateurV4(etat, { calageAuMot: true }).calageAuMot).toBe(true);
  });
});
