/** MG-3 : validation des textes PAR MOT et PAR RÉSEAU. Faux site, dépôts en mémoire, aucun réseau, valeurs fictives. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GROUPES_PAR_RESEAU,
  IDS_FIXES_MOT,
  RESEAUX_AUTO,
  empreinteMot,
  resoudreCibleMot,
  textesDuMot,
} from "@/domaine/guide-reseau/empreinte-mot";
import { GROUPES_MP, TEXTES_MP } from "@/domaine/guide-reseau/textes-mp";
import {
  ENV_SITE_FICTIF,
  siteCiblesFactice,
} from "./aides/site-cibles-factice";

vi.mock("server-only", () => ({}));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");
const CS = await import("@/services/cibles-site");
const V = await import("@/services/mots-validation-par-mot");
const commun = await import("@/services/_commun");

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 12, 10, 0, 0);
const TITRE_SERVEUR = "Titre serveur fictif";
const env = {
  ...ENV_SITE_FICTIF,
  PARCOURS_CONVERSATION_TITRE_GUIDE: TITRE_SERVEUR,
} as unknown as Record<string, string>;
let site: ReturnType<typeof siteCiblesFactice>;
let n = 0;
/** Chaque appel avance l'horloge de 20 minutes : la copie du site est toujours périmée, le faux site est relu. */
const maintenantMs = () => T0 + ++n * 20 * MIN;
const NOM_FB = "compte-fb-fictif";
const NOM_IG = "compte-ig-fictif";

const apercu = async (mot: string) =>
  V.apercuTextesMot({ mot, env, maintenantMs: maintenantMs() });
const empreinteDe = async (mot: string, reseau: "facebook" | "instagram") => {
  const a = (await apercu(mot)).find((x) => x.reseau === reseau)!;
  if (!a.ok) throw new Error(`aperçu refusé : ${a.raison}`);
  return a.empreinte;
};
const valider = async (mot: string, reseau: string, empreinteVue?: string) =>
  V.validerTextesMot({
    mot,
    reseau,
    empreinteVue:
      empreinteVue ?? (await empreinteDe(mot, reseau as "facebook")),
    confirmeParOperateur: true,
    env,
    maintenantMs: maintenantMs(),
  });
const verifier = (mot: string, compte: string) =>
  V.verifierMotPourCompte({ mot, compte, env, maintenantMs: maintenantMs() });
const lier = (mot: string, reseau: string, codeCible: string) =>
  site.liaisons.push({ mot, reseau, codeCible, actif: true });

beforeEach(async () => {
  reinitialiserDepots();
  CS.reinitialiserEtatCiblesSite();
  n = 0;
  site = siteCiblesFactice();
  site.cibles.push({
    code: "gde-essai03",
    type: "guide",
    titre: "Guide fictif D",
    actif: true,
    test: false,
  });
  site.cibles.push({
    code: "gde-essai04",
    type: "guide",
    titre: "Guide d'essai E",
    actif: true,
    test: true,
  });
  site.cibles.push({
    code: "guide-ia",
    type: "guide",
    titre: "Titre du catalogue à ne pas utiliser",
    actif: true,
    test: false,
  });
  site.liaisons.length = 0;
  lier("chatgpt", "tous", "gde-essai01");
  lier("chatgpt2", "tous", "gde-essai01");
  lier("guide", "tous", "gde-essai01");
  lier("essai", "tous", "gde-essai04");
  lier("page", "tous", "adr-essai0000001");
  lier("ia", "tous", "guide-ia");
  lier("fantome", "tous", "gde-essai99");
  pm.injecterTransportSite(site.transport);
  await commun.ecrireParametre("zernio.comptes", {
    lusLe: "2026-11-12T10:00:00.000Z",
    comptes: [
      { id: NOM_FB, reseau: "facebook", nom: "Compte Facebook fictif" },
      { id: NOM_IG, reseau: "instagram", nom: "Compte Instagram fictif" },
      {
        id: "compte-li-fictif",
        reseau: "linkedin_page",
        nom: "Compte LinkedIn fictif",
      },
      { id: "compte-tt-fictif", reseau: "tiktok", nom: "Compte TikTok fictif" },
    ],
  });
});
afterEach(() => {
  pm.injecterTransportSite(null);
});

describe("contrat pur", () => {
  it("réseaux, groupes et textes à identifiant fixe", () => {
    expect([...RESEAUX_AUTO]).toEqual(["facebook", "instagram"]);
    for (const g of GROUPES_PAR_RESEAU.facebook)
      expect(GROUPES_PAR_RESEAU.instagram).toContain(g);
    expect(GROUPES_PAR_RESEAU.instagram).toEqual(
      expect.arrayContaining(["ig-suivre", "ig-pas-encore"]),
    );
    expect(GROUPES_PAR_RESEAU.facebook).not.toContain("ig-suivre");
    for (const id of IDS_FIXES_MOT) expect(TEXTES_MP[id].statut).toBe("actif");
    for (const g of GROUPES_PAR_RESEAU.instagram)
      expect(GROUPES_MP[g].length).toBeGreaterThan(0);
  });
  it("refus : mot invalide, GUIDE, titre absent", () => {
    expect(textesDuMot({ mot: "a", reseau: "facebook", titre: "T" })).toEqual({
      ok: false,
      raison: "mot_invalide",
    });
    expect(
      textesDuMot({ mot: "chatgpt", reseau: "facebook", titre: "T" }),
    ).toEqual({ ok: false, raison: "mot_invalide" });
    expect(
      textesDuMot({ mot: "GUIDE", reseau: "facebook", titre: "T" }),
    ).toEqual({ ok: false, raison: "mot_guide_a_part" });
    expect(
      textesDuMot({ mot: "CHATGPT", reseau: "facebook", titre: "  " }),
    ).toEqual({ ok: false, raison: "titre_cible_absent" });
  });
  it("seuls les textes actifs sont rendus, avec le mot et le titre", () => {
    const r = textesDuMot({
      mot: "CHATGPT",
      reseau: "facebook",
      titre: "Mon titre",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.textes.some((t) => t.texte.includes("Mon titre"))).toBe(true);
    expect(r.textes.some((t) => t.texte.includes("CHATGPT"))).toBe(true);
    expect(r.textes.some((t) => /\[(MOT|TITRE DU GUIDE)\]/.test(t.texte))).toBe(
      false,
    );
    expect(r.textes.some((t) => t.version === "mp-m1-v3")).toBe(false);
    expect(r.textes.some((t) => t.version === "mp-m1-v2")).toBe(true);
  });
  it("l'empreinte dépend du mot, du réseau, de la cible et du titre", () => {
    const base = {
      mot: "CHATGPT",
      reseau: "facebook" as "facebook" | "instagram",
      codeCible: "gde-essai01",
      titre: "T",
    };
    const h = (o: Partial<typeof base>) => {
      const r = empreinteMot({ ...base, ...o });
      return r.ok ? r.empreinte : "";
    };
    const ref = h({});
    expect(ref).toMatch(/^[0-9a-f]{64}$/);
    expect(
      new Set([
        ref,
        h({ mot: "CHATGPT2" }),
        h({ reseau: "instagram" }),
        h({ codeCible: "gde-essai02" }),
        h({ titre: "U" }),
      ]).size,
    ).toBe(5);
    expect(h({ titre: " T " })).toBe(ref);
  });
  it("le réseau compte dans l'empreinte même si les textes sont les mêmes", () => {
    const sauve = [...GROUPES_PAR_RESEAU.instagram];
    GROUPES_PAR_RESEAU.instagram = [...GROUPES_PAR_RESEAU.facebook];
    try {
      const h = (reseau: "facebook" | "instagram") => {
        const r = empreinteMot({
          mot: "CHATGPT",
          reseau,
          codeCible: "gde-essai01",
          titre: "T",
        });
        return r.ok ? r.empreinte : "";
      };
      expect(h("facebook")).not.toBe(h("instagram"));
    } finally {
      GROUPES_PAR_RESEAU.instagram = sauve;
    }
  });
  it("résolution de la cible : pas de repli sur guide-ia hors GUIDE", () => {
    const catalogue = [
      {
        code: "gde-essai01",
        type: "guide" as const,
        titre: "A",
        actif: true,
        test: false,
      },
    ];
    const base = {
      reseau: "facebook" as const,
      liaisons: [],
      catalogue,
      titreServeur: "Serveur",
    };
    expect(resoudreCibleMot({ ...base, mot: "CHATGPT" })).toEqual({
      genre: "sans_cible",
    });
    expect(resoudreCibleMot({ ...base, mot: "GUIDE" })).toMatchObject({
      genre: "ok",
      code: "guide-ia",
      titre: "Serveur",
    });
    const liaisons = [
      {
        mot: "CHATGPT",
        reseau: "tous" as const,
        codeCible: "gde-essai02",
        actif: true,
      },
    ];
    expect(resoudreCibleMot({ ...base, mot: "CHATGPT", liaisons })).toEqual({
      genre: "introuvable",
    });
  });
});

describe("validation par mot et par réseau", () => {
  it("valider CHATGPT ne valide ni CHATGPT2 ni GUIDE", async () => {
    expect(await valider("CHATGPT", "facebook")).toEqual({
      ok: true,
      raison: "valide",
    });
    expect(
      await V.motValidePour({
        mot: "CHATGPT",
        reseau: "facebook",
        codeCible: "gde-essai01",
        titre: "Guide fictif A",
      }),
    ).toBe(true);
    expect(
      await V.motValidePour({
        mot: "CHATGPT2",
        reseau: "facebook",
        codeCible: "gde-essai01",
        titre: "Guide fictif A",
      }),
    ).toBe(false);
    expect(
      await V.motValidePour({
        mot: "GUIDE",
        reseau: "facebook",
        codeCible: "gde-essai01",
        titre: "Guide fictif A",
      }),
    ).toBe(false);
    expect(await verifier("CHATGPT2", NOM_FB)).toBe(
      "textes_non_valides_reseau",
    );
    expect(await verifier("GUIDE", NOM_FB)).toBe("textes_non_valides_reseau");
  });
  it("valider facebook ne valide pas instagram", async () => {
    await valider("CHATGPT", "facebook");
    expect(await verifier("CHATGPT", NOM_FB)).toBeNull();
    expect(await verifier("CHATGPT", NOM_IG)).toBe("textes_non_valides_reseau");
  });
  it("GUIDE garde sa validation : refusé ici", async () => {
    const r = await V.validerTextesMot({
      mot: "GUIDE",
      reseau: "facebook",
      empreinteVue: "x",
      confirmeParOperateur: true,
      env,
      maintenantMs: maintenantMs(),
    });
    expect(r).toEqual({ ok: false, raison: "mot_guide_a_part" });
  });
  it("la confirmation de l'opérateur est obligatoire", async () => {
    const e = await empreinteDe("CHATGPT", "facebook");
    const r = await V.validerTextesMot({
      mot: "CHATGPT",
      reseau: "facebook",
      empreinteVue: e,
      confirmeParOperateur: false,
      env,
      maintenantMs: maintenantMs(),
    });
    expect(r).toEqual({ ok: false, raison: "validation_operateur_absente" });
    expect(
      await V.etatValidationMot({
        mot: "CHATGPT",
        reseau: "facebook",
        codeCible: "gde-essai01",
        titre: "Guide fictif A",
      }),
    ).toBe("absente");
  });
  it("mot invalide et réseau à la main", async () => {
    expect((await valider("chatgpt", "facebook", "x")).raison).toBe(
      "mot_invalide",
    );
    for (const r of ["linkedin", "tiktok", "autre"])
      expect((await valider("CHATGPT", r, "x")).raison).toBe(
        "reseau_a_la_main",
      );
  });
  it("changer la cible ou son titre => périmée", async () => {
    await valider("CHATGPT", "facebook");
    expect(await verifier("CHATGPT", NOM_FB)).toBeNull();
    site.cibles.find((c) => c.code === "gde-essai01")!.titre =
      "Autre titre fictif";
    expect(await verifier("CHATGPT", NOM_FB)).toBe("validation_perimee");
    site.cibles.find((c) => c.code === "gde-essai01")!.titre = "Guide fictif A";
    expect(await verifier("CHATGPT", NOM_FB)).toBeNull();
    site.liaisons.find((l) => l.mot === "chatgpt")!.codeCible = "gde-essai03";
    expect(await verifier("CHATGPT", NOM_FB)).toBe("validation_perimee");
    expect(
      await V.etatValidationMot({
        mot: "CHATGPT",
        reseau: "facebook",
        codeCible: "gde-essai03",
        titre: "Guide fictif D",
      }),
    ).toBe("perimee");
  });
  it("un texte ajouté au dictionnaire d'un groupe couvert => périmée", async () => {
    await valider("CHATGPT", "facebook");
    const id = "mp-essai-recu-v9";
    (TEXTES_MP as Record<string, unknown>)[id] = {
      version: id,
      statut: "actif",
      texte: "Texte fictif pour « [TITRE DU GUIDE] ».",
    };
    (GROUPES_MP.recu as string[]).push(id);
    try {
      expect(await verifier("CHATGPT", NOM_FB)).toBe("validation_perimee");
    } finally {
      (GROUPES_MP.recu as string[]).pop();
      delete (TEXTES_MP as Record<string, unknown>)[id];
    }
    expect(await verifier("CHATGPT", NOM_FB)).toBeNull();
  });
  it("une empreinte vue d'un autre mot est refusée", async () => {
    const autre = await empreinteDe("CHATGPT2", "facebook");
    expect(await valider("CHATGPT", "facebook", autre)).toEqual({
      ok: false,
      raison: "validation_perimee",
    });
    expect(await valider("CHATGPT", "facebook", "")).toEqual({
      ok: false,
      raison: "validation_perimee",
    });
    expect(await verifier("CHATGPT", NOM_FB)).toBe("textes_non_valides_reseau");
  });
  it("guide-ia est rendu avec le titre du serveur", async () => {
    const a = (await apercu("IA")).find((x) => x.reseau === "facebook")!;
    expect(a.ok && a.cible.titre).toBe(TITRE_SERVEUR);
    if (!a.ok) throw new Error("aperçu refusé");
    expect(a.textes.some((t) => t.texte.includes(TITRE_SERVEUR))).toBe(true);
    expect(a.textes.some((t) => t.texte.includes("Titre du catalogue"))).toBe(
      false,
    );
    expect((await valider("IA", "facebook")).ok).toBe(true);
    expect(await verifier("IA", NOM_FB)).toBeNull();
  });
  it("site en copie ou éteint => site_injoignable, aucune décision", async () => {
    const e = await empreinteDe("CHATGPT", "facebook");
    await valider("CHATGPT", "facebook");
    site.etat.panne = true;
    CS.reinitialiserEtatCiblesSite();
    const c = await V.cibleActuelleDuMot({
      mot: "CHATGPT",
      reseau: "facebook",
      env,
      maintenantMs: T0 + 25 * 20 * MIN + 11 * MIN,
    });
    expect(c).toEqual({ ok: false, raison: "site_injoignable" });
    const r = await V.validerTextesMot({
      mot: "CHATGPT",
      reseau: "facebook",
      empreinteVue: e,
      confirmeParOperateur: true,
      env,
      maintenantMs: T0 + 25 * 20 * MIN + 12 * MIN,
    });
    expect(r).toEqual({ ok: false, raison: "site_injoignable" });
    expect(await verifier("CHATGPT", NOM_FB)).toBe("site_injoignable");
  });
  it("site non relié : rien n'est décidé", async () => {
    pm.injecterTransportSite(null);
    const r = await V.cibleActuelleDuMot({
      mot: "CHATGPT",
      reseau: "facebook",
      env: {},
      maintenantMs: maintenantMs(),
    });
    expect(r).toEqual({ ok: false, raison: "site_injoignable" });
  });
  it("cible TEST : validation permise, envoi refusé", async () => {
    expect((await valider("ESSAI", "facebook")).ok).toBe(true);
    expect(await verifier("ESSAI", NOM_FB)).toBe("cible_test");
  });
  it("adresse : pas encore", async () => {
    const a = (await apercu("PAGE")).find((x) => x.reseau === "facebook")!;
    expect(a).toEqual({
      reseau: "facebook",
      ok: false,
      raison: "adresse_pas_encore",
    });
    expect(await valider("PAGE", "facebook", "x")).toEqual({
      ok: false,
      raison: "adresse_pas_encore",
    });
    expect(await verifier("PAGE", NOM_FB)).toBe("adresse_pas_encore");
  });
  it("sans cible et cible introuvable", async () => {
    expect((await valider("RIEN", "facebook", "x")).raison).toBe("sans_cible");
    expect((await valider("FANTOME", "facebook", "x")).raison).toBe(
      "cible_introuvable",
    );
    expect(await verifier("RIEN", NOM_FB)).toBe("sans_cible");
    expect(await verifier("FANTOME", NOM_FB)).toBe("cible_introuvable");
  });
  it("titre de cible absent", async () => {
    site.cibles.find((c) => c.code === "gde-essai01")!.titre = "   ";
    expect((await valider("CHATGPT", "facebook", "x")).raison).toBe(
      "titre_cible_absent",
    );
  });
  it("comptes : LinkedIn et TikTok à la main, compte inconnu", async () => {
    await valider("CHATGPT", "facebook");
    expect(await verifier("CHATGPT", "compte-li-fictif")).toBe(
      "reseau_a_la_main",
    );
    expect(await verifier("CHATGPT", "compte-tt-fictif")).toBe(
      "reseau_a_la_main",
    );
    expect(await verifier("CHATGPT", "compte-absent")).toBe(
      "reseau_du_compte_inconnu",
    );
    expect(await V.reseauDuCompte(NOM_IG)).toBe("instagram");
  });
  it("lecture impossible et réglage mal formé : fermé", async () => {
    await commun.ecrireParametre(V.PARAM_VALIDATIONS_PAR_MOT, [
      "n'importe quoi",
    ]);
    expect(await verifier("CHATGPT", NOM_FB)).toBe("textes_non_valides_reseau");
    const spy = vi
      .spyOn(depots().parametres, "obtenir")
      .mockRejectedValue(new Error("panne"));
    try {
      expect(await verifier("CHATGPT", NOM_FB)).toBe("lecture_impossible");
      expect(
        await V.motValidePour({
          mot: "CHATGPT",
          reseau: "facebook",
          codeCible: "gde-essai01",
          titre: "Guide fictif A",
        }),
      ).toBe(false);
      expect(
        await V.etatValidationMot({
          mot: "CHATGPT",
          reseau: "facebook",
          codeCible: "gde-essai01",
          titre: "Guide fictif A",
        }),
      ).toBe("absente");
    } finally {
      spy.mockRestore();
    }
  });
  it("validation idempotente, journal sans texte, vérification hors verrou", async () => {
    expect((await valider("CHATGPT", "facebook")).ok).toBe(true);
    const avant = JSON.stringify(
      await depots().parametres.obtenir(V.PARAM_VALIDATIONS_PAR_MOT),
    );
    expect((await valider("CHATGPT", "facebook")).ok).toBe(true);
    expect(
      JSON.stringify(
        await depots().parametres.obtenir(V.PARAM_VALIDATIONS_PAR_MOT),
      ),
    ).toBe(avant);
    const journal = await depots().evenements.lister((e) =>
      e.message.startsWith("Textes du mot"),
    );
    expect(journal.map((e) => e.message)).toEqual([
      "Textes du mot CHATGPT validés pour facebook par l'opérateur.",
    ]);
    // Le verrou global n'est pas réentrant : un appel DANS le verrou ne doit pas se bloquer.
    const res = await Promise.race([
      commun.sousVerrou(() => verifier("CHATGPT", NOM_FB)),
      new Promise((r) => setTimeout(() => r("bloque"), 3000)),
    ]);
    expect(res).toBeNull();
  });
  it("la sortie ne contient ni identifiant ni secret", async () => {
    await valider("CHATGPT", "facebook");
    const sortie = JSON.stringify([
      await apercu("CHATGPT"),
      await valider("CHATGPT", "instagram"),
      await verifier("CHATGPT", NOM_FB),
      await depots().evenements.lister(() => true),
      await depots().parametres.obtenir(V.PARAM_VALIDATIONS_PAR_MOT),
    ]);
    for (const interdit of [
      NOM_FB,
      NOM_IG,
      "compte-",
      ENV_SITE_FICTIF.SITE_GUIDES_RESEAU_SECRET,
      "cheminPdf",
      "fictif-a.pdf",
      "https://",
    ])
      expect(sortie).not.toContain(interdit);
  });
});
