/**
 * FICHE DE SCÈNES DU TABLEAU ANIMÉ (tâche TB-21) : pages et scènes en blocs, lisibles par Will. Pour chaque scène :
 * ce que dit la voix, ce que le stylo écrit, les dessins, les gestes, les mots importants ; et, à côté de la scène
 * fautive, les refus des règles en phrases simples. Lecture seule : reçoit la fiche et les refus tels quels.
 */
import type { ProblemeFiche } from "@/briques/fiche-scenes";
import { Icone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import { cn } from "@/lib/cn";
import type { FicheTableau } from "@/moteurs/montage-tableau/fiche";
import { pagesDeLaFiche, type SceneLue } from "./vue";

export function FicheScenesTableau({ fiche, problemes = [] }: { fiche: Pick<FicheTableau, "scenes">; problemes?: readonly ProblemeFiche[] }) {
  const { pages, refusGeneraux } = pagesDeLaFiche(fiche, problemes);
  const aCorriger = problemes.length;
  return (
    <section aria-label="Les scènes" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-titre text-2xl text-texte">Les scènes</p>
        {aCorriger ? (
          <Pastille ton="brique" icone="attention">
            {aCorriger === 1 ? "1 point à revoir" : `${aCorriger} points à revoir`}
          </Pastille>
        ) : (
          <Pastille ton="sauge" icone="coche">
            Tout est bon
          </Pastille>
        )}
      </div>

      {refusGeneraux.length > 0 && <Refus phrases={refusGeneraux} />}

      {pages.map((p) => (
        <div key={p.numero} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-texte-faible">Page {p.numero}</p>
          <ol className="space-y-2">
            {p.scenes.map((s) => (
              <BlocScene key={s.cle} scene={s} />
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

function BlocScene({ scene }: { scene: SceneLue }) {
  const fautive = scene.refus.length > 0;
  return (
    <li className={cn("rounded-2xl border px-4 py-3", fautive ? "border-brique/40 bg-brique-doux" : "border-trait bg-surface-1")}>
      <p className="flex items-center gap-2 text-[15px] font-semibold text-texte">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-sm text-texte-doux">{scene.numero}</span>
        {scene.nom}
      </p>
      <dl className="mt-2 space-y-1.5 text-[15px]">
        <Ligne titre="La voix dit">« {scene.dit} »</Ligne>
        {scene.ecrit.length > 0 && <Ligne titre="Écrit">{scene.ecrit.join(" · ")}</Ligne>}
        {scene.dessins.length > 0 && <Ligne titre="Dessin">{scene.dessins.join(" · ")}</Ligne>}
        {scene.visuel && <Ligne titre="Visuel">{scene.visuel}</Ligne>}
        {scene.gestes.length > 0 && <Ligne titre="Geste">{scene.gestes.join(" · ")}</Ligne>}
        {scene.importants.length > 0 && <Ligne titre="Mots importants">{scene.importants.join(" · ")}</Ligne>}
      </dl>
      {fautive && <Refus phrases={scene.refus} className="mt-3" />}
    </li>
  );
}

function Ligne({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
      <dt className="text-texte-faible">{titre}</dt>
      <dd className="min-w-0 text-texte">{children}</dd>
    </div>
  );
}

function Refus({ phrases, className }: { phrases: readonly string[]; className?: string }) {
  return (
    <ul role="alert" className={cn("space-y-1 rounded-xl border border-brique/40 bg-fond px-3 py-2", className)}>
      {phrases.map((phrase, i) => (
        <li key={i} className="flex items-start gap-2 text-[15px] text-texte">
          <Icone nom="attention" size={16} className="mt-0.5 shrink-0 text-brique" />
          <span className="min-w-0">{phrase}</span>
        </li>
      ))}
    </ul>
  );
}
