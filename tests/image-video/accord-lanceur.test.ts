/**
 * Relecture des commits « rendu réel » (argent) · une fabrication menée par le LANCEUR n'avance au-delà du script
 * (voix payée) qu'avec l'accord du prix donné par Will dans le studio, écrit AVEC la décision ; la réservation de la
 * voix lit CE montant. « Refaire cette partie » sur sa vitrine le dit en une phrase au lieu de la marquer « en cours ».
 * Dépôts en mémoire, session simulée, outils simulés : aucun appel payant, aucun réseau.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Travail } from "@/domaine/types";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });
vi.mock("@/services/auth", async (orig) => ({ ...(await orig<typeof import("@/services/auth")>()), exigerSession: async () => ({ utilisateurId: "will" }) }));

const { avancerJusquAArretIV, etatInitialIV, validerCarteIV } = await import("@/moteurs/montage-image-video/fabrication");
const { reinitialiserDepots } = await import("@/donnees/memoire");
const { lireParametre } = await import("@/services/_commun");
const { publierVitrineIV, idsVitrineIV } = await import("@/services/image-video-lanceur");
const { validerScriptImageVideo, prixAffiche } = await import("@/services/image-video-scripts");
const { validerScriptEtReprendre, reessayerImageVideo, PHRASES_IV } = await import("@/services/image-video-ecran");
const { outilsImageVideo, PREFIXE_DECISIONS, PHRASE_ACCORD_ABSENT_IV } = await import("@/services/image-video");

const VIDEO = "v-iv-accord";

/** Vitrine du lanceur arrêtée à la porte du script (carte validée). */
async function vitrineAuScript() {
  const carte = carteFixe("C");
  const o = outilsSimules(carte, monde());
  let e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { videoId: VIDEO })), o);
  e = validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" });
  e = await avancerJusquAArretIV(e, o);
  expect(e.etape).toBe("script-a-valider");
  await publierVitrineIV({ videoId: VIDEO, titre: "Essai", etat: e, entrees: {} });
  return { e, montant: prixAffiche(e.propositionScript!) };
}

const toutGarder = (e: Awaited<ReturnType<typeof vitrineAuScript>>["e"]) => ({ choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) });
const decisionsGardees = () => lireParametre<Record<string, Record<string, unknown>> | null>(`${PREFIXE_DECISIONS}${VIDEO}`, null);

describe("vitrine du lanceur : décision du script et accord du prix, ensemble ou pas du tout", () => {
  beforeEach(() => void reinitialiserDepots());

  it("sans accord, ou avec un accord plus bas que le prix affiché : RIEN n'est écrit (le lanceur ne peut pas avancer)", async () => {
    const { e, montant } = await vitrineAuScript();
    expect(montant).toBeGreaterThan(0);
    await expect(validerScriptImageVideo(VIDEO, toutGarder(e))).rejects.toThrow(/Validez de nouveau en confirmant ce prix/);
    await expect(validerScriptImageVideo(VIDEO, toutGarder(e), montant - 1)).rejects.toThrow(/Rien n'est payé/);
    expect((await decisionsGardees())?.script).toBeUndefined();
    // Par l'écran : une phrase, aucune décision gardée.
    const issue = await validerScriptEtReprendre(VIDEO, { ...toutGarder(e), ajoutsWill: [] }, undefined);
    expect(issue.statut).toBe("refusee");
    expect((await decisionsGardees())?.script).toBeUndefined();
  });

  it("avec l'accord : la décision est écrite AVEC le montant accordé ; aucun « Réessayer » n'est lancé sur la vitrine", async () => {
    const { e, montant } = await vitrineAuScript();
    let reessais = 0;
    const issue = await validerScriptEtReprendre(VIDEO, { ...toutGarder(e), ajoutsWill: [] }, montant, { reessayer: async () => void reessais++ });
    expect(issue).toEqual({ statut: "reprise" });
    expect(reessais).toBe(0);
    expect((await decisionsGardees())?.script).toMatchObject({ proposition: e.propositionScript!.empreinte, accordCentimes: montant });
  });

  it("outils du lanceur : une décision sans accord est ignorée et la voix n'est pas réservée ; avec l'accord, elle compte", async () => {
    await vitrineAuScript();
    const { travailId } = idsVitrineIV(VIDEO);
    const outils = await outilsImageVideo({ videoId: VIDEO, travailId, production: false, accordDuScriptExige: true, lireImageSource: async () => null });
    const { ecrireParametre } = await import("@/services/_commun");
    await ecrireParametre(`${PREFIXE_DECISIONS}${VIDEO}`, { script: { proposition: "p", choixFormules: {} } });
    expect(await outils.decisions!.script!()).toBeNull();
    expect(await outils.budget.reserver({ videoId: VIDEO, appelId: "iv-voix-1-1", etape: "voix", fournisseur: "heygen", centimes: 40, caracteres: 900 })).toEqual({ ok: false, message: PHRASE_ACCORD_ABSENT_IV });
    await ecrireParametre(`${PREFIXE_DECISIONS}${VIDEO}`, { script: { proposition: "p", choixFormules: {}, accordCentimes: 180 } });
    expect(await outils.decisions!.script!()).toMatchObject({ proposition: "p", accordCentimes: 180 });
    expect(await outils.budget.reserver({ videoId: VIDEO, appelId: "iv-voix-1-1", etape: "voix", fournisseur: "heygen", centimes: 40, caracteres: 900 })).toEqual({ ok: true });
  });

  it("« Refaire cette partie » sur une vitrine arrêtée : phrase honnête (relancer le lanceur), le travail n'est pas remis « en cours »", async () => {
    await vitrineAuScript();
    let reessais = 0;
    const issue = await reessayerImageVideo(VIDEO, undefined, { reessayer: async () => void reessais++ });
    expect(issue).toEqual({ statut: "refusee", phrase: PHRASES_IV.lanceur });
    expect(reessais).toBe(0);
    expect(PHRASES_IV.lanceur).toMatch(/relancez le lanceur/);
  });

  it("hors lanceur (boucle de fond) : rien ne change, la décision est gardée puis « Réessayer » porte l'accord", async () => {
    const { e } = await vitrineAuScript();
    const travail = { id: "t", statut: "echec", parametres: { imageVideo: e } } as unknown as Travail;
    const accords: unknown[] = [];
    let ecrit: unknown = null;
    const issue = await validerScriptEtReprendre(VIDEO, { ...toutGarder(e), ajoutsWill: [] }, 999, {
      travail: async () => travail,
      validerScript: async (_v, d, a) => void (ecrit = { d, a }),
      reessayer: async (_t, a) => void accords.push(a),
    });
    expect(issue).toEqual({ statut: "reprise" });
    expect(ecrit).toMatchObject({ a: 999 });
    expect(accords).toEqual([999]);
  });
});
