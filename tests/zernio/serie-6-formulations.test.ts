/**
 * Série 6 : 12 nouvelles formulations (Instagram : réponse privée unique, personne qui ne suit pas encore ; déjà envoyé ;
 * réponse publique), en PROPOSITION : aucune n'est branchée à l'envoi, chacune se valide une à une sur /mots.
 * Les anciens groupes et textes ne bougent pas, à l'octet. Données 100 % fictives.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GROUPES_MP, TEXTES_MP } from "@/domaine/guide-reseau/textes-mp";
import { controlerTexteSortant } from "@/services/mots-controle";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const { reinitialiserDepots } = await import("@/donnees/memoire");
const MS = await import("@/services/mots-service");

const CHEMIN = new URL(
  "../../contrats/dictionnaire-textes-mp.v2.json",
  import.meta.url,
);
const J = (...p: string[]) => p.join("");

const GROUPES = {
  "ig-suivre": ["mp-ig-suivre-v1-1", "mp-ig-suivre-v1-2", "mp-ig-suivre-v1-3"],
  "ig-pas-encore": [
    "mp-ig-pas-encore-v1-1",
    "mp-ig-pas-encore-v1-2",
    "mp-ig-pas-encore-v1-3",
  ],
  "deja-envoye": [
    "mp-deja-envoye-v1-1",
    "mp-deja-envoye-v1-2",
    "mp-deja-envoye-v1-3",
  ],
  "pub-commentaire": ["mp-pub-v2-1", "mp-pub-v2-2", "mp-pub-v2-3"],
} as const;
const NOUVELLES = Object.values(GROUPES).flat();
const brut = (id: string) =>
  (
    TEXTES_MP as Record<
      string,
      { version: string; statut: string; texte: string }
    >
  )[id];
const G = GROUPES_MP as Record<string, readonly string[]>;

/** Mots jamais permis dans un texte de la série 6 (jetons, jamais écrits d'un bloc). */
const INTERDITS: readonly [string, RegExp][] = [
  [
    "abonné",
    new RegExp(
      J("\\babonn", "(?:e|é|er|ement|es|és|ée|ées|ements|ez)?\\b"),
      "i",
    ),
  ],
  ["abonner (sans accent aussi)", new RegExp(J("abonn"), "i")],
  ["message automatique", /message automatique/i],
  ["réponse automatique", /r[ée]ponse automatique/i],
  ["stop", /\bstop\b/i],
  ["cordialement", /cordialement/i],
  ["Grenoble", new RegExp(J("Gren", "oble"), "i")],
  ["gain garanti", new RegExp(J("Aucun gain ", "garanti"), "i")],
  ["label qualité", new RegExp(J("Quali", "opi"), "i")],
  ["signature", /axion ia/i],
];
const MARQUEURS_PERMIS = ["[TITRE DU GUIDE]", "[MOT]", "[LIEN]"];

describe("1 · dictionnaire", () => {
  it("12 textes, dans 4 groupes de 3, ordre fixe, tous présents ; les anciens groupes restent intacts", () => {
    for (const [g, ids] of Object.entries(GROUPES))
      expect(G[g], g).toEqual([...ids]);
    expect(NOUVELLES).toHaveLength(12);
    for (const v of NOUVELLES) {
      expect(brut(v), v).toBeDefined();
      expect(brut(v).version, v).toBe(v);
      expect(brut(v).statut, v).toBe("actif");
    }
    const d = JSON.parse(readFileSync(CHEMIN, "utf8"));
    expect(d.version).toBe(5);
    expect(Object.keys(d.textes).length).toBe(35 + 12);
    expect(Object.keys(d.groupes)).toEqual([
      "m1-lien",
      "adresse-refusee",
      "m1-adresse",
      "recu",
      "adresse-non-reconnue",
      "lien-rappel",
      ...Object.keys(GROUPES),
    ]);
  });
  it("chaque groupe a 3 textes distincts, de tournure différente (pas la même première phrase)", () => {
    for (const [g, ids] of Object.entries(GROUPES)) {
      const textes = ids.map((v) => brut(v).texte);
      expect(new Set(textes).size, g).toBe(3);
      expect(
        new Set(textes.map((t) => t.split(/[.!?:]/)[0].toLowerCase())).size,
        `${g} : débuts`,
      ).toBe(3);
    }
  });
  it("les anciens textes sont inchangés à l'octet (empreinte des 35 entrées d'avant la série 6)", () => {
    const d = JSON.parse(readFileSync(CHEMIN, "utf8")) as {
      textes: Record<string, unknown>;
    };
    const anciens = Object.fromEntries(
      Object.entries(d.textes).filter(
        ([k]) => !(NOUVELLES as readonly string[]).includes(k),
      ),
    );
    expect(Object.keys(anciens)).toHaveLength(35);
    expect(
      createHash("sha256").update(JSON.stringify(anciens)).digest("hex"),
    ).toBe("23051e33a45201258ab5aea5a5792fceaccf250d968e7b8f2de3ea9f3ca7d0bb");
  });
});

describe("2 · règles de contenu", () => {
  it("aucun des 12 textes ne contient un interdit", () => {
    for (const v of NOUVELLES)
      for (const [nom, motif] of INTERDITS)
        expect(brut(v).texte, `${v} · ${nom}`).not.toMatch(motif);
  });
  it("seuls les marqueurs [TITRE DU GUIDE], [MOT], [LIEN] sont permis", () => {
    for (const v of NOUVELLES)
      for (const m of brut(v).texte.match(/\[[^\]]*\]/g) ?? [])
        expect(MARQUEURS_PERMIS, `${v} · ${m}`).toContain(m);
  });
  it("chaque texte passe le contrôle de sortie (mots-controle.ts), brut et rendu", () => {
    for (const v of NOUVELLES) {
      const rendu = brut(v)
        .texte.replace(/\[TITRE DU GUIDE\]/g, "Guide fictif")
        .replace(/\[MOT\]/g, "GUIDE")
        .replace(/\[LIEN\]/g, "https://exemple.test/g?j=abc");
      for (const t of [brut(v).texte, rendu])
        expect(controlerTexteSortant("message_prive", t), v).toEqual([]);
    }
  });
  it("groupe 3 « déjà envoyé » : se termine par [LIEN], sans ponctuation après, et dit que le courrier est parti par e-mail", () => {
    for (const v of GROUPES["deja-envoye"]) {
      expect(brut(v).texte, v).toMatch(/\[LIEN\]$/);
      expect(brut(v).texte.split("[LIEN]").length, `${v} : un seul lien`).toBe(
        2,
      );
      expect(brut(v).texte, v).toContain("[TITRE DU GUIDE]");
      expect(brut(v).texte, v).toMatch(/e-mail/);
      expect(brut(v).texte, v).toMatch(/indésirables/);
    }
  });
  it("groupes 1, 2 et 4 : aucun [LIEN], aucune adresse web", () => {
    for (const v of [
      ...GROUPES["ig-suivre"],
      ...GROUPES["ig-pas-encore"],
      ...GROUPES["pub-commentaire"],
    ]) {
      expect(brut(v).texte, v).not.toContain("[LIEN]");
      expect(brut(v).texte, v).not.toMatch(/https?:|www\./i);
    }
  });
  it("groupe 1 : cite le guide, demande de suivre le compte puis de répondre OK ; groupe 2 : idem sans titre", () => {
    for (const v of GROUPES["ig-suivre"]) {
      expect(brut(v).texte, v).toContain("[TITRE DU GUIDE]");
      expect(brut(v).texte, v).toMatch(/suiv/i);
      expect(brut(v).texte, v).toMatch(/\bOK\b/);
    }
    for (const v of GROUPES["ig-pas-encore"]) {
      expect(brut(v).texte, v).toMatch(/personnes qui suivent le compte/);
      expect(brut(v).texte, v).toMatch(/suiv/i);
      expect(brut(v).texte, v).toMatch(/\bOK\b/);
    }
  });
  it("groupe 4 : court, sans réseau nommé, sans marqueur, sans promesse de gain, dit « message privé »", () => {
    for (const v of GROUPES["pub-commentaire"]) {
      const t = brut(v).texte;
      expect(t.length, v).toBeLessThanOrEqual(160);
      expect(t, v).not.toMatch(/instagram|facebook/i);
      expect(t, v).not.toMatch(/\[/);
      expect(t, v).toMatch(/message(?:s)? priv/i);
      expect(t, v).not.toMatch(/gagn|gain|argent|euros?|€|résultat/i);
    }
  });
  it("le contrôle de sortie refuse bien les interdits du vocabulaire (garde-fou du test lui-même)", () => {
    for (const [nom, motif] of INTERDITS.slice(0, 2))
      expect(
        `Bonjour, ${J("l'abonn", "é")} et ${J("s'abonn", "er")}`,
        nom,
      ).toMatch(motif);
  });
});

describe("3 · écran /mots", () => {
  beforeEach(() => reinitialiserDepots());
  it("la vue liste les 12 nouvelles formulations, non validées ; valider l'une ne change que celle-ci", async () => {
    const actions = await import("@/app/(studio)/mots/actions");
    const avant = await MS.lireVueMots();
    const versions = avant.formulations!.map((f) => f.version as string);
    for (const v of NOUVELLES) expect(versions, v).toContain(v);
    expect(avant.formulations!).toHaveLength(7 + 13 + 12);
    expect(avant.formulations!.every((f) => !f.valide)).toBe(true);
    expect(
      await actions.validerFormulationAction("mp-deja-envoye-v1-2"),
    ).toMatchObject({ ok: true });
    const apres = await MS.lireVueMots();
    expect(
      apres.formulations!.filter((f) => f.valide).map((f) => f.version),
    ).toEqual(["mp-deja-envoye-v1-2"]);
  });
  it("EcranMots affiche les 4 groupes, chaque texte, « pas encore branché » sur 2 groupes, « branché mais éteint » sur 3 groupes Instagram", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { EcranMots } = await import("@/components/mots/EcranMots");
    const vue = await MS.lireVueMots();
    const html = renderToStaticMarkup(
      createElement(EcranMots, {
        vue,
        services: {
          validerFormulation: async () => ({ ok: true, raison: "valide" }),
        } as never,
        comptes: [],
      }),
    );
    const esc = (t: string) =>
      t
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
    for (const v of NOUVELLES) expect(html, v).toContain(esc(brut(v).texte));
    for (const g of ["deja-envoye", "pub-commentaire"]) {
      const bloc = html.split(`data-groupe="${g}"`)[1].split("data-groupe=")[0];
      expect(bloc, g).toContain("pas encore branché");
    }
    for (const g of ["ig-suivre", "ig-pas-encore", "lien-rappel"]) {
      const bloc = html.split(`data-groupe="${g}"`)[1].split("data-groupe=")[0];
      expect(bloc, g).not.toContain("pas encore branché");
      expect(bloc, g).toContain("Branché sur Instagram, mais éteint");
    }
    for (const g of [
      "m1-lien",
      "adresse-refusee",
      "m1-adresse",
      "recu",
      "adresse-non-reconnue",
    ]) {
      const bloc = html.split(`data-groupe="${g}"`)[1].split("data-groupe=")[0];
      expect(bloc, g).not.toContain("pas encore branché");
    }
    expect(html.match(/Valider cette formulation/g)).toHaveLength(7 + 13 + 12);
  });
});
