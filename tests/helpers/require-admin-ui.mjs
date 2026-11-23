import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

let seedReact;

// The SSR fixtures load CJS bundles. SEED recipes expose CSS through ESM,
// so bundle the real SEED components with CSS stripped for Node rendering.
export function requireAdminUi(url) {
    const require = createRequire(url);
    return id => {
        if (id !== '@seed-design/react') return require(id);
        if (!seedReact) {
            const bundle = buildSync({
                stdin: {
                    contents: 'export { ActionButton, Badge } from "@seed-design/react";',
                    resolveDir: fileURLToPath(new URL('../..', import.meta.url)),
                },
                bundle: true,
                platform: 'node',
                format: 'cjs',
                loader: { '.css': 'empty' },
                external: ['react', 'react-dom'],
                write: false,
            }).outputFiles[0].text;
            const module = { exports: {} };
            new Function('require', 'module', 'exports', bundle)(require, module, module.exports);
            seedReact = module.exports;
        }
        return seedReact;
    };
}
