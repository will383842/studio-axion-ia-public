/**
 * T-EXT-27b : le port « regarder » du tutoriel. Faux `executer`, faux rendu, compteurs : aucun appel à Claude, aucun
 * rendu réel, 0 €.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { imagesPourClaude, IMAGES_REGARD_MAX, roleRegard, variableRegard } from "@/briques/regardeur";
import type { InstantRegard } from "@/briques/regardeur";
import type { DemandeRendu } from "@/fournisseurs/types";
import { creerRegardTutoriel, type RenduRegard } from "@/services/tutoriel-regard";
import { ETAPE_REGARD_TUTORIEL, IMAGES_REGARD_TUTORIEL, plafondPropreTutoriel } from "@/services/tutoriel-claude";

const instant = (i: number): InstantRegard => ({ nom: `i${String(i + 1).padStart(2, "0")}`, instantSec: i * 2 + 0.5, partieId: `s${i}`, sorte: "partie", legende: `partie s${i}`, texteAttendu: false, motsDits: [] });
const instants = (n: number) => Array.from({ length: n }, (_, i) => instant(i));

const MAITRE: DemandeRendu = {
  idRendu: "t-4x5-0",
  operation: "composition",
  file: "longue",
  entrees: { audio: "https://stockage.test/voix.mp3" },
  sortie: { urlDepot: "https://depot.test/m.mp4", cle: "studio/test/m.mp4" },
  parametres: { composition: "TutorielOutil", proprietes: { plan: { format: { fps: 25 }, dureeMs: 40000 }, fin: { titre: "Axion IA" } } },
};

const rendu: RenduRegard = {
  service: () => {
    throw new Error("rendu réel interdit dans les tests");
  },
  signer: async (_l, depot) => ({ lectures: {}, urlDepot: `https://depot.test/${depot.cle}` }),
  cle: (nom) => `studio/test/videos/v/${nom}`,
};

const LECTURE = (noms: string[]) => ({ images: noms.map((nom) => ({ nom, textes: [], sousTitre: null, pageVide: false, noire: false, illisible: false })) });

function montage(opts: { echecs?: string[]; reponse?: (nomsImages: string[]) => unknown } = {}) {
  const demandes: DemandeRendu[] = [];
  const executions: unknown[][] = [];
  const executer = (async (...a: unknown[]) => {
    executions.push(a);
    const entree = a[2] as { images: { legende: string }[] };
    const noms = entree.images.map((i) => i.legende);
    return opts.reponse ? opts.reponse(noms) : { ok: true, simule: false, donnees: LECTURE(noms), coutUsd: 0, modele: "faux" };
  }) as never;
  const tirer = async (d: DemandeRendu) => {
    demandes.push(d);
    return opts.echecs?.some((n) => d.idRendu.endsWith(n)) ? null : { type: "image/png" as const, base64: "AAAA" };
  };
  const regarder = creerRegardTutoriel({ videoId: "v-to", origine: "usine", rendu }, { executer, tirer });
  return { regarder, demandes, executions };
}

describe("T-EXT-27b : images-clés", () => {
  it("12 instants → 12 demandes `image-fixe`, mêmes composition et propriétés que le maître, image = instant × fps", async () => {
    const m = montage();
    await m.regarder({ demandeMaitre: MAITRE, instants: instants(12) });
    expect(m.demandes).toHaveLength(12);
    m.demandes.forEach((d, i) => {
      expect(d.operation).toBe("image-fixe");
      expect(d.file).toBe("courte");
      expect(d.parametres.composition).toBe(MAITRE.parametres.composition);
      expect(d.parametres.proprietes).toEqual(MAITRE.parametres.proprietes);
      expect(d.entrees).toEqual(MAITRE.entrees);
      expect(d.parametres.image).toBe(Math.round((i * 2 + 0.5) * 25));
    });
    expect(new Set(m.demandes.map((d) => d.idRendu)).size).toBe(12);
  });

  it("15 instants → 12 images au plus", async () => {
    const m = montage();
    await m.regarder({ demandeMaitre: MAITRE, instants: instants(15) });
    expect(m.demandes).toHaveLength(12);
    expect((m.executions[0][2] as { images: unknown[] }).images).toHaveLength(12);
  });

  it("une image en échec est absente : l'appel part avec les autres", async () => {
    const m = montage({ echecs: ["i03"] });
    const lecture = await m.regarder({ demandeMaitre: MAITRE, instants: instants(5) });
    const entree = m.executions[0][2] as { images: { legende: string }[]; variable: string };
    expect(entree.images.map((i) => i.legende)).toEqual(["i01", "i02", "i04", "i05"]);
    expect(entree.variable).toBe(variableRegard([instant(0), instant(1), instant(3), instant(4)]));
    expect(lecture?.images.map((i) => i.nom)).toEqual(["i01", "i02", "i04", "i05"]);
  });

  it("0 image → null et AUCUN appel à Claude", async () => {
    const m = montage({ echecs: ["i01", "i02"] });
    expect(await m.regarder({ demandeMaitre: MAITRE, instants: instants(2) })).toBeNull();
    expect(m.executions).toHaveLength(0);
    const vide = montage();
    expect(await vide.regarder({ demandeMaitre: MAITRE, instants: [] })).toBeNull();
    expect(vide.executions).toHaveLength(0);
  });
});

describe("T-EXT-27b : l'appel du regardeur commun", () => {
  it("un seul appel : rôle commun, étape du tutoriel, plafond propre, origine, images et variable", async () => {
    const m = montage();
    await m.regarder({ demandeMaitre: MAITRE, instants: instants(3) });
    expect(m.executions).toHaveLength(1);
    const [videoId, role, entree, options] = m.executions[0] as [string, unknown, { contexte: object; variable: string; images: unknown[] }, { etape: string; plafondPropre: unknown; origine: string }];
    expect(videoId).toBe("v-to");
    expect(role).toBe(roleRegard);
    expect(options.etape).toBe(ETAPE_REGARD_TUTORIEL);
    expect(options.etape.startsWith("Tutoriel ·")).toBe(true);
    expect(options.plafondPropre).toEqual(plafondPropreTutoriel());
    expect(options.origine).toBe("usine");
    expect(entree.images).toEqual(imagesPourClaude([1, 2, 3].map((n) => ({ nom: `i0${n}`, type: "image/png" as const, base64: "AAAA" }))));
    expect(entree.variable).toBe(variableRegard(instants(3)));
  });

  it("le nombre d'images du regard ne dépasse jamais le plafond commun", () => {
    expect(IMAGES_REGARD_TUTORIEL).toBeLessThanOrEqual(IMAGES_REGARD_MAX);
  });

  it.each(["plafond-video", "en-attente-credit", "budget-usine", "bloquee-modele", "indisponible"] as const)("arrêt %s → null", async (arret) => {
    const m = montage({ reponse: () => ({ ok: false, arret, message: "x" }) });
    expect(await m.regarder({ demandeMaitre: MAITRE, instants: instants(2) })).toBeNull();
  });

  it.each([
    ["simulé", () => ({ ok: true, simule: true, coutUsd: 0, modele: "simulation" })],
    ["texte vide", () => ({ ok: true, simule: false, texte: "  ", coutUsd: 0, modele: "m" })],
    ["texte illisible", () => ({ ok: true, simule: false, texte: "pas du JSON", coutUsd: 0, modele: "m" })],
    ["forme fausse", () => ({ ok: true, simule: false, donnees: { images: [{ nom: 1 }] }, coutUsd: 0, modele: "m" })],
  ])("%s → null", async (_nom, reponse) => {
    const m = montage({ reponse });
    expect(await m.regarder({ demandeMaitre: MAITRE, instants: instants(2) })).toBeNull();
  });

  it("le texte brut d'un JSON valide est lu quand il n'y a pas de données", async () => {
    const m = montage({ reponse: (noms) => ({ ok: true, simule: false, texte: JSON.stringify(LECTURE(noms)), coutUsd: 0, modele: "m" }) });
    const l = await m.regarder({ demandeMaitre: MAITRE, instants: instants(2) });
    expect(l?.images).toHaveLength(2);
  });

  it("jamais d'exception vers le moteur (exécuteur ou tirage qui lève)", async () => {
    const leve = creerRegardTutoriel({ videoId: "v", origine: "usine", rendu }, { executer: (async () => { throw new Error("panne"); }) as never, tirer: async () => ({ type: "image/png", base64: "AA" }) });
    expect(await leve.call(null, { demandeMaitre: MAITRE, instants: instants(2) })).toBeNull();
    const tire = creerRegardTutoriel({ videoId: "v", origine: "usine", rendu }, { executer: (async () => { throw new Error("jamais appelé"); }) as never, tirer: async () => { throw new Error("rendu en panne"); } });
    expect(await tire({ demandeMaitre: MAITRE, instants: instants(2) })).toBeNull();
  });
});

describe("T-EXT-27b : garde du fichier", () => {
  const texte = readFileSync("src/services/tutoriel-regard.ts", "utf8");
  it("ni consigne, ni schéma, ni lecture simulée, ni adaptateur de texte", () => {
    for (const interdit of ["consigne", "z.object", "simuler", "appelClaudeTutoriel", "executerRole(", "appelerAvecRotation(", "envoyerMessage("]) expect(texte).not.toContain(interdit);
  });
  it("l'appel payant porte l'origine sur sa ligne et passe par l'exécuteur gardé", () => {
    const lignes = texte.split("\n").filter((l) => /\bexecuter\(/.test(l));
    expect(lignes.length).toBe(1);
    expect(lignes[0]).toContain("origine");
    expect(lignes[0]).toContain("roleRegard");
  });
});
