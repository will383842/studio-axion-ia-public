/** VL-SV : mode sans voix du moteur « Vidéo longue » — durées de lecture, 0 appel de voix, 0 €. Aucun appel réel. */
import { describe, expect, it, vi } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import { estimerMotsSansVoix, MOTS_PAR_SECONDE_LECTURE, avancerVideoLongue } from "@/moteurs/montage-video-longue/chaine";
import { lireEntreesVideoLongue } from "@/moteurs/montage-video-longue/entrees";
import { definitionVideoLongue } from "@/moteurs/montage-video-longue";
import { MOTS_PAR_SECONDE } from "@/components/formats/video-longue/PlanChapitres";
import { formatVideoLongue } from "@/formats/video-longue";

const chapitres = [
  { id: "c1", titre: "Pourquoi", texte: "un deux trois quatre cinq" },
  { id: "c2", titre: "Comment", texte: "six sept huit" },
];
const cmd = (sansVoix?: unknown) => ({ videoId: "v", ratios: ["16:9"], distribution: [], entrees: { videoLongue: { chapitres, ...(sansVoix === undefined ? {} : { sansVoix }) } } }) as unknown as CommandeFabrication;

describe("VL-SV entrées", () => {
  it("seul `true` exact allume le mode sans voix", () => {
    expect(lireEntreesVideoLongue(cmd(true)).sansVoix).toBe(true);
    for (const v of [undefined, false, "true", 1, null]) expect(lireEntreesVideoLongue(cmd(v)).sansVoix).toBe(false);
  });
  it("le format accepte zéro personnage mais jamais plus d'un", () => {
    expect(formatVideoLongue.personnages.min).toBe(0);
    expect(formatVideoLongue.personnages.max).toBe(1);
    expect(formatVideoLongue.musique).toBe("interdite");
  });
});

describe("VL-SV durée de lecture", () => {
  it("chaque mot reste le temps de le lire, chapitres bout à bout", () => {
    const { mots, dureeSec } = estimerMotsSansVoix(lireEntreesVideoLongue(cmd(true)));
    expect(mots).toHaveLength(8);
    expect(dureeSec).toBeCloseTo(8 / MOTS_PAR_SECONDE_LECTURE, 1);
    for (let i = 1; i < mots.length; i++) expect(mots[i].debutSec).toBeGreaterThanOrEqual(mots[i - 1].finSec - 0.002);
  });
});

describe("VL-SV chaîne", () => {
  it("fabrique sans jamais lire la voix, et le résultat est muet, à 0 €, avec sous-titres", async () => {
    const lire = vi.fn();
    const monter = vi.fn(async () => ({ fichierCle: "k" }));
    const deps = { voix: { lire }, monter };
    const def = definitionVideoLongue(() => deps);
    const c = cmd(true);
    const entrees = lireEntreesVideoLongue(c);
    const ctx = { commande: c, entrees, travailId: "t", versionId: "v", tentative: 1, etapes: def.etapesFabrication };
    let etat = def.etatInitial(entrees, c);
    for (let i = 0; i < 12 && !etat.fini && !etat.echec; i++) etat = await avancerVideoLongue(etat, ctx, deps);
    expect(lire).not.toHaveBeenCalled();
    expect(etat.voix?.morceaux).toBe(0);
    expect(etat.sorties["16:9"]).toBe("k");
    const r = def.resultat(c, etat, entrees);
    expect(r.lignesReelles.every((l) => l.total.centimes === 0)).toBe(true);
    expect(r.lignesReelles.some((l) => /voix/i.test(l.etape) || l.fournisseur === "heygen")).toBe(false);
    expect(r.sorties[0].rapportQualite.verifie).toMatchObject({ son: false, sousTitres: true });
  });
});

describe("VL-SV cadence de lecture", () => {
  it("le moteur et l'écran comptent le même nombre de mots par seconde", () => {
    expect(MOTS_PAR_SECONDE_LECTURE).toBe(MOTS_PAR_SECONDE);
  });
});
