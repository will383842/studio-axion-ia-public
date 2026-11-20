/**
 * CC-SV · mode SANS VOIX du cas concret : même vidéo (écrans, sous-titres, texte à l'écran), silence total, aucune musique,
 * 0 appel à la voix, 0 € de voix. Doubles seulement (aucun appel réel). Le mode avec voix reste le défaut et ne change pas ;
 * la règle L1-05 (seule la voix HeyGen maître parle) reste entière.
 */
import { describe, expect, it } from "vitest";
import { VoixNonEpingleeError, exigerVoixMaitre } from "@/briques/voix-maitre";
import { fournisseurVoixPermis } from "@/formats/cas-concret";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { estimerDepuisCas } from "@/moteurs/montage-cas-concret";
import { lireEntreesCasConcret } from "@/moteurs/montage-cas-concret/etapes";
import { fabriquerCasConcret, MOTS_PAR_SECONDE_LECTURE_CAS_CONCRET, voixSilencieuse } from "@/moteurs/montage-cas-concret/fabriquer";
import { doubles, SONS_VALIDES } from "./doubles";

type Compo = { son: Record<string, unknown>; texte: { sousTitres?: { segments: unknown[] } } };

describe("CC-SV · chaîne sans voix", () => {
  async function sansVoix() {
    const d = doubles({ bruitages: SONS_VALIDES });
    d.options.sansVoix = true;
    const cr = await fabriquerCasConcret(d.options);
    return { d, cr };
  }

  it("0 lecture, 0 assemblage, 0 réservation de voix, 0 €", async () => {
    const { d, cr } = await sansVoix();
    expect(d.lus).toEqual([]);
    expect(d.assemblages).toEqual([]);
    expect(d.reservationsVoix).toEqual([]);
    expect(cr.prises).toEqual([]);
    expect(cr.coutCentimes).toBe(0);
    expect(cr.coutVoixCentimes).toBe(0);
    expect(cr.estimation.caracteres).toBe(0);
    expect(cr.sansVoix).toBe(true);
    expect(cr.voix.idVoix).toBe("sans-voix");
  });

  it("silence total : aucune piste voix, aucun bruitage, aucune musique ; les sous-titres sont là", async () => {
    const { d, cr } = await sansVoix();
    const compos = d.compositionsSoumises();
    expect(compos.length).toBeGreaterThan(0);
    for (const c of compos) {
      expect(Object.keys(c.entrees)).not.toContain("voix");
      expect(JSON.stringify(c.entrees)).not.toMatch(/musique/i);
      expect(((c.parametres as Compo).texte.sousTitres?.segments ?? []).length).toBeGreaterThan(0);
    }
    for (const f of cr.fins) {
      expect(f.bruitages).toBe(0);
      expect(f.dureeSec).toBeGreaterThan(0);
      expect((f.sousTitres ?? []).length).toBeGreaterThan(0);
    }
  });

  it("la vérification passe (volume, crête et fin de voix n'ont pas de sens sans son)", async () => {
    const { cr } = await sansVoix();
    expect(cr.rapport.verdict).toBe("ok");
    expect(cr.rapport.lignes.some((l) => l.famille === "voix")).toBe(false);
  });

  it("avec voix (défaut) : inchangé, la voix est lue et payée", async () => {
    const d = doubles({ bruitages: SONS_VALIDES });
    const cr = await fabriquerCasConcret(d.options);
    expect(d.lus.length).toBeGreaterThan(0);
    expect(cr.sansVoix).toBeUndefined();
    expect(cr.estimation.caracteres).toBeGreaterThan(0);
    for (const c of d.compositionsSoumises()) expect(Object.keys(c.entrees)).toContain("voix");
  });
});

describe("CC-SV · rythme de lecture", () => {
  const texte = "Un dossier arrive. Il est classé tout seul, puis envoyé au bon service.";
  it("les mots suivent le rythme de lecture, sans pause inventée ni son", () => {
    const v = voixSilencieuse(texte, [], [{ id: "f", ecrans: [] }]);
    const mots = v.fins[0].mots;
    expect(mots.map((m) => m.mot)).toEqual(texte.split(" "));
    const dernier = mots.at(-1)!;
    // ≈ 3 mots par seconde, plus les courtes pauses de ponctuation : jamais plus rapide que le rythme de lecture.
    expect(mots.length / dernier.finSec).toBeLessThanOrEqual(MOTS_PAR_SECONDE_LECTURE_CAS_CONCRET * 1.2);
    expect(v.fins[0].cle).toBe("");
    expect(v.payees).toEqual([]);
    expect(v.rapport.coutCentimes).toBe(0);
  });

  it("un texte plus long reste plus longtemps ; la fin est lue après le corps ; une fin vide ne porte que le corps", () => {
    const court = voixSilencieuse("Bonjour.", [], [{ id: "f", ecrans: [] }]).fins[0].dureeSec;
    const long = voixSilencieuse(texte, [], [{ id: "f", ecrans: [] }]).fins[0].dureeSec;
    expect(long).toBeGreaterThan(court);
    const v = voixSilencieuse(texte, [{ id: "a", texte: "Faites votre diagnostic." }], [
      { id: "a", ecrans: [{}] },
      { id: "b", ecrans: [] },
    ]);
    const [avecFin, vide] = v.fins;
    expect(avecFin.mots.length).toBe(vide.mots.length + 3);
    expect(avecFin.mots.at(-1)!.debutSec).toBeGreaterThan(vide.mots.at(-1)!.finSec);
  });
});

describe("CC-SV · entrées, prix et règle L1-05", () => {
  const cas = trouverCas("recrutement-apporteurs")!;
  const reseaux = ["facebook", "instagram"] as never;

  it("le choix est lu dans les entrées ; absent, avec voix", () => {
    expect(lireEntreesCasConcret({ casConcret: { sansVoix: true, reseaux: ["facebook"] } } as never).sansVoix).toBe(true);
    expect(lireEntreesCasConcret({ casConcret: { reseaux: ["facebook"] } } as never).sansVoix).toBeUndefined();
    expect(lireEntreesCasConcret({ casConcret: { sansVoix: "oui" } } as never).sansVoix).toBeUndefined();
  });

  it("sans voix : aucune ligne de coût « voix » ; avec voix : la ligne existe", () => {
    const sans = estimerDepuisCas(cas, reseaux, false, { voix: null });
    const avec = estimerDepuisCas(cas, reseaux, false, { voix: { fournisseur: "heygen" } });
    expect(sans.lignes.some((l) => l.etape === "Voix")).toBe(false);
    expect(avec.lignes.some((l) => l.etape === "Voix")).toBe(true);
    expect(sans.total.centimes).toBeLessThan(avec.total.centimes);
  });

  it("une voix qui n'est pas celle de HeyGen reste refusée", () => {
    expect(fournisseurVoixPermis("elevenlabs")).toBe(false);
    expect(() => exigerVoixMaitre("elevenlabs", "x")).toThrow(VoixNonEpingleeError);
  });
});
