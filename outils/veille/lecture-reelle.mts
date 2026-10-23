/**
 * PREUVE du lot B2 : lecture RÉELLE des sources publiques de la veille (registre npm, GitHub, pages de nouveautés,
 * catalogue fal.ai). Gratuit, aucune clé (sauf GITHUB_TOKEN_VEILLE facultatif). Aucune donnée du studio modifiée.
 * Usage : npx tsx outils/veille/lecture-reelle.mts
 * Sorties : docs/captures/veille/lecture-reelle.json (résultats) et tests/fixtures/b2-*.json (réponses enregistrées,
 * tronquées, rejouées par les tests sans réseau).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { VeilleOutil } from "@/domaine/types";
import { DELAI_SOURCE_MS, empreinte } from "@/veille/http";
import { lireSource } from "@/veille/lecture";
import { OUTILS_DEPART, outilNeuf } from "@/veille/outils-depart";
import { texteLisible } from "@/veille/page";
import { deciderApresLecture, etatOutil } from "@/veille/regles";
import { resumerNouveauteSimule } from "@/veille/resume-simule";

const racine = process.cwd();
const maintenant = new Date();
const iso = maintenant.toISOString();

// Journal des appels (adresse, statut, taille) et enregistrement des réponses pour les tests.
const appels: { url: string; statut: number; octets: number; ms: number }[] = [];
const enregistrees = new Map<string, string>();
const appeler: typeof fetch = async (entree, init) => {
  const url = String(entree);
  const t0 = Date.now();
  const r = await fetch(entree, init);
  const corps = await r.text();
  appels.push({ url, statut: r.status, octets: corps.length, ms: Date.now() - t0 });
  enregistrees.set(url, corps);
  return new Response(corps, { status: r.status, headers: r.headers });
};

const contexte = { appeler, env: { GITHUB_TOKEN_VEILLE: process.env.GITHUB_TOKEN_VEILLE }, maintenant, delaiMs: DELAI_SOURCE_MS };

const resultats = [];
for (const o of OUTILS_DEPART) {
  const outil = outilNeuf(o, iso);
  const lecture = await lireSource(o.source, contexte);
  const decision = deciderApresLecture(outil, lecture, iso);
  const resume = decision.nouveaute
    ? resumerNouveauteSimule({ outil: o.nom, role: o.role, versionUtilisee: o.versionUtilisee, versionVue: decision.nouveaute.versionVue, notes: decision.nouveaute.notes })
    : undefined;
  const maj = { ...outil, ...decision.patch } as VeilleOutil;
  const etat = etatOutil(maj, resume ? [{ statut: "nouvelle", rouge: resume.rouge }] : [], lecture.ok);
  resultats.push({
    outil: o.nom,
    source: o.source,
    versionUtilisee: o.versionUtilisee ?? null,
    lecture: lecture.ok ? { version: lecture.version ?? null, date: lecture.date ?? null, lien: lecture.lien ?? null, empreinte: lecture.empreinte ?? null, fichiers: lecture.fichiers ?? null } : { muette: lecture.raison },
    etat,
    nouveaute: decision.nouveaute ? { versionVue: decision.nouveaute.versionVue, resume } : null,
  });
  console.log(`${o.nom.padEnd(24)} ${etat.padEnd(12)} utilisée ${String(o.versionUtilisee ?? "—").padEnd(28)} dernière ${lecture.ok ? (lecture.version ?? "(empreinte seule)") : `MUETTE : ${lecture.raison}`}`);
}

// Remotion : changement SIMULÉ de LICENSE.md sur la lecture réelle → alerte rouge.
const remotion = resultats.find((r) => r.outil === "Remotion")!;
let licence: unknown = null;
if (remotion.lecture && "fichiers" in remotion.lecture && remotion.lecture.fichiers) {
  const o = OUTILS_DEPART.find((x) => x.id === "veille-remotion")!;
  const lu = { ...outilNeuf(o, iso), verifieLe: iso, derniereVersion: remotion.lecture.version ?? undefined, empreinte: JSON.stringify({ contenu: remotion.lecture.empreinte, fichiers: remotion.lecture.fichiers }) };
  const modifiee = { ok: true as const, version: remotion.lecture.version ?? undefined, notes: "", empreinte: remotion.lecture.empreinte ?? undefined, fichiers: { "LICENSE.md": empreinte("texte de licence modifié") } };
  const d = deciderApresLecture(lu, modifiee, iso);
  const r = d.nouveaute && resumerNouveauteSimule({ outil: "Remotion", role: o.role, versionUtilisee: o.versionUtilisee, versionVue: d.nouveaute.versionVue, notes: d.nouveaute.notes });
  licence = { fichiersChanges: d.nouveaute?.fichiersChanges, rouge: r ? r.rouge || !!d.nouveaute?.fichiersChanges.length : false, risque: r && r.risque };
  console.log(`Remotion, LICENSE.md modifié (simulé) → rouge = ${JSON.stringify(licence)}`);
}

const sortie = join(racine, "docs", "captures", "veille");
mkdirSync(sortie, { recursive: true });
writeFileSync(
  join(sortie, "lecture-reelle.json"),
  JSON.stringify({ le: iso, cout: "0 € (pages publiques, aucune clé)", appels: appels.map((a) => ({ ...a, url: a.url.replace(/([?&](?:key|token)=)[^&]+/gi, "$1…") })), resultats, remotionLicenceModifieeSimulee: licence }, null, 2) + "\n",
);

// Réponses enregistrées pour les tests (tronquées, sans aucune clé).
const fixtures = join(racine, "tests", "fixtures");
const get = (u: string) => enregistrees.get(u);
const npm = JSON.parse(get("https://registry.npmjs.org/remotion") ?? "{}");
writeFileSync(join(fixtures, "b2-npm-remotion.json"), JSON.stringify({ "dist-tags": { latest: npm["dist-tags"]?.latest }, time: { [npm["dist-tags"]?.latest]: npm.time?.[npm["dist-tags"]?.latest] } }, null, 2) + "\n");
const rel = JSON.parse(get("https://api.github.com/repos/remotion-dev/remotion/releases/latest") ?? "{}");
writeFileSync(join(fixtures, "b2-github-remotion.json"), JSON.stringify({ tag_name: rel.tag_name, published_at: rel.published_at, html_url: rel.html_url, body: String(rel.body ?? "").slice(0, 1500) }, null, 2) + "\n");
const lic = get("https://raw.githubusercontent.com/remotion-dev/remotion/HEAD/LICENSE.md") ?? "";
writeFileSync(join(fixtures, "b2-remotion-license.json"), JSON.stringify({ texte: lic }, null, 2) + "\n");
const refs = JSON.parse(get("https://api.github.com/repos/FFmpeg/FFmpeg/git/matching-refs/tags/") ?? "[]") as { ref: string }[];
writeFileSync(join(fixtures, "b2-github-ffmpeg-refs.json"), JSON.stringify(refs.slice(-40).map((r) => ({ ref: r.ref })), null, 2) + "\n");
const fal = [...enregistrees.entries()].filter(([u]) => u.startsWith("https://api.fal.ai/v1/models?category=")).map(([u, c]) => [u, JSON.parse(c)] as const);
writeFileSync(
  join(fixtures, "b2-fal.json"),
  JSON.stringify(Object.fromEntries(fal.map(([u, p]) => [new URL(u).searchParams.get("category"), { models: (p.models as { endpoint_id: string; metadata?: Record<string, unknown> }[]).sort((a, b) => String(b.metadata?.date ?? "").localeCompare(String(a.metadata?.date ?? ""))).slice(0, 6).map((m) => ({ endpoint_id: m.endpoint_id, metadata: { display_name: m.metadata?.display_name, category: m.metadata?.category, description: String(m.metadata?.description ?? "").slice(0, 200), status: m.metadata?.status, date: m.metadata?.date } })), has_more: false }])), null, 2) + "\n",
);
for (const [nom, url] of [["heygen", "https://developers.heygen.com/changelog"], ["elevenlabs", "https://elevenlabs.io/docs/changelog"]] as const) {
  const t = texteLisible(get(url) ?? "");
  writeFileSync(join(fixtures, `b2-page-${nom}.json`), JSON.stringify({ url, texte: t.slice(0, 6000) }, null, 2) + "\n");
}
console.log(`\n${appels.length} lectures, 0 € ; résultats : docs/captures/veille/lecture-reelle.json`);
