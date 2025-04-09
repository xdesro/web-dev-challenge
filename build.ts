import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

// Get all dependencies from package.json
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const deps = Object.keys({
  ...pkg.dependencies || {},
  ...pkg.peerDependencies || {}
});

// Plugin to transform imports to use esm.sh
const esmShPlugin: esbuild.Plugin = {
  name: 'esm-sh-transform',
  setup(build) {
    // Handle regular imports
    build.onLoad({ filter: /\.[jt]sx?$/ }, async (args) => {
      const contents = await fs.promises.readFile(args.path, 'utf8');
      
      // Transform imports to use esm.sh
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

// Run build
esbuild.build({
  entryPoints: ['src/main.ts'], // Change to your entry point
  bundle: true,
  outfile: 'dist/bundle.js',
  format: 'esm',
  platform: 'browser',
  sourcemap: false,
  minify: false,
  
  // Externalize all dependencies
  external: deps,
  
  // Apply the ESM transform plugin
  plugins: [esmShPlugin]
}).catch(() => process.exit(1));
