/**
 * Lot G2 (3e passe) · le débit du plafond de 60 s est CELUI DE LA COMMANDE sur les trois autres chemins : le contrôle réel
 * (`apresFabricationGenerateur`), le raccord (`lancerVariantesEnAttente`) et le coût complet (`etatFabricationSujet`).
 * Réglage allumé, voix HeyGen à vitesse 1,5 ; puis format à débit d'écriture 2,2 : l'ordre des segments jugé par le contrôle
 * et par le raccord est EGAL aux segments de la commande de `complementsGenerateur`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import type { BlocScript, Video, VarianteReseau } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const vus = vi.hoisted(() => ({ ordresControle: [] as string[][], ordresRaccord: [] as string[][], segmentsEstimes: [] as string[][] }));

vi.mock("@/briques/declinaison", async (orig) => {
  const o = await orig<typeof import("@/briques/declinaison")>();
  return {
    ...o,
    horodatageDesSegments: (ordre: string[], temps: Parameters<typeof o.horodatageDesSegments>[1]) => {
      vus.ordresControle.push(ordre);
      return o.horodatageDesSegments(ordre, temps);
    },
    etapesVariante: (e: Parameters<typeof o.etapesVariante>[0]) => {
      vus.ordresRaccord.push(e.ordreVersion);
      return o.etapesVariante(e);
    },
    raccordsSurMere: () => ({ visible: false, raisons: [], tranches: { debutRemplaceSec: 0, finRemplaceSec: 0 } }),
  };
});

// La mère d'une vidéo : un horodatage minimal (le moteur avocat réel n'est pas l'objet).
vi.mock("@/moteurs", async (orig) => {
  const o = await orig<typeof import("@/moteurs")>();
  return {
    ...o,
    moteurDeCommande: (c: Parameters<typeof o.moteurDeCommande>[0]) => ({
      ...o.moteurDeCommande(c),
      // Espion du coût complet : les segments de la commande que `commandeEstimation` remet à l'estimation.
      estimer: (cmd: Parameters<ReturnType<typeof o.moteurDeCommande>["estimer"]>[0]) => {
        vus.segmentsEstimes.push(ids(cmd.script.blocs));
        return o.moteurDeCommande(c).estimer(cmd);
      },
      mereDeclinaison: (_p: unknown, ids: { videoId: string; versionId: string }) => ({ ...ids, audioCle: "a", dureeSec: 40, motsPrononces: [], segments: [{ segmentId: "s1", debutSec: 0, finSec: 10 }], plans: [] }),
    }),
  };
});

// Aucune fabrication ni aucun appel payant : le lancement de la version est un simple espion.
vi.mock("@/services/fabrication", async (orig) => ({ ...(await orig<typeof import("@/services/fabrication")>()), lancerFabricationConfirmee: vi.fn(async () => ({ travailId: "t" })) }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre } = await import("@/services/_commun");
const fr = await import("@/services/fabrication-reseaux");
const { obtenirFormat, debitLecture } = await import("@/formats");
const { preparerMotDePasse } = await import("../helpers/g1a");

const MDP = "essai-g2-debit";
const mots = (n: number) => Array.from({ length: n }, () => "mot").join(" ");
const bloc = (id: string, segs: { id: string; texte: string; facultatif?: string }[]) => ({ id, blocRecette: "corps", titre: id, segments: segs }) as unknown as BlocScript;
const ids = (b: BlocScript[]) => b.flatMap((x) => x.segments.filter((s) => s.texte.trim()).map((s) => s.id));

/** Un sujet LinkedIn : ouverture 8 s, corps 25 s + facultatif `facSec` s, au débit `debit` (mots/s) de la voix. */
async function preparer(formatId: string, voix: { fournisseur: string; reglages: { vitesse: number } } | null, debit: number, facSec = 30) {
  const n = (sec: number) => mots(Math.round(sec * debit));
  await ecrireParametre("adaptations_reseaux.actif", true);
  if (voix) await depots().voix.enregistrer({ id: "vx", personnageId: "p", nom: "vx", langue: "fr-FR", minutesEnregistrees: 0, statut: "prete", fichierIds: [], ...voix } as never);
  await depots().scripts.enregistrer({ id: "sc1", blocs: [bloc("gen-b1", [{ id: "s1", texte: n(25) }, { id: "f1", texte: n(facSec), facultatif: "linkedin" }])] } as never);
  await depots().scriptsMaitres.enregistrer({ id: "m1", brief: { reseaux: ["linkedin"] } } as never);
  const variante = { id: "v1", code: "0001-L", scriptMaitreId: "m1", scriptId: "sc1", formatId, reseau: "linkedin", segmentFacultatifRetenu: true, ouverture: [bloc("o", [{ id: "o1", texte: n(8) }])], fin: [], encadre: { texte: "x" }, dureeEstimeeSec: 60 } as unknown as VarianteReseau;
  await depots().variantes.enregistrer(variante);
  const distribution = [{ role: "Face caméra", source: "double", ...(voix ? { voixId: "vx" } : {}) }];
  const base = { formatId, varianteId: "v1", distribution, dureeCibleSec: 60, ratios: ["9:16"], estDemo: false } as unknown as Video;
  const decl = { role: "mere", operationId: "op" };
  await depots().versions.enregistrer({ id: "ver-m", videoId: "vm", commande: { moteurId: "montage-avocat", distribution } } as never);
  await depots().videos.enregistrer({ ...base, id: "vm", statut: "prete", versionChoisieId: "ver-m", entrees: { declinaison: decl } } as never);
  await depots().videos.enregistrer({ ...base, id: "vv", statut: "brouillon", typeDerive: "variante-reseau", sourceVideoId: "vm", entrees: { declinaison: { role: "variante", mereVideoId: "vm", attendMere: true, prixConfirme: true } } } as never);
  return { variante, video: (await depots().videos.obtenir("vv"))!, ctx: { distribution: distribution as never, prononciations: [], estimation: true } };
}

beforeEach(async () => {
  await preparerMotDePasse(MDP);
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  vus.ordresControle.length = 0;
  vus.ordresRaccord.length = 0;
  vus.segmentsEstimes.length = 0;
});

async function verifier(formatId: string, voix: Parameters<typeof preparer>[1], debitReel: number, facSec: number, attendu: string[]) {
  const { video, ctx } = await preparer(formatId, voix, debitReel, facSec);
  const commande = await fr.complementsGenerateur(video, ctx);
  const segmentsCommande = ids(commande.script!.blocs);
  // Précondition : le débit de la commande tranche autrement que le débit « sans voix » (sinon le test ne prouve rien).
  expect(segmentsCommande).toEqual(attendu);
  await fr.apresFabricationGenerateur("vm");
  expect(vus.ordresControle.at(-1)).toEqual(segmentsCommande);
  expect(vus.ordresRaccord.at(-1)).toEqual(segmentsCommande);
}

describe("G2 · même débit que la commande sur le contrôle réel et le raccord", () => {
  it("voix HeyGen à vitesse 1,5 (55 s à son débit, 83 s au débit sans voix) : le facultatif reste, partout", async () => {
    const voix = { fournisseur: "heygen", reglages: { vitesse: 1.5 } };
    await verifier("tableau-anime", voix, debitLecture(obtenirFormat("tableau-anime"), voix), 22, ["o1", "s1", "f1"]);
  });

  it("voix HeyGen à vitesse 0,5 (63 s à son débit, 31 s au débit sans voix) : le facultatif est coupé, partout", async () => {
    const voix = { fournisseur: "heygen", reglages: { vitesse: 0.5 } };
    await verifier("tableau-anime", voix, debitLecture(obtenirFormat("tableau-anime"), voix), 30, ["o1", "s1"]);
  });

  it("format à débit d'écriture 2,2 (motion), voix HeyGen à vitesse 1 : 55 s à 2,6 mots/s, 65 s à 2,2 — le facultatif reste, partout", async () => {
    const voix = { fournisseur: "heygen", reglages: { vitesse: 1 } };
    expect(debitLecture(obtenirFormat("motion"), null)).toBe(2.2);
    await verifier("motion", voix, debitLecture(obtenirFormat("motion"), voix), 22, ["o1", "s1", "f1"]);
  });

  it("le coût complet (`etatFabricationSujet`) est calculé sur les mêmes blocs", async () => {
    const voix = { fournisseur: "heygen", reglages: { vitesse: 1.5 } };
    const { video, ctx } = await preparer("tableau-anime", voix, debitLecture(obtenirFormat("tableau-anime"), voix), 22);
    const segmentsCommande = ids((await fr.complementsGenerateur(video, ctx)).script!.blocs);
    expect(segmentsCommande).toEqual(["o1", "s1", "f1"]);
    vus.segmentsEstimes.length = 0;
    await depots().videos.modifier(video.id, { entrees: { declinaison: { role: "complete", attendConfirmation: true, operationId: "op" } } });
    const etats = await fr.etatFabricationSujet("m1");
    expect(etats.find((e) => e.videoId === "vv")?.coutComplet).toBeTruthy();
    expect(vus.segmentsEstimes.at(-1)).toEqual(segmentsCommande);
  });
});

describe("G2 · estimation : repli si la base est indisponible", () => {
  it("la distribution par défaut qui échoue n'empêche pas le prix : repli sur la commande légère", async () => {
    const voix = { fournisseur: "heygen", reglages: { vitesse: 1 } };
    await preparer("tableau-anime", voix, 2.6);
    await depots().variantes.modifier("v1", { etat: "validee", code: "0001-AV-TT-LK" } as never);
    await depots().scripts.modifier("sc1", { scriptMaitreId: "m1", mode: "avatar" } as never);
    const lecture = vi.spyOn(depots().personnages, "lister").mockRejectedValue(new Error("base indisponible"));
    const plan = await fr.planFabricationSujet("m1");
    expect(lecture).toHaveBeenCalled();
    expect(plan?.versions).toHaveLength(1);
    lecture.mockRestore();
  });
});

