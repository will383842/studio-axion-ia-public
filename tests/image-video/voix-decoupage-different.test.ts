/**
 * GV2-09 · la voix ne bloque plus la vidéo quand ses mots sont découpés ou écrits autrement que le script (mots fusionnés,
 * mot écrit autrement). Doubles de la fabrication, aucun appel réel. Une seule lecture payée, jamais de relecture pour cela ;
 * le contrôle des hésitations reste entier ; le cas concret garde son contrôle mot à mot.
 */
import { describe, expect, it, vi } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { controlerPrise } from "@/moteurs/montage-cas-concret/voix";
import { avancerJusquAArretIV, attendWillIV, etatInitialIV, validerCarteIV, validerScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });

type Alterer = (mots: MotHorodate[]) => MotHorodate[];

async function jusquAuBout(alterer?: Alterer) {
  const carte = carteFixe("C");
  const m = monde();
  const o: OutilsFabricationIV = outilsSimules(carte, m);
  if (alterer) {
    const voix = o.voix.voix();
    const lire = voix.lire.bind(voix);
    o.voix.voix = () => ({ ...voix, lire: async (d: Parameters<typeof lire>[0]) => {
        const r = await lire(d);
        return { ...r, mots: alterer(r.mots as MotHorodate[]) };
      } }) as typeof voix;
  }
  const decCarte = (e: EtatFabricationIV) => ({ proposition: e.propositionCarte!.empreinte, le: "2026-10-20T08:00:00.000Z" });
  let e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { plafondCentimes: 5000 })), o);
  for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
    if (e.attente) e = await avancerJusquAArretIV(e, o);
    else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, decCarte(e)), o);
    else if (attendWillIV(e) === "script") e = await avancerJusquAArretIV(validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) }), o);
    else break;
  }
  return { e, m };
}

const fusionner: Alterer = (mots) => {
  const k = mots.findIndex((x, i) => i >= 5 && /[\p{L}]/u.test(x.mot) && /[\p{L}]/u.test(mots[i + 1]?.mot ?? ""));
  return [...mots.slice(0, k), { mot: `${mots[k].mot}${mots[k + 1].mot}`, debutSec: mots[k].debutSec, finSec: mots[k + 1].finSec }, ...mots.slice(k + 2)];
};
const ecritAutrement: Alterer = (mots) => mots.map((x, i) => (i % 8 === 3 ? { ...x, mot: `xx${x.mot}` } : x));

describe("voix découpée ou écrite autrement : une seule lecture, vidéo prête", () => {
  it("deux mots fusionnés en un : UNE lecture, vidéo prête, chaque version coupée sur ses phrases", async () => {
    const ref = await jusquAuBout();
    const { e, m } = await jusquAuBout(fusionner);
    expect(e.refus).toBeUndefined();
    expect(e.etape).toBe("prete");
    expect(m.lus).toHaveLength(1);
    expect(e.voix!.reparations ?? 0).toBe(0);
    expect(e.caisse.reservations.filter((r) => r.etape === "voix")).toHaveLength(1);
    expect(e.pistes).toHaveLength(ref.e.pistes!.length);
    for (const p of e.pistes!) {
      const r = ref.e.pistes!.find((x) => x.version === p.version)!;
      expect(p.motsCorps).toBe(r.motsCorps - 1);
      // La fin (phrases propres à la version) est celle de la version de référence, mot pour mot.
      expect(p.mots.slice(p.motsCorps).map((x) => x.mot)).toEqual(r.mots.slice(r.motsCorps).map((x) => x.mot));
    }
  });

  it("un mot sur huit écrit autrement (même nombre de mots) : UNE lecture, vidéo prête, une remarque au journal", async () => {
    const { e, m } = await jusquAuBout(ecritAutrement);
    expect(e.refus).toBeUndefined();
    expect(e.etape).toBe("prete");
    expect(m.lus).toHaveLength(1);
    expect(e.voix!.reparations ?? 0).toBe(0);
    expect(e.journal.some((l) => /La voix écrit autrement \d+ mots? du script : vérifiez les sous-titres\./.test(l))).toBe(true);
  });
});

describe("contrôle d'une prise : l'écart de mots n'est accepté que sur demande", () => {
  const mot = (m: string, i: number): MotHorodate => ({ mot: m, debutSec: i * 0.3, finSec: i * 0.3 + 0.25 });
  const rendre = (...m: string[]) => m.map(mot);
  const texte = "Un e-mail propre vaut mieux.";

  it("cas concret (option éteinte) : un mot écrit autrement ou fusionné reste refusé, comme avant", () => {
    expect(controlerPrise({ texte, mots: rendre("xxUn", "e-mail", "propre", "vaut", "mieux") })).toMatchObject({ rejet: "mots" });
    expect(controlerPrise({ texte, mots: rendre("Un", "e-mailpropre", "vaut", "mieux") })).toMatchObject({ rejet: "mots" });
    expect(controlerPrise({ texte, mots: rendre("Un", "e-mail", "propre", "vaut", "mieux") })).toEqual({ ok: true });
  });

  it("image → vidéo (option allumée) : mot fusionné ou écrit autrement accepté", () => {
    expect(controlerPrise({ texte, mots: rendre("xxUn", "e-mail", "propre", "vaut", "mieux"), accepterEcartDeMots: true })).toEqual({ ok: true });
    expect(controlerPrise({ texte, mots: rendre("Un", "e-mailpropre", "vaut", "mieux"), accepterEcartDeMots: true })).toEqual({ ok: true });
  });

  it("option allumée : une hésitation écrite comme un mot (« euh ») reste refusée", () => {
    expect(controlerPrise({ texte, mots: rendre("Un", "euh", "e-mail", "propre", "vaut", "mieux"), accepterEcartDeMots: true })).toMatchObject({ rejet: "mots" });
    expect(controlerPrise({ texte, mots: rendre("Un", "e-mail", "propre", "vaut", "mieux", "euh"), accepterEcartDeMots: true })).toMatchObject({ rejet: "mots" });
  });

  it("option allumée : un long blanc hors ponctuation reste refusé, même quand les mots diffèrent", () => {
    const mots = rendre("Un", "e-mailpropre", "vaut", "mieux");
    mots[2] = { mot: "vaut", debutSec: 2.5, finSec: 2.8 };
    mots[3] = { mot: "mieux", debutSec: 2.9, finSec: 3.1 };
    expect(controlerPrise({ texte, mots, accepterEcartDeMots: true })).toMatchObject({ rejet: "traine" });
  });
});
