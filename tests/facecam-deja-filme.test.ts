/**
 * « J'AI DÉJÀ FILMÉ MA VIDÉO » (retour prod du 09/10). Will a filmé sa vidéo face caméra à l'iPhone et colle le texte
 * qu'il a dit : `creerVersionFacecamDepuisTexte` crée, sans aucun appel Claude, une version facecam « je lis » validée
 * dont le texte est EXACTEMENT le sien ; l'écran d'envoi la trouve, la réception range la prise et lance le montage.
 * Aucun réseau : `fetch` est interdit pendant tout le fichier.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { variablesDuCatalogue } from "@/fournisseurs/catalogue";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.setConfig({ testTimeout: 60_000 });

const MDP = "essai-facecam-deja-filme";
const environnementDepart = { ...process.env };
const fetchDepart = globalThis.fetch;

const TEXTE = `Vous perdez deux heures par jour sur vos e-mails ? Moi aussi, avant.
Aujourd'hui je vous montre comment l'IA trie ma boîte en 5 minutes… Sans rien installer !
Abonnez-vous pour la suite.`;

/** Serveur d'alignement face caméra « posé » (valeur d'essai : rien n'est appelé, la chaîne n'avance pas ici). */
const ALIGNEUR = { STUDIO_ALIGNEUR_URL: "http://aligneur.essai:4200" };

async function charger(env: Record<string, string> = {}) {
  vi.resetModules();
  for (const n of Object.keys(process.env)) if (n.startsWith("FOURNISSEUR_") || n.startsWith("MOTEUR_")) delete process.env[n];
  delete process.env.STUDIO_ALIGNEUR_URL;
  for (const n of variablesDuCatalogue()) delete process.env[n];
  Object.assign(process.env, env);
  const memoire = await import("@/donnees/memoire");
  memoire.reinitialiserDepots();
  reinitialiserRequete();
  const auth = await import("@/services/auth");
  await auth.seConnecter(MDP, false);
  (await import("@/services/boucle-generation")).suspendreBoucleGeneration(true);
  return {
    depots: memoire.depots,
    envoi: await import("@/services/envoi-facecam"),
    derivations: await import("@/domaine/derivations-generateur"),
    chaine: await import("@/generateur/chaine"),
  };
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
  globalThis.fetch = (() => {
    throw new Error("fetch interdit dans ce test");
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = fetchDepart;
  process.env = { ...environnementDepart };
  vi.resetModules();
});

describe("facecam · « J'ai déjà filmé ma vidéo »", () => {
  it("crée une version facecam « je lis » validée, numérotée, au texte EXACT de Will, sans écriture", async () => {
    const r = await charger();
    const { varianteId } = await r.envoi.creerVersionFacecamDepuisTexte(TEXTE, "Mes e-mails triés par l'IA");
    expect(varianteId).toMatch(/^var/);
    const v = (await r.depots().variantes.obtenir(varianteId))!;
    expect(v.formatId).toBe("facecam");
    expect(v.etat).toBe("validee");
    expect(v.avisWill?.resultat).toBe("valide");
    expect(v.code).toMatch(/^\d{4}-FC-TT-L$/);
    const m = (await r.depots().scriptsMaitres.obtenir(v.scriptMaitreId))!;
    expect(m.numero).toBeGreaterThan(0);
    expect(v.code.startsWith(String(m.numero).padStart(4, "0"))).toBe(true);
    expect(m.brief.idee).toBe("Mes e-mails triés par l'IA");

    // Le texte validé est celui de Will, mot pour mot (seuls les sauts de ligne deviennent des espaces).
    const script = (await r.depots().scripts.obtenir(v.scriptId))!;
    const dit = r.derivations.texteDesBlocs(r.derivations.assemblerBlocs(script, v));
    expect(dit).toBe(TEXTE.replace(/\s+/g, " ").trim());
    expect(script.blocs[0].segments.map((s) => s.texte)).toEqual([
      "Vous perdez deux heures par jour sur vos e-mails ?",
      "Moi aussi, avant.",
      "Aujourd'hui je vous montre comment l'IA trie ma boîte en 5 minutes…",
      "Sans rien installer !",
      "Abonnez-vous pour la suite.",
    ]);
    // Téléprompteur mis en forme par le code, comme la chaîne ; on y relit exactement les mêmes mots.
    expect(v.prompteur).toBe(r.chaine.miseEnFormePrompteur(script.blocs));
    const relu = v.prompteur!.split("\n").map((l) => l.replace(/^\d+\. /, "").replaceAll(" / ", " ")).join(" ");
    expect(relu).toBe(dit);

    // Aucune écriture par la chaîne : aucune génération, aucune dépense.
    expect(await r.depots().generations.lister((g) => g.scriptMaitreId === m.id)).toEqual([]);
  });

  it("texte vide : accepté (script facultatif, 18/10), version créée sans texte", async () => {
    const r = await charger();
    const { varianteId } = await r.envoi.creerVersionFacecamDepuisTexte("  \n ");
    expect((await r.depots().variantes.obtenir(varianteId))?.formatId).toBe("facecam");
  });

  it("l'écran d'envoi la trouve ; la réception range la prise et lance le montage « je lis », sans Claude", async () => {
    const r = await charger(ALIGNEUR);
    const { varianteId } = await r.envoi.creerVersionFacecamDepuisTexte(TEXTE);
    const vue = await r.envoi.vueEnvoiFacecam(varianteId);
    expect(vue).toMatchObject({ varianteId, dejaRecue: false, titre: "Vous perdez deux heures par jour sur vos e-mails ?" });
    expect((await r.envoi.versionsFacecamAEnvoyer()).map((x) => x.varianteId)).toContain(varianteId);

    const t = new Date().toISOString();
    await r.depots().fichiers.enregistrer({ id: "f-prise-deja-filme", cleStockage: "studio/prod/rushs/f-prise-deja-filme.mov", nom: "IMG_0042.MOV", mime: "video/quicktime", taille: 80_000_000, dureeSec: 31, origine: "envoi", statut: "pret", creeLe: t, modifieLe: t } as never);
    const recu = await r.envoi.recevoirVideoFacecam(varianteId, "f-prise-deja-filme", 31, "Un zoom sur « 5 minutes »");
    expect(recu.enAttente).toBeUndefined();
    expect(recu.travailId).toBeTruthy();

    const v = (await r.depots().variantes.obtenir(varianteId))!;
    expect(v.videoId).toBe(recu.videoId);
    const video = (await r.depots().videos.obtenir(recu.videoId))!;
    const entrees = video.entrees as { prises: { fichierId: string }[]; facecam?: { consignes: { texte: string }[] } };
    expect(entrees.prises.map((p) => p.fichierId)).toEqual(["f-prise-deja-filme"]);
    expect(entrees.facecam?.consignes.map((c) => c.texte)).toEqual(["Un zoom sur « 5 minutes »"]);
    // Le script de la vidéo (source des sous-titres « je lis ») est le texte de Will.
    const s = (await r.depots().scripts.obtenir(video.scriptId!))!;
    expect(r.derivations.texteDesBlocs(s.blocs)).toBe(TEXTE.replace(/\s+/g, " ").trim());
    // Le montage est parti : un travail de fabrication, aucune génération Claude.
    expect(await r.depots().travaux.obtenir(recu.travailId!)).toBeTruthy();
    expect(await r.depots().generations.lister()).toEqual([]);
    expect((await r.envoi.vueEnvoiFacecam(varianteId))?.dejaRecue).toBe(true);
  });

  it("serveur de montage non relié : la vidéo est bien reçue et rangée, la raison est dite simplement", async () => {
    const r = await charger();
    const { varianteId } = await r.envoi.creerVersionFacecamDepuisTexte(TEXTE);
    const t = new Date().toISOString();
    await r.depots().fichiers.enregistrer({ id: "f-prise-2", cleStockage: "studio/prod/rushs/f-prise-2.mov", nom: "IMG_0043.MOV", mime: "video/quicktime", taille: 80_000_000, dureeSec: 31, origine: "envoi", statut: "pret", creeLe: t, modifieLe: t } as never);
    const recu = await r.envoi.recevoirVideoFacecam(varianteId, "f-prise-2", 31);
    expect(recu.travailId).toBeUndefined();
    expect(recu.enAttente).toContain("pas relié");
    expect((await r.depots().variantes.obtenir(varianteId))?.videoId).toBe(recu.videoId);
    expect(await r.depots().generations.lister()).toEqual([]);
  });

  it("écran : « J'ai déjà filmé ma vidéo » se propose en un bouton (vouvoiement, très peu de texte)", async () => {
    const { DejaFilme } = await import("@/components/facecam/DejaFilme");
    const html = renderToStaticMarkup(createElement(DejaFilme));
    expect(html).toContain("J&#x27;ai déjà filmé ma vidéo");
    expect(html).not.toMatch(/\btu\b/i);
  });
});
