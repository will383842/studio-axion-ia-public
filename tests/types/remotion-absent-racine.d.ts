// Remplaçant de typage de « remotion » pour le `tsconfig.json` RACINE quand studio-rendu/node_modules n'est pas installé (CI « eslint et
// tsc différentiels », N-17) : le tsc racine suit les imports de `registre-v4.tsx` jusqu'aux compositions de studio-rendu. Installés, les
// vrais types passent en premier (`paths` de `tsconfig.json` : le paquet de studio-rendu, puis ce fichier). Le tsc PROPRE de studio-rendu
// ne lit pas ce fichier : il vérifie toujours ces compositions avec les vrais types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quelconque = any;
export declare const AbsoluteFill: Quelconque;
export declare const Audio: Quelconque;
export declare const Composition: Quelconque;
export declare const Easing: Quelconque;
export declare const Freeze: Quelconque;
export declare const Img: Quelconque;
export declare const Loop: Quelconque;
export declare const OffthreadVideo: Quelconque;
export declare const Sequence: Quelconque;
export declare const bundle: Quelconque;
export declare const cancelRender: Quelconque;
export declare const continueRender: Quelconque;
export declare const delayRender: Quelconque;
export declare const makeCancelSignal: Quelconque;
export declare const renderFrames: Quelconque;
export declare const ensureBrowser: Quelconque;
export declare const getInputProps: Quelconque;
export declare const interpolate: Quelconque;
export declare const openBrowser: Quelconque;
export declare const random: Quelconque;
export declare const registerRoot: Quelconque;
export declare const renderMedia: Quelconque;
export declare const renderStill: Quelconque;
export declare const selectComposition: Quelconque;
export declare const spring: Quelconque;
export declare const staticFile: Quelconque;
export declare const useCurrentFrame: Quelconque;
export declare const useVideoConfig: Quelconque;
