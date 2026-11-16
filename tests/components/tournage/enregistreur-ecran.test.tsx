/**
 * G15-03 · Enregistreur d'écran (composant neuf, monté nulle part). Sans DOM : doublures de `getDisplayMedia` et de
 * `MediaRecorder`, aucun appel réel, aucun envoi. On lit l'arbre rendu et on appelle nous-mêmes les gestes.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("../../aides/crochets-factices")).crochets }));

const { attendre, monter, trouver, texteDe } = await import("../../aides/crochets-factices");
const { EnregistreurEcran, AVERTISSEMENT_ECRAN } = await import("@/components/tournage/EnregistreurEcran");

const AVERTISSEMENT = "Fermez vos messages et vos mots de passe : tout ce qui est à l'écran sera filmé.";
const lisible = (n: ReactNode) => texteDe(n);
const bouton = (arbre: ReactNode, libelle: string) =>
  trouver(arbre, (e) => typeof e.props.onClick === "function" && (lisible(e.props.children as ReactNode).includes(libelle) || e.props["aria-label"] === libelle))[0];
const clic = async (arbre: ReactNode, libelle: string) => {
  const b = bouton(arbre, libelle);
  expect(b, `bouton « ${libelle} »`).toBeTruthy();
  await (b.props.onClick as () => unknown)();
  await attendre();
};

let enregistreurs: EnregistreurDouble[] = [];
class EnregistreurDouble {
  state = "inactive";
  mimeType = "video/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public flux: unknown) {
    enregistreurs.push(this);
  }
  static isTypeSupported = () => true;
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["x"], { type: "video/webm" }) });
    this.onstop?.();
  }
}
const piste = () => ({ stop: vi.fn(), onended: null as null | (() => void), addEventListener: vi.fn() });
const fluxDouble = () => ({ getTracks: () => [piste()], getVideoTracks: () => [piste()] });

const globaux = globalThis as unknown as Record<string, unknown>;
const avant = { navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"), MediaRecorder: globaux.MediaRecorder };
function poserNavigateur(mediaDevices: unknown) {
  Object.defineProperty(globalThis, "navigator", { value: { mediaDevices }, configurable: true });
}

beforeEach(() => {
  enregistreurs = [];
  globaux.MediaRecorder = EnregistreurDouble;
});
afterEach(() => {
  if (avant.navigator) Object.defineProperty(globalThis, "navigator", avant.navigator);
  globaux.MediaRecorder = avant.MediaRecorder;
});

describe("EnregistreurEcran", () => {
  it("affiche l'avertissement AVANT le bouton « Commencer »", () => {
    expect(AVERTISSEMENT_ECRAN).toBe(AVERTISSEMENT);
    const html = renderToStaticMarkup(<EnregistreurEcran onTermine={() => undefined} />);
    const texte = html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'");
    expect(texte).toContain(AVERTISSEMENT);
    expect(html.indexOf("Fermez vos messages")).toBeGreaterThan(-1);
    expect(html.indexOf("Fermez vos messages")).toBeLessThan(html.indexOf("Commencer"));
  });

  it("navigateur sans getDisplayMedia : phrase claire, aucun plantage", async () => {
    poserNavigateur({});
    const m = monter(EnregistreurEcran, { onTermine: vi.fn() });
    await clic(m.rendre(), "Commencer");
    expect(lisible(m.rendre())).toContain("n'est pas possible sur ce navigateur");
  });

  it("navigateur sans mediaDevices du tout : même phrase", async () => {
    poserNavigateur(undefined);
    const m = monter(EnregistreurEcran, { onTermine: vi.fn() });
    await clic(m.rendre(), "Commencer");
    expect(lisible(m.rendre())).toContain("n'est pas possible sur ce navigateur");
  });

  it("refus de partage : phrase claire, on peut réessayer", async () => {
    poserNavigateur({ getDisplayMedia: vi.fn(async () => Promise.reject(Object.assign(new Error("refus"), { name: "NotAllowedError" }))) });
    const onTermine = vi.fn();
    const m = monter(EnregistreurEcran, { onTermine });
    await clic(m.rendre(), "Commencer");
    expect(lisible(m.rendre())).toContain("Le partage d'écran a été refusé");
    expect(bouton(m.rendre(), "Commencer")).toBeTruthy();
    expect(onTermine).not.toHaveBeenCalled();
  });

  it("arrêt : onTermine appelé une seule fois avec un Blob, et les pistes sont fermées", async () => {
    const flux = fluxDouble();
    const pistes = flux.getTracks();
    flux.getTracks = () => pistes;
    flux.getVideoTracks = () => pistes;
    poserNavigateur({ getDisplayMedia: vi.fn(async () => flux) });
    const onTermine = vi.fn();
    const m = monter(EnregistreurEcran, { onTermine });
    await clic(m.rendre(), "Commencer");
    expect(enregistreurs).toHaveLength(1);
    expect(enregistreurs[0].state).toBe("recording");
    await clic(m.rendre(), "Arrêter");
    await clic(m.rendre(), "Arrêter").catch(() => undefined);
    expect(onTermine).toHaveBeenCalledTimes(1);
    expect(onTermine.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(pistes[0].stop).toHaveBeenCalled();
  });

  it("garde : aucun fichier n'importe EnregistreurEcran (composant non branché)", () => {
    const racine = join(__dirname, "../../..");
    const fichiers: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        if (n === "node_modules" || n === ".next" || n === ".git") continue;
        const p = join(d, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.(tsx?|mjs|js)$/.test(n)) fichiers.push(p);
      }
    };
    parcourir(join(racine, "src"));
    parcourir(join(racine, "tests"));
    const importeurs = fichiers.filter((f) => !f.endsWith("enregistreur-ecran.test.tsx") && !f.endsWith("EnregistreurEcran.tsx") && /EnregistreurEcran/.test(readFileSync(f, "utf8")));
    expect(importeurs).toEqual([]);
  });
});
