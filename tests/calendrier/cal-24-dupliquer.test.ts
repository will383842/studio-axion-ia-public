/**
 * CAL-24 (écrite EN AVANCE, attend CAL-22, CAL-23 et RC-08a) : dupliquer une publication vers un autre réseau ou une autre date,
 * et lien « Voir sur le réseau ».
 * AUCUN appel réel : dépôts en mémoire, `fetch` espionné (il ne doit jamais être appelé), rien n'est allumé.
 * Règles : la copie naît « propose » (jamais programmée ni validée toute seule), son texte est marqué « À adapter », l'original ne change pas,
 * rien n'est supprimé, une date passée avertit.
 */
import { readFileSync } from "node:fs";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reinitialiserDepots } from "@/donnees/memoire";
import { depots, lireParametre } from "@/services/_commun";
import type { Publication } from "@/domaine/types";

const exigerSession = vi.hoisted(() => vi.fn(async () => ({ id: "fondateur-1" })));
vi.mock("@/services/auth", () => ({ exigerSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/(studio)/calendrier/charger-comptes", () => ({ comptesCibles: async (r: string[]) => Object.fromEntries(r.filter((x) => x !== "facebook").map((x) => [x, `compte-${x}`])) }));
vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("../aides/crochets-factices")).crochets }));

const { dupliquerEntree, PHRASES_DUPLICATION } = await import("@/app/(studio)/calendrier/actions/dupliquer");
const { LIBELLE_VOIR_SUR_RESEAU, MARQUE_A_ADAPTER, cleLienCopie, lienVoirSurReseau, marquerAAdapter } = await import("@/domaine/calendrier/lien-reseau");
const { monter, trouver, texteDe, attendre } = await import("../aides/crochets-factices");

const MAINTENANT = "2026-12-10T10:00:00.000Z";
const ORIGINAL = {
  id: "cre_1", jourVise: "2026-12-15", heuresParReseau: { linkedin: "2026-12-15T08:30:00.000Z" }, compteCible: "compte-linkedin", videoId: "vid_1",
  statut: "programme", decalages: 0, valideeLe: "2026-12-01T00:00:00.000Z", valideePar: "fondateur-1",
  textes: { linkedin: { texte: "Le texte d'origine.", premierCommentaire: "Et vous ?" } },
} as const;
const CLE_ORIGINALE = "creneau:cre_1|linkedin";
const saisie = (sur: Record<string, unknown> = {}) => ({ cle: CLE_ORIGINALE, reseau: "instagram" as const, jour: "2026-12-20", cleFormulaire: "form1", ...sur });

let fetchEspion: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(MAINTENANT));
  reinitialiserDepots();
  exigerSession.mockClear();
  fetchEspion = vi.fn(async () => { throw new Error("aucun appel réel attendu"); });
  vi.stubGlobal("fetch", fetchEspion);
  await depots().creneauxEditoriaux.enregistrer(structuredClone(ORIGINAL) as never);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const tousLesCreneaux = async () => (await depots().creneauxEditoriaux.lister()) as unknown as Record<string, unknown>[];
const copies = async () => (await tousLesCreneaux()).filter((c) => c.id !== "cre_1");

describe("CAL-24 · dupliquer un créneau", () => {
  it("crée une NOUVELLE entrée « propose » sur le réseau et le jour choisis ; l'original ne bouge pas", async () => {
    const avant = JSON.stringify(await depots().creneauxEditoriaux.obtenir("cre_1"));
    const r = await dupliquerEntree(saisie());
    expect(r.ok).toBe(true);
    const [copie] = await copies();
    expect(copie).toBeDefined();
    expect(copie!.id).not.toBe("cre_1");
    expect(copie!.statut).toBe("propose");
    expect(copie!.jourVise).toBe("2026-12-20");
    expect(Object.keys(copie!.heuresParReseau as object)).toEqual(["instagram"]);
    expect(copie!.videoId).toBe("vid_1");
    expect(copie!.compteCible).toBe("compte-instagram");
    expect(JSON.stringify(await depots().creneauxEditoriaux.obtenir("cre_1"))).toBe(avant);
    expect(await tousLesCreneaux()).toHaveLength(2); // rien n'est supprimé
  });

  it("le texte de la copie est marqué « À adapter », le texte d'origine est gardé après la marque", async () => {
    await dupliquerEntree(saisie());
    const [copie] = await copies();
    const t = (copie!.textes as Record<string, { texte: string; premierCommentaire: string }>).instagram!;
    expect(t.texte.startsWith(MARQUE_A_ADAPTER)).toBe(true);
    expect(t.texte).toContain("Le texte d'origine.");
  });

  it("jamais programmée ni validée toute seule : pas de date de validation, pas d'envoi planifié, aucun appel réseau", async () => {
    await dupliquerEntree(saisie());
    const [copie] = await copies();
    expect(["programme", "publie", "valide", "a_valider"]).not.toContain(copie!.statut);
    expect(copie!.valideeLe).toBeUndefined();
    expect(copie!.valideePar).toBeUndefined();
    expect(await depots().envoisPlanifies.lister()).toHaveLength(0);
    expect(fetchEspion).not.toHaveBeenCalled();
  });

  it("garde le lien vers l'original", async () => {
    const r = await dupliquerEntree(saisie());
    if (!r.ok) throw new Error("attendu : ok");
    expect(await lireParametre(cleLienCopie(r.donnees.creneauId), null)).toBe(CLE_ORIGINALE);
  });

  it("même réseau, autre date : accepté ; le compte cible du réseau de l'original est gardé", async () => {
    const r = await dupliquerEntree(saisie({ reseau: "linkedin", jour: "2026-12-22" }));
    expect(r.ok).toBe(true);
    const [copie] = await copies();
    expect(copie!.compteCible).toBe("compte-linkedin");
    expect(Object.keys(copie!.heuresParReseau as object)).toEqual(["linkedin"]);
  });

  it("même réseau ET même jour que l'original : refusé avec une phrase claire, rien n'est écrit", async () => {
    const r = await dupliquerEntree(saisie({ reseau: "linkedin", jour: "2026-12-15" }));
    expect(r).toMatchObject({ ok: false, message: PHRASES_DUPLICATION.identique });
    expect(await copies()).toHaveLength(0);
  });

  it("date dans le passé : avertissement à confirmer, rien n'est écrit ; après confirmation, la copie est créée", async () => {
    const r = await dupliquerEntree(saisie({ jour: "2026-12-01" }));
    expect(r).toMatchObject({ ok: false, aConfirmer: "passe" });
    if (r.ok) throw new Error("attendu : avertissement");
    expect(r.avertissement).toMatch(/passée/);
    expect(await copies()).toHaveLength(0);
    const r2 = await dupliquerEntree(saisie({ jour: "2026-12-01", confirmerPasse: true }));
    expect(r2.ok).toBe(true);
    expect(await copies()).toHaveLength(1);
  });

  it("copie collée à une autre publication du même réseau : avertissement à confirmer, rien n'est écrit ; après confirmation, la copie est créée", async () => {
    await depots().creneauxEditoriaux.enregistrer({ id: "voisin", jourVise: "2026-12-20", heuresParReseau: { instagram: "2026-12-20T08:30:00.000Z" }, compteCible: "compte-instagram", videoId: "vid_2", statut: "propose", decalages: 0 } as never);
    const r = await dupliquerEntree(saisie({ jour: "2026-12-20", heure: "09:30" }));
    expect(r).toMatchObject({ ok: false });
    if (r.ok || !r.aConfirmer) throw new Error("attendu : avertissement de proximité ou de quota");
    expect(r.aConfirmer).toBe("proximite");
    expect(r.avertissement).toMatch(/Confirmez/);
    expect(await copies()).toHaveLength(1); // seulement le voisin
    const r2 = await dupliquerEntree(saisie({ jour: "2026-12-20", heure: "09:30", confirmerProximite: true }));
    expect(r2.ok).toBe(true);
    expect(await copies()).toHaveLength(2);
  });

  it("double clic (même clé de formulaire) : une seule copie", async () => {
    const a = await dupliquerEntree(saisie());
    const b = await dupliquerEntree(saisie());
    expect(a.ok && b.ok).toBe(true);
    expect(await copies()).toHaveLength(1);
    if (a.ok && b.ok) expect(b.donnees.creneauId).toBe(a.donnees.creneauId);
  });

  it("même clé de formulaire mais autre demande : refusé, la première copie reste telle quelle", async () => {
    await dupliquerEntree(saisie());
    const r = await dupliquerEntree(saisie({ reseau: "facebook" }));
    expect(r).toMatchObject({ ok: false, message: PHRASES_DUPLICATION.autreDemande });
    const toutes = await copies();
    expect(toutes).toHaveLength(1);
    expect(Object.keys(toutes[0]!.heuresParReseau as object)).toEqual(["instagram"]);
  });

  it("refuse sans rien écrire : clé de fiche illisible, réseau inconnu, jour invalide, clé de formulaire invalide, original introuvable", async () => {
    const P = PHRASES_DUPLICATION;
    for (const [mauvaise, phrase] of [
      [saisie({ cle: "n'importe quoi" }), P.original],
      [saisie({ reseau: "myspace" }), P.reseau],
      [saisie({ jour: "2026-02-30" }), P.jour],
      [saisie({ jour: "demain" }), P.jour],
      [saisie({ cleFormulaire: "a b" }), P.formulaire],
      [saisie({ cle: "creneau:inconnu|linkedin" }), P.original],
      [saisie({ heure: "25:99" }), P.heure],
    ] as const) {
      const r = await dupliquerEntree(mauvaise as never);
      expect(r, JSON.stringify(mauvaise)).toMatchObject({ ok: false, message: phrase });
    }
    expect(await copies()).toHaveLength(0);
  });

  it("écriture interrompue (la fiche échoue une fois) : le rejeu avec la même clé termine la copie, avec son lien, sans doublon", async () => {
    const parametres = depots().parametres;
    const reel = parametres.enregistrer.bind(parametres);
    let echec = true;
    const espion = vi.spyOn(parametres, "enregistrer").mockImplementation(async (e) => {
      if (echec && String((e as { id: string }).id).startsWith("calendrier.fiche.")) { echec = false; throw new Error("écriture impossible"); }
      return reel(e);
    });
    const premier = await dupliquerEntree(saisie());
    expect(premier).toMatchObject({ ok: false, message: PHRASES_DUPLICATION.impossible });
    const rejeu = await dupliquerEntree(saisie());
    espion.mockRestore();
    if (!rejeu.ok) throw new Error(`attendu : ok, reçu ${rejeu.message}`);
    expect(await copies()).toHaveLength(1);
    expect(await lireParametre(cleLienCopie(rejeu.donnees.creneauId), null)).toBe(CLE_ORIGINALE);
    const fiche = await lireParametre<{ texte?: string } | null>(`calendrier.fiche.${rejeu.donnees.cle}`, null);
    expect(fiche?.texte?.startsWith(MARQUE_A_ADAPTER)).toBe(true);
  });

  it("heure qui n'existe pas ce jour-là (changement d'heure) : la copie est créée et la phrase d'avertissement est rendue", async () => {
    const r = await dupliquerEntree(saisie({ jour: "2027-03-28", heure: "02:30" }));
    if (!r.ok) throw new Error("attendu : ok");
    expect(r.donnees.avertissement).toMatch(/n'existe pas/);
    const normal = await dupliquerEntree(saisie({ jour: "2026-12-21", cleFormulaire: "form2" }));
    if (!normal.ok) throw new Error("attendu : ok");
    expect(normal.donnees.avertissement).toBeUndefined();
  });

  it("quota atteint (un seul post par jour autorisé ailleurs que l'écart) : le quota est annoncé comme « quota »", async () => {
    // Plusieurs publications espacées le même jour sur le réseau : l'écart est respecté, le quota du jour est dépassé.
    for (const [i, h] of ["2026-12-20T01:00:00.000Z", "2026-12-20T05:00:00.000Z", "2026-12-20T13:00:00.000Z", "2026-12-20T17:00:00.000Z", "2026-12-20T21:00:00.000Z"].entries()) {
      await depots().creneauxEditoriaux.enregistrer({ id: `v${i}`, jourVise: "2026-12-20", heuresParReseau: { instagram: h }, compteCible: "compte-instagram", videoId: `vid_${i}`, statut: "propose", decalages: 0 } as never);
    }
    const r = await dupliquerEntree(saisie({ jour: "2026-12-20", heure: "11:00" }));
    if (r.ok || !r.aConfirmer) throw new Error("attendu : avertissement");
    expect(r.aConfirmer).toBe("quota");
  });

  it("même clé de formulaire mais autre heure : refusé, la copie garde son heure", async () => {
    await dupliquerEntree(saisie({ heure: "09:00" }));
    const r = await dupliquerEntree(saisie({ heure: "15:00" }));
    expect(r).toMatchObject({ ok: false, message: PHRASES_DUPLICATION.autreDemande });
    expect(await copies()).toHaveLength(1);
  });

  it("la fiche de la copie est écrite AVANT la copie : si elle échoue, aucune copie n'existe, et un nouvel essai réussit", async () => {
    const parametres = depots().parametres;
    const reel = parametres.enregistrer.bind(parametres);
    let echec = true;
    const espion = vi.spyOn(parametres, "enregistrer").mockImplementation(async (e) => {
      if (echec && String((e as { id: string }).id).startsWith("calendrier.fiche.")) { echec = false; throw new Error("écriture impossible"); }
      return reel(e);
    });
    expect(await dupliquerEntree(saisie())).toMatchObject({ ok: false, message: PHRASES_DUPLICATION.impossible });
    expect(await copies()).toHaveLength(0);
    const r = await dupliquerEntree(saisie({ cleFormulaire: "form-neuf" }));
    espion.mockRestore();
    expect(r.ok).toBe(true);
    expect(await copies()).toHaveLength(1);
  });

  it("un rejeu tardif n'écrase pas un texte déjà adapté dans la fiche", async () => {
    const r = await dupliquerEntree(saisie());
    if (!r.ok) throw new Error("attendu : ok");
    await depots().parametres.enregistrer({ id: `calendrier.fiche.${r.donnees.cle}`, valeur: { texte: "Mon texte adapté.", premierCommentaire: "" }, creeLe: MAINTENANT, modifieLe: MAINTENANT } as never);
    expect((await dupliquerEntree(saisie())).ok).toBe(true);
    const fiche = await lireParametre<{ texte?: string }>(`calendrier.fiche.${r.donnees.cle}`, {});
    expect(fiche.texte).toBe("Mon texte adapté.");
  });

  it("DÉCISION DOCUMENTÉE : la marque « À adapter » est dans le texte ; elle est donc visible à la relecture, mais seule une garde de validation hors de cette fiche peut empêcher de l'envoyer", async () => {
    await dupliquerEntree(saisie());
    const [copie] = await copies();
    const t = (copie!.textes as Record<string, { texte: string }>).instagram!.texte;
    expect(t.startsWith(MARQUE_A_ADAPTER)).toBe(true);
    expect(readFileSync("src/app/(studio)/calendrier/actions/dupliquer.ts", "utf8")).toContain("garde de validation hors de cette fiche");
  });

  it("sans session : l'action échoue avant toute lecture ou écriture", async () => {
    exigerSession.mockRejectedValueOnce(new Error("Non connecté"));
    await expect(dupliquerEntree(saisie())).rejects.toThrow("Non connecté");
    expect(await copies()).toHaveLength(0);
  });
});

describe("CAL-24 · dupliquer une publication déjà publiée", () => {
  const publication = (sur: Partial<Publication> = {}): Publication => ({
    id: "pub_1", visuelId: "vis_1", reseau: "linkedin", statut: "publiee", via: "zernio", date: "2026-11-10T08:00:00.000Z", texte: "Texte publié.",
    urlPubliee: "https://www.linkedin.com/posts/exemple-1", creeLe: "2026-11-01T00:00:00Z", modifieLe: "2026-11-10T08:00:00Z", ...sur,
  } as Publication);

  it("crée une copie « propose » à partir de la publication ; la publication ne change pas", async () => {
    await depots().publications.enregistrer(publication());
    const nombre = (await depots().publications.lister()).length;
    const avant = JSON.stringify(await depots().publications.obtenir("pub_1"));
    const r = await dupliquerEntree(saisie({ cle: "publication:pub_1|linkedin", reseau: "facebook", jour: "2026-12-18" }));
    expect(r.ok).toBe(true);
    const [copie] = await copies();
    expect(copie!.statut).toBe("propose");
    expect(copie!.visuelId).toBe("vis_1");
    expect(copie!.compteCible).toBe("compte-studio"); // aucun compte relié pour ce réseau : repli
    const t = (copie!.textes as Record<string, { texte: string }>).facebook!;
    expect(t.texte).toBe(`${MARQUE_A_ADAPTER}Texte publié.`);
    expect(JSON.stringify(await depots().publications.obtenir("pub_1"))).toBe(avant);
    expect(await depots().publications.lister()).toHaveLength(nombre);
    expect(fetchEspion).not.toHaveBeenCalled();
  });

  it("un visuel n'est pas copié vers un réseau qui ne publie que des vidéos (TikTok) : phrase claire, rien n'est écrit", async () => {
    await depots().publications.enregistrer(publication());
    for (const reseau of ["tiktok", "youtube", "youtube-shorts"]) {
      const r = await dupliquerEntree(saisie({ cle: "publication:pub_1|linkedin", reseau, jour: "2026-12-18", cleFormulaire: `f-${reseau}` }));
      expect(r, reseau).toMatchObject({ ok: false, message: PHRASES_DUPLICATION.visuelVideoSeule });
    }
    expect(await copies()).toHaveLength(0);
  });
});

describe("CAL-24 · « Voir sur le réseau »", () => {
  const pub = (sur: Record<string, unknown> = {}) => ({ statut: "publiee", urlPubliee: "https://www.linkedin.com/posts/exemple-1", ...sur });

  it("publiée avec une adresse connue : le lien est rendu", () => {
    expect(LIBELLE_VOIR_SUR_RESEAU).toBe("Voir sur le réseau");
    expect(lienVoirSurReseau(pub())).toBe("https://www.linkedin.com/posts/exemple-1");
  });

  it("sans adresse (absente, vide ou espaces) : pas de lien", () => {
    expect(lienVoirSurReseau(pub({ urlPubliee: undefined }))).toBeNull();
    expect(lienVoirSurReseau(pub({ urlPubliee: "" }))).toBeNull();
    expect(lienVoirSurReseau(pub({ urlPubliee: "   " }))).toBeNull();
  });

  it("pas publiée (programmée, échec, brouillon) : pas de lien, même avec une adresse", () => {
    for (const statut of ["programmee", "echec", "brouillon", "archive"]) expect(lienVoirSurReseau(pub({ statut })), statut).toBeNull();
  });

  it("adresse qui n'est pas une page web sûre : pas de lien", () => {
    for (const u of ["javascript:alert(1)", "data:text/html,x", "//exemple.fr/x", "linkedin.com/posts/1", "ftp://exemple.fr/x", "https://", "http://[::1"]) expect(lienVoirSurReseau(pub({ urlPubliee: u })), u).toBeNull();
  });
});

describe("CAL-24 · marque « À adapter »", () => {
  it("ajoute la marque une seule fois", () => {
    expect(marquerAAdapter("Bonjour")).toBe(`${MARQUE_A_ADAPTER}Bonjour`);
    expect(marquerAAdapter(marquerAAdapter("Bonjour"))).toBe(`${MARQUE_A_ADAPTER}Bonjour`);
    expect(marquerAAdapter("").startsWith(MARQUE_A_ADAPTER.trim())).toBe(true);
  });
});

describe("CAL-24 · écran DupliquerEntree", () => {
  const rendre = (el: unknown) => renderToStaticMarkup(el as ReactElement);
  const lisible = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
  const INTERDITS = [/Buffer|Zernio|diffuseur/i, /€|\beuros?\b|\bprix\b|\btarif/i, /Supprimer|supprim/i, /\b(tu|ton|tes|toi)\b/i, /\b(propose|a_valider|programmee|publiee)\b/];

  it("repos : un bouton « Dupliquer » ; ouvert : réseau, jour, « Créer la copie » et « Annuler », tout en vouvoiement, sans mot technique ni prix", async () => {
    const { DupliquerEntree } = await import("@/components/calendrier/DupliquerEntree");
    const m = monter(DupliquerEntree, { cle: CLE_ORIGINALE, reseau: "linkedin", jour: "2026-12-15" });
    const repos = lisible(rendre(m.rendre()));
    expect(repos).toContain("Dupliquer");
    expect(repos).not.toContain("Créer la copie");
    (trouver(m.rendre(), (e) => e.type === "button")[0]!.props.onClick as () => void)();
    const ouvert = lisible(rendre(m.rendre()));
    for (const mot of ["Réseau", "Jour", "Créer la copie", "Annuler", "à adapter", "validez-la", "ne part pas"]) expect(ouvert.toLowerCase(), mot).toContain(mot.toLowerCase());
    for (const motif of INTERDITS) expect(ouvert, String(motif)).not.toMatch(motif);
  });

  it("les boutons passent à la ligne et gardent une zone de clic de 44 px (lisible à 375 px)", () => {
    const src = readFileSync("src/components/calendrier/DupliquerEntree.tsx", "utf8");
    expect(src).toMatch(/flex-wrap/);
    expect(src).toMatch(/min-h-\[44px\]/);
    expect(src).not.toMatch(/bg-(black|slate-9|gray-9|zinc-9)/);
  });

  it("« Voir sur le réseau » : lien rendu avec une adresse connue, rien sans adresse", async () => {
    const { VoirSurLeReseau } = await import("@/components/calendrier/DupliquerEntree");
    const avec = rendre(createElement(VoirSurLeReseau, { statut: "publiee", urlPubliee: "https://www.linkedin.com/posts/exemple-1" }));
    expect(avec).toContain('href="https://www.linkedin.com/posts/exemple-1"');
    expect(lisible(avec)).toContain("Voir sur le réseau");
    expect(avec).toMatch(/rel="[^"]*noopener[^"]*"/);
    expect(rendre(createElement(VoirSurLeReseau, { statut: "publiee" }))).toBe("");
    expect(rendre(createElement(VoirSurLeReseau, { statut: "programmee", urlPubliee: "https://www.linkedin.com/posts/exemple-1" }))).toBe("");
  });

  it("la liste des réseaux de l'écran est celle du registre (YouTube compris) et le réseau d'origine y figure", async () => {
    const { DupliquerEntree } = await import("@/components/calendrier/DupliquerEntree");
    const m = monter(DupliquerEntree, { cle: "creneau:cre_9|youtube", reseau: "youtube", jour: "2026-12-15" });
    (trouver(m.rendre(), (e) => e.type === "button")[0]!.props.onClick as () => void)();
    const options = trouver(m.rendre(), (e) => e.type === "option").map((o) => o.props.value);
    expect(options).toContain("youtube");
    expect(options).toContain("linkedin");
  });

  it("après un avertissement de date passée, changer le jour efface l'avertissement : « Créer la copie » revient", async () => {
    vi.doMock("@/app/(studio)/calendrier/actions/dupliquer", () => ({
      dupliquerEntree: async () => ({ ok: false, message: "x", aConfirmer: "passe", avertissement: "Cette date est passée : confirmez." }),
    }));
    vi.resetModules();
    const { DupliquerEntree } = await import("@/components/calendrier/DupliquerEntree");
    const m = monter(DupliquerEntree, { cle: CLE_ORIGINALE, reseau: "linkedin", jour: "2026-12-15" });
    (trouver(m.rendre(), (e) => e.type === "button")[0]!.props.onClick as () => void)();
    (trouver(m.rendre(), (e) => e.type === "form")[0]!.props.onSubmit as (e: { preventDefault(): void }) => void)({ preventDefault() {} });
    await attendre();
    expect(lisible(rendre(m.rendre()))).toContain("Créer quand même");
    (trouver(m.rendre(), (e) => e.type === "input")[0]!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "2026-12-30" } });
    const html = lisible(rendre(m.rendre()));
    expect(html).toContain("Créer la copie");
    expect(html).not.toContain("Créer quand même");
    expect(html).not.toContain("Cette date est passée");
    vi.doUnmock("@/app/(studio)/calendrier/actions/dupliquer");
  });

  it("« Annuler » puis réouverture : une nouvelle clé de formulaire est envoyée (la personne n'est pas bloquée par un refus précédent)", async () => {
    const cles: string[] = [];
    vi.doMock("@/app/(studio)/calendrier/actions/dupliquer", () => ({
      dupliquerEntree: async (s: { cleFormulaire: string }) => { cles.push(s.cleFormulaire); return { ok: false, message: "Ce formulaire a déjà créé une copie différente." }; },
    }));
    vi.resetModules();
    const { DupliquerEntree } = await import("@/components/calendrier/DupliquerEntree");
    const m = monter(DupliquerEntree, { cle: CLE_ORIGINALE, reseau: "linkedin", jour: "2026-12-15" });
    const ouvrir = () => (trouver(m.rendre(), (e) => e.type === "button")[0]!.props.onClick as () => void)();
    const envoyer = () => (trouver(m.rendre(), (e) => e.type === "form")[0]!.props.onSubmit as (e: { preventDefault(): void }) => void)({ preventDefault() {} });
    ouvrir(); envoyer(); await attendre();
    (trouver(m.rendre(), (e) => e.type === "button" && texteDe(e) === "Annuler")[0]!.props.onClick as () => void)();
    ouvrir(); envoyer(); await attendre();
    expect(cles).toHaveLength(2);
    expect(cles[1]).not.toBe(cles[0]);
    vi.doUnmock("@/app/(studio)/calendrier/actions/dupliquer");
  });

  it("confirmer : appelle l'action une fois avec la bonne demande ; une date passée affiche l'avertissement et propose « Créer quand même »", async () => {
    const appels: Record<string, unknown>[] = [];
    vi.doMock("@/app/(studio)/calendrier/actions/dupliquer", () => ({
      dupliquerEntree: async (s: Record<string, unknown>) => {
        appels.push(s);
        return s.confirmerPasse ? { ok: true, donnees: { creneauId: "copie_1", message: "La copie est créée." } } : { ok: false, message: "x", aConfirmer: "passe", avertissement: "Cette date est passée : confirmer pour créer la copie quand même." };
      },
    }));
    vi.resetModules();
    const { DupliquerEntree } = await import("@/components/calendrier/DupliquerEntree");
    const m = monter(DupliquerEntree, { cle: CLE_ORIGINALE, reseau: "linkedin", jour: "2026-12-15" });
    (trouver(m.rendre(), (e) => e.type === "button")[0]!.props.onClick as () => void)();
    const formulaire = trouver(m.rendre(), (e) => e.type === "form")[0]!;
    (formulaire.props.onSubmit as (e: { preventDefault(): void }) => void)({ preventDefault() {} });
    await attendre();
    expect(appels).toHaveLength(1);
    expect(appels[0]).toMatchObject({ cle: CLE_ORIGINALE });
    expect(lisible(rendre(m.rendre()))).toContain("Cette date est passée");
    const quandMeme = trouver(m.rendre(), (e) => e.type === "button" && texteDe(e).includes("Créer quand même"))[0]!;
    (quandMeme.props.onClick as () => void)();
    await attendre();
    expect(appels).toHaveLength(2);
    expect(appels[1]).toMatchObject({ confirmerPasse: true });
    expect(lisible(rendre(m.rendre()))).toContain("La copie est créée.");
    vi.doUnmock("@/app/(studio)/calendrier/actions/dupliquer");
  });
});

describe("CAL-24 · gardes de périmètre", () => {
  const action = readFileSync("src/app/(studio)/calendrier/actions/dupliquer.ts", "utf8");
  it("l'action est « use server », exige la session avant tout, n'importe aucun fournisseur de publication et ne supprime rien", () => {
    expect(action.trimStart().startsWith('"use server"')).toBe(true);
    expect(action).not.toMatch(/fournisseurs\/publication|zernio-client|zernio-corps|services\/zernio/);
    expect(action).not.toMatch(/\.supprimer\(|supprimer\(/);
    const corps = action.slice(action.indexOf("export async function dupliquerEntree"));
    expect(corps.indexOf("exigerSession()")).toBeGreaterThan(-1);
    expect(corps.indexOf("exigerSession()")).toBeLessThan(corps.indexOf("depots()") === -1 ? Infinity : corps.indexOf("depots()"));
  });
  it("actions.ts n'est pas modifié par cette fiche (les deux actions de L4-04 seulement)", () => {
    const a = readFileSync("src/app/(studio)/calendrier/actions.ts", "utf8");
    expect(a).not.toMatch(/dupliquer/i);
  });
});
