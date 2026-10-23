/**
 * V4-1 dans la chaîne de fabrication (doubles seulement, aucun appel réel) :
 *  - l'image de l'annonce, déposée, arrive dans le téléphone de l'étape « L'annonce » ; pas déposée : repli dessiné ;
 *  - la voix assemblée coupée net (celle de la v4) ARRÊTE la fabrication à l'étape voix, avec une phrase claire ;
 *    une voix dite jusqu'au bout passe.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ProprietesEcran } from "@/briques/ecrans-motion";
import { ErreurFabricationCasConcret, fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { doubles, type Doubles } from "../fabriquer/doubles";

const CLE_ANNONCE = "visuels-cas-concret/recrutement-apporteurs/annonce.png";
const estAssemblee = (cle: string) => cle.includes("cc-recette");

/** WAV PCM 16 bits mono. */
function wav(echantillons: Float32Array, frequence: number): Uint8Array {
  const b = Buffer.alloc(44 + echantillons.length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + echantillons.length * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(frequence, 24);
  b.writeUInt32LE(frequence * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(echantillons.length * 2, 40);
  echantillons.forEach((x, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x)) * 32767), 44 + i * 2));
  return new Uint8Array(b);
}

/** Voix dite jusqu'au bout : un son de 150 s qui s'éteint doucement (0,3 s) puis 1 s de silence. */
function voixEntiere(): Uint8Array {
  const f = 8000;
  const x = new Float32Array(151 * f);
  for (let i = 0; i < 150 * f; i++) x[i] = 0.3 * Math.min(1, (150 - i / f) / 0.3) * Math.sin((2 * Math.PI * 200 * i) / f);
  return wav(x, f);
}

async function echec(d: Doubles): Promise<ErreurFabricationCasConcret> {
  const err = await fabriquerCasConcret(d.options).then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ErreurFabricationCasConcret);
  return err as ErreurFabricationCasConcret;
}

/** Propriétés de l'écran « étape 1 » rendues (corps). */
const etape1 = (d: Doubles) =>
  d
    .ecransSoumis()
    .map((s) => (s.parametres as { proprietes: ProprietesEcran }).proprietes)
    .find((p) => p.type === "etape" && p.numero === 1);

describe("V4-1 · image de l'annonce dans la chaîne", () => {
  it("image déposée : le téléphone de l'étape 1 montre l'annonce", async () => {
    const d = doubles();
    d.partage.fichiers.add(CLE_ANNONCE);
    const cr = await fabriquerCasConcret(d.options);
    const p = etape1(d);
    expect(p && p.type === "etape" && "capture" in p.visuel ? p.visuel.capture.cle : null).toBe(CLE_ANNONCE);
    expect(cr.journalCaptures, cr.journalCaptures.join("\n")).not.toContainEqual(expect.stringMatching(/L'annonce/));
  });

  it("image pas déposée : repli dessiné, dit dans les vérifications", async () => {
    const d = doubles();
    const cr = await fabriquerCasConcret(d.options);
    const p = etape1(d);
    expect(p && p.type === "etape" && p.visuel).toEqual({ objet: "telephone-notification" });
    expect(cr.journalCaptures.join(" ")).toMatch(/L'annonce.*pas déposée/);
  });
});

describe("V4-1 · contrôle bloquant de la fin de la voix dans la chaîne", () => {
  it("la voix de la v4 (coupée net dans « machine ») arrête la fabrication à l'étape voix", async () => {
    const d = doubles();
    const coupee = new Uint8Array(readFileSync(join(__dirname, "sons/v4-fin-coupee.wav")));
    d.options.outils.voix.lireSon = async (cle) => (estAssemblee(cle) ? coupee : null);
    const err = await echec(d);
    expect(err.etape).toBe("voix");
    expect(err.raisons.join(" ")).toMatch(/coupée net.*pas dite jusqu'au bout.*Relancez la voix/);
    // Rien n'est rendu après une voix refusée.
    expect(d.ecransSoumis()).toHaveLength(0);
  });

  it("le son brut (MP3 de la voix) est copié en WAV pour être mesuré : les coupes vont dans ses blancs (essai réel du 14/10)", async () => {
    const d = doubles();
    const entiere = voixEntiere();
    const lus: string[] = [];
    d.options.outils.voix.lireSon = async (cle) => {
      lus.push(cle);
      return estAssemblee(cle) || cle.includes("cc-brut-wav") ? entiere : null;
    };
    await expect(fabriquerCasConcret(d.options)).resolves.toBeTruthy();
    // Chaque son brut illisible a été copié en WAV, puis ce WAV a été lu pour mesurer ses blancs.
    expect(lus.some((cle) => cle.includes("cc-brut-wav"))).toBe(true);
  });

  it("une voix dite jusqu'au bout passe", async () => {
    const d = doubles();
    const entiere = voixEntiere();
    d.options.outils.voix.lireSon = async (cle) => (estAssemblee(cle) ? entiere : null);
    await expect(fabriquerCasConcret(d.options)).resolves.toBeTruthy();
  });
});
