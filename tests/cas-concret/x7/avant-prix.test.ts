/**
 * X7 · L'écran contrôle avant le prix tout ce que la fabrication contrôle sans payer. Pour chaque refus possible sans
 * appel payant : `estimerCas` (ce que lit la feuille « Votre vidéo ») le rend, la feuille l'affiche et son bouton est
 * inactif ; `preparerEtLancer` refuse avec la MÊME phrase, sans rien créer ni lancer (coût 0) ; le moteur, quand la
 * commande porte de quoi le voir, refuse au lancement avec la même phrase. Base en mémoire, aucun `fetch`.
 */
import { hash } from "@node-rs/argon2";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
// La fin « diagnostic » de LinkedIn rendue inutilisable dans ce fichier : LinkedIn n'a plus de fin.
vi.mock("@/briques/fins/table-diagnostic", async (original) => {
  const m = await original<typeof import("@/briques/fins/table-diagnostic")>();
  return { ...m, TABLE_FINS_DIAGNOSTIC: m.TABLE_FINS_DIAGNOSTIC.map((l) => (l.id === "fin-li-diagnostic-gratuit" ? { ...l, validee: false } : l)) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret");
const mots = await import("@/services/cas-concret-mots");
const { CATALOGUE } = await import("@/formats/cas-concret/catalogue");
const { empreinteCas } = await import("@/formats/cas-concret/cas");
const { PHRASES_AVANT_PRIX, phraseSansFin, refusAvantPrix } = await import("@/moteurs/montage-cas-concret/avant-prix");
const { creerMoteurMontageCasConcret } = await import("@/moteurs/montage-cas-concret");
const { PHRASES_ECRAN_FOURNI } = await import("@/moteurs/montage-cas-concret/captures");
const { PiedVotreVideo } = await import("../../../src/components/formats/cas-concret/entree/FeuilleVotreVideo");

import type { CasConcret } from "@/formats/cas-concret/cas";
import type { CommandeFabrication } from "@/domaine/types";
import { RELU_RECRUTEMENT } from "../../helpers/script-relu";

const MDP = "cas-concret-x7";
const SANS_LINKEDIN = ["facebook", "instagram", "tiktok"];
const VALIDE = "recrutement-apporteurs";

/** Cas fabriqués pour ce test, ajoutés au catalogue le temps du fichier. */
const base = CATALOGUE.find((c) => c.id === VALIDE)!;
const variantes: CasConcret[] = [
  { ...structuredClone(base), id: "x7-invalide", etapes: base.etapes.slice(0, 2) },
  { ...structuredClone(base), id: "x7-sans-source", faits: base.faits.map((f, i) => (i === 0 ? { ...f, preuve: "" } : f)) },
  { ...structuredClone(base), id: "x7-conformite", conformite: undefined, resteHumain: "Vous gardez la main : tout reste conforme." },
];

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
  (CATALOGUE as CasConcret[]).push(...variantes);
});
afterAll(() => {
  (CATALOGUE as CasConcret[]).splice(CATALOGUE.length - variantes.length, variantes.length);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  await voixAvocat(true);
  lancer.mockClear();
});

async function voixAvocat(prete: boolean) {
  const d = depots();
  const voix = (await d.voix.obtenir("voix-will"))!;
  if (prete) await d.voix.enregistrer({ ...voix, id: "voix-avocat-test", nom: "Voix avocat", statut: "pret" });
  // X8 : la voix habituelle suffit ; « pas prête » veut dire aucune voix prête de HeyGen.
  else for (const v of await d.voix.lister((v) => v.personnageId === "p-will")) await d.voix.modifier(v.id, { statut: "brouillon" });
  await d.personnages.modifier("p-will", { voixParDefautId: "voix-will", voixParFormat: prete ? { avocat: "voix-avocat-test" } : {} });
}

const lancer = vi.fn(async () => ({ travailId: "t-x7" }));
const videosCas = async () => depots().videos.lister((v) => v.formatId === "cas-concret");

const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

/** La feuille affiche le refus et son bouton est inactif. */
function feuilleBloquee(phrase: string) {
  const html = renderToStaticMarkup(createElement(PiedVotreVideo, { montant: 60, refus: null, blocage: phrase, desactive: false, onFabriquer: async () => undefined }));
  expect(texte(html)).toContain(phrase);
  expect(html).toMatch(BOUTON_INACTIF);
}

/** L'attribut `disabled` du bouton (et non la classe « disabled:… »). */
const BOUTON_INACTIF = /<button[^>]*\sdisabled(=""|\s|>)/;

interface Scenario {
  nom: string;
  casId: string;
  reseaux?: string[];
  mot?: string;
  avecMot?: boolean;
  essai?: boolean;
  empreinteVue?: string;
  avant?: () => Promise<void>;
  phrase: string;
  /** Le moteur voit ce refus sur la commande seule (cas, réseaux, empreinte). */
  moteur?: boolean;
}

const SCENARIOS: Scenario[] = [
  { nom: "cas invalide", casId: "x7-invalide", phrase: PHRASES_AVANT_PRIX.casInvalide, moteur: true },
  { nom: "fait sans source", casId: "x7-sans-source", phrase: PHRASES_AVANT_PRIX.faitSansSource, moteur: true },
  { nom: "cas périmé (empreinte vue différente)", casId: VALIDE, empreinteVue: "cas-ancienne", phrase: PHRASES_AVANT_PRIX.casChange, moteur: true },
  { nom: "cas non validé hors essai", casId: "devis-signe-alerte", phrase: PHRASES_AVANT_PRIX.nonValide },
  { nom: "voix pas prête", casId: VALIDE, avant: () => voixAvocat(false), phrase: PHRASES_AVANT_PRIX.voix },
  { nom: "réseau sans fin utilisable", casId: VALIDE, reseaux: ["facebook", "linkedin"], phrase: phraseSansFin(["linkedin"]), moteur: true },
  { nom: "phrase de conformité absente du cas", casId: "x7-conformite", phrase: PHRASES_AVANT_PRIX.conformite, moteur: true },
  { nom: "mot invalide", casId: VALIDE, mot: "deux mots", avecMot: true, phrase: PHRASES_AVANT_PRIX.motInvalide, moteur: true },
  {
    nom: "mot déjà pris",
    casId: "rappels-rendez-vous",
    mot: "IA",
    avecMot: true,
    essai: true,
    avant: async () => {
      await mots.poserBranchementMot("IA", "instagram", "branche", "2026-10-12");
      expect((await service.preparerEtLancer({ casId: VALIDE, reseaux: SANS_LINKEDIN, mot: "IA", avecMot: true, accordCentimes: 10_000, empreinteScriptRelu: RELU_RECRUTEMENT }, { lancer })).statut).toBe("lancee");
      lancer.mockClear();
    },
    phrase: PHRASES_AVANT_PRIX.motPris,
  },
  {
    // P3 (P2C) : une image déposée pour une étape qui n'est pas un écran réel (gardée sans le contrôle de `poserEcranFourni`) ; réglage allumé dans la base de test seulement.
    nom: "écran fourni pour une étape sans écran réel",
    casId: VALIDE,
    avant: async () => {
      const { ecrireParametre } = await import("@/services/_commun");
      const { PARAM_ECRANS_FOURNIS } = await import("@/components/formats/cas-concret/ecran-fourni/service");
      await ecrireParametre("casConcret.ecranFourni", true);
      await ecrireParametre(PARAM_ECRANS_FOURNIS, { [VALIDE]: [{ etapeCas: 1, cle: "studio/dev/entree/e1.png", mime: "image/png", masques: [], attesteLe: "2026-10-13T00:00:00.000Z" }] });
    },
    phrase: PHRASES_ECRAN_FOURNI.etapeInconnue,
  },
];

function commande(s: Scenario, empreinte: string | undefined): CommandeFabrication {
  return {
    versionContrat: 2,
    moteurId: "montage-cas-concret",
    videoId: "v-x7",
    formatId: "cas-concret",
    distribution: [{ role: "voix", source: "double", personnageId: "p-will", voixId: "voix-avocat-test" }],
    entrees: { casConcret: { casId: s.casId, porte: "A", mot: s.mot ?? "IA", avecMot: s.avecMot ?? false, reseaux: s.reseaux ?? SANS_LINKEDIN, essai: s.essai ?? false, ...(empreinte ? { empreinteCas: empreinte } : {}) } },
  } as unknown as CommandeFabrication;
}

describe("X7 · un refus sans dépense est dit avant le prix, avec la même phrase partout", () => {
  it.each(SCENARIOS.map((s) => [s.nom, s] as const))("%s", async (_nom, s) => {
    await s.avant?.();
    const avant = (await videosCas()).length;
    const reseaux = s.reseaux ?? SANS_LINKEDIN;
    const choix = { mot: s.mot ?? "IA", essai: s.essai ?? false, ...(s.empreinteVue ? { empreinteVue: s.empreinteVue } : {}) };

    // La feuille : `estimerCas` rend le refus ; la feuille l'affiche, bouton inactif.
    const e = await service.estimerCas(s.casId, reseaux, s.avecMot ?? false, choix);
    expect(e.refus).toBe(s.phrase);
    feuilleBloquee(s.phrase);

    // Le lancement : même phrase, rien de créé, rien de lancé (coût 0).
    const r = await service.preparerEtLancer({ casId: s.casId, reseaux, avecMot: s.avecMot ?? false, accordCentimes: 10_000, ...choix }, { lancer });
    expect(r).toEqual({ statut: "refusee", phrase: s.phrase });
    expect(lancer).not.toHaveBeenCalled();
    expect(await videosCas()).toHaveLength(avant);

    // Le moteur, sur la commande seule : même phrase, avant toute réservation.
    if (s.moteur) {
      const cas = CATALOGUE.find((c) => c.id === s.casId)!;
      const refus = creerMoteurMontageCasConcret({ outils: () => undefined as never }).refusAuLancement!(commande(s, s.empreinteVue ?? empreinteCas(cas)));
      expect(refus?.message).toBe(s.phrase);
    }
  });

  it("aucun refus : le prix est montré, le bouton actif ; les fins de LinkedIn rétablies ne bloquent plus", async () => {
    const e = await service.estimerCas(VALIDE, SANS_LINKEDIN, false, { mot: "IA" });
    expect(e.refus).toBeUndefined();
    // V4-3 : le cas validé rejoue son script (aucune écriture à payer) et la voix d'essai est gratuite : le prix est
    // celui de la voix seule, montré tel quel.
    expect(e.centimes).toBeGreaterThanOrEqual(0);
    expect(e.phrase).toMatch(/^environ .*€/);
    const html = renderToStaticMarkup(createElement(PiedVotreVideo, { montant: e.centimes, refus: null, blocage: null, desactive: false, onFabriquer: async () => undefined }));
    expect(html).not.toMatch(BOUTON_INACTIF);
  });

  it("cas absent : la même phrase au lancement et dans la fonction pure", async () => {
    expect(await service.preparerEtLancer({ casId: "inconnu", reseaux: SANS_LINKEDIN, mot: "IA", avecMot: false, accordCentimes: 10_000 }, { lancer })).toEqual({ statut: "refusee", phrase: PHRASES_AVANT_PRIX.casAbsent });
    expect(refusAvantPrix({ cas: undefined, reseaux: ["facebook"], mot: "IA", avecMot: false, motSur: [], essai: false })).toBe(PHRASES_AVANT_PRIX.casAbsent);
  });

  it("aucun réseau : la même phrase partout", async () => {
    expect((await service.estimerCas(VALIDE, [], false)).refus).toBe(PHRASES_AVANT_PRIX.sansReseau);
    expect(await service.preparerEtLancer({ casId: VALIDE, reseaux: [], mot: "IA", avecMot: false, accordCentimes: 10_000 }, { lancer })).toEqual({ statut: "refusee", phrase: PHRASES_AVANT_PRIX.sansReseau });
  });

  it("les phrases ne portent aucun identifiant technique", () => {
    for (const p of [...Object.values(PHRASES_AVANT_PRIX), phraseSansFin(["linkedin", "facebook"])]) {
      expect(p).not.toMatch(/\b(cas|fin|x7)-[a-z]|CAS_|undefined|null/);
      for (const c of CATALOGUE) expect(p).not.toContain(c.id);
      expect(p).toMatch(/\.$/);
    }
  });
});
