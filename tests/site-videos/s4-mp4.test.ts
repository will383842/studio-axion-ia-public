/** S4.3 — lecture immédiate d'un MP4 : l'atome « moov » vient-il avant « mdat » ? (lecture des premiers octets seulement) */
import { describe, expect, it } from "vitest";
import { lectureImmediate } from "@/domaine/site-videos/mp4";

const enc = new TextEncoder();

/** Un atome : taille sur 4 octets (ou 1 + taille sur 8 octets), type, corps. */
function atome(type: string, corps = 0, large = false): Uint8Array {
  const entete = large ? 16 : 8;
  const o = new Uint8Array(entete + corps);
  const v = new DataView(o.buffer);
  if (large) {
    v.setUint32(0, 1);
    v.setUint32(8, 0);
    v.setUint32(12, o.length);
  } else v.setUint32(0, o.length);
  o.set(enc.encode(type), 4);
  return o;
}
const coller = (...parties: Uint8Array[]) => {
  const o = new Uint8Array(parties.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parties) {
    o.set(p, i);
    i += p.length;
  }
  return o;
};

describe("S4.3 lectureImmediate", () => {
  it("ftyp + moov + mdat → « oui »", () => {
    expect(lectureImmediate(coller(atome("ftyp", 12), atome("moov", 100), atome("mdat", 5000)))).toBe("oui");
  });

  it("ftyp + free + mdat + moov → « non »", () => {
    expect(lectureImmediate(coller(atome("ftyp", 12), atome("free", 8), atome("mdat", 5000), atome("moov", 100)))).toBe("non");
  });

  it("un atome de taille 1 (64 bits) est lu correctement", () => {
    expect(lectureImmediate(coller(atome("ftyp", 12), atome("free", 40, true), atome("moov", 10), atome("mdat", 50)))).toBe("oui");
    expect(lectureImmediate(coller(atome("ftyp", 12), atome("free", 40, true), atome("mdat", 50), atome("moov", 10)))).toBe("non");
  });

  it("un « mdat » de taille 0 (jusqu'à la fin du fichier) vient bien avant tout « moov » possible → « non »", () => {
    const mdat = atome("mdat", 30);
    new DataView(mdat.buffer).setUint32(0, 0);
    expect(lectureImmediate(coller(atome("ftyp", 12), mdat))).toBe("non");
  });

  it("des octets tronqués, vides ou qui ne ressemblent pas à un MP4 → « inconnu »", () => {
    expect(lectureImmediate(new Uint8Array(0))).toBe("inconnu");
    expect(lectureImmediate(coller(atome("ftyp", 12)).slice(0, 5))).toBe("inconnu");
    // Seul « ftyp », puis plus rien : on ne sait pas.
    expect(lectureImmediate(atome("ftyp", 12))).toBe("inconnu");
    // Un « free » énorme qui dépasse les octets lus : impossible de voir la suite.
    const free = atome("free", 8);
    new DataView(free.buffer).setUint32(0, 5_000_000);
    expect(lectureImmediate(coller(atome("ftyp", 12), free))).toBe("inconnu");
    expect(lectureImmediate(enc.encode("ceci n'est pas une vidéo, c'est du texte"))).toBe("inconnu");
  });

  it("un « moov » dont seule l'en-tête est lue suffit : il est avant le « mdat »", () => {
    const moov = atome("moov", 5000);
    expect(lectureImmediate(coller(atome("ftyp", 12), moov.slice(0, 20)))).toBe("oui");
  });

  it("un atome de taille invalide (< 8, hors 0 et 1) → « inconnu »", () => {
    const mauvais = atome("free", 8);
    new DataView(mauvais.buffer).setUint32(0, 4);
    expect(lectureImmediate(coller(atome("ftyp", 12), mauvais, atome("moov", 10)))).toBe("inconnu");
  });

  it("aucune lecture hors limites : tous les découpages d'un vrai fichier et des octets au hasard rendent un verdict sans lever", () => {
    const valeurs = new Set(["oui", "non", "inconnu"]);
    const fichiers = [coller(atome("ftyp", 12), atome("moov", 100), atome("mdat", 300)), coller(atome("ftyp", 12), atome("free", 40, true), atome("mdat", 300), atome("moov", 100))];
    for (const f of fichiers) for (let n = 0; n <= f.length; n++) expect(valeurs.has(lectureImmediate(f.slice(0, n)))).toBe(true);
    let graine = 12345;
    const alea = () => ((graine = (graine * 1103515245 + 12345) & 0x7fffffff) >>> 8) & 0xff;
    for (let i = 0; i < 3000; i++) {
      const octets = Uint8Array.from({ length: (i % 90) + 1 }, alea);
      expect(valeurs.has(lectureImmediate(octets))).toBe(true);
    }
  });

  it("accepte aussi une vue (sous-tableau) sur un tampon plus grand", () => {
    const f = coller(atome("ftyp", 12), atome("moov", 40), atome("mdat", 10));
    const grand = new Uint8Array(f.length + 20);
    grand.set(f, 10);
    expect(lectureImmediate(grand.subarray(10, 10 + f.length))).toBe("oui");
  });
});
