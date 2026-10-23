/**
 * ÉQUIPE 7 · TIKTOK — « VOTRE MARQUE » (docs/conception/TIKTOK-SERIES-HASHTAGS.md, § 2.4).
 * Buffer ne permet pas de déclarer le contenu de marque TikTok (relevé du schéma du 03/10/2026) : le studio rappelle
 * le geste à faire dans TikTok (feuille d'envoi et notification). Brouillon toujours. Aucune étiquette IA ajoutée.
 * Aucun réseau, aucune clé.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { parleDAxion, RAPPEL_VOTRE_MARQUE, votreMarque } from "@/domaine/votre-marque";
import { entreeCreerPost } from "@/fournisseurs/publication/buffer";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");
const series = await import("@/services/series");

const MDP = "essai-e7-marque";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

describe("« Votre marque » (PUR)", () => {
  it("détecte une vidéo qui parle d'Axion IA ou de l'offre", () => {
    for (const t of ["Chez Axion IA, on forme vos équipes.", "axion-ia.com : réservez", "Axion-IA vous accompagne", "Notre formation dure une journée", "Découvrez nos formations IA", "Notre accompagnement sur mesure"]) expect(parleDAxion(t), t).toBe(true);
    for (const t of ["Vos devis en 10 minutes avec ChatGPT", "L'axe principal de votre stratégie", "Une formation en ligne gratuite existe"]) expect(parleDAxion(t), t).toBe(false);
  });

  it("pré-cochée selon le texte, puis le choix de Will prime", () => {
    expect(votreMarque({}, "Chez Axion IA, on forme vos équipes.")).toEqual({ cochee: true, auto: true });
    expect(votreMarque({}, "Vos devis en 10 minutes")).toEqual({ cochee: false, auto: true });
    expect(votreMarque({ metEnAvantAxion: false }, "Chez Axion IA")).toEqual({ cochee: false, auto: false });
    expect(votreMarque({ metEnAvantAxion: true }, "Vos devis")).toEqual({ cochee: true, auto: false });
  });

  it("le rappel dit exactement le geste à faire dans TikTok", () => {
    expect(RAPPEL_VOTRE_MARQUE).toBe("Dans TikTok : Divulgation du contenu → Votre marque");
  });
});

describe("Buffer ne sait pas déclarer « Votre marque » : rien d'inventé, brouillon gardé, aucune étiquette IA", () => {
  it("le schéma relevé de Buffer n'a aucun champ de contenu de marque TikTok", () => {
    const schema = JSON.parse(readFileSync(join(__dirname, "..", "docs/buffer/schema-2026-10.json"), "utf8")) as { data?: { __schema: { types: { name: string; inputFields?: { name: string }[] }[] } }; __schema?: { types: { name: string; inputFields?: { name: string }[] }[] } };
    const types = (schema.data?.__schema ?? schema.__schema)!.types;
    const tiktok = types.find((t) => t.name === "TikTokPostMetadataInput")!;
    // Si Buffer ajoute un jour ce champ, ce test rougit : il faudra le cocher dans `entreeCreerPost`.
    expect(tiktok.inputFields!.map((f) => f.name).sort()).toEqual(["isAiGenerated", "title"]);
  });

  it("l'entrée createPost TikTok reste un brouillon, sans champ inventé ni étiquette IA", () => {
    const input = entreeCreerPost({ reseau: "tiktok", texte: "Texte", date: new Date(Date.now() + 86_400_000).toISOString(), fichierCle: "https://exemple.test/v.mp4", canalId: "c1", mode: "brouillon", votreMarque: true });
    expect(input.saveToDraft).toBe(true);
    expect(JSON.stringify(input)).not.toMatch(/isAiGenerated|aiAssisted|brand|commercial/i);
  });
});

describe("Kit et envoi (essai, aucun réseau)", () => {
  async function videoPrete(id: string, titre: string) {
    const modele = (await depots().videos.obtenir("v-15"))!;
    await depots().videos.enregistrer({ ...modele, id, titre, estDemo: false, scriptId: undefined });
    for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(id, c, true);
    return id;
  }
  const demain = () => new Date(Date.now() + 86_400_000).toISOString();

  it("case pré-cochée quand le titre parle d'Axion IA ; Will peut la décocher", async () => {
    const id = await videoPrete("v-marque", "Pourquoi Axion IA forme vos équipes");
    expect((await pub.obtenirKit(id))!.votreMarque).toEqual({ cochee: true, auto: true });
    await series.definirVotreMarque(id, false);
    expect((await pub.obtenirKit(id))!.votreMarque).toEqual({ cochee: false, auto: false });
  });

  it("envoi TikTok d'une vidéo « Votre marque » : brouillon, rappel noté, notification avec le geste", async () => {
    const id = await videoPrete("v-marque2", "Pourquoi Axion IA forme vos équipes");
    const r = await pub.envoyerVersBuffer(id, ["tiktok", "instagram"], demain());
    const tt = r.publications.find((p) => p.reseau === "tiktok")!;
    expect(tt.statut).toBe("brouillon");
    expect(tt.votreMarque).toBe(true);
    expect(r.publications.find((p) => p.reseau === "instagram")!.votreMarque).toBeFalsy();
    const notes = await depots().notifications.lister((n) => (n.message ?? "").includes(RAPPEL_VOTRE_MARQUE) || n.titre.includes(RAPPEL_VOTRE_MARQUE));
    expect(notes).toHaveLength(1);
    // Aucune mention « IA » ajoutée au texte publié.
    expect(tt.texte).not.toMatch(/g[ée]n[ée]r[ée]e? par (l')?ia|contenu g[ée]n[ée]r[ée]/i);
  });

  it("vidéo qui ne met pas Axion IA en avant : aucun rappel", async () => {
    const id = await videoPrete("v-neutre", "Vos devis en 10 minutes");
    const r = await pub.envoyerVersBuffer(id, ["tiktok"], demain());
    expect(r.publications[0].votreMarque).toBeFalsy();
    expect(await depots().notifications.compter((n) => (n.message ?? "").includes(RAPPEL_VOTRE_MARQUE))).toBe(0);
  });
});
