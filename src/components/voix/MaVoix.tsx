"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import {
  ajouterPilierAction,
  ajouterTexteAction,
  ajouterTournureAction,
  confirmerInterditAction,
  niveauTournureAction,
  prononciationEcouteeAction,
  rangerTournureAction,
  regleRelueAction,
  retirerPilierAction,
  sigleTelQuelAction,
  texteRetenuAction,
  validerExpressionAction,
  validerFicheAction,
  validerPilierAction,
} from "@/app/(studio)/ecrire/voix/actions";
import { positionAction } from "@/app/(studio)/ecrire/matieres/actions";
import type { ContexteAxion, ExempleStyle, Matiere, TourneInterdite } from "@/domaine/types";
import type { ExpressionProposee } from "@/domaine/voix";
import type { FileAValider, VueFiche, VueRegle } from "@/services/voix";
import type { VueInterdits } from "@/services/contexte-axion";
import { Bouton, Icone, Interrupteur, LogoReseau, notifier, Pastille, ZoneTexte, type NomIcone } from "@/components/ui";
import { ajouterDicte, BoutonMicro, useDictee } from "@/components/matieres/Dictee";
import { cn } from "@/lib/cn";

type Resultat = { ok: true } | { ok: false; message: string };

async function faire(f: () => Promise<Resultat>, ok?: string): Promise<boolean> {
  const r = await f();
  if (!r.ok) {
    notifier.erreur(r.message);
    return false;
  }
  if (ok) notifier.succes(ok);
  return true;
}

/** Une rubrique repliable : icône, titre, pastille « à faire », contenu. */
function Rubrique({ id, icone, titre, aFaire, compteur, ouverte, onBasculer, children }: { id: string; icone: NomIcone; titre: string; aFaire?: number; compteur?: number; ouverte: boolean; onBasculer: () => void; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-b border-trait last:border-b-0">
      <button type="button" onClick={onBasculer} aria-expanded={ouverte} className="flex min-h-14 w-full items-center gap-3 px-4 text-left">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-texte-doux">
          <Icone nom={icone} size={18} />
        </span>
        <span className="flex-1 text-[15px] font-semibold text-texte">{titre}</span>
        {!!aFaire && (
          <Pastille ton="ambre" point>
            {aFaire}
          </Pastille>
        )}
        {compteur !== undefined && !aFaire && <span className="text-sm tabular-nums text-texte-faible">{compteur}</span>}
        <Icone nom="chevron-bas" size={18} className={cn("text-texte-faible transition-transform", ouverte && "rotate-180")} />
      </button>
      {ouverte && <div className="space-y-4 px-4 pb-5">{children}</div>}
    </section>
  );
}

function Puce({ children, ton = "neutre", onClick, icone, actif }: { children: ReactNode; ton?: "neutre" | "sauge" | "orange"; onClick?: () => void; icone?: NomIcone; actif?: boolean }) {
  const classe = cn(
    "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold",
    ton === "sauge" && "border-sauge/40 bg-sauge-doux text-sauge",
    ton === "orange" && "border-orange/40 bg-orange-doux text-orange-vif",
    ton === "neutre" && "border-trait bg-surface-1 text-texte",
  );
  if (!onClick)
    return (
      <span className={classe}>
        {icone && <Icone nom={icone} size={14} />}
        {children}
      </span>
    );
  return (
    <button type="button" onClick={onClick} aria-pressed={actif} className={cn(classe, "hover:brightness-110")}>
      {icone && <Icone nom={icone} size={14} />}
      {children}
    </button>
  );
}

function AjoutTexte() {
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const champ = useRef<HTMLTextAreaElement>(null);
  const micro = useDictee((m) => setTexte((t) => ajouterDicte(t, m)), champ);
  return (
    <div className="space-y-3 rounded-2xl bg-surface-2 p-4">
      <BoutonMicro taille="md" ecoute={micro.ecoute} onClick={micro.basculer} libelle="Un texte à vous" />
      <ZoneTexte ref={champ} libelle="Un texte à vous" libelleMasque value={texte} onChange={(e) => setTexte(e.target.value)} rows={3} placeholder="Un post, un mémo, ce que vous diriez face caméra." />
      <Bouton
        pleineLargeur
        icone="coche"
        chargement={envoi}
        disabled={!texte.trim()}
        onClick={async () => {
          micro.arreter();
          setEnvoi(true);
          if (await faire(() => ajouterTexteAction(texte), "Texte gardé")) setTexte("");
          setEnvoi(false);
        }}
      >
        Garder
      </Bouton>
    </div>
  );
}

function AjoutCourt({ libelle, onAjouter, enfants }: { libelle: string; onAjouter: (t: string) => Promise<boolean>; enfants?: ReactNode }) {
  const [texte, setTexte] = useState("");
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (texte.trim() && (await onAjouter(texte.trim()))) setTexte("");
      }}
    >
      <input
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        aria-label={libelle}
        placeholder={libelle}
        className="min-h-11 min-w-0 flex-1 rounded-full border border-trait bg-surface-1 px-4 text-[15px] text-texte placeholder:text-texte-faible focus:border-orange focus:outline-none"
      />
      {enfants}
      <button type="submit" aria-label="Ajouter" disabled={!texte.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-orange text-sur-orange disabled:opacity-40">
        <Icone nom="plus" size={20} />
      </button>
    </form>
  );
}

function jour(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
}

export interface DonneesMaVoix {
  fiche: VueFiche;
  textes: ExempleStyle[];
  expressions: ExpressionProposee[];
  avis: Matiere[];
  contexte: ContexteAxion;
  interdits: VueInterdits;
  /** Vérification E2E n° 1, n° 26 : `libelle` lisible (« à l'ère de »), le motif normalisé n'est jamais montré. */
  tournures: (TourneInterdite & { libelle?: string })[];
  regles: VueRegle[];
  file: FileAValider;
}

/**
 * « MA VOIX » (plan v5 B.6.1) : ma façon de parler, mes textes, carnet de voix, mes positions, mes thèmes, mes
 * interdits, tournures interdites, règles des réseaux, prononciation. Tout se valide d'un toucher.
 */
export function MaVoix({ d, ouverteInitiale }: { d: DonneesMaVoix; ouverteInitiale?: string }) {
  const [ouverte, setOuverte] = useState<string | null>(ouverteInitiale ?? null);
  const [toutesTournures, setToutesTournures] = useState(false);
  const [niveauNouveau, setNiveauNouveau] = useState<TourneInterdite["niveau"]>("bloquant");
  const basculer = (id: string) => setOuverte((o) => (o === id ? null : id));
  const f = d.fiche;
  const ficheAValider = !f.fiche?.valideeParWillLe;
  const themesAValider = (d.contexte.piliersProposes ?? []).filter((p) => !d.contexte.piliers.some((x) => x.id === p.id));
  const interditsAConfirmer = d.interdits.actifs.filter((i) => !i.confirmeLe).length + d.interdits.proposes.length;
  const reglesARevoir = d.regles.filter((r) => r.aRevoir);
  const tournuresVisibles = toutesTournures ? d.tournures : d.tournures.slice(0, 8);

  return (
    <div className="overflow-hidden rounded-carte border border-trait bg-surface-1">
      <Rubrique id="facon" icone="citation" titre="Ma façon de parler" aFaire={ficheAValider ? 1 : 0} ouverte={ouverte === "facon"} onBasculer={() => basculer("facon")}>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-surface-2 p-3">
            <p className="font-titre text-3xl tabular-nums text-texte">{f.proposition.tireeDe.length ? f.proposition.longueurPhraseMediane : (f.fiche?.longueurPhraseMediane ?? 0)}</p>
            <p className="text-xs text-texte-faible">mots par phrase</p>
          </div>
          <div className="rounded-2xl bg-surface-2 p-3">
            <p className="font-titre text-3xl tabular-nums text-texte">{f.proposition.tireeDe.length}</p>
            <p className="text-xs text-texte-faible">textes lus</p>
          </div>
        </div>
        {(f.fiche?.expressions.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2">
            {f.fiche!.expressions.map((e) => (
              <Puce key={e} ton="sauge">
                {e}
              </Puce>
            ))}
          </div>
        )}
        {!f.depuisReglage && !f.proposition.tireeDe.length && <p className="text-sm text-texte-doux">Dictez d&apos;abord quelques textes à vous.</p>}
        {f.fiche?.valideeParWillLe && <p className="text-xs text-texte-faible">Validée le {jour(f.fiche.valideeParWillLe)}</p>}
        <Bouton pleineLargeur icone="coche" variante={ficheAValider ? "principal" : "secondaire"} onClick={() => faire(validerFicheAction, "Façon de parler validée")}>
          {ficheAValider ? "Valider" : "Mettre à jour"}
        </Bouton>
      </Rubrique>

      <Rubrique id="textes" icone="document" titre="Mes textes" compteur={d.textes.filter((t) => t.retenu).length} ouverte={ouverte === "textes"} onBasculer={() => basculer("textes")}>
        <AjoutTexte />
        <ul className="space-y-2">
          {d.textes.map((t) => (
            <li key={t.id} className="rounded-2xl border border-trait p-3">
              <p className={cn("line-clamp-2 text-sm text-texte", !t.retenu && "text-texte-faible")}>{t.texte}</p>
              <Interrupteur libelle={`${t.mots} mots`} coche={t.retenu} onChange={(v) => faire(() => texteRetenuAction(t.id, v))} className="min-h-10" />
            </li>
          ))}
        </ul>
      </Rubrique>

      <Rubrique id="carnet" icone="etincelles" titre="Mes expressions" aFaire={d.expressions.length} compteur={d.contexte.carnetVoix.length} ouverte={ouverte === "carnet"} onBasculer={() => basculer("carnet")}>
        {d.expressions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {d.expressions.map((e) => (
              <Puce key={e.expression} ton="orange" icone="plus" onClick={() => faire(() => validerExpressionAction(e.expression, e.texteSourceId))}>
                {e.expression}
              </Puce>
            ))}
          </div>
        )}
        {d.contexte.carnetVoix.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {d.contexte.carnetVoix.map((e) => (
              <Puce key={e.expression} ton="sauge" icone="coche">
                {e.expression}
              </Puce>
            ))}
          </div>
        )}
        {!d.expressions.length && !d.contexte.carnetVoix.length && <p className="text-sm text-texte-doux">Elles apparaissent quand une tournure revient dans deux de vos textes.</p>}
      </Rubrique>

      <Rubrique id="positions" icone="etoile" titre="Mes positions" compteur={d.contexte.positionIds.length} ouverte={ouverte === "positions"} onBasculer={() => basculer("positions")}>
        {d.avis.length ? (
          <ul className="space-y-2">
            {d.avis.map((a) => (
              <li key={a.id} className="rounded-2xl border border-trait px-3">
                <Interrupteur libelle={<span className="font-medium">« {a.texte} »</span>} coche={d.contexte.positionIds.includes(a.id)} onChange={(v) => faire(() => positionAction(a.id, v))} />
              </li>
            ))}
          </ul>
        ) : (
          <Bouton asChild variante="secondaire" pleineLargeur icone="micro">
            <Link href="/ecrire/matieres?type=avis-will&ajout=matiere">Dicter un avis</Link>
          </Bouton>
        )}
      </Rubrique>

      <Rubrique id="themes" icone="grille" titre="Mes thèmes" aFaire={themesAValider.length} compteur={d.contexte.piliers.length} ouverte={ouverte === "themes"} onBasculer={() => basculer("themes")}>
        {themesAValider.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-texte-faible">Proposés</p>
            <div className="flex flex-wrap gap-2">
              {themesAValider.map((p) => (
                <Puce key={p.id} ton="orange" icone="plus" onClick={() => faire(() => validerPilierAction(p.id))}>
                  {p.nom}
                </Puce>
              ))}
            </div>
          </div>
        )}
        {d.contexte.piliers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {d.contexte.piliers.map((p) => (
              <Puce key={p.id} ton="sauge" icone="fermer" onClick={() => faire(() => retirerPilierAction(p.id))}>
                {p.nom}
              </Puce>
            ))}
          </div>
        )}
        <AjoutCourt libelle="Un autre thème" onAjouter={(t) => faire(() => ajouterPilierAction(t))} />
      </Rubrique>

      <Rubrique id="interdits" icone="bouclier" titre="Mes interdits" aFaire={interditsAConfirmer} compteur={d.interdits.actifs.length} ouverte={ouverte === "interdits"} onBasculer={() => basculer("interdits")}>
        <ul className="space-y-2">
          {[...d.interdits.actifs, ...d.interdits.proposes].map((i) => {
            const confirme = !!i.confirmeLe;
            const propose = d.interdits.proposes.some((p) => p.id === i.id);
            return (
              <li key={i.id} className="rounded-2xl border border-trait p-3">
                <p className="text-sm font-semibold leading-snug text-texte">{i.texte}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex-1 text-xs text-texte-faible">{i.origine}</span>
                  {confirme ? (
                    <Pastille ton="sauge" icone="coche">
                      Confirmé
                    </Pastille>
                  ) : (
                    <Bouton taille="md" variante={propose ? "secondaire" : "contour"} icone={propose ? "plus" : "coche"} onClick={() => faire(() => confirmerInterditAction(i.id))}>
                      {propose ? "Ajouter" : "Confirmer"}
                    </Bouton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Rubrique>

      <Rubrique id="tournures" icone="oeil-barre" titre="Tournures interdites" compteur={d.tournures.length} ouverte={ouverte === "tournures"} onBasculer={() => basculer("tournures")}>
        <AjoutCourt
          libelle="Une tournure à éviter"
          onAjouter={(t) => faire(() => ajouterTournureAction(t, niveauNouveau), "Tournure ajoutée")}
          enfants={
            <button
              type="button"
              onClick={() => setNiveauNouveau((n) => (n === "bloquant" ? "grappe" : "bloquant"))}
              className={cn("min-h-11 shrink-0 rounded-full border px-3 text-xs font-bold", niveauNouveau === "bloquant" ? "border-brique/40 bg-brique-doux text-brique" : "border-ambre/40 bg-ambre-doux text-ambre")}
            >
              {niveauNouveau === "bloquant" ? "Jamais" : "Dès 2"}
            </button>
          }
        />
        <ul className="divide-y divide-trait">
          {tournuresVisibles.map((t) => {
            // Nom lu du bouton « Ranger » : la tournure telle que Will la lit (son libellé, sinon la phrase elle-même).
            const tournure = t.libelle ?? t.motif;
            return (
            <li key={t.id} className="flex min-h-12 items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm text-texte">{t.libelle ?? t.motif}</span>
              <button
                type="button"
                onClick={() => faire(() => niveauTournureAction(t.id, t.niveau === "bloquant" ? "grappe" : "bloquant"))}
                className={cn("min-h-9 shrink-0 rounded-full border px-2.5 text-xs font-bold", t.niveau === "bloquant" ? "border-brique/40 bg-brique-doux text-brique" : "border-ambre/40 bg-ambre-doux text-ambre")}
              >
                {t.niveau === "bloquant" ? "Jamais" : "Dès 2"}
              </button>
              <button type="button" aria-label={`Ranger « ${tournure} »`} onClick={() => faire(() => rangerTournureAction(t.id))} className="grid size-9 shrink-0 place-items-center rounded-full text-texte-faible hover:bg-surface-2">
                <Icone nom="archive" size={16} />
              </button>
            </li>
            );
          })}
        </ul>
        {d.tournures.length > 8 && (
          <Bouton variante="fantome" pleineLargeur iconeDroite={toutesTournures ? "chevron-bas" : "chevron-droite"} onClick={() => setToutesTournures((x) => !x)}>
            {toutesTournures ? "Moins" : `Les ${d.tournures.length}`}
          </Bouton>
        )}
      </Rubrique>

      <Rubrique id="regles" icone="calendrier" titre="Règles des réseaux" aFaire={reglesARevoir.length} compteur={d.regles.length} ouverte={ouverte === "regles"} onBasculer={() => basculer("regles")}>
        <ul className="space-y-2">
          {(reglesARevoir.length ? reglesARevoir : d.regles.slice(0, 6)).map(({ regle: r, aRevoir }) => (
            <li key={r.id} className="rounded-2xl border border-trait p-3">
              <div className="flex items-start gap-2">
                {r.reseau !== "tous" && <LogoReseau reseau={r.reseau} taille="sm" />}
                <p className="line-clamp-3 flex-1 text-sm leading-snug text-texte">{r.texte}</p>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="flex-1 text-xs text-texte-faible">Vue le {jour(r.verifieeLe)}</span>
                {aRevoir && (
                  <Bouton taille="md" variante="secondaire" icone="coche" onClick={() => faire(() => regleRelueAction(r.id), "Règle relue")}>
                    Relue
                  </Bouton>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Rubrique>

      <Rubrique id="prononciation" icone="volume" titre="Prononciation" aFaire={d.file.siglesInconnus.length + d.file.nonEcoutees.length} ouverte={ouverte === "prononciation"} onBasculer={() => basculer("prononciation")}>
        {d.file.siglesInconnus.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-texte-faible">Se dit tel quel ?</p>
            <div className="flex flex-wrap gap-2">
              {d.file.siglesInconnus.map((s) => (
                <Puce key={s} ton="orange" icone="coche" onClick={() => faire(() => sigleTelQuelAction(s))}>
                  {s}
                </Puce>
              ))}
            </div>
          </div>
        )}
        {d.file.nonEcoutees.length > 0 && (
          <ul className="divide-y divide-trait">
            {d.file.nonEcoutees.slice(0, 8).map((p) => (
              <li key={p.id} className="flex min-h-12 items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-texte">
                  <span className="font-semibold">{p.mot}</span> <span className="text-texte-faible">→ {p.prononciation}</span>
                </span>
                <Bouton taille="md" variante="secondaire" icone="coche" onClick={() => faire(() => prononciationEcouteeAction(p.id))}>
                  Juste
                </Bouton>
              </li>
            ))}
          </ul>
        )}
        <Bouton asChild variante="fantome" pleineLargeur iconeDroite="chevron-droite">
          <Link href="/bibliotheque/prononciations">Tout le dictionnaire</Link>
        </Bouton>
      </Rubrique>
    </div>
  );
}
