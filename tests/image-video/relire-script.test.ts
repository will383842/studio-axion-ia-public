/**
 * Image → vidéo sur l'écran commun « Relire le script » (réglage `imageVideo.relireScript`, ÉTEINT par défaut).
 * Tout est SIMULÉ (doubles de la machine, aucun appel payant) ; les écrans sont rendus en HTML statique.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Travail } from "@/domaine/types";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/image-video" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("@/services/auth", async (orig) => ({ ...(await orig<typeof import("@/services/auth")>()), exigerSession: async () => ({ utilisateurId: "will" }) }));

const { avancerJusquAArretIV, etatInitialIV, validerCarteIV } = await import("@/moteurs/montage-image-video/fabrication");
const { controlerScriptIV } = await import("@/moteurs/montage-image-video/controle-script");
const vue = await import("@/components/formats/image-video/vue");
const relire = await import("@/components/formats/image-video/relire");
const ecran = await import("@/services/image-video-ecran");
const { ScriptEcrans } = await import("@/components/formats/image-video/ScriptEcrans");
const { ScriptRelireIV } = await import("@/components/formats/image-video/ScriptRelireIV");

const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

async function auScript() {
  const carte = carteFixe("C");
  const o = outilsSimules(carte, monde());
  let e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte)), o);
  e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), o);
  expect(e.etape).toBe("script-a-valider");
  const travail = { id: "trav-1", type: "fabrication", cibleId: "v-1", versionId: "ver-1", titre: "Essai", etapes: [], statut: "echec", progression: 0, tentatives: 1, cleIdempotence: "k", creeLe: "2026-10-15T08:00:00.000Z", modifieLe: "2026-10-15T08:00:00.000Z", parametres: { imageVideo: e } } as unknown as Travail;
  return { e, travail };
}

describe("Image → vidéo : réglage `imageVideo.relireScript`", () => {
  it("le réglage est éteint par défaut et porte le nom attendu", () => {
    expect(ecran.PARAM_RELIRE_SCRIPT_IV).toBe("imageVideo.relireScript");
  });

  it("éteint : la vue ne demande pas l'écran commun ; allumé : elle le demande", async () => {
    const { travail } = await auScript();
    const video = async () => ({ id: "v-1", titre: "Essai", formatId: "image-video", entrees: {} });
    const eteint = await ecran.vueImageVideo("v-1", { video, travail: async () => travail, url: async () => null, relireScript: async () => false });
    const allume = await ecran.vueImageVideo("v-1", { video, travail: async () => travail, url: async () => null, relireScript: async () => true });
    expect(eteint!.script!.relireScript).toBeUndefined();
    expect(allume!.script!.relireScript).toBe(true);
  });

  it("éteint : l'ancien écran est rendu tel quel ; allumé : l'écran « Relire le script » (une carte par écran, prix sur le bouton)", async () => {
    const { travail } = await auScript();
    const s = ecran.construireVueImageVideo({ id: "v-1", titre: "Essai" }, travail, null).script!;
    const ancien = renderToStaticMarkup(createElement(ScriptEcrans, { videoId: "v-1", ...s }));
    expect(ancien).not.toContain('aria-label="Relire le script"');
    expect(texte(ancien)).toContain("Modifier le script");

    const html = renderToStaticMarkup(createElement(ScriptRelireIV, { videoId: "v-1", ...s }));
    const t = texte(html);
    expect(html).toContain('aria-label="Relire le script"');
    // Une phrase par écran, plus celle de la question de commentaire seulement dans le réglage « question puis fin » (le défaut depuis le 26/10/2026 est « fin seule »).
    expect(html.match(/aria-label="Modifier la phrase \d+"/g)).toHaveLength(s.fiche.ecrans.length);
    const auPlus = vue.euros(Math.max(s.prix.auPlusCentimes, s.prix.habituelCentimes));
    expect(t).toContain(`Valider et fabriquer (au plus ${auPlus})`);
    for (const ec of s.fiche.ecrans) expect(t).toContain(ec.texteDit.slice(0, 20));
    expect(t).toContain(s.fiche.accroches[1].texteDit);
  });

  it("l'adaptateur : lignes par écran + question, modifications au format de la validation, rien changé = rien envoyé", async () => {
    const { e } = await auScript();
    const f = e.propositionScript!.fiche;
    const depart = relire.lignesRelireIV(f, true);
    expect(depart).toHaveLength(f.ecrans.length + 1);
    expect(relire.lignesRelireIV(f, false)).toHaveLength(f.ecrans.length);
    expect(relire.modificationsDesLignesIV(depart, depart)).toEqual({ ecrans: {} });
    const relues = depart.map((l) => (l.id === f.ecrans[0].id ? { ...l, dit: `${l.dit} Ajout.` } : l.id === "question" ? { ...l, dit: "Et vous, qu'en pensez-vous ?" } : l));
    const m = relire.modificationsDesLignesIV(depart, relues);
    expect(m.question).toBe("Et vous, qu'en pensez-vous ?");
    expect(Object.keys(m.ecrans)).toEqual([f.ecrans[0].id]);
    const d = vue.scriptValideParWill(f, e.propositionScript!.formules, { ...m, formules: {} });
    expect(d.fiche!.ecrans[0].texteDit).toContain("Ajout.");
    expect(d.fiche!.questionCommentaire.texteDit).toBe("Et vous, qu'en pensez-vous ?");
  });

  it("contrôles en direct GRATUITS : le script proposé n'a aucun blocage ; un script abîmé bloque, avec la ligne concernée", async () => {
    const { e } = await auScript();
    const choixFormules = Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const]));
    expect(controlerScriptIV(e, { choixFormules }).filter((p) => p.niveau === "bloquant")).toEqual([]);
    const f = structuredClone(e.propositionScript!.fiche);
    f.ecrans[0].texteDit = "Certifié Certifexemple, garanti à 100 %.";
    const pastilles = controlerScriptIV(e, { fiche: f, choixFormules });
    expect(pastilles.some((p) => p.niveau === "bloquant")).toBe(true);
    expect(controlerScriptIV(e, { fiche: { ecrans: [] } }).map((p) => p.code)).toEqual(["script-incomplet"]);
    expect(controlerScriptIV({ ...e, etape: "voix" }, {})).toEqual([]);
  });

  it("socle qualité commun : l'observation donne des pastilles « info » sans jamais bloquer", async () => {
    const { e } = await auScript();
    const f = e.propositionScript!.fiche;
    const pastilles = relire.observerIV(f, true)(relire.lignesRelireIV(f, true));
    expect(pastilles.every((p) => p.niveau === "info")).toBe(true);
  });
});
