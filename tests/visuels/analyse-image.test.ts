import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { decoderPng, plusHauteZoneVide, type ImageRgb } from "../../studio-rendu/scripts/analyse-image";

/** Encode un PNG RVB 8 bits (filtre 0) : sert à fabriquer des images de test. */
function encoderPng({ largeur, hauteur, rgb }: ImageRgb, filtre = 0): Buffer {
  const lignes = Buffer.alloc(hauteur * (largeur * 3 + 1));
  for (let y = 0; y < hauteur; y++) {
    lignes[y * (largeur * 3 + 1)] = filtre;
    for (let x = 0; x < largeur * 3; x++) {
      const v = rgb[y * largeur * 3 + x];
      const gauche = filtre === 1 && x >= 3 ? rgb[y * largeur * 3 + x - 3] : 0;
      lignes[y * (largeur * 3 + 1) + 1 + x] = (v - gauche) & 255;
    }
  }
  const morceau = (type: string, corps: Buffer) => {
    const t = Buffer.alloc(8);
    t.writeUInt32BE(corps.length, 0);
    t.write(type, 4, "latin1");
    return Buffer.concat([t, corps, Buffer.alloc(4)]); // CRC non vérifié par le décodeur
  };
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(largeur, 0);
  entete.writeUInt32BE(hauteur, 4);
  entete[8] = 8;
  entete[9] = 2;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), morceau("IHDR", entete), morceau("IDAT", deflateSync(lignes)), morceau("IEND", Buffer.alloc(0))]);
}

function image(largeur: number, hauteur: number, fond: [number, number, number], rectangles: { x: number; y: number; l: number; h: number; c: [number, number, number] }[] = []): ImageRgb {
  const rgb = new Uint8Array(largeur * hauteur * 3);
  for (let p = 0; p < largeur * hauteur; p++) rgb.set(fond, p * 3);
  for (const r of rectangles) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.l; x++) rgb.set(r.c, (y * largeur + x) * 3);
  return { largeur, hauteur, rgb };
}

const CREME: [number, number, number] = [248, 240, 227];
const PALE: [number, number, number] = [242, 223, 203];
const ENCRE: [number, number, number] = [13, 10, 7];

describe("décodeur PNG minimal", () => {
  it.each([0, 1])("relit exactement les pixels (filtre %i)", (filtre) => {
    const origine = image(40, 30, CREME, [{ x: 5, y: 4, l: 10, h: 6, c: ENCRE }]);
    const relu = decoderPng(encoderPng(origine, filtre));
    expect([relu.largeur, relu.hauteur]).toEqual([40, 30]);
    expect([...relu.rgb]).toEqual([...origine.rgb]);
  });
  it("refuse ce qui n'est pas un PNG", () => {
    expect(() => decoderPng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toThrow(/PNG/);
  });
});

describe("plus haute zone vide", () => {
  it("une page sans rien est vide sur toute sa hauteur", () => {
    expect(plusHauteZoneVide(image(200, 300, CREME), [PALE], 100).hauteurPx).toBe(300);
  });
  it("une bande d'encre pleine largeur coupe la zone en deux", () => {
    const zone = plusHauteZoneVide(image(200, 300, CREME, [{ x: 0, y: 200, l: 200, h: 10, c: ENCRE }]), [PALE], 100);
    expect(zone.hauteurPx).toBe(200);
    expect(zone.y).toBe(0);
  });
  it("un contenu plus étroit que la largeur demandée ne compte pas comme obstacle s'il laisse une fenêtre libre", () => {
    const zone = plusHauteZoneVide(image(200, 300, CREME, [{ x: 0, y: 100, l: 60, h: 10, c: ENCRE }]), [PALE], 100);
    expect(zone.hauteurPx).toBe(300);
  });
  it("le remplissage pâle d'une carte est vide, son contour d'encre ne l'est pas", () => {
    const carte = image(200, 300, CREME, [
      { x: 20, y: 20, l: 160, h: 260, c: ENCRE },
      { x: 24, y: 24, l: 152, h: 252, c: PALE },
    ]);
    const zone = plusHauteZoneVide(carte, [PALE], 100);
    expect(zone.hauteurPx).toBeLessThan(260);
    expect(zone.hauteurPx).toBeGreaterThanOrEqual(240);
  });
  it("un fond sombre s'apprécie sur lui-même : le texte clair compte comme contenu", () => {
    const sombre = image(200, 300, ENCRE, [{ x: 10, y: 140, l: 180, h: 20, c: CREME }]);
    expect(plusHauteZoneVide(sombre, [], 100).hauteurPx).toBe(140);
  });
});
