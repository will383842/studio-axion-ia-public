/** GV2-13 : les masquages de sous-titres ne retirent que ce qui est vraiment écrit à l'écran. */
import { describe, expect, it } from "vitest";
import { masquerMontantsDits, masquerPendantCartesPleinEcran, masquerTextesAffiches } from "./incrustations";

const mot = (m: string, debutSec: number, finSec: number) => ({ mot: m, debutSec, finSec });
const groupe = (id: string, mots: ReturnType<typeof mot>[]) => ({ id, debutSec: mots[0].debutSec, finSec: mots.at(-1)!.finSec, mots });
const texte = (g: { mots: { mot: string }[] }) => g.mots.map((m) => m.mot).join(" ");

describe("masquerMontantsDits : seuls les mots du montant partent", () => {
  const inc = [{ deSec: 0, aSec: 10, type: "montant" as const, texte: "- 2 500 €" }];

  it("« vous perdez 2 500 € sans le savoir » garde « vous perdez » et « sans le savoir »", () => {
    const g = groupe("g", [mot("vous", 1, 1.3), mot("perdez", 1.3, 1.7), mot("2", 1.7, 1.9), mot("500", 1.9, 2.3), mot("€", 2.3, 2.5), mot("sans", 2.5, 2.8), mot("le", 2.8, 2.9), mot("savoir.", 2.9, 3.3)]);
    const r = masquerMontantsDits([g], inc);
    expect(r).toHaveLength(1);
    expect(texte(r[0])).toBe("vous perdez sans le savoir.");
    expect(r[0].debutSec).toBe(1);
    expect(r[0].finSec).toBe(3.3);
    expect(texte(g)).toContain("2 500 €");
  });

  it("le montant au début du groupe : le début est recalé sur le premier mot gardé", () => {
    const g = groupe("g", [mot("2", 1, 1.2), mot("500", 1.2, 1.5), mot("euros", 1.5, 1.9), mot("par", 1.9, 2.1), mot("mois", 2.1, 2.5)]);
    const r = masquerMontantsDits([g], inc);
    expect(texte(r[0])).toBe("par mois");
    expect(r[0].debutSec).toBe(1.9);
  });

  it("un groupe qui ne contient que le montant reste retiré", () => {
    const g = groupe("g", [mot("2", 1, 1.2), mot("500", 1.2, 1.5), mot("€", 1.5, 1.8)]);
    expect(masquerMontantsDits([g], inc)).toEqual([]);
  });

  it("hors de l'incrustation ou autre nombre : rien ne change", () => {
    const g = groupe("g", [mot("vous", 1, 1.3), mot("perdez", 1.3, 1.7), mot("2", 1.7, 1.9), mot("500", 1.9, 2.3), mot("€", 2.3, 2.5)]);
    expect(masquerMontantsDits([g], [{ ...inc[0], deSec: 5, aSec: 6 }])).toEqual([g]);
    expect(masquerMontantsDits([g], [{ ...inc[0], texte: "- 3 000 €" }])).toEqual([g]);
  });

  it("les mots sans heures : les heures du groupe ne bougent pas", () => {
    const g = { debutSec: 1, finSec: 3, mots: [{ mot: "perdez" }, { mot: "2" }, { mot: "500" }, { mot: "€" }] };
    const r = masquerMontantsDits([g], inc);
    expect(r[0].mots.map((m) => m.mot)).toEqual(["perdez"]);
    expect([r[0].debutSec, r[0].finSec]).toEqual([1, 3]);
  });
});

describe("masquerTextesAffiches : une répétition suit l'ordre de la carte", () => {
  const carte = [{ debutSec: 0, finSec: 10, texte: "Une formation pour vos équipes" }];
  const seg = (debutSec: number, t: string) => ({ debutSec, finSec: debutSec + 1, mots: t.split(" ").map((m) => ({ mot: m })) });

  it("« pour vos équipes dès demain » reste (un seul mot porteur, et « dès demain » n'est pas écrit)", () => {
    const s = [seg(1, "pour vos équipes dès demain")];
    expect(masquerTextesAffiches(s, carte)).toEqual(s);
    expect(masquerTextesAffiches([seg(1, "pour vos équipes")], carte)).toHaveLength(1);
  });

  it("les mêmes mots dans un autre ordre restent", () => {
    const s = [seg(1, "équipes formation une")];
    expect(masquerTextesAffiches(s, carte)).toEqual(s);
  });

  it("un groupe répété mot pour mot (sans casse ni ponctuation) reste masqué", () => {
    expect(masquerTextesAffiches([seg(1, "Une formation pour vos équipes.")], carte)).toEqual([]);
    expect(masquerTextesAffiches([seg(1, "formation pour vos")], carte)).toHaveLength(1);
    expect(masquerTextesAffiches([seg(1, "FORMATION pour vos équipes")], carte)).toEqual([]);
  });
});

describe("masquerPendantCartesPleinEcran : la partie hors carte est gardée", () => {
  const carte = [{ debutSec: 3.55, finSec: 4.6 }];

  it("« Voici comment faire » (2,7-3,6) garde ses mots, rogné au début de la carte ; « dès demain matin. » (4,5-5,4) commence à la fin", () => {
    const a = groupe("a", [mot("Voici", 2.7, 3), mot("comment", 3, 3.3), mot("faire", 3.3, 3.6)]);
    const b = groupe("b", [mot("dès", 4.5, 4.7), mot("demain", 4.7, 5), mot("matin.", 5, 5.4)]);
    const r = masquerPendantCartesPleinEcran([a, b], carte);
    expect(r.map(texte)).toEqual(["Voici comment faire", "dès demain matin."]);
    expect(r[0].finSec).toBeLessThanOrEqual(3.55);
    expect(r[1].debutSec).toBeGreaterThanOrEqual(4.6);
    expect(r[1].finSec).toBe(5.4);
  });

  it("un groupe entièrement sous la carte reste masqué ; hors carte il est intact", () => {
    const dedans = groupe("d", [mot("avec", 3.7, 4), mot("des", 4, 4.2), mot("aides", 4.2, 4.5)]);
    const avant = groupe("v", [mot("Bonjour", 1, 2)]);
    expect(masquerPendantCartesPleinEcran([avant, dedans], carte)).toEqual([avant]);
  });

  it("une partie hors carte de moins de 0,3 s : le groupe est retiré", () => {
    const g = groupe("g", [mot("alors", 3.4, 3.65), mot("voilà", 3.65, 4.2)]);
    expect(masquerPendantCartesPleinEcran([g], carte)).toEqual([]);
  });

  it("sans carte : les groupes sont rendus tels quels", () => {
    const g = groupe("g", [mot("a", 1, 2)]);
    expect(masquerPendantCartesPleinEcran([g], undefined)).toEqual([g]);
  });
});
