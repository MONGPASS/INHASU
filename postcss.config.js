// SEED ships its tokens on :root and text sizing on html. Keep both in the admin shell.
const scopeSeedBase = {
    postcssPlugin: 'scope-admin-seed-base',
    Once(root) {
        root.walkRules(rule => {
            if (!rule.source?.input.file?.replaceAll('\\', '/').endsWith('/@seed-design/css/base.css')) return;
            rule.selector = rule.selector.replace(/:root|^html(?=[\s[,{]|$)/g, ':where(.admin-app-wrapper, [data-admin-seed])');
        });
    },
};

export default {
    plugins: [
        scopeSeedBase,
        (await import('tailwindcss')).default(),
        (await import('autoprefixer')).default(),
    ],
};
