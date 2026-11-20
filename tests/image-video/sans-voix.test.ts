/**
 * IV-SV · Image → vidéo, MODE SANS VOIX. Tout est SIMULÉ (`doubles-fabrication.ts`) : aucun appel payant.
 * Sans voix : 0 appel HeyGen, aucune ligne de coût « voix » ni « écoute », silence total (aucun bruitage, aucune musique),
 * sous-titres présents, rythme au temps de lecture. Avec voix : inchangé. Voix non HeyGen : toujours refusée.
 */
import { describe, expect, it, vi } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import { DEBIT_MOTS_PAR_SEC } from "@/domaine/image-video/complexite";
import { exigerVoixMaitre } from "@/briques/voix-maitre/voix-epinglee";
import { estimerImageVideo, lireEntreesImageVideo, demandeDeLaCommande, plafondProposeIV } from "@/moteurs/montage-image-video";
import { attendWillIV, avancerJusquAArretIV, etatInitialIV, validerCarteIV, validerScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { empreinteSon } from "@/moteurs/montage-image-video/assemblage";
import { wavSilenceIV } from "@/moteurs/montage-image-video/sans-voix";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });

const commande = (imageVideo: Record<string, unknown>) => ({ videoId: "v1", entrees: { imageVideo: { reseaux: ["linkedin", "instagram"], ...imageVideo } }, tauxUsdEur: 1, dureeCibleSec: 50 }) as unknown as CommandeFabrication;

async function jusquAuBout(e0: EtatFabricationIV, o: OutilsFabricationIV): Promise<EtatFabricationIV> {
  const outils: OutilsFabricationIV = { ...o, secoursAutomatique: false };
  let e = await avancerJusquAArretIV(e0, outils);
  for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
    if (e.attente) e = await avancerJusquAArretIV(e, outils);
    else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), outils);
    else if (attendWillIV(e) === "script") {
      const p = e.propositionScript!;
      e = await avancerJusquAArretIV(validerScriptIV(e, { proposition: p.empreinte, choixFormules: Object.fromEntries(p.formules.map((f) => [f.cle, "garder" as const])) }), outils);
    } else break;
  }
  return e;
}

describe("IV-SV · pièces pures", () => {
  it("le WAV de silence est un RIFF PCM mono valide, de la bonne durée, rempli de zéros", () => {
    const o = wavSilenceIV(2);
    expect(String.fromCharCode(...o.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...o.slice(8, 12))).toBe("WAVE");
    const v = new DataView(o.buffer);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(40, true)).toBe(8000 * 2 * 2);
    expect(o.length).toBe(44 + 32000);
    expect(o.slice(44).every((x) => x === 0)).toBe(true);
  });

  it("sans voix : ni ligne « Voix » ni ligne « Écoute », prix plus bas ; avec voix : inchangé", () => {
    const avec = estimerImageVideo(commande({}));
    const sans = estimerImageVideo(commande({ sansVoix: true }));
    expect(avec.lignes.map((l) => l.etape)).toContain("Voix");
    expect(sans.lignes.map((l) => l.etape)).not.toContain("Voix");
    expect(sans.lignes.map((l) => l.etape)).not.toContain("Écoute");
    expect(sans.lignes.some((l) => l.fournisseur === "heygen" || l.fournisseur === "transcription")).toBe(false);
    expect(sans.total.centimes).toBeLessThan(avec.total.centimes);
  });

  it("le choix traverse la commande jusqu'à la demande de la machine ; absent : aucune clé", () => {
    expect(lireEntreesImageVideo(commande({ sansVoix: true }).entrees).sansVoix).toBe(true);
    expect(lireEntreesImageVideo(commande({ sansVoix: "oui" }).entrees).sansVoix).toBeUndefined();
    expect(demandeDeLaCommande(commande({ sansVoix: true }), "ver1").sansVoix).toBe(true);
    expect("sansVoix" in demandeDeLaCommande(commande({}), "ver1")).toBe(false);
  });

  it("le plafond proposé ne compte ni voix ni écoute en mode sans voix", () => {
    const base = { caisse: { plafondCentimes: 100, reservations: [] }, etape: "lecture" as const };
    const avec = plafondProposeIV({ ...base, demande: { reseaux: ["linkedin"], tauxUsdEur: 1 } } as never);
    const sans = plafondProposeIV({ ...base, demande: { reseaux: ["linkedin"], tauxUsdEur: 1, sansVoix: true } } as never);
    expect(sans).toBeLessThanOrEqual(avec);
  });

  it("une voix non HeyGen reste refusée (L1-05 entière)", () => {
    expect(() => exigerVoixMaitre("autre-fournisseur", "une-voix")).toThrow();
  });
});

describe("IV-SV · fabrication simulée sans voix", () => {
  it("prête, 0 appel HeyGen, 0 écoute, silence total, sous-titres au temps de lecture", async () => {
    const carte = carteFixe("A");
    const m = monde();
    const o = outilsSimules(carte, m);
    const e = await jusquAuBout(etatInitialIV(demandeEssai(carte, { sansVoix: true })), o);
    expect(e.refus).toBeUndefined();
    expect(e.etape).toBe("prete");
    // Aucune voix lue ni écoutée, aucune réservation de voix ou d'écoute.
    expect(m.lus.length).toBe(0);
    expect(m.ordre).not.toContain("heygen");
    expect(m.ordre).not.toContain("transcription");
    expect(e.caisse.reservations.some((r) => r.etape === "voix" || r.etape === "ecoute" || r.fournisseur === "heygen")).toBe(false);
    expect(e.voix).toBeUndefined();
    // Pistes de silence : mots au débit de lecture, aucun bruitage dans le mixage.
    expect(e.pistes?.length).toBeGreaterThan(0);
    for (const p of e.pistes ?? []) {
      expect(p.mots.length).toBeGreaterThan(0);
      const pas = p.mots[1].debutSec - p.mots[0].debutSec;
      expect(pas).toBeCloseTo(1 / DEBIT_MOTS_PAR_SEC, 2);
    }
    for (const r of Object.values(e.rendus ?? {})) expect(r.demande).toBeTruthy();
    expect(e.courtes).toEqual([]);
    // Contrôles : la vidéo est livrée, les lignes de la voix sont sans objet.
    expect(e.controles?.verdict?.ok).toBe(true);
    expect(e.livraison?.some((l) => l.version !== "aucune" && l.fichierCle)).toBe(true);
    expect(e.journal.join(" ")).toMatch(/sans voix/i);
  });

  it("piste de silence LISIBLE (comme en production) : aucune transcription ni écoute payante, aucun appel réseau (garde de porte.ts)", async () => {
    const reseau = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      throw new Error("appel réseau interdit dans ce test");
    });
    try {
      const carte = carteFixe("A");
      const m = monde();
      const o: OutilsFabricationIV = {
        ...outilsSimules(carte, m),
        // Comme `src/services/image-video.ts` : un vrai WAV de silence est rangé dans le stockage, la lecture du son réussit.
        pisteMuette: async (d) => {
          const octets = wavSilenceIV(d.dureeSec);
          const cle = `voix-seule/sans-voix-${d.version}-${Math.round(d.dureeSec * 1000)}.wav`;
          m.sons.set(cle, octets);
          return { cle, empreinte: empreinteSon(octets) };
        },
      };
      const e = await jusquAuBout(etatInitialIV(demandeEssai(carte, { sansVoix: true })), o);
      expect(e.refus).toBeUndefined();
      expect(e.etape).toBe("prete");
      // La piste existe bel et bien : sans la garde de la porte, l'écoute la lirait et paierait une transcription.
      expect([...m.sons.keys()].some((c) => c.startsWith("voix-seule/sans-voix-"))).toBe(true);
      expect(m.transcriptions.length).toBe(0);
      expect(m.ordre).not.toContain("transcription");
      expect(m.ordre).not.toContain("heygen");
      expect(e.caisse.reservations.some((r) => r.etape === "ecoute" || r.etape === "voix" || r.fournisseur === "transcription" || r.fournisseur === "heygen")).toBe(false);
      expect(reseau).not.toHaveBeenCalled();
    } finally {
      reseau.mockRestore();
    }
  });

  it("avec voix : la voix est lue et payée comme avant", async () => {
    const carte = carteFixe("A");
    const m = monde();
    const e = await jusquAuBout(etatInitialIV(demandeEssai(carte)), outilsSimules(carte, m));
    expect(e.etape).toBe("prete");
    expect(m.lus.length).toBeGreaterThan(0);
    expect(e.voix).toBeDefined();
  });
});

describe("IV-SV · prix de « Valider et fabriquer » (prixSuiteIV)", () => {
  it("sans voix : ni voix ni transcription dans l'accord du script ; avec voix : inchangé", async () => {
    const prixDuScript = async (sansVoix: boolean) => {
      const carte = carteFixe("A");
      const o: OutilsFabricationIV = { ...outilsSimules(carte, monde()), secoursAutomatique: false };
      let e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, sansVoix ? { sansVoix: true } : {})), o);
      for (let i = 0; i < 5 && attendWillIV(e) !== "script"; i++) {
        e = attendWillIV(e) === "carte" ? await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), o) : e;
      }
      expect(attendWillIV(e)).toBe("script");
      return e.propositionScript!.prix;
    };
    const avec = await prixDuScript(false);
    const sans = await prixDuScript(true);
    expect(avec.habituelCentimes).toBeGreaterThan(0);
    expect(sans.habituelCentimes).toBeLessThan(avec.habituelCentimes);
    expect(sans.auPlusCentimes).toBeLessThan(avec.auPlusCentimes);
  });
});
