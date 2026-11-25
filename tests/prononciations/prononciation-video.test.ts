/**
 * PRONONCIATION-a : « ce mot est mal dit dans CETTE vidéo » (module pur, sans importeur, éteint, 0 €).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Prononciation } from "../../src/domaine/types";
import { preparerMotMalDit } from "../../src/domaine/prononciation-video";

const RACINE = resolve(__dirname, "../..");
const entree = (p: Partial<Prononciation> & { mot: string; prononciation: string }): Prononciation => ({ id: `p-${p.mot}`, creeLe: "2026-11-01T00:00:00Z", modifieLe: "2026-11-01T00:00:00Z", ...p }) as Prononciation;
const plans = [
  { id: "p1", texte: "Bonjour, Zernio programme vos publications." },
  { id: "p2", texte: "Rien à signaler ici." },
  { id: "p3", texte: "Avec ZERNIO, tout est simple. Zernios partout !" },
];

describe("preparerMotMalDit : l'exemple de Williams (Zernio → zèrnio)", () => {
  const r = preparerMotMalDit({ plans, liste: [], mot: "Zernio", prononciation: "zèrnio" });
  it("ajoute, 2 phrases touchées, le lu change", () => {
    expect(r.action).toBe("ajouter");
    expect(r.entreeExistante).toBeUndefined();
    expect(r.phrases.map((p) => p.planId)).toEqual(["p1", "p3"]);
    expect(r.phrases[0]).toEqual({ planId: "p1", ecrit: plans[0].texte, luAvant: plans[0].texte, luApres: "Bonjour, zèrnio programme vos publications." });
    expect(r.phrases[1].luApres).toBe("Avec zèrnio, tout est simple. zèrnio partout !");
  });
  it("l'écrit est inchangé, recopié tel quel", () => {
    expect(r.ecritInchange).toBe(true);
    expect(r.phrases.map((p) => p.ecrit)).toEqual([plans[0].texte, plans[2].texte]);
  });
  it("caractères à relire = ceux des phrases lues après", () => {
    expect(r.caracteresARelire).toBe(r.phrases.reduce((s, p) => s + p.luApres.length, 0));
    expect(r.caracteresARelire).toBeGreaterThan(0);
  });
});

describe("modifier ou ajouter", () => {
  it("mot déjà en base (même clé, casse et tiret ignorés) : « modifier », l'ancienne entrée rendue", () => {
    const existante = entree({ mot: "zernio", prononciation: "zernyo" });
    const r = preparerMotMalDit({ plans, liste: [existante], mot: "Zernio", prononciation: "zèrnio" });
    expect(r.action).toBe("modifier");
    expect(r.entreeExistante).toBe(existante);
    // luAvant utilise l'ancienne prononciation, luApres la nouvelle (et pas les deux).
    expect(r.phrases[0].luAvant).toBe("Bonjour, zernyo programme vos publications.");
    expect(r.phrases[0].luApres).toBe("Bonjour, zèrnio programme vos publications.");
  });
  it("une entrée rangée (archivée) ne compte pas : « ajouter »", () => {
    const rangee = entree({ mot: "Zernio", prononciation: "zernyo", archiveLe: "2026-11-02T00:00:00Z" });
    expect(preparerMotMalDit({ plans, liste: [rangee], mot: "Zernio", prononciation: "zèrnio" }).action).toBe("ajouter");
  });
  it("une entrée réservée à une autre voix est une autre entrée : « ajouter »", () => {
    const autre = entree({ mot: "Zernio", prononciation: "zernyo", portee: { voixId: "v-autre" } });
    expect(preparerMotMalDit({ plans, liste: [autre], mot: "Zernio", prononciation: "zèrnio" }).action).toBe("ajouter");
  });
  it("la liste reçue n'est pas modifiée", () => {
    const liste = [entree({ mot: "zernio", prononciation: "zernyo" })];
    const copie = JSON.stringify(liste);
    preparerMotMalDit({ plans, liste, mot: "Zernio", prononciation: "zèrnio" });
    expect(JSON.stringify(liste)).toBe(copie);
  });
});

describe("variantes de casse, de pluriel, de tiret", () => {
  it("Axion-IA, AXION IA, AxionIA, pluriel", () => {
    const t = [{ id: "a", texte: "Axion-IA, AXION IA et AxionIAs." }];
    const r = preparerMotMalDit({ plans: t, liste: [], mot: "Axion-IA", prononciation: "axionia" });
    expect(r.phrases[0].luApres).toBe("axionia, axionia et axionia.");
  });
  it("un mot collé à d'autres lettres n'est pas touché", () => {
    const r = preparerMotMalDit({ plans: [{ id: "a", texte: "Zernioter n'existe pas." }], liste: [], mot: "Zernio", prononciation: "zèrnio" });
    expect(r.action).toBe("rien");
  });
});

describe("rien à faire (phrase claire, sans montant)", () => {
  it.each([
    ["mot absent de la vidéo", { mot: "Absent", prononciation: "abse" }],
    ["prononciation vide", { mot: "Zernio", prononciation: "   " }],
    ["prononciation identique au mot", { mot: "Zernio", prononciation: "Zernio" }],
    ["mot vide", { mot: " ", prononciation: "x" }],
  ])("%s", (_nom, args) => {
    const r = preparerMotMalDit({ plans, liste: [], ...args });
    expect(r.action).toBe("rien");
    expect(r.phrases).toEqual([]);
    expect(r.caracteresARelire).toBe(0);
    expect(r.ecritInchange).toBe(true);
    expect(r.message).toMatch(/\S/);
    expect(r.message).not.toMatch(/€|euro|centime/i);
  });
  it("la même prononciation déjà en base : rien à faire", () => {
    const r = preparerMotMalDit({ plans, liste: [entree({ mot: "Zernio", prononciation: "zèrnio" })], mot: "Zernio", prononciation: "zèrnio" });
    expect(r.action).toBe("rien");
  });
});

describe("texte seul (sans plans)", () => {
  it("une seule phrase « texte »", () => {
    const r = preparerMotMalDit({ texte: "Merci Zernio.", plans: [], liste: [], mot: "Zernio", prononciation: "zèrnio" });
    expect(r.phrases).toEqual([{ planId: "texte", ecrit: "Merci Zernio.", luAvant: "Merci Zernio.", luApres: "Merci zèrnio." }]);
  });
});

describe("un seul importeur (PRONONCIATION-b-v21m : l'action serveur du panneau, monté nulle part)", () => {
  it("seul l'action serveur de « Ce mot est mal dit » importe prononciation-video", () => {
    const vus: string[] = [];
    const marche = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) marche(p);
        else if (/\.(tsx?|mts)$/.test(f) && !p.endsWith("domaine/prononciation-video.ts") && /prononciation-video/.test(readFileSync(p, "utf8"))) vus.push(p);
      }
    };
    marche(join(RACINE, "src"));
    expect(vus.map((v) => relative(RACINE, v).split("\\").join("/")).sort()).toEqual(["src/components/prononciations/actions-mot-mal-dit.ts"]);
  });
});
