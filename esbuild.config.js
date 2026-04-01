const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

const cssPlugin = {
  name: 'css-bundle',
  setup(build) {
    build.onEnd(() => {
      const cssPath = path.join(__dirname, 'src/styles/main.css');
      if (fs.existsSync(cssPath)) {
        fs.copyFileSync(cssPath, path.join(__dirname, 'dist/javarunner.css'));
      }
    });
  },
};

const config = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/javarunner.js',
  format: 'iife',
  globalName: 'JavaRunner',
  sourcemap: true,
  minify: !isWatch,
  target: ['es2020'],
  plugins: [cssPlugin],
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
  },
};

if (isWatch) {
  esbuild.context(config).then(ctx => {
    ctx.watch();
    console.log('Watching for changes...');
  });
} else {
  esbuild.build(config).then(result => {
    const stats = fs.statSync('dist/javarunner.js');
    console.log(`Built dist/javarunner.js (${(stats.size / 1024).toFixed(1)} KB)`);
  });
}
