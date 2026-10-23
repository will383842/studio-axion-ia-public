/**
 * L10 · Banc « rendu fidèle à la prod » : le lecteur des `COPY` du Dockerfile (pur). Le rendu lui-même (npm ci, Remotion,
 * navigateur) tourne en routine cloud, pas dans vitest.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copiesDuDockerfile, fichiersImportes, sourcesDuDossier } from "../../scripts/image-video/galerie-prod";

describe("copiesDuDockerfile", () => {
  it("lit les COPY, ignore --from et --chown, résout les destinations relatives par le WORKDIR (« / » final gardé)", () => {
    const texte = ["FROM x AS ffmpeg", "FROM node", "COPY --from=ffmpeg /ffmpeg /usr/local/bin/", "WORKDIR /app/studio-rendu", "COPY --chown=a:a studio-rendu/package.json studio-rendu/package-lock.json ./", "COPY --chown=a:a src/briques/motion /app/src/briques/motion"].join("\n");
    expect(copiesDuDockerfile(texte)).toEqual([
      { sources: ["studio-rendu/package.json", "studio-rendu/package-lock.json"], destination: "/app/studio-rendu/" },
      { sources: ["src/briques/motion"], destination: "/app/src/briques/motion" },
    ]);
  });
  it("sur le vrai Dockerfile : compositions, src du paquet et briques lues par les compositions", () => {
    const copies = copiesDuDockerfile(readFileSync(join(process.cwd(), "deploiement/studio-rendu/Dockerfile"), "utf8"));
    const sources = copies.flatMap((c) => c.sources);
    for (const s of ["studio-rendu/compositions", "studio-rendu/src", "src/briques/habillage", "src/briques/ecrans-motion", "src/briques/composition/scene.ts"]) expect(sources).toContain(s);
    expect(sources.some((s) => s.includes("--"))).toBe(false);
  });
});

describe("L17 · le Dockerfile de prod copie tout ce que lisent les compositions", () => {
  const copies = copiesDuDockerfile(readFileSync(join(process.cwd(), "deploiement/studio-rendu/Dockerfile"), "utf8"));
  /** Un fichier `src/…` du dépôt est-il dans l'image (copié seul, ou par un dossier qui le contient) ? */
  const copie = (fichier: string) => copies.some((c) => c.sources.some((s) => fichier === s || fichier.startsWith(`${s}/`)));

  it("compositions image-video : chaque fichier de src/ atteint par leurs imports (de proche en proche) est copié", () => {
    const lus = fichiersImportes(sourcesDuDossier("studio-rendu/compositions/image-video")).filter((f) => f.startsWith("src/"));
    // Les dossiers attendus aujourd'hui : un import nouveau vers src/ entre ici sans rien changer au test.
    const dossiers = [...new Set(lus.map((f) => f.split("/").slice(0, 3).join("/")))].sort();
    expect(dossiers).toEqual(expect.arrayContaining(["src/briques/schema-motion", "src/briques/habillage", "src/briques/ecrans-motion"]));
    expect(lus).toContain("src/briques/schema-motion/cadrage.ts");
    expect(lus.filter((f) => !copie(f))).toEqual([]);
  });

  it("toute la Racine de prod (compositions et src du paquet) : aucun fichier de src/ lu et non copié", () => {
    const lus = fichiersImportes([...sourcesDuDossier("studio-rendu/compositions"), ...sourcesDuDossier("studio-rendu/src")]).filter((f) => f.startsWith("src/"));
    expect(lus.filter((f) => !copie(f))).toEqual([]);
  });

  it("le test rougit sur un dossier non copié (Dockerfile sans la ligne schema-motion)", () => {
    const sans = copies.filter((c) => !c.sources.includes("src/briques/schema-motion"));
    const lus = fichiersImportes(sourcesDuDossier("studio-rendu/compositions/image-video")).filter((f) => f.startsWith("src/"));
    expect(lus.filter((f) => !sans.some((c) => c.sources.some((s) => f === s || f.startsWith(`${s}/`)))).length).toBeGreaterThan(0);
  });
});
