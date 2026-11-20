/**
 * HSH-01a · placement des hashtags (à la fin du texte ou dans le premier commentaire), règle pure et réglage.
 * Limites 0 / maximum / maximum + 1 pour chaque réseau et chaque emplacement. Dépôt mémoire, données fictives,
 * aucun appel réel, aucune clé.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import type { IdReseau } from "@/domaine/types";
import { ecritureReseau } from "@/reseaux/ecriture";
import { limiteMotsDieses } from "@/reseaux/hashtags";
import { premierCommentaireTransmissible } from "@/fournisseurs/publication/buffer";
import { premierCommentaireTransmissibleZernio } from "@/fournisseurs/publication/zernio-corps";
import { PLACEMENTS, PLACEMENT_PAR_DEFAUT, REGLES_PLACEMENT, placerHashtags, premierCommentairePossible, type PlacementHashtags } from "@/reseaux/placement-hashtags";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/placement-hashtags");

const RESEAUX = ["linkedin", "instagram", "facebook", "tiktok"] as const;
const EMPLACEMENTS: PlacementHashtags[] = ["texte", "premier-commentaire"];
const OUTILS = ["buffer", "zernio"] as const;
const TEXTE = "Vos devis en dix minutes.";

function maximum(reseau: IdReseau): number {
  const l = limiteMotsDieses(reseau);
  return typeof l === "number" ? l : ecritureReseau(reseau as "tiktok").motsDiese.valeur[1];
}
function mots(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `#sujet${String.fromCharCode(97 + i)}`);
}
function transmissible(reseau: IdReseau, outil: "buffer" | "zernio"): boolean {
  if (reseau === "tiktok") return false;
  return outil === "buffer" ? premierCommentaireTransmissible(reseau) : premierCommentaireTransmissibleZernio(reseau);
}

describe("HSH-01a · règle pure placerHashtags", () => {
  it("défaut « texte » pour les quatre réseaux", () => {
    for (const r of RESEAUX) expect(PLACEMENT_PAR_DEFAUT[r]).toBe("texte");
    expect([...PLACEMENTS]).toEqual(["texte", "premier-commentaire"]);
  });

  for (const reseau of RESEAUX) {
    for (const outil of OUTILS) {
      for (const placement of EMPLACEMENTS) {
        const max = maximum(reseau);
        const min = ecritureReseau(reseau as "tiktok").motsDiese.valeur[0];
        for (const [nom, n] of [["0", 0], ["maximum", max], ["maximum + 1", max + 1]] as const) {
          it(`${reseau} · ${outil} · ${placement} · ${nom} (${n})`, () => {
            const r = placerHashtags({ reseau, outil, placement, texte: TEXTE, motsDiese: mots(n) });
            const gardes = n;
            const ligne = mots(gardes).join(" ");
            const ailleurs = placement === "premier-commentaire" && transmissible(reseau, outil);
            if (gardes === 0) {
              expect(r.texte).toBe(TEXTE);
              expect(r.premierCommentaire).toBeUndefined();
            } else if (ailleurs) {
              expect(r.texte).toBe(TEXTE);
              expect(r.premierCommentaire).toBe(ligne);
              expect(r.repli).toBeUndefined();
            } else {
              expect(r.texte).toBe(`${TEXTE}\n\n${ligne}`);
              expect(r.premierCommentaire).toBeUndefined();
              if (placement === "premier-commentaire") expect(r.repli).toMatch(/premier commentaire/);
              else expect(r.repli).toBeUndefined();
            }
            if (n > max) expect(r.message).toMatch(/au plus/);
            else if (n < min) expect(r.message).toMatch(/au moins/);
            else expect(r.message).toBeUndefined();
          });
        }
      }
    }
  }

  it("TikTok : jamais de premier commentaire, repli dans le texte", () => {
    for (const outil of OUTILS) {
      const r = placerHashtags({ reseau: "tiktok", outil, placement: "premier-commentaire", texte: TEXTE, motsDiese: mots(3) });
      expect(r.premierCommentaire).toBeUndefined();
      expect(r.texte).toContain("#sujeta");
      expect(r.repli).toMatch(/TikTok/);
    }
  });

  it("un commentaire existant est conservé et les hashtags s'y ajoutent", () => {
    const r = placerHashtags({ reseau: "linkedin", outil: "zernio", placement: "premier-commentaire", texte: TEXTE, motsDiese: mots(2), commentaire: "Dites-nous tout." });
    expect(r.premierCommentaire).toBe("Dites-nous tout.\n\n#sujeta #sujetb");
    const t = placerHashtags({ reseau: "linkedin", outil: "zernio", placement: "texte", texte: TEXTE, motsDiese: mots(2), commentaire: "Dites-nous tout." });
    expect(t.premierCommentaire).toBe("Dites-nous tout.");
  });

  it("un mot-dièse interdit est écarté avec un message en français, sans exception", () => {
    const r = placerHashtags({ reseau: "instagram", outil: "buffer", placement: "texte", texte: TEXTE, motsDiese: ["#fyp", "#sujeta"] });
    expect(r.texte).toBe(`${TEXTE}\n\n#sujeta`);
    expect(r.message).toMatch(/#fyp/);
  });

  it("interdits : accord au singulier et au pluriel", () => {
    const un = placerHashtags({ reseau: "instagram", outil: "buffer", placement: "texte", texte: TEXTE, motsDiese: ["#fyp", "#sujeta"] });
    expect(un.message).toMatch(/écarté : ce mot-dièse n'aide pas/);
    const deux = placerHashtags({ reseau: "instagram", outil: "buffer", placement: "texte", texte: TEXTE, motsDiese: ["#fyp", "#viral", "#sujeta"] });
    expect(deux.message).toMatch(/écartés : ces mots-dièse n'aident pas/);
  });

  it("au-delà du maximum : aucun mot-dièse supprimé, message présent", () => {
    for (const reseau of RESEAUX) {
      const n = maximum(reseau) + 3;
      const r = placerHashtags({ reseau, outil: "zernio", placement: "texte", texte: TEXTE, motsDiese: mots(n) });
      expect(r.texte).toBe(`${TEXTE}\n\n${mots(n).join(" ")}`);
      expect(r.message).toMatch(/au plus/);
    }
  });

  it("la source ne nomme aucun outil de publication résilié", () => {
    for (const reseau of RESEAUX) for (const outil of OUTILS) {
      const g = REGLES_PLACEMENT[reseau][outil];
      if (g.niveau === "sourcé") expect(g.source).not.toMatch(/buffer/i);
    }
  });

  it("chaque règle porte source et date, sinon « hypothèse »", () => {
    for (const reseau of RESEAUX) {
      for (const outil of OUTILS) {
        const g = REGLES_PLACEMENT[reseau][outil];
        if (g.niveau === "hypothèse") expect(g.source).toBeNull();
        else {
          expect(g.source).toBeTruthy();
          expect(g.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
    }
  });
});

describe("HSH-01a · service du réglage", () => {
  const MDP = "essai-hsh-01a";
  beforeAll(async () => {
    await preparerMotDePasse(MDP);
  });
  beforeEach(() => {
    reinitialiserDepots();
    reinitialiserRequete();
  });

  it("lirePlacements rend « texte » partout par défaut", async () => {
    expect(await service.lirePlacements()).toEqual({ linkedin: "texte", instagram: "texte", facebook: "texte", tiktok: "texte" });
  });

  it("definirPlacement exige une session", async () => {
    await expect(service.definirPlacement("linkedin", "premier-commentaire")).rejects.toThrow();
  });

  it("definirPlacement enregistre, journalise, et refuse une valeur inconnue", async () => {
    await auth.seConnecter(MDP, false);
    await service.definirPlacement("linkedin", "premier-commentaire");
    expect((await service.lirePlacements()).linkedin).toBe("premier-commentaire");
    expect((await service.lirePlacements()).instagram).toBe("texte");
    const journal = await depots().evenements.lister();
    expect(JSON.stringify(journal)).toMatch(/placement/i);
    await expect(service.definirPlacement("linkedin", "ailleurs" as never)).rejects.toThrow();
    await expect(service.definirPlacement("youtube" as never, "texte")).rejects.toThrow();
  });
});

describe("Instagram + Zernio + placement « premier commentaire » (ZRN-01)", () => {
  it("les hashtags passent dans le premier commentaire, hors de la légende : c'est le choix explicite du réglage", () => {
    const r = placerHashtags({ reseau: "instagram", outil: "zernio", placement: "premier-commentaire", texte: TEXTE, motsDiese: mots(3), commentaire: "Voir le guide" });
    expect(premierCommentairePossible("instagram", "zernio")).toBe(true);
    expect(r.texte).toBe(TEXTE);
    expect(r.premierCommentaire).toBe(`Voir le guide\n\n${mots(3).join(" ")}`);
    expect(r.repli).toBeUndefined();
  });
});
