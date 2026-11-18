import { describe, expect, it } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import type { LectureMorceau } from "@/briques/voix-longue";
import { decouperScript } from "@/briques/voix-longue";
import {
  creerDependancesVideoLongue,
  empreinteMorceau,
  ErreurVideoLongue,
  lireAccordVideoLongue,
  pireCasVoixCentimesUsd,
  PLAFOND_VIDEO_LONGUE_CENTIMES_USD,
  type PortsVideoLongue,
} from "@/services/video-longue-branchements";

// AUCUN appel réel : tout fournisseur ci-dessous est un faux qui compte ses appels.

const VIDEO = "v1";
const chapitre = (id: string, n: number) => ({ id, titre: `Titre ${id}`, texte: `${`Phrase ${id} de test. `.repeat(Math.ceil(n / 10))}`.slice(0, n) });

function commande(opts: { chapitres?: { id: string; titre: string; texte: string }[]; accord?: unknown } = {}): CommandeFabrication {
  const chapitres = opts.chapitres ?? [chapitre("c1", 1000), chapitre("c2", 1000)];
  const tous = decouperScript(chapitres);
  const car = tous.reduce((s, m) => s + m.texte.length, 0);
  const accord = opts.accord === undefined ? { donne: true, videoId: VIDEO, caracteres: car, morceaux: tous.length } : opts.accord;
  return { videoId: VIDEO, ratios: ["16:9"], distribution: [], entrees: { videoLongue: { chapitres, ...(accord === null ? {} : { accord }) } } } as unknown as CommandeFabrication;
}

interface Faux {
  ports: PortsVideoLongue;
  appelsVoix: string[];
  reservations: number[];
  appelsAligneur: number;
  appelsMontage: number;
  etat: { actif: unknown; montagePret: boolean; echecAu?: number; refusReservation?: boolean };
  base: Map<string, unknown>;
}

function faux(over: Partial<Faux["etat"]> = {}, base = new Map<string, unknown>()): Faux {
  const f: Faux = { appelsVoix: [], reservations: [], appelsAligneur: 0, appelsMontage: 0, etat: { actif: true, montagePret: true, ...over }, base, ports: undefined as never };
  f.ports = {
    actif: async () => f.etat.actif === true,
    registre: {
      depense: async (v) => (f.base.get(`d.${v}`) as number | undefined) ?? 0,
      ecrireDepense: async (v, c) => void f.base.set(`d.${v}`, c),
      morceauFait: async (c) => (f.base.get(c) as LectureMorceau | undefined) ?? null,
      noterMorceau: async (c, l) => void f.base.set(c, l),
    },
    montagePret: async () => f.etat.montagePret,
    reserver: async (e) => {
      if (f.etat.refusReservation) throw new Error("crédits insuffisants");
      f.reservations.push(e.centimesUsd);
    },
    lireMorceau: async (texte) => {
      f.appelsVoix.push(texte);
      if (f.etat.echecAu !== undefined && f.appelsVoix.length === f.etat.echecAu) throw new Error("HeyGen indisponible");
      return { dureeSec: 10, mots: [{ mot: "a", debutSec: 0, finSec: 1 } as never] };
    },
    aligner: async () => {
      f.appelsAligneur++;
      return [{ mot: "x", debutSec: 0, finSec: 1 } as never];
    },
    monter: async () => {
      f.appelsMontage++;
      return { fichierCle: "k" };
    },
  };
  return f;
}

const morceau = (cmd: CommandeFabrication, i = 0) => decouperScript((cmd.entrees as never as { videoLongue: { chapitres: never[] } }).videoLongue.chapitres)[i];
const ctxMontage = { chapitres: [], mots: [], dureeSec: 1 };
const total = (f: Faux) => f.appelsVoix.length + f.appelsAligneur + f.appelsMontage + f.reservations.length;

describe("VL-07 — éteint = aucun appel", () => {
  for (const valeur of [undefined, false, "true", 1, "oui", null, {}]) {
    it(`réglage ${JSON.stringify(valeur)} : rien ne part`, async () => {
      const f = faux({ actif: valeur });
      const c = commande();
      const d = creerDependancesVideoLongue(c, f.ports);
      await expect(d.voix.lire(morceau(c))).rejects.toMatchObject({ motif: "eteint" });
      await expect(d.monter("16:9", ctxMontage)).rejects.toMatchObject({ motif: "eteint" });
      expect(total(f)).toBe(0);
      expect(f.base.size).toBe(0);
    });
  }
  it("la construction seule ne touche aucun port", () => {
    const f = faux();
    creerDependancesVideoLongue(commande(), f.ports);
    expect(total(f)).toBe(0);
  });
});

describe("VL-07 — accord explicite par vidéo", () => {
  const cas: [string, unknown][] = [
    ["absent", null],
    ["donne faux", { donne: false, videoId: VIDEO, caracteres: 9999, morceaux: 9 }],
    ["donne en texte", { donne: "true", videoId: VIDEO, caracteres: 9999, morceaux: 9 }],
    ["autre vidéo", { donne: true, videoId: "v2", caracteres: 9999, morceaux: 9 }],
    ["sans quantités", { donne: true, videoId: VIDEO }],
  ];
  for (const [nom, accord] of cas) {
    it(`accord ${nom} : refus, rien ne part`, async () => {
      const f = faux();
      const c = commande({ accord });
      const d = creerDependancesVideoLongue(c, f.ports);
      await expect(d.voix.lire(morceau(c))).rejects.toMatchObject({ motif: "sans-accord" });
      await expect(d.monter("16:9", ctxMontage)).rejects.toMatchObject({ motif: "sans-accord" });
      expect(total(f)).toBe(0);
    });
  }
  it("script plus long que les quantités acceptées : refus", async () => {
    const f = faux();
    const c = commande({ accord: { donne: true, videoId: VIDEO, caracteres: 100, morceaux: 1 } });
    await expect(creerDependancesVideoLongue(c, f.ports).voix.lire(morceau(c))).rejects.toMatchObject({ motif: "accord-depasse" });
    expect(total(f)).toBe(0);
  });
  it("lireAccordVideoLongue : accord valide lu tel quel", () => {
    expect(lireAccordVideoLongue(commande())).toMatchObject({ donne: true, videoId: VIDEO });
  });
});

describe("VL-07 — plafond de 10 $ (pire cas, avant chaque appel)", () => {
  it("le tarif pire cas est celui de HeyGen, centime supérieur", () => {
    expect(pireCasVoixCentimesUsd(5000)).toBe(150);
    expect(pireCasVoixCentimesUsd(1)).toBe(1);
  });
  it("sous le plafond : la voix est lue, passe par la réservation gardée, et le registre suit", async () => {
    const f = faux();
    const c = commande();
    const d = creerDependancesVideoLongue(c, f.ports);
    await d.voix.lire(morceau(c));
    expect(f.appelsVoix).toHaveLength(1);
    expect(f.reservations).toEqual([pireCasVoixCentimesUsd(morceau(c).texte.length)]);
    expect(f.base.get(`d.${VIDEO}`)).toBe(f.reservations[0]);
  });
  it("le pire cas du reste à lire dépasse 10 $ : arrêt propre AVANT le premier appel", async () => {
    // 8 morceaux de ~5 000 caractères = ~1 200 centimes > 1 000.
    const chapitres = Array.from({ length: 8 }, (_, i) => chapitre(`c${i}`, 4990));
    const f = faux();
    const c = commande({ chapitres });
    expect(decouperScript(chapitres).length).toBe(8);
    await expect(creerDependancesVideoLongue(c, f.ports).voix.lire(morceau(c))).rejects.toMatchObject({ motif: "plafond" });
    expect(total(f)).toBe(0);
    expect(f.base.get(`d.${VIDEO}`)).toBeUndefined();
  });
  it("plafond atteint en cours de route : arrêt, plus aucun appel, rien de repayé", async () => {
    const f = faux();
    const c = commande();
    const d = creerDependancesVideoLongue(c, f.ports);
    await d.voix.lire(morceau(c, 0));
    // Le registre dit déjà 9,99 $ dépensés : le morceau suivant ne tient plus.
    f.base.set(`d.${VIDEO}`, PLAFOND_VIDEO_LONGUE_CENTIMES_USD - 1);
    const avant = f.appelsVoix.length;
    const c2 = commande({ chapitres: [chapitre("n1", 1000), chapitre("n2", 1000), chapitre("autre", 4000)] });
    await expect(creerDependancesVideoLongue(c2, f.ports).voix.lire(morceau(c2, 0))).rejects.toBeInstanceOf(ErreurVideoLongue);
    expect(f.appelsVoix).toHaveLength(avant);
    expect(f.base.get(`d.${VIDEO}`)).toBe(PLAFOND_VIDEO_LONGUE_CENTIMES_USD - 1);
  });
});

describe("VL-07 — reprise sans repayer", () => {
  it("un morceau déjà lu est rendu depuis le registre : 0 appel, 0 réservation", async () => {
    const f = faux();
    const c = commande({ chapitres: [chapitre("c1", 4990), chapitre("c2", 4990)] });
    const d = creerDependancesVideoLongue(c, f.ports);
    const premier = await d.voix.lire(morceau(c, 0));
    const depense = f.base.get(`d.${VIDEO}`);
    const encore = await d.voix.lire(morceau(c, 0));
    expect(encore).toEqual(premier);
    expect(f.appelsVoix).toHaveLength(1);
    expect(f.reservations).toHaveLength(1);
    expect(f.base.get(`d.${VIDEO}`)).toBe(depense);
  });
  it("échec au 2e morceau puis reprise : seul le 2e est payé, le 1er est gardé", async () => {
    const base = new Map<string, unknown>();
    const chapitres = [chapitre("c1", 4990), chapitre("c2", 4990)];
    const c = commande({ chapitres });
    const f1 = faux({ echecAu: 2 }, base);
    const d1 = creerDependancesVideoLongue(c, f1.ports);
    await d1.voix.lire(morceau(c, 0));
    await expect(d1.voix.lire(morceau(c, 1))).rejects.toMatchObject({ motif: "fournisseur" });
    expect(f1.appelsVoix).toHaveLength(2);
    // Reprise (nouveau fournisseur sain, même base) : le morceau 1 ne repart pas.
    const f2 = faux({}, base);
    const d2 = creerDependancesVideoLongue(c, f2.ports);
    await d2.voix.lire(morceau(c, 0));
    await d2.voix.lire(morceau(c, 1));
    expect(f2.appelsVoix).toHaveLength(1);
    expect(f2.appelsVoix[0]).toBe(morceau(c, 1).texte);
    expect(base.has(empreinteMorceau(VIDEO, morceau(c, 0).texte))).toBe(true);
  });
  it("la reprise garde le plafond : l'échec en vol reste compté au registre (prudence)", async () => {
    const f = faux({ echecAu: 1 });
    const c = commande();
    await expect(creerDependancesVideoLongue(c, f.ports).voix.lire(morceau(c))).rejects.toBeInstanceOf(ErreurVideoLongue);
    expect(f.base.get(`d.${VIDEO}`)).toBe(pireCasVoixCentimesUsd(morceau(c).texte.length));
  });
});

describe("VL-07 — chemin gardé, aligneur, montage", () => {
  it("réservation refusée (crédits) : aucun appel, registre rendu", async () => {
    const f = faux({ refusReservation: true });
    const c = commande();
    await expect(creerDependancesVideoLongue(c, f.ports).voix.lire(morceau(c))).rejects.toThrow("crédits insuffisants");
    expect(f.appelsVoix).toHaveLength(0);
    expect(f.base.get(`d.${VIDEO}`)).toBe(0);
  });
  it("montage non relié : aucune voix lue, rien n'est payé", async () => {
    const f = faux({ montagePret: false });
    const c = commande();
    await expect(creerDependancesVideoLongue(c, f.ports).voix.lire(morceau(c))).rejects.toMatchObject({ motif: "montage-non-relie" });
    expect(total(f)).toBe(0);
  });
  it("l'aligneur ne sert que si la voix ne rend aucun mot", async () => {
    const f = faux();
    f.ports.lireMorceau = async (t) => (f.appelsVoix.push(t), { dureeSec: 5, mots: [] });
    const c = commande();
    const r = await creerDependancesVideoLongue(c, f.ports).voix.lire(morceau(c));
    expect(f.appelsAligneur).toBe(1);
    expect(r.mots).toHaveLength(1);
  });
  it("allumé et accordé : le montage passe par le port", async () => {
    const f = faux();
    const r = await creerDependancesVideoLongue(commande(), f.ports).monter("16:9", ctxMontage);
    expect(r.fichierCle).toBe("k");
    expect(f.appelsMontage).toBe(1);
  });
});
