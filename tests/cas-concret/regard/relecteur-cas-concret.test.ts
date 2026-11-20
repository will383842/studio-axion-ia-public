import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LectureRegard } from "@/briques/regardeur";
import type { MotCalage } from "@/briques/motion/calage";
import { calerFiche } from "@/moteurs/montage-cas-concret/calage";
import { VERSION_FICHE_ECRANS, type EcranCorps, type FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { MARQUE, textesEcrits } from "@/moteurs/montage-cas-concret/regles";
import { instantsCasConcret } from "@/moteurs/montage-cas-concret/regard-cas-concret";
import { relecteurCasConcret, type PortsRegardCasConcret } from "@/services/regardeur-cas-concret";

const DITS = ["un", "deux", "trois", "quatre", "cinq"].map((m) => `${m} mot dit ici`);
const brute = (): FicheEcrans => ({
  version: VERSION_FICHE_ECRANS, formatId: "cas-concret", videoId: "video-1", versionId: "version-1", habillage: "charte-duo/1", ratio: "9:16",
  offre: "integration", origine: "porte-a", posture: "chez-nous", casId: "recrutement-apporteurs", empreinteCas: "cas-0123456789abcdef-1a",
  ecrans: DITS.map((texteDit, k) => ({ id: `e0${k + 1}`, type: "titre", fond: "sombre", marque: MARQUE, texteDit, avanceMs: 0, evenements: [], lignes: [`Titre ${k + 1}`] }) as EcranCorps),
});
const mots: MotCalage[] = DITS.join(" ").split(" ").map((mot, i) => ({ mot, debutSec: i * 0.4, finSec: i * 0.4 + 0.35 }));
const fiche = ((): FicheEcrans => {
  const r = calerFiche(brute(), null, mots, { finApresDernierMotSec: 2.1 });
  if (!r.ok) throw new Error(r.problemes.join("\n"));
  return r.fiche;
})();
const VIDEO = { cle: "studio/dev/cas-concret/v-1/sortie-secrete-abc.mp4", dureeSec: 12 };
const instants = instantsCasConcret(fiche, null, VIDEO.dureeSec);
const dep = { videoId: "v-1", env: "dev" };

interface Compteurs { extractions: number; appels: number; entrees: unknown[]; memo: Map<string, string> }
function ports(opts: { lecture?: () => LectureRegard; simule?: boolean; ok?: boolean; donnees?: unknown; extraction?: "fini" | "en-cours" | "echec" } = {}): { p: PortsRegardCasConcret; c: Compteurs } {
  const c: Compteurs = { extractions: 0, appels: 0, entrees: [], memo: new Map() };
  const p: PortsRegardCasConcret = {
    lireMemo: async (cle) => c.memo.get(cle) ?? null,
    ecrireMemo: async (cle, texte) => { c.memo.set(cle, texte); },
    extraire: async (d) => {
      c.extractions++;
      const e = opts.extraction ?? "fini";
      if (e === "en-cours") return { statut: "en-cours" };
      if (e === "echec") throw new Error("aligneur en panne");
      return { statut: "fini", images: d.instants.map((i) => ({ nom: i.nom, cle: d.cles[i.nom]! })) };
    },
    lireImage: async () => ({ octets: new Uint8Array([0xff, 0xd8, 1, 2, 3]), type: "image/jpeg" }),
    appeler: async (entree) => {
      c.appels++;
      c.entrees.push(entree);
      if (opts.ok === false) return { ok: false };
      if (opts.simule) return { ok: true, simule: true };
      return { ok: true, simule: false, donnees: "donnees" in opts ? opts.donnees : (opts.lecture ?? fidele)() };
    },
  };
  return { p, c };
}
const fidele = (coupe: Record<string, string> = {}): LectureRegard => ({
  images: instants.map((i) => {
    const e = fiche.ecrans.find((x) => x.id === i.partieId);
    const textes = (e ? textesEcrits(e) : []).map((texte) => ({ texte, coupe: false, horsCadre: false }));
    if (i.partieId && coupe[i.partieId]) textes.push({ texte: coupe[i.partieId]!, coupe: true, horsCadre: false });
    return { nom: i.nom, textes, sousTitre: null, pageVide: false, noire: false, illisible: false };
  }),
});

describe("relecteurCasConcret (S-12-REGARDEUR-CC-v19c)", () => {
  it("a) lecture propre : aucune réserve, 1 extraction, 1 appel ; 2e passage : 0 appel (mémo)", async () => {
    const { p, c } = ports();
    const relire = relecteurCasConcret(dep, p);
    const r1 = await relire(fiche, null, VIDEO);
    expect(r1.reserves).toEqual([]);
    expect(r1.imagesLues).toBe(instants.length);
    expect(c.extractions).toBe(1);
    expect(c.appels).toBe(1);
    const r2 = await relire(fiche, null, VIDEO);
    expect(c.appels).toBe(1);
    expect(r2).toEqual(r1);
    expect([...c.memo.keys()][0]).toMatch(/^studio\/dev\/cas-concret\/v-1\/regard\/[0-9a-f]{16}\.json$/);
  });

  it("b) texte coupé sur e02 : réserve « écran e02 : texte coupé (« … ») »", async () => {
    const { p } = ports({ lecture: () => fidele({ e02: "Phrase coupée net" }) });
    const r = await relecteurCasConcret(dep, p)(fiche, null, VIDEO);
    expect(r.reserves.some((x) => x.startsWith("écran e02 : texte coupé (« "))).toBe(true);
  });

  it("b bis) fin choisie (dep.fin) absente de l'écran : réserve « fin choisie » ; présente : aucune réserve ; sans dep.fin : comme avant", async () => {
    const FIN = "Abonnez-vous maintenant";
    const absente = await relecteurCasConcret({ ...dep, fin: { ecran: FIN } }, ports().p)(fiche, null, VIDEO);
    expect(absente.reserves.join(" ")).toMatch(/fin choisie/);
    expect(absente.reserves).toContain("fin choisie absente de la vidéo");
    const sans = await relecteurCasConcret(dep, ports().p)(fiche, null, VIDEO);
    expect(sans.reserves).toEqual([]);
  });

  it("b ter) fin choisie (dep.fin) affichée sur la dernière image : aucune réserve (pas de faux « phrase non écrite ») ; absente : « fin choisie absente »", async () => {
    const FIN = "Abonnez-vous maintenant";
    const avecFin = (): LectureRegard => {
      const l = fidele();
      const derniere = l.images[l.images.length - 1]!;
      return { images: l.images.map((im) => (im === derniere ? { ...im, textes: [...im.textes, { texte: FIN, coupe: false, horsCadre: false }] } : im)) };
    };
    const affichee = await relecteurCasConcret({ ...dep, fin: { ecran: FIN } }, ports({ lecture: avecFin }).p)(fiche, null, VIDEO);
    expect(affichee.reserves).toEqual([]);
    const absente = await relecteurCasConcret({ ...dep, fin: { ecran: FIN } }, ports().p)(fiche, null, VIDEO);
    expect(absente.reserves).toContain("fin choisie absente de la vidéo");
  });

  it("c) extraction en cours : attente, 0 appel, « non relue » ; échec : « Images de la vidéo non relues », 0 appel", async () => {
    let attentes = 0;
    const a = ports({ extraction: "en-cours" });
    const r = await relecteurCasConcret(dep, a.p)(fiche, null, { ...VIDEO, attendre: async () => { attentes++; } });
    expect(attentes).toBe(1);
    expect(a.c.appels).toBe(0);
    expect(r.reserves.join(" ")).toMatch(/non relue/);
    const b = ports({ extraction: "echec" });
    const r2 = await relecteurCasConcret(dep, b.p)(fiche, null, VIDEO);
    expect(r2.imagesLues).toBe(0);
    expect(r2.reserves.join(" ")).toContain("Images de la vidéo non relues");
    expect(b.c.appels).toBe(0);
  });

  it("d) Claude ok:false, simulé ou hors schéma : « non relues », jamais [], rien au mémo", async () => {
    for (const o of [{ ok: false }, { simule: true }, { donnees: { n: "importe quoi" } }]) {
      const { p, c } = ports(o);
      const r = await relecteurCasConcret(dep, p)(fiche, null, VIDEO);
      expect(r.reserves.length).toBeGreaterThan(0);
      expect(r.reserves.join(" ")).toMatch(/non relue/);
      expect(c.memo.size).toBe(0);
    }
  });

  it("e) mémo écrit AVANT de rendre ; ecrireMemo qui lève : même sortie", async () => {
    const a = ports({ lecture: () => fidele({ e03: "Coupé ici" }) });
    const r = await relecteurCasConcret(dep, a.p)(fiche, null, VIDEO);
    expect(a.c.memo.size).toBe(1);
    const b = ports({ lecture: () => fidele({ e03: "Coupé ici" }) });
    b.p.ecrireMemo = async () => { throw new Error("stockage"); };
    b.p.lireMemo = async () => { throw new Error("stockage"); };
    expect(await relecteurCasConcret(dep, b.p)(fiche, null, VIDEO)).toEqual(r);
  });

  it("e bis) panne de Claude (exception) : « non relues », jamais []", async () => {
    const a = ports();
    a.p.appeler = async () => { throw new Error("réseau"); };
    const r = await relecteurCasConcret(dep, a.p)(fiche, null, VIDEO);
    expect(r.reserves.join(" ")).toMatch(/non relue/);
  });

  it("f) rien de ce qui part vers Claude ne contient studio/, .mp4 ni .jpg", async () => {
    const { p, c } = ports();
    await relecteurCasConcret(dep, p)(fiche, null, VIDEO);
    const t = JSON.stringify(c.entrees.map((e) => ({ ...(e as object), images: undefined })));
    expect(t).not.toContain("studio/");
    expect(t).not.toContain("sortie-secrete");
    expect(t).not.toMatch(/\.(mp4|jpe?g)/i);
  });

  it("g) éteint = identique : aucun appelant dans src/**, rien chargé à l'import, fabriquer.ts intact", () => {
    const racine = new URL("../../../src", import.meta.url).pathname;
    const propre = readFileSync(join(racine, "services/regardeur-cas-concret.ts"), "utf8");
    expect(propre).not.toContain("lireParametre");
    expect(propre).not.toMatch(/^import .*from "(\.\/depense-claude-video|\.\/image-video|@\/fournisseurs[^"]*)"/m);
    const fichiers: string[] = [];
    const parcourir = (d: string) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) parcourir(f); else if (/\.(ts|tsx)$/.test(n)) fichiers.push(f); } };
    parcourir(racine);
    const appelants = fichiers.filter((f) => !f.endsWith("services/regardeur-cas-concret.ts") && /regardeur-cas-concret["']/.test(readFileSync(f, "utf8")));
    expect(appelants).toEqual([]);
    expect(readFileSync(join(racine, "moteurs/montage-cas-concret/fabriquer.ts"), "utf8")).not.toContain("regardeur-cas-concret");
  });
});
