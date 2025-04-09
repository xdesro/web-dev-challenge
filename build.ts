import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const deps = Object.keys({
  ...pkg.dependencies || {},
  ...pkg.peerDependencies || {}
});

const esmShPlugin: esbuild.Plugin = {
  name: 'esm-sh-transform',
  setup(build) {
    build.onLoad({ filter: /\.[jt]sx?$/ }, async (args) => {
      const contents = await fs.promises.readFile(args.path, 'utf8');
      const transformed = contents.replace(
        /import\s+.+\s+from\s+['"](?!\.|\/)(?!https:\/\/esm\.sh)([^'"]*)['"]/g,
        (match, path) => {
          return match.replace(`"${path}"`, `"https://esm.sh/${path}"`).replace(`'${path}'`, `'https://esm.sh/${path}'`);
        }
      );

      return { 
        contents: transformed, 
        loader: path.extname(args.path).substring(1) as esbuild.Loader 
      };
    });
  }
};

esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/bundle.js',
  format: 'esm',
  platform: 'browser',
  sourcemap: false,
  minify: false,
  external: deps,
  plugins: [esmShPlugin]
}).catch(() => process.exit(1));
