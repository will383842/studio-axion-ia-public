/**
 * G6b · « je lis » dans le moteur avocat : prises filmées en `rush`, un seul angle, calées sur le texte (alignement
 * forcé, fournisseur « alignement »), assemblées (1 corps + le début et la fin du réseau) par `studio-rendu`, posées à la
 * place du double (vidéo opaque, ni micro dessiné ni liseré) ; sous-titres tirés du texte VALIDÉ ; rien à payer (ni
 * voix ni double). Aligneur et rendu injectés : la réponse de l'aligneur est la sortie RÉELLE de `studio-aligneur` sur
 * la voix d'essai (lot D3, `tests/fixtures/d3-calage-voix-essai.json`). Aucun appel réseau.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");

import type { BlocScript, CommandeFabrication, Travail } from "@/domaine/types";
import type { DemandeAlignement, DemandeRendu, EtatRendu, FournisseurAlignement, ResultatAlignement, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs";
import type { ParametresCompositionAvocat } from "@/moteurs/montage-avocat/scene";

const MDP = "essai-g6b-moteur";
const T0 = Date.UTC(2026, 9, 3, 9, 0, 0);
const CALE = JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", "d3-calage-voix-essai.json"), "utf8")) as ResultatAlignement;

beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

const stockage = (): StockageFichiers => ({
  id: "r2",
  type: "stockage",
  nom: "Stockage",
  reelPrevu: "R2",
  mode: "reel",
  capacites: { asynchrone: false, accordExige: false },
  preparerDepot: async () => ({ cleStockage: "x", urlDepot: "" }),
  confirmerDepot: async () => ({ ok: true }),
  urlLecture: async (cle) => `https://r2.exemple/${cle}`,
  urlLectureDuree: async (cle) => `https://r2.exemple/${cle}`,
  urlDepotDuree: async (cle) => `https://r2.exemple/${cle}?depot`,
});

function fauxRendu() {
  const recues: DemandeRendu[] = [];
  const etats = new Map<string, EtatRendu>();
  const service: ServiceRendu = {
    async soumettre(d) {
      recues.push(d);
      etats.set(d.idRendu, { statut: "termine", sortieCle: d.sortie.cle, mesures: d.operation === "composition" ? { largeur: 1080, hauteur: 1920, fps: 25, dureeSec: 11, lufs: -14 } : { dureeSec: 11 } });
      return { idRendu: d.idRendu };
    },
    etat: async (id) => etats.get(id) ?? { statut: "inconnu" },
  };
  return { recues, service };
}

/** Aligneur « réel » injecté : répond la sortie enregistrée de studio-aligneur (prise unique sur la voix d'essai). */
function aligneurEnregistre() {
  const demandes: DemandeAlignement[] = [];
  const a: FournisseurAlignement = {
    id: "studio-aligneur",
    type: "alignement",
    nom: "Calage des mots",
    reelPrevu: "studio-aligneur",
    mode: "reel",
    capacites: { asynchrone: true, accordExige: false },
    soumettre: async (d: DemandeAlignement) => void demandes.push(d),
    suivre: async () => ({ statut: "termine", resultat: CALE }),
  } as unknown as FournisseurAlignement;
  return { demandes, aligneur: () => a };
}

async function jusquAuBout(moteur: MoteurVideo, c: CommandeFabrication, t: Travail): Promise<{ travail: Travail; resultat: ResultatFabrication }> {
  let travail = t;
  let resultat: ResultatFabrication | undefined;
  for (let ms = T0; ms < T0 + 10 * 60_000; ms += 500) {
    const r = await moteur.avancer(travail, c, ms);
    travail = r.travail;
    resultat = r.resultat ?? resultat;
    if (travail.statut === "termine") return { travail, resultat: resultat! };
    if (travail.statut === "echec") throw new Error(JSON.stringify(travail.erreur));
  }
  throw new Error(`bloqué : ${travail.statut}`);
}

const SEGMENTS = [
  { id: "s1", texte: "Vous recevez un PV de 135 € ?" },
  { id: "s2", texte: "Surtout, ne le payez pas tout de suite." },
  { id: "s3", texte: "Je vous explique pourquoi, en trois points." },
];
const DITS = ["Vous recevez un pé vé de cent trente-cinq euros ?", "Surtout, ne le payez pas tout de suite.", "Je vous explique pourquoi, en trois points."];

async function commandeJeLis(prises: CommandeFabrication["prises"]): Promise<CommandeFabrication> {
  const c0 = await fabrication.construireCommande("v-03");
  const blocs: BlocScript[] = [
    { id: "b1", blocRecette: "accroche", segments: [SEGMENTS[0]] },
    { id: "b2", blocRecette: "coeur", segments: [SEGMENTS[1]] },
    { id: "b3", blocRecette: "appel", segments: [SEGMENTS[2]] },
  ];
  return {
    ...c0,
    script: { blocs, texteComplet: SEGMENTS.map((s) => s.texte).join(" ") },
    dureeCibleSec: 11,
    plans: [],
    prononciations: [],
    texteDitParSegment: DITS,
    distribution: [{ ...c0.distribution[0], source: "rush", modeAngles: "un-angle", visagesResolus: undefined }],
    accessoires: c0.accessoires,
    briques: { ...c0.briques, illustrations: false },
    prises,
  };
}

describe("G6b · prises filmées dans le moteur", () => {
  it("rien à payer ; « Vos prises » ; calage sur le texte DIT ; prise coupée avant le premier mot et après le dernier ; vidéo opaque", async () => {
    const rendu = fauxRendu();
    const al = aligneurEnregistre();
    const m = creerMoteurMontageAvocat({ rendu: rendu.service, stockage, alignement: al.aligneur });
    const c = await commandeJeLis([{ id: "p1", partie: "version", cle: "prises/0042-AV-TT-L-prise-1.mp4", mime: "video/mp4", dureeSec: 10.921, segmentIds: ["s1", "s2", "s3"] }]);
    const e = await m.estimer(c);
    expect(e.lignes.map((l) => l.etape)).not.toContain("Voix");
    expect(e.lignes.some((l) => l.etape.startsWith("Double"))).toBe(false);
    expect(e.total.centimes).toBe(0);
    const t = await m.lancer(c, { travailId: "t-jl", versionId: "ver-jl", titre: "Je lis", maintenant: T0 });
    expect(t.etapes.map((x) => x.cle)).not.toContain("visage");
    expect(t.etapes.find((x) => x.cle === "voix")?.nom).toBe("Vos prises");
    const { resultat, travail } = await jusquAuBout(m, c, t);
    expect(travail.etapes.find((x) => x.cle === "voix")?.coutReel?.centimes ?? 0).toBe(0);
    // Alignement forcé sur le texte DIT (prononciations appliquées une fois), sur le son de la prise.
    expect(al.demandes).toHaveLength(1);
    expect(al.demandes[0].texte.replace(/\s+/g, " ")).toBe(DITS.join(" "));
    expect(al.demandes[0].audio).toContain("prises/0042-AV-TT-L-prise-1.mp4");
    // Assemblage : la prise, de 0,25 s avant « Vous » à 0,5 s après « points ».
    const assemblage = rendu.recues.find((d) => d.operation === "assemblage")!;
    expect(assemblage.parametres).toMatchObject({ sortie: "mp4", video: { largeur: 1080, hauteur: 1920, fps: 25 } });
    const [morceau] = (assemblage.parametres as { morceaux: { entree: string; deSec: number; aSec: number }[] }).morceaux;
    expect(morceau.entree).toBe("prise-p1");
    expect(morceau.deSec).toBeCloseTo(CALE.mots[0].debutSec - 0.25, 2);
    expect(morceau.aSec).toBeCloseTo(Math.min(10.921, CALE.mots.at(-1)!.finSec + 0.5), 2);
    // Composition : la prise assemblée tient lieu de double, opaque ; ni micro dessiné ni liseré.
    const compo = rendu.recues.find((d) => d.operation === "composition")!;
    const p = compo.parametres as Extract<ParametresCompositionAvocat, { mode: "complet" }>;
    expect(compo.entrees["double-principal"]).toContain("prises-assemblees.mp4");
    expect(p.image.doubles.principal).toMatchObject({ type: "video", transparent: false });
    expect(p.image.accessoire).toBeUndefined();
    expect(p.image.contour).toBeUndefined();
    // Sous-titres depuis le texte VALIDÉ, calés : « PV » et « 135 », jamais « pé vé ».
    const mots = (resultat.sousTitres ?? []).flatMap((s) => s.mots);
    const texte = mots.map((x) => x.mot).join(" ");
    expect(texte).toMatch(/\bPV\b/);
    expect(texte).toContain("135");
    expect(texte).not.toMatch(/pé vé|trente-cinq/);
    // « Vous » commence où l'aligneur l'a entendu (décalé du début du morceau).
    expect(mots[0].debutSec).toBeCloseTo(CALE.mots[0].debutSec - morceau.deSec, 1);
  });

  it("1 corps + le début et la fin du réseau : trois prises calées puis assemblées dans l'ordre du texte", async () => {
    const m = creerMoteurMontageAvocat();
    const c = await commandeJeLis([
      { id: "deb", partie: "debut", cle: "prises/debut-tt.mp4", mime: "video/mp4", dureeSec: 3.4, segmentIds: ["s1"] },
      { id: "corps", partie: "corps", cle: "prises/corps.mp4", mime: "video/mp4", dureeSec: 3.6, segmentIds: ["s2"] },
      { id: "fin", partie: "fin", cle: "prises/fin-tt.mp4", mime: "video/mp4", dureeSec: 3.5, segmentIds: ["s3"] },
    ]);
    const { resultat } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "t-jl3", versionId: "ver-jl3", titre: "Je lis", maintenant: T0 }));
    const projet = resultat.projetMontage as { assemblage?: { morceaux: { entree: string }[]; source: string } };
    expect(projet.assemblage?.source).toBe("prises");
    expect(projet.assemblage?.morceaux.map((x) => x.entree)).toEqual(["prise-deb", "prise-corps", "prise-fin"]);
    const segs = (resultat.sousTitres ?? []).map((s) => s.mots.map((x) => x.mot).join(" ")).join(" ");
    expect(segs).toContain("PV");
    expect(segs).toContain("trois points");
    // Un seul angle (effet deux caméras par recadrage) : aucun plan du second angle.
    expect(new Set(resultat.plans!.filter((p) => p.sourceImage === "double").map((p) => p.angle)).size).toBe(1);
    expect(resultat.plans!.filter((p) => p.sourceImage === "double").some((p) => p.cadrage.zoom > 1.05)).toBe(true);
  });
});
