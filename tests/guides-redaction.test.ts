import { describe, expect, it, vi } from "vitest";
import { empreinteGuide } from "@/domaine/guide-reseau/guide-contenu";
import { ErreurClaude } from "@/fournisseurs/claude/client";
import { MODELE_REDACTION_GUIDE, guidesRedactionActif, redigerBrouillonGuide, type DepsRedaction } from "@/services/guides-redaction";

const contenuBon = { titre: "Réussir son premier essai", sections: [{ titre: "Préparer", paragraphes: ["Vous commencez par relire le sujet."], puces: ["Un point"] }] };

function deps(reponse: string | Error, extra: Partial<DepsRedaction> = {}) {
  const magasin = new Map<string, unknown>();
  const appeler = vi.fn(async () => {
    if (reponse instanceof Error) throw reponse;
    return { texte: reponse };
  });
  const journal: string[] = [];
  const d: DepsRedaction = {
    env: { GUIDES_REDACTION_ENABLED: "true" },
    choisirCle: async () => "cle-fictive-test",
    appeler,
    lireParametre: async (id) => magasin.get(id) ?? null,
    ecrireParametre: async (id, v) => void magasin.set(id, v),
    journaliser: async (type, message) => void journal.push(`${type}|${message}`),
    maintenant: () => "2026-11-15T10:00:00.000Z",
    ...extra,
  };
  return { d, appeler, magasin, journal };
}

describe("G2 · interrupteur GUIDES_REDACTION_ENABLED", () => {
  it("éteint par défaut : seul « true » allume", () => {
    expect(guidesRedactionActif({})).toBe(false);
    for (const v of ["1", "TRUE", "True", "yes", "on", " true", "true ", "", "false"]) expect(guidesRedactionActif({ GUIDES_REDACTION_ENABLED: v })).toBe(false);
    expect(guidesRedactionActif({ GUIDES_REDACTION_ENABLED: "true" })).toBe(true);
  });
  it("lecture bornée : une valeur démesurée n'allume pas", () => {
    expect(guidesRedactionActif({ GUIDES_REDACTION_ENABLED: "true" + " ".repeat(5000) })).toBe(false);
  });
  it("éteint = AUCUN appel, rien d'écrit", async () => {
    const { d, appeler, magasin } = deps(JSON.stringify(contenuBon), { env: {} });
    const r = await redigerBrouillonGuide("essai", d);
    expect(r).toMatchObject({ ok: false, raison: "interrupteur_eteint" });
    expect(appeler).not.toHaveBeenCalled();
    expect(magasin.size).toBe(0);
  });
});

describe("G2 · rédaction", () => {
  it("succès : modèle claude-sonnet-5-5, statut « À valider », jamais « validé »", async () => {
    const { d, appeler, magasin } = deps(JSON.stringify(contenuBon));
    const r = await redigerBrouillonGuide("essai", d);
    expect(MODELE_REDACTION_GUIDE).toBe("claude-sonnet-5-5");
    expect(r).toMatchObject({ ok: true, version: 1, statut: "À valider", empreinte: empreinteGuide(contenuBon) });
    expect(appeler).toHaveBeenCalledTimes(1);
    const [requete, cle] = appeler.mock.calls[0] as unknown as [{ modele: string; systeme: { texte: string }[] }, string];
    expect(requete.modele).toBe("claude-sonnet-5-5");
    expect(cle).toBe("cle-fictive-test");
    expect(JSON.stringify(requete)).toContain("vouvoi"); // la consigne impose le vouvoiement
    const stocke = JSON.stringify([...magasin.values()]);
    expect(stocke).toContain("À valider");
    expect(stocke.toLowerCase()).not.toContain('"statut":"validé"');
  });
  it("tolère une clôture Markdown autour du JSON", async () => {
    const { d } = deps("```json\n" + JSON.stringify(contenuBon) + "\n```");
    expect((await redigerBrouillonGuide("essai", d)).ok).toBe(true);
  });
  it("versionne : un second brouillon devient la version 2, le premier reste", async () => {
    const { d, magasin } = deps(JSON.stringify(contenuBon));
    await redigerBrouillonGuide("essai", d);
    const r2 = await redigerBrouillonGuide("essai", d);
    expect(r2).toMatchObject({ ok: true, version: 2 });
    const valeur = [...magasin.values()][0] as { versions: { version: number }[] };
    expect(valeur.versions.map((v) => v.version)).toEqual([1, 2]);
  });
  it("panne de Claude : rien d'enregistré, raison claire", async () => {
    const { d, magasin } = deps(new ErreurClaude("reseau", "coupure", undefined, true));
    const r = await redigerBrouillonGuide("essai", d);
    expect(r).toMatchObject({ ok: false, raison: "panne_claude" });
    expect(magasin.size).toBe(0);
  });
  it("panne inattendue (exception quelconque) : jamais propagée", async () => {
    const { d } = deps(new Error("boum"));
    expect(await redigerBrouillonGuide("essai", d)).toMatchObject({ ok: false, raison: "panne_claude" });
  });
  it("réponse illisible : rien d'enregistré", async () => {
    for (const texte of ["pas du json", "{}", JSON.stringify({ titre: "T", sections: [] }), ""]) {
      const { d, magasin } = deps(texte);
      expect(await redigerBrouillonGuide("essai", d)).toMatchObject({ ok: false, raison: "reponse_illisible" });
      expect(magasin.size).toBe(0);
    }
  });
  it("texte refusé par G1 : rien d'enregistré, règle nommée, aucun extrait dans la sortie ni le journal", async () => {
    const mauvais = { titre: "T", sections: [{ titre: "S", paragraphes: ["Rejoignez nos abonnés à Grenoble"], puces: [] }] };
    const { d, magasin, journal } = deps(JSON.stringify(mauvais));
    const r = await redigerBrouillonGuide("essai", d);
    expect(r).toMatchObject({ ok: false, raison: "texte_refuse", regle: "abonne" });
    expect(magasin.size).toBe(0);
    expect(JSON.stringify(r) + journal.join("\n")).not.toContain("Grenoble");
  });
  it("sans clé : aucun appel", async () => {
    const { d, appeler } = deps(JSON.stringify(contenuBon), { choisirCle: async () => null });
    expect(await redigerBrouillonGuide("essai", d)).toMatchObject({ ok: false, raison: "cle_absente" });
    expect(appeler).not.toHaveBeenCalled();
  });
  it("mot invalide (vide, trop long, caractères de contrôle) : aucun appel", async () => {
    for (const mot of ["", "   ", "a".repeat(61), "a\u0000b", "x\ny"]) {
      const { d, appeler } = deps(JSON.stringify(contenuBon));
      expect(await redigerBrouillonGuide(mot, d)).toMatchObject({ ok: false, raison: "mot_invalide" });
      expect(appeler).not.toHaveBeenCalled();
    }
  });
  it("journal sans donnée de personne ni texte du guide ni clé", async () => {
    const { d, journal } = deps(JSON.stringify(contenuBon));
    await redigerBrouillonGuide("essai", d);
    const tout = journal.join("\n");
    expect(journal.length).toBeGreaterThan(0);
    expect(tout).not.toContain("cle-fictive-test");
    expect(tout).not.toContain("relire le sujet");
  });
  it("échec d'écriture du paramètre : résultat d'échec, pas d'exception", async () => {
    const { d } = deps(JSON.stringify(contenuBon), { ecrireParametre: async () => { throw new Error("base"); } });
    expect(await redigerBrouillonGuide("essai", d)).toMatchObject({ ok: false, raison: "enregistrement_echec" });
  });
});
