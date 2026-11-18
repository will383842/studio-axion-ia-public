/**
 * S1d : `vueCasConcret` (fichiers par réseau, phrase de la fin, textes, liens, rapport, coût, essai, document à préparer).
 * Base en mémoire, adresses injectées : aucun service réel, aucun `fetch`.
 */
import { hash } from "@node-rs/argon2";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const { vueCasConcret, phraseDeFin, dimensionsDe } = await import("@/services/cas-concret-vue");
const { CONSIGNE_SANS_FIN } = await import("@/moteurs/montage-cas-concret/publication");

const MDP = "cas-concret-vue";
const VIDEO = "v-03";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"] as const;

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

const urlDeCle = async (cle: string) => `https://stockage.test/${cle}?signature=abc`;

/** v-03 devient une vidéo « Cas concret MD » terminée : un fichier par suite de fin, un lien par réseau. */
async function videoCasConcret(options: { casId?: string; essai?: boolean; avecMot?: boolean; motSur?: readonly string[]; reseaux?: readonly string[]; projet?: boolean; mesures?: boolean; sansFin?: boolean } = {}) {
  const { casId = "recrutement-apporteurs", essai = false, avecMot = true, motSur = [], reseaux = RESEAUX, projet = true, mesures = true, sansFin = false } = options;
  const d = depots();
  const video = (await d.videos.obtenir(VIDEO))!;
  const version = (await d.versions.obtenir(video.versionChoisieId!))!;
  const fins = reseaux.map((r) => ({ id: `fin-${r}`, reseaux: [r], fichierCle: `studio/test/video/${VIDEO}/${r}.mp4`, dureeSec: 52.4 }));
  for (const f of fins) await d.fichiers.enregistrer({ id: `f-${f.id}`, cleStockage: f.fichierCle, nom: `${f.id}.mp4`, mime: "video/mp4", taille: 1, ...(mesures ? { largeur: 1080, hauteur: 1920 } : {}), origine: "fabrication", statut: "pret", creeLe: "2026-10-12T08:00:00.000Z", modifieLe: "2026-10-12T08:00:00.000Z" } as never);
  const liens = Object.fromEntries(reseaux.map((r) => [r, `https://axion-ia.com/fr/diagnostic?utm_source=${r}&utm_campaign=cc-${casId}-abc123`]));
  // 18/11 (relecteur B) : `sansFin` = publication d'une vidéo fabriquée APRÈS « sans choix, aucune fin » (texte du haut, aucun lien) ; sinon l'ancienne publication « diagnostic ».
  const publication = reseaux.map((r) => (sansFin
    ? { reseau: r, texte: `Texte pour ${r}.`, ouPoserLeLien: "aucun", consigneLien: CONSIGNE_SANS_FIN }
    : { reseau: r, texte: `Texte pour ${r}.`, ouPoserLeLien: "premier-commentaire", premierCommentaire: `Votre diagnostic gratuit, en quelques minutes : ${liens[r]}`, consigneLien: "Poser ce lien en premier commentaire, juste après la publication." }));
  await d.videos.modifier(VIDEO, { formatId: "cas-concret", estDemo: false });
  await d.versions.modifier(version.id, {
    estDemo: false,
    coutReel: { centimes: 42, devise: "EUR" },
    commande: { ...version.commande, moteurId: "montage-cas-concret", entrees: { casConcret: { casId, porte: "A", mot: "IA", motDit: "I.A.", avecMot, motSur: [...motSur], reseaux: [...reseaux], essai, codeSuivi: "cc-abc123" } } },
    projetMontage: projet ? { moteur: "montage-cas-concret", casConcret: { fins, liens, publication, rapport: { verdict: "ok", resume: "Vérifications passées", phrases: [] } } } : {},
  });
  return version.id;
}

describe("vueCasConcret", () => {
  it("rend un fichier par réseau coché, avec adresse, durée et dimensions", async () => {
    await videoCasConcret();
    const v = (await vueCasConcret(VIDEO, { urlDeCle }))!;
    expect(v.fichiers.map((f) => f.nom)).toEqual(["Facebook", "Instagram", "TikTok", "LinkedIn"]);
    expect(v.fichiers.every((f) => f.url?.startsWith("https://stockage.test/") && f.dureeSec === 52.4)).toBe(true);
    expect(v.fichiers[0].dimensions).toBe("1080 × 1920");
    expect(v.essai).toBe(false);
  });

  it("donne un lien, un texte et un premier commentaire par réseau coché", async () => {
    await videoCasConcret({ reseaux: ["instagram", "linkedin"] });
    const v = (await vueCasConcret(VIDEO, { urlDeCle }))!;
    expect(v.fichiers).toHaveLength(2);
    for (const f of v.fichiers) {
      expect(f.lien).toContain(`utm_source=${f.reseau}`);
      expect(f.texte).toBe(`Texte pour ${f.reseau}.`);
      expect(f.premierCommentaire).toContain(f.lien!);
      expect(f.consigneLien).toMatch(/premier commentaire/);
    }
  });

  it("vidéo d'essai : essai vrai, ni lien, ni texte, ni premier commentaire", async () => {
    await videoCasConcret({ essai: true });
    const v = (await vueCasConcret(VIDEO, { urlDeCle }))!;
    expect(v.essai).toBe(true);
    expect(v.fichiers).toHaveLength(4);
    for (const f of v.fichiers) {
      expect(f.lien).toBeUndefined();
      expect(f.texte).toBeUndefined();
      expect(f.premierCommentaire).toBeUndefined();
      expect(f.consigneLien).toBeUndefined();
    }
  });

  it("mot coché mais branché nulle part : « Fin : diagnostic et lien » et sa raison", async () => {
    await videoCasConcret({ casId: "compte-rendu-dicte", sansFin: true });
    const v = (await vueCasConcret(VIDEO, { urlDeCle }))!;
    const fb = v.fichiers.find((f) => f.reseau === "facebook")!;
    // 17/11 (Williams) : sans choix, aucune fin ; la phrase de la fin n'est plus « diagnostic et lien » mais « Fin : aucune… » (la raison, figée, reste dite).
    expect(fb.phraseFin).toBe("Fin : aucune (votre choix). Rien n'est dit ni écrit après la question.");
    expect(fb.raisonFin).toBe("Le mot n'est pas branché sur ce compte : aucune fin n'est ajoutée.");
    expect(v.documentAPreparer).toBe(false);
  });

  it("sans le mot : la phrase de la fin et sa raison le disent", async () => {
    await videoCasConcret({ avecMot: false, sansFin: true });
    const v = (await vueCasConcret(VIDEO, { urlDeCle }))!;
    for (const f of v.fichiers) {
      // 17/11 (Williams) : sans choix, aucune fin ; la phrase de la fin n'est plus « diagnostic et lien » mais « Fin : aucune… » (la raison, figée, reste dite).
      expect(f.phraseFin).toBe("Fin : aucune (votre choix). Rien n'est dit ni écrit après la question.");
      // 17/11 (Williams, FIX-CC-FIN-NON-CHOISIE) : « la vidéo propose le diagnostic » (RAISON_SANS_MOT) est supprimée : sans choix, la phrase dit déjà « (votre choix) » ; avant : toMatch(/sans le mot/).
      expect(f.raisonFin).toBeUndefined();
    }
  });

  it("vidéo fabriquée AVANT « sans choix, aucune fin » (publication « diagnostic » gardée) : la fin n'est pas dite « aucune » ; avec la publication sans fin, elle l'est", async () => {
    // 18/11 (relecteur B) : l'écran ne doit pas dire « aucune (votre choix) » d'un fichier qui porte l'ancienne fin et dont le texte garde le lien.
    await videoCasConcret({ avecMot: false });
    const ancienne = (await vueCasConcret(VIDEO, { urlDeCle }))!;
    for (const f of ancienne.fichiers) {
      expect(f.phraseFin).toBeUndefined();
      expect(f.raisonFin).toBeUndefined();
      expect(f.premierCommentaire).toContain("diagnostic");
    }
    reinitialiserDepots();
    await auth.seConnecter(MDP, false);
    await videoCasConcret({ avecMot: false, sansFin: true });
    const neuve = (await vueCasConcret(VIDEO, { urlDeCle }))!;
    for (const f of neuve.fichiers) {
      expect(f.phraseFin).toContain("Fin : aucune");
      expect(f.consigneLien).toBe(CONSIGNE_SANS_FIN);
      expect(f.premierCommentaire).toBeUndefined();
    }
  });

  it("mot branché sur Instagram : « Fin : mot et envoi » là seulement, document à préparer", async () => {
    await videoCasConcret({ motSur: ["instagram"], sansFin: true });
    const v = (await vueCasConcret(VIDEO, { urlDeCle }))!;
    const phrase = (r: string) => v.fichiers.find((f) => f.reseau === r)!;
    expect(phrase("instagram").phraseFin).toBe("Fin : mot et envoi");
    expect(phrase("instagram").raisonFin).toBeUndefined();
    // 17/11 (Williams) : sans choix, aucune fin ; la phrase de la fin n'est plus « diagnostic et lien » mais « Fin : aucune… » (la raison, figée, reste dite).
    expect(phrase("facebook").phraseFin).toBe("Fin : aucune (votre choix). Rien n'est dit ni écrit après la question.");
    expect(phrase("tiktok").phraseFin).toBe("Fin : aucune (votre choix). Rien n'est dit ni écrit après la question.");
    expect(v.documentAPreparer).toBe(true);
  });

  it("document à préparer : faux si aucun réseau coché n'a de cadeau", async () => {
    await videoCasConcret({ reseaux: ["tiktok", "linkedin"] });
    expect((await vueCasConcret(VIDEO, { urlDeCle }))!.documentAPreparer).toBe(false);
  });

  it("rapport en phrases et coût réel", async () => {
    await videoCasConcret();
    const v = (await vueCasConcret(VIDEO, { urlDeCle }))!;
    expect(v.rapport).toEqual({ verdict: "ok", resume: "Vérifications passées", phrases: [] });
    expect(v.coutCentimes).toBe(42);
    expect(v.cout).toMatch(/0,42/);
  });

  it("dimensions : sans mesure, aucune dimension inventée", async () => {
    await videoCasConcret({ mesures: false });
    const v = (await vueCasConcret(VIDEO, { urlDeCle }))!;
    expect(v.fichiers.every((f) => f.dimensions === undefined)).toBe(true);
  });

  it("adresse indisponible : fichier sans adresse, pas d'erreur", async () => {
    await videoCasConcret();
    const v = (await vueCasConcret(VIDEO, { urlDeCle: async () => { throw new Error("stockage hors service"); } }))!;
    expect(v.fichiers).toHaveLength(4);
    expect(v.fichiers.every((f) => f.url === undefined)).toBe(true);
  });

  it("hors du moteur, ou sans projet de montage : null", async () => {
    expect(await vueCasConcret(VIDEO, { urlDeCle })).toBeNull();
    await videoCasConcret({ projet: false });
    expect(await vueCasConcret(VIDEO, { urlDeCle })).toBeNull();
    expect(await vueCasConcret("v-inconnue", { urlDeCle })).toBeNull();
  });

  it("session exigée", async () => {
    await videoCasConcret();
    await auth.seDeconnecter();
    await expect(vueCasConcret(VIDEO, { urlDeCle })).rejects.toBeTruthy();
  });

  it("pièces pures", () => {
    expect(phraseDeFin(["commentaire", "cadeau"])).toBe("Fin : mot et envoi");
    expect(phraseDeFin(["rendez-vous", "lien"])).toBe("Fin : diagnostic et lien");
    expect(dimensionsDe(1080, 1920)).toBe("1080 × 1920");
    expect(dimensionsDe(1080, undefined)).toBeUndefined();
  });

  it("le fichier n'importe ni publications ni buffer", () => {
    const source = readFileSync(join(process.cwd(), "src/services/cas-concret-vue.ts"), "utf8");
    expect(source).not.toMatch(/from "[^"]*(publications|buffer)[^"]*"/);
  });
});

describe("P9 · documentOuvert (réglage `casConcret.documentPromis`)", () => {
  it("faux par défaut (éteint), vrai une fois le réglage allumé (dans le double seulement)", async () => {
    await videoCasConcret();
    expect((await vueCasConcret(VIDEO, { urlDeCle }))!.documentOuvert).toBe(false);
    await ecrireParametre("casConcret.documentPromis", true);
    expect((await vueCasConcret(VIDEO, { urlDeCle }))!.documentOuvert).toBe(true);
  });

  it("faux quand le cas de la vidéo est introuvable, même réglage allumé (le bloc ne s'afficherait pas : la phrase reste)", async () => {
    await videoCasConcret({ casId: "cas-retire" });
    await ecrireParametre("casConcret.documentPromis", true);
    expect((await vueCasConcret(VIDEO, { urlDeCle }))!.documentOuvert).toBe(false);
  });
});
