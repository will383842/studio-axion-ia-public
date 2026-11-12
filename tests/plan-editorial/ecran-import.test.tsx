/**
 * L4-12 : « Importer un fichier de publications (tableau ou collage) ». Dépôts en mémoire, aucun appel réel, données fictives.
 * Règle : seule une erreur de format bloque ; passé, proximité, quota et week-end avertissent et se confirment d'un clic.
 */
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const espion = vi.hoisted(() => ({ actif: false, setters: {} as Record<number, ReturnType<typeof vi.fn>> }));
// Passe-plat, sauf quand un test appelle le composant à la main pour saisir au clavier sans DOM.
vi.mock("react", async (importOriginal) => {
  const reel = await importOriginal<typeof import("react")>();
  let rang = 0;
  return {
    ...reel,
    default: reel,
    useRef: (v: unknown) => (espion.actif ? { current: v } : reel.useRef(v)),
    useState: (init: unknown) => {
      if (!espion.actif) return reel.useState(init);
      const i = rang++;
      const f = vi.fn();
      espion.setters[i] = f;
      return [init, f];
    },
  };
});
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({ id: "s1" })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { reinitialiserDepots } from "@/donnees/memoire";
import { MOTS_INTERDITS_ECRAN } from "@/domaine/libelles";
import { analyserImport, importerPublications } from "@/app/(studio)/calendrier/importer/actions";
import PageImporter from "@/app/(studio)/calendrier/importer/page";
import { FeuilleImportPlan, importerInactif } from "@/components/plan-editorial/FeuilleImportPlan";
import { etatDepuisStatut, libelleEtat } from "@/components/calendrier/PastilleStatutPlan";
import { lireStockageFiche } from "@/services/calendrier-fiche";

let d: ReturnType<typeof reinitialiserDepots>;
beforeEach(() => { d = reinitialiserDepots(); vi.useFakeTimers({ now: new Date("2026-11-20T10:00:00Z") }); });

const COMPTE = "compte-fictif-1";
/** Une ligne par jour ouvré distinct (pas de proximité, pas de quota, pas de week-end). */
function jourOuvre(i: number): string {
  const d0 = new Date(Date.UTC(2026, 11, 1)); // mardi 1er décembre 2026
  let n = 0;
  while (n < i) { d0.setUTCDate(d0.getUTCDate() + 1); if (![0, 6].includes(d0.getUTCDay())) n++; }
  return d0.toISOString().slice(0, 10);
}
const ligne = (i: number, reseau = "linkedin") => `${jourOuvre(i)};09:00;${reseau};Publication fictive numéro ${i}`;
const tableau = (n: number) => ["jour;heure;réseau;texte", ...Array.from({ length: n }, (_, i) => ligne(i))].join("\n");

describe("lecture du fichier (analyse)", () => {
  it("tableau avec en-tête : 3 lignes lues, 3 valides, 0 erreur", async () => {
    const a = await analyserImport({ texte: tableau(3) });
    expect(a).toMatchObject({ ok: true, lus: 3, erreurs: [] });
    expect(a.lignes).toHaveLength(3);
    expect(a.lignes[0]).toMatchObject({ numero: 2, jour: "2026-12-01", heure: "09:00", reseau: "linkedin", texte: "Publication fictive numéro 0" });
  });
  it("accepte tabulation, point-virgule et barre verticale, JJ/MM/AAAA, noms de réseau avec majuscules", async () => {
    const a = await analyserImport({ texte: ["03/12/2026\t14:30\tLinkedIn\tpar tabulation", "2026-12-04|10:00|Instagram|par barre", "2026-12-07;facebook;sans heure"].join("\n") });
    expect(a.erreurs).toEqual([]);
    expect(a.lignes.map((l) => [l.jour, l.heure, l.reseau])).toEqual([["2026-12-03", "14:30", "linkedin"], ["2026-12-04", "10:00", "instagram"], ["2026-12-07", "09:00", "facebook"]]);
  });
  it("collage : lignes vides ignorées, retours Windows, texte avec séparateur dans le dernier champ", async () => {
    const a = await analyserImport({ texte: "\r\n2026-12-03;09:00;tiktok;Un texte; avec un point-virgule dedans\r\n\r\n" });
    expect(a.erreurs).toEqual([]);
    expect(a.lignes).toHaveLength(1);
    expect(a.lignes[0].texte).toBe("Un texte; avec un point-virgule dedans");
  });
  it.each([
    ["vide", ""],
    ["espaces seuls", "  \n \t \n"],
    ["en-tête seul", "jour;heure;réseau;texte"],
  ])("%s : erreur de format, rien à importer", async (_nom, texte) => {
    const a = await analyserImport({ texte });
    expect(a.ok).toBe(false);
    expect(a.erreurs).toHaveLength(1);
    expect(a.erreurs[0].message).toMatch(/aucune publication/i);
  });
  it.each([
    ["jour impossible", "2026-02-30;09:00;linkedin;x", /jour/i],
    ["jour illisible", "demain;09:00;linkedin;x", /jour/i],
    ["heure impossible", "2026-12-03;25:00;linkedin;x", /heure/i],
    ["heure à la minute 60", "2026-12-03;09:60;linkedin;x", /heure/i],
    ["réseau inconnu", "2026-12-03;09:00;myspace;x", /réseau/i],
    ["colonnes manquantes", "2026-12-03;linkedin", /colonnes|texte/i],
    ["guillemet jamais fermé", '2026-12-03;09:00;linkedin;"texte sans fin', /guillemet/i],
  ])("erreur de format, ligne %s : numéro de ligne et motif", async (_nom, l, motif) => {
    const a = await analyserImport({ texte: `${ligne(0)}\n${l}` });
    expect(a.ok).toBe(false);
    expect(a.erreurs).toHaveLength(1);
    expect(a.erreurs[0].numero).toBe(2);
    expect(a.erreurs[0].message).toMatch(motif);
    expect(a.lus).toBe(2);
  });
  it("texte vide : jamais une erreur de format ; la ligne est lue et un avertissement « texte » la signale", async () => {
    const a = await analyserImport({ texte: `${ligne(0)}\n2026-12-03;09:00;linkedin;   \n${ligne(2)}` });
    expect(a.ok).toBe(true);
    expect(a.erreurs).toEqual([]);
    expect(a.lignes).toHaveLength(3);
    expect(a.lignes[1].texte).toBe("");
    expect(a.avertissements).toContainEqual(expect.objectContaining({ numero: 2, type: "texte" }));
  });
  it("cellule collée d'un tableur entre guillemets, sur plusieurs paragraphes : une seule publication, retours conservés", async () => {
    const texte = ['2026-12-03\t09:00\tLinkedIn\t"Premier paragraphe', "", 'Deuxième ""entre guillemets"" ; avec point-virgule"', "04/12/2026\t10:00\tInstagram\tune ligne"].join("\n");
    const a = await analyserImport({ texte });
    expect(a.erreurs).toEqual([]);
    expect(a.lus).toBe(2);
    expect(a.lignes[0].texte).toBe('Premier paragraphe\n\nDeuxième "entre guillemets" ; avec point-virgule');
    expect(a.lignes[1]).toMatchObject({ numero: 4, jour: "2026-12-04", reseau: "instagram", texte: "une ligne" });
  });
  it("même chose avec des retours Windows et le point-virgule ; la numérotation suit les lignes du fichier", async () => {
    const a = await analyserImport({ texte: '2026-12-03;09:00;facebook;"a\r\nb"\r\n2026-12-0x;09:00;facebook;x' });
    expect(a.ok).toBe(false);
    expect(a.erreurs).toEqual([expect.objectContaining({ numero: 3 })]);
  });
  it("fichier CSV à virgules : lu (le texte peut contenir des virgules)", async () => {
    const a = await analyserImport({ texte: 'jour,heure,réseau,texte\n2026-12-03,09:00,LinkedIn,"Bonjour, tout le monde"\n2026-12-04,10:00,Instagram,Sans guillemets, avec virgule' });
    expect(a.erreurs).toEqual([]);
    expect(a.lignes.map((l) => [l.reseau, l.texte])).toEqual([["linkedin", "Bonjour, tout le monde"], ["instagram", "Sans guillemets, avec virgule"]]);
  });
  it("limite exacte : 200 lignes passent, 201 refusées ; texte de 3000 signes passe, 3001 refusé", async () => {
    expect((await analyserImport({ texte: tableau(200) })).ok).toBe(true);
    const trop = await analyserImport({ texte: tableau(201) });
    expect(trop.ok).toBe(false);
    expect(trop.erreurs[0].message).toMatch(/200/);
    expect((await analyserImport({ texte: `2026-12-03;09:00;linkedin;${"a".repeat(3000)}` })).ok).toBe(true);
    expect((await analyserImport({ texte: `2026-12-03;09:00;linkedin;${"a".repeat(3001)}` })).ok).toBe(false);
  });
  it("entrée non texte (nulle, nombre) : erreur de format, pas d'exception", async () => {
    expect((await analyserImport({ texte: undefined as unknown as string })).ok).toBe(false);
    expect((await analyserImport({ texte: 42 as unknown as string })).ok).toBe(false);
  });
  it("date passée ou future : avertissement, jamais une erreur ; le passé se confirme", async () => {
    const a = await analyserImport({ texte: "2026-11-03;09:00;linkedin;passé\n2030-01-08;09:00;linkedin;futur lointain" });
    expect(a.ok).toBe(true);
    expect(a.avertissements.map((x) => [x.numero, x.type])).toEqual([[1, "passe"]]);
  });
});

describe("importer : tout ou rien, contrôle lus = créés", () => {
  it("chaque publication importée arrive « à valider » (pas « propose »), affichée « À valider » dans le calendrier, sans trace de validation", async () => {
    const r = await importerPublications({ texte: tableau(2), compteCible: COMPTE, cle: "kst" });
    expect(r).toMatchObject({ ok: true, crees: 2 });
    const l = await d.creneauxEditoriaux.lister();
    expect(l.map((c) => c.statut)).toEqual(["a_valider", "a_valider"]);
    expect(l.every((c) => !c.valideeLe && !c.valideePar)).toBe(true);
    expect(libelleEtat(etatDepuisStatut(l[0].statut)!).libelle).toBe("À valider");
  });
  it("rejeu après coupure : une ligne restée « propose » passe « à valider », une ligne déjà validée n'est pas touchée", async () => {
    const texte = tableau(2);
    await importerPublications({ texte, compteCible: COMPTE, cle: "krj" });
    const [a, b] = await d.creneauxEditoriaux.lister();
    await d.creneauxEditoriaux.enregistrer({ ...a, statut: "propose" });
    await d.creneauxEditoriaux.enregistrer({ ...b, statut: "valide", valideeLe: "2026-11-20T09:00:00.000Z", valideePar: "fondateur" });
    await importerPublications({ texte, compteCible: COMPTE, cle: "krj" });
    expect((await d.creneauxEditoriaux.obtenir(a.id))!.statut).toBe("a_valider");
    expect((await d.creneauxEditoriaux.obtenir(b.id))!.statut).toBe("valide");
  });
  it("une ligne sans texte parmi 60 valides : à confirmer, puis 61 lues = 61 créées, la vide « à valider » sans texte rangé", async () => {
    const texte = [...Array.from({ length: 60 }, (_, i) => ligne(i + 1)), "2026-12-03;09:00;tiktok;"].join("\n");
    const r = await importerPublications({ texte, compteCible: COMPTE, cle: "kv" });
    expect(r).toMatchObject({ ok: false, aConfirmer: true });
    expect(r.ok === false && r.avertissements?.some((x) => x.type === "texte" && x.numero === 61)).toBe(true);
    expect(await d.creneauxEditoriaux.lister()).toHaveLength(0);
    expect(await importerPublications({ texte, compteCible: COMPTE, cle: "kv", confirmer: true })).toMatchObject({ ok: true, lus: 61, crees: 61 });
    const vide = (await d.creneauxEditoriaux.lister()).find((c) => c.heuresParReseau.tiktok === "2026-12-03T08:00:00.000Z")!;
    expect(vide.statut).toBe("a_valider");
    expect((await lireStockageFiche({ cle: `creneau:${vide.id}|linkedin`, origine: "creneau", id: vide.id, reseau: "tiktok" })).texte ?? "").toBe("");
  });
  it("un texte de plusieurs paragraphes entre guillemets est rangé tel quel", async () => {
    const r = await importerPublications({ texte: '2026-12-03;09:00;linkedin;"Un\n\nDeux"', compteCible: COMPTE, cle: "kml" });
    expect(r).toMatchObject({ ok: true, lus: 1, crees: 1 });
    const [c] = await d.creneauxEditoriaux.lister();
    expect((await lireStockageFiche({ cle: `creneau:${c.id}|linkedin`, origine: "creneau", id: c.id, reseau: "linkedin" })).texte).toBe("Un\n\nDeux");
  });
  it("61 lignes lues = 61 créneaux, texte rangé, aucun appel au diffuseur", async () => {
    const fetchEspion = vi.spyOn(globalThis, "fetch");
    // 61 jours distincts ouvrés
    const texte = Array.from({ length: 61 }, (_, i) => ligne(i)).join("\n");
    const r = await importerPublications({ texte, compteCible: COMPTE, cle: "k61" });
    expect(r).toMatchObject({ ok: true, lus: 61, crees: 61 });
    const l = await d.creneauxEditoriaux.lister();
    expect(l).toHaveLength(61);
    expect(l.every((c) => c.statut === "a_valider" && c.compteCible === COMPTE)).toBe(true);
    const c0 = l.find((c) => c.jourVise === "2026-12-01")!;
    expect(c0.heuresParReseau.linkedin).toBe("2026-12-01T08:00:00.000Z");
    expect((await lireStockageFiche({ cle: `creneau:${c0.id}|linkedin`, origine: "creneau", id: c0.id, reseau: "linkedin" })).texte).toBe("Publication fictive numéro 0");
    expect(fetchEspion).not.toHaveBeenCalled();
  });
  it("une erreur de format refuse tout : rien n'est écrit", async () => {
    const r = await importerPublications({ texte: `${ligne(0)}\n2026-12-03;09:00;myspace;x`, compteCible: COMPTE, cle: "kerr" });
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.erreurs?.[0].numero).toBe(2);
    expect(await d.creneauxEditoriaux.lister()).toHaveLength(0);
  });
  it("compte ou clé invalides : refus de format, rien n'est écrit", async () => {
    expect(await importerPublications({ texte: ligne(0), compteCible: "", cle: "k1" })).toMatchObject({ ok: false });
    expect(await importerPublications({ texte: ligne(0), compteCible: COMPTE, cle: "clé invalide !" })).toMatchObject({ ok: false });
    expect(await d.creneauxEditoriaux.lister()).toHaveLength(0);
  });
  it("le passé avertit sans écrire, puis « importer quand même » écrit", async () => {
    const texte = `2026-11-03;09:00;linkedin;passé\n${ligne(3)}`;
    const r = await importerPublications({ texte, compteCible: COMPTE, cle: "kp" });
    expect(r).toMatchObject({ ok: false, aConfirmer: true });
    expect(r.ok === false && r.avertissements?.some((x) => x.type === "passe")).toBe(true);
    expect(await d.creneauxEditoriaux.lister()).toHaveLength(0);
    expect(await importerPublications({ texte, compteCible: COMPTE, cle: "kp", confirmer: true })).toMatchObject({ ok: true, crees: 2 });
    expect(await d.creneauxEditoriaux.lister()).toHaveLength(2);
  });
  it("proximité dans le fichier même (même réseau, même heure) : à confirmer, jamais bloqué", async () => {
    const texte = "2026-12-03;09:00;linkedin;un\n2026-12-03;09:00;linkedin;deux";
    const r = await importerPublications({ texte, compteCible: COMPTE, cle: "kx" });
    expect(r).toMatchObject({ ok: false, aConfirmer: true });
    expect(r.ok === false && r.avertissements?.some((x) => x.type === "proximite")).toBe(true);
    expect(await importerPublications({ texte, compteCible: COMPTE, cle: "kx", confirmer: true })).toMatchObject({ ok: true, lus: 2, crees: 2 });
  });
  it("proximité avec une entrée déjà au calendrier, et quota atteint : avertis ; une entrée archivée ne compte pas", async () => {
    await importerPublications({ texte: "2026-12-03;09:00;linkedin;déjà là", compteCible: COMPTE, cle: "ka" });
    const a = await analyserImport({ texte: "2026-12-03;09:30;linkedin;trop proche" });
    expect(a.ok).toBe(true);
    expect(a.avertissements.map((x) => x.type)).toEqual(expect.arrayContaining(["proximite"]));
    const b = await analyserImport({ texte: "2026-12-03;21:00;linkedin;même jour, loin" });
    expect(b.avertissements.map((x) => x.type)).toContain("quota");
    const [existant] = await d.creneauxEditoriaux.lister();
    await d.creneauxEditoriaux.enregistrer({ ...existant, statut: "archive" });
    expect((await analyserImport({ texte: "2026-12-03;09:30;linkedin;plus de gêne" })).avertissements).toEqual([]);
  });
  it("week-end LinkedIn : avertissement, jamais bloqué", async () => {
    const texte = "2026-12-05;09:00;linkedin;samedi";
    const r = await importerPublications({ texte, compteCible: COMPTE, cle: "kw" });
    expect(r).toMatchObject({ ok: false, aConfirmer: true });
    expect(await importerPublications({ texte, compteCible: COMPTE, cle: "kw", confirmer: true })).toMatchObject({ ok: true, crees: 1 });
  });
  it("rejeu (même clé, même fichier) : toujours 3 créneaux ; même clé avec un autre fichier : refusé", async () => {
    const texte = tableau(3);
    await importerPublications({ texte, compteCible: COMPTE, cle: "kr" });
    expect(await importerPublications({ texte, compteCible: COMPTE, cle: "kr" })).toMatchObject({ ok: true, lus: 3, crees: 3 });
    expect(await d.creneauxEditoriaux.lister()).toHaveLength(3);
    const autre = await importerPublications({ texte: ligne(9), compteCible: COMPTE, cle: "kr" });
    expect(autre).toMatchObject({ ok: false });
    expect(await d.creneauxEditoriaux.lister()).toHaveLength(3);
  });
  it("double envoi simultané : 3 créneaux seulement", async () => {
    const texte = tableau(3);
    await Promise.all([importerPublications({ texte, compteCible: COMPTE, cle: "kd" }), importerPublications({ texte, compteCible: COMPTE, cle: "kd" })]);
    expect(await d.creneauxEditoriaux.lister()).toHaveLength(3);
  });
  it("heure d'hiver et d'été de Paris, jamais UTC (09:00 le 1er juillet = 07:00Z)", async () => {
    await importerPublications({ texte: "2027-07-01;09:00;instagram;été", compteCible: COMPTE, cle: "ke", confirmer: true });
    expect((await d.creneauxEditoriaux.lister())[0].heuresParReseau.instagram).toBe("2027-07-01T07:00:00.000Z");
  });
});

describe("écran", () => {
  const mots = (html: string) => html.replace(/<[^>]*>/g, " ").toLowerCase();
  it("le bouton « Importer » est inactif seulement sur une erreur de format (ou rien à importer)", () => {
    const ok = { ok: true, lus: 2, lignes: [], erreurs: [] as { numero: number; message: string }[], avertissements: [] as { numero: number; type: "passe"; message: string }[] };
    expect(importerInactif(ok)).toBe(false);
    expect(importerInactif({ ...ok, avertissements: [{ numero: 1, type: "passe", message: "passé" }] })).toBe(false);
    expect(importerInactif({ ...ok, erreurs: [{ numero: 2, message: "Jour invalide." }] })).toBe(true);
    expect(importerInactif(null)).toBe(false);
  });
  it("la feuille montre le champ de collage, le choix d'un fichier et un bouton « Importer » actif au départ", () => {
    const html = renderToStaticMarkup(createElement(FeuilleImportPlan, { compteCible: COMPTE }));
    expect(html).toContain("Importer");
    expect(html).toMatch(/<textarea/);
    expect(html).toMatch(/type="file"/);
    expect(html).toMatch(/<button(?![^>]*\sdisabled[=\s>])[^>]*>\s*Importer/);
  });
  it("aucun libellé interdit, aucun montant, aucune mention de message automatique", async () => {
    const feuille = mots(renderToStaticMarkup(createElement(FeuilleImportPlan, { compteCible: COMPTE })));
    const page = mots(renderToStaticMarkup(await PageImporter({ searchParams: Promise.resolve({}) })));
    for (const texte of [feuille, page]) {
      for (const interdit of MOTS_INTERDITS_ECRAN) expect(texte).not.toMatch(new RegExp(`(^|[^a-zà-ÿ])${interdit}([^a-zà-ÿ]|$)`));
      expect(texte).not.toMatch(/€|\$|euro|automatique/);
    }
  });
  it("aucun libellé interdit ni « Proposée » dans les messages d'erreur, d'avertissement et de réussite", async () => {
    const textes: string[] = [];
    const a = await analyserImport({ texte: ["2026-13-03;09:00;linkedin;x", "2026-12-03;25:00;linkedin;x", "2026-12-03;09:00;myspace;x", "2026-12-03;linkedin", '2026-12-03;09:00;linkedin;"x', "demain;09:00;linkedin;x"].join("\n") });
    textes.push(...a.erreurs.map((e) => e.message));
    textes.push((await analyserImport({ texte: "" })).erreurs[0].message, (await analyserImport({ texte: tableau(201) })).erreurs[0].message);
    const w = await analyserImport({ texte: "2026-11-03;09:00;linkedin;passé\n2026-12-05;09:00;linkedin;samedi\n2026-12-07;09:00;linkedin;\n2026-12-07;09:20;linkedin;proche" });
    textes.push(...w.avertissements.map((x) => x.message));
    const conf = await importerPublications({ texte: "2026-11-03;09:00;linkedin;passé", compteCible: COMPTE, cle: "kmsg" });
    const fin = await importerPublications({ texte: "2026-11-03;09:00;linkedin;passé", compteCible: COMPTE, cle: "kmsg", confirmer: true });
    const sans = await importerPublications({ texte: ligne(0), compteCible: "", cle: "kmsg2" });
    textes.push(conf.ok ? "" : conf.message, sans.ok ? "" : sans.message);
    expect(textes.length).toBeGreaterThan(10);
    expect(fin.ok).toBe(true);
    for (const t of textes.map(mots)) {
      for (const interdit of MOTS_INTERDITS_ECRAN) expect(t).not.toMatch(new RegExp(`(^|[^a-zà-ÿ])${interdit}([^a-zà-ÿ]|$)`));
      expect(t).not.toMatch(/€|\$|euro|automatique|propos[ée]e?s?\b/);
    }
    const ecran = mots(renderToStaticMarkup(createElement(FeuilleImportPlan, { compteCible: COMPTE })));
    expect(ecran).not.toMatch(/propos[ée]e?s?\b/);
  });
  it("après un import réussi, l'écran dit « À valider » et jamais « Proposée »", () => {
    const src = FeuilleImportPlan.toString();
    expect(src).toContain("À valider");
    expect(src).not.toContain("Proposée");
  });
  it("taper dans le champ remet l'analyse à zéro : le bouton redevient actif au premier clic", () => {
    espion.actif = true;
    try {
      const arbre = FeuilleImportPlan({ compteCible: COMPTE }) as ReactElement<{ children: unknown }>;
      const trouver = (n: unknown, balise: string): ReactElement<Record<string, unknown>> | null => {
        if (!n || typeof n !== "object") return null;
        if (Array.isArray(n)) { for (const x of n) { const r = trouver(x, balise); if (r) return r; } return null; }
        const e = n as ReactElement<Record<string, unknown>>;
        if (e.type === balise) return e;
        return trouver(e.props?.children, balise);
      };
      const zone = trouver(arbre, "textarea")!;
      expect(zone).not.toBeNull();
      (zone.props.onChange as (e: unknown) => void)({ target: { value: "2026-12-03;09:00;linkedin;corrigé" } });
      // Rang des états dans le composant : texte 0, compte 1, analyse 2.
      expect(espion.setters[2]).toHaveBeenCalledWith(null);
    } finally {
      espion.actif = false;
    }
  });
  it("la page s'appelle « Importer un fichier de publications » et dit que rien ne part sans validation", async () => {
    const html = renderToStaticMarkup(await PageImporter({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Importer un fichier de publications");
    expect(html).toMatch(/à valider|validation/i);
  });
});
