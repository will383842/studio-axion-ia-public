/**
 * UI-4 : identifiants de rendu liés au CONTENU. Le faux service de rendu est idempotent comme le vrai (un idRendu déjà connu
 * renvoie le résultat déjà connu) : une retouche doit donc changer les identifiants, un même contenu les garder.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { monterVideoLongue, nomFichierVideoLongue16x9, chapitresPourPlan } = await import("@/services/video-longue-montage");
import type { CommandeFabrication } from "@/domaine/types";
const { ErreurRendu } = await import("@/fournisseurs/rendu/client");

const FORMAT_ID = /^[A-Za-z0-9_.:-]{1,120}$/;
const mots = (texte: string, debut: number) => texte.split(" ").map((mot, i) => ({ mot, debutSec: debut + i * 0.4, finSec: debut + i * 0.4 + 0.35 }));
function ctxDe(t1: string, t2: string) {
  const m1 = mots(t1, 0);
  const fin1 = m1[m1.length - 1].finSec + 0.05;
  const m2 = mots(t2, fin1);
  const dureeSec = Math.round((m2[m2.length - 1].finSec + 0.05) * 10) / 10;
  return {
    chapitres: [
      { debutSec: 0, finSec: fin1, libelle: "Un", blocRecette: "chapitres" },
      { debutSec: fin1, finSec: dureeSec, libelle: "Deux", blocRecette: "chapitres" },
    ],
    mots: [...m1, ...m2],
    dureeSec,
  } as never;
}
const commande = { videoId: "v-essai" } as CommandeFabrication;

function ports() {
  const connus = new Map<string, string>();
  const demandes: { idRendu: string; operation: string; sortie: { cle: string } }[] = [];
  const noté: Record<string, { sortieCle: string; empreinte: string }> = {};
  return {
    demandes,
    connus,
    ports: {
      rendu: {
        soumettre: async (d: { idRendu: string; operation: string; sortie: { cle: string } }) => {
          demandes.push(d);
          if (!connus.has(d.idRendu)) connus.set(d.idRendu, d.sortie.cle); // idempotent : un id connu garde SON résultat
          return { idRendu: d.idRendu };
        },
        etat: async (id: string) => ({ statut: "termine" as const, sortieCle: connus.get(id)! }),
      },
      signer: async (l: Record<string, string>, d: { cle: string }[]) => ({ lectures: Object.fromEntries(Object.entries(l).map(([n, c]) => [n, `https://lire/${c}`])), depots: Object.fromEntries(d.map((x) => [x.cle, `https://deposer/${x.cle}`])) }),
      cle: (c: { videoId: string }, nom: string) => `studio/dev/videos/${c.videoId}/${nom}`,
      lirePlages: async () => ({ ...noté }),
      ecrirePlages: async (_v: string, p: Record<string, { sortieCle: string; empreinte: string }>) => void Object.assign(noté, p),
      attendre: async () => {},
    } as never,
  };
}
const ids = (d: { idRendu: string; operation: string }[], op: string) => d.filter((x) => x.operation === op).map((x) => x.idRendu);

describe("UI-4 : identifiants stables pour un même contenu, distincts sinon", () => {
  it("même contenu, même travail : mêmes identifiants et mêmes clés", async () => {
    const a = ports();
    const r1 = await monterVideoLongue(commande, "t1", ctxDe("un deux trois quatre.", "cinq six sept huit."), a.ports);
    const b = ports();
    const r2 = await monterVideoLongue(commande, "t1", ctxDe("un deux trois quatre.", "cinq six sept huit."), b.ports);
    expect(ids(a.demandes, "composition")).toEqual(ids(b.demandes, "composition"));
    expect(ids(a.demandes, "collage-chapitres")).toEqual(ids(b.demandes, "collage-chapitres"));
    expect(r1.fichierCle).toBe(r2.fichierCle);
  });

  it("texte différent : idRendu, clés de morceaux et collage différents, rien de l'ancien contenu", async () => {
    const a = ports();
    await monterVideoLongue(commande, "t1", ctxDe("un deux trois quatre.", "cinq six sept huit."), a.ports);
    // Même service de rendu idempotent : il connaît déjà les anciens ids.
    const b = ports();
    b.connus.forEach((v, k) => b.connus.set(k, v));
    for (const [k, v] of a.connus) b.connus.set(k, v);
    const r2 = await monterVideoLongue(commande, "t2", ctxDe("un deux trois quatre.", "NOUVEAU texte retouché ici."), b.ports);
    const anciens = new Set(ids(a.demandes, "composition"));
    const nouveaux = ids(b.demandes, "composition");
    expect(nouveaux.some((i) => !anciens.has(i))).toBe(true);
    const c2Anciens = [...anciens].filter((i) => i.includes("-c2-"));
    const c2Nouveaux = nouveaux.filter((i) => i.includes("-c2-"));
    expect(c2Nouveaux.filter((i) => c2Anciens.includes(i))).toEqual([]);
    expect(ids(b.demandes, "collage-chapitres")[0]).not.toBe(ids(a.demandes, "collage-chapitres")[0]);
    // Le morceau du chapitre 2 est NEUF (clé différente), pas l'ancien renvoyé par le rendu idempotent.
    const sortiesC2 = b.demandes.filter((d) => d.operation === "composition" && d.idRendu.includes("-c2-")).map((d) => b.connus.get(d.idRendu));
    expect(sortiesC2.every((k) => k && !a.connus.has(k.split("/").pop()!.replace(".mp4", "")))).toBe(true);
    expect(r2.fichierCle).toContain("t2");
    for (const i of [...nouveaux, ...ids(b.demandes, "collage-chapitres")]) expect(i).toMatch(FORMAT_ID);
  });

  it("deux travaux : deux clés de sortie différentes (une retouche n'écrase pas la version précédente)", async () => {
    const a = ports();
    const r1 = await monterVideoLongue(commande, "t1", ctxDe("un deux trois quatre.", "cinq six sept huit."), a.ports);
    const r2 = await monterVideoLongue(commande, "t2", ctxDe("un deux trois quatre.", "cinq six sept huit."), a.ports);
    expect(r1.fichierCle).not.toBe(r2.fichierCle);
    expect(nomFichierVideoLongue16x9("t1")).not.toBe(nomFichierVideoLongue16x9("t2"));
  });

  it("identifiant borné à 120 caractères même avec un videoId très long", async () => {
    const a = ports();
    await monterVideoLongue({ videoId: "v".repeat(300) + " é/x" } as CommandeFabrication, "t".repeat(200), ctxDe("un deux.", "trois quatre."), a.ports);
    for (const d of a.demandes) expect(d.idRendu).toMatch(FORMAT_ID);
  });

  it("réglage éteint pendant le montage : la plage suivante ne part pas", async () => {
    const a = ports();
    let n = 0;
    const p = { ...(a.ports as object), actif: async () => ++n < 2 } as never;
    await expect(monterVideoLongue(commande, "t1", ctxDe("un deux trois quatre.", "cinq six sept huit."), p)).rejects.toThrow();
    expect(ids(a.demandes, "composition")).toHaveLength(1);
  });

  it("frontière de chapitre : un mot 30 ms avant le début compte dans le chapitre suivant, une seule fois", () => {
    const ctx = { chapitres: [{ debutSec: 0, finSec: 2, libelle: "a" }, { debutSec: 2, finSec: 4, libelle: "b" }], mots: [{ mot: "x", debutSec: 0.1, finSec: 0.5 }, { mot: "y", debutSec: 1.98, finSec: 2.3 }, { mot: "z", debutSec: 3, finSec: 3.4 }], dureeSec: 4 } as never;
    const cs = chapitresPourPlan(ctx);
    const texte = (i: number) => cs[i].segments.map((s) => s.texte).join(" ");
    expect(texte(0)).toBe("x");
    expect(texte(1)).toBe("y z");
  });
});

describe("UI-4 : robustesse de la lecture d'état du rendu", () => {
  const ctx = () => ctxDe("un deux trois quatre.", "cinq six sept huit.");
  const reessayable = () => new ErreurRendu({ code: "indisponible", reessayable: true, message: "Le service de rendu ne répond pas." });

  it("4 erreurs réessayables de suite sont tolérées (avec attente), la plage aboutit", async () => {
    const a = ports();
    const p = a.ports as unknown as { rendu: { etat: (id: string) => Promise<unknown> }; attendre: (ms: number) => Promise<void> };
    const vrai = p.rendu.etat;
    let restantes = 4;
    let attentes = 0;
    p.rendu.etat = async (id) => {
      if (restantes-- > 0) throw reessayable();
      return vrai(id);
    };
    p.attendre = async () => void attentes++;
    await monterVideoLongue(commande, "t1", ctx(), a.ports);
    expect(attentes).toBeGreaterThanOrEqual(4);
  });

  it("5 erreurs réessayables de suite : la plage échoue", async () => {
    const a = ports();
    (a.ports as unknown as { rendu: { etat: () => Promise<never> } }).rendu.etat = async () => {
      throw reessayable();
    };
    await expect(monterVideoLongue(commande, "t1", ctx(), a.ports)).rejects.toThrow(/Plage/);
  });

  it("une erreur non réessayable échoue tout de suite", async () => {
    const a = ports();
    (a.ports as unknown as { rendu: { etat: () => Promise<never> } }).rendu.etat = async () => {
      throw new ErreurRendu({ code: "refuse", reessayable: false, message: "non" });
    };
    await expect(monterVideoLongue(commande, "t1", ctx(), a.ports)).rejects.toThrow(/Plage/);
  });

  it("après un renvoi sur « inconnu », on attend avant de relire", async () => {
    const a = ports();
    const p = a.ports as unknown as { rendu: { etat: (id: string) => Promise<unknown> }; attendre: (ms: number) => Promise<void> };
    const vrai = p.rendu.etat;
    const journal: string[] = [];
    let inconnus = 1;
    p.rendu.etat = async (id) => {
      journal.push("etat");
      if (inconnus-- > 0) return { statut: "inconnu" };
      return vrai(id);
    };
    p.attendre = async () => void journal.push("attente");
    await monterVideoLongue(commande, "t1", ctx(), a.ports);
    const i = journal.indexOf("etat");
    expect(journal[i + 1]).toBe("attente");
  });
});
