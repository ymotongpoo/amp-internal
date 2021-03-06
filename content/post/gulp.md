+++
date = "2016-10-11T16:14:23+09:00"
draft = false
title = "1. Generating AMP JS"
tags = ["gulp", "gulpfule.js"]
+++

## Preface

Before digging into the repository of AMP HTML, let's see how AMP elements works in the browser at first hand. 

The specification of AMP HTML tag set is combination of subset of HTML5 and custom elements. All builtin custom elements and whole AMP runtime is implemented in AMP JS, which is hosted in the wild on `https://cdn.ampproject.org/v0.js`.
Other third party extensional custom elements, such as `amp-analytics`, `amp-ad` and so on are handled in special JavaScript with the elements' names.

The following snippets is from existing AMP page in the production.

```html
<script custom-element="amp-font" src="https://cdn.ampproject.org/v0/amp-font-0.1.js" async></script>
<script custom-element="amp-ad" src="https://cdn.ampproject.org/v0/amp-ad-0.1.js" async></script>
<script custom-element="amp-analytics" src="https://cdn.ampproject.org/v0/amp-analytics-0.1.js" async></script>
...
<script src="https://cdn.ampproject.org/v0.js" async></script>
```

All JavaScripts for AMP are hosted under `https://cdn.ampproject.org/`. So it seems that we should take a look at where all those JavaScripts are located, or generated in the repository.

You may find that there's no file named `v0.js` in the repository once you hit the `find` command on the console. Also, you may find thet there's no files with the name of `[CUSTOM ELEMENT NAME]-[VERSION].js` neither, though you find directories under `extensions` directory that look dedicated for each custom elements, such as `amp-ad`, `amp-audio` and so on.

The reason of this is because there JavaScript files are generated by the process run by `gulp`. So let's take a look at `gulpfile.js` and understand how these files are generated.

## compileJs()
As soon as searching the string `'v0.js'` in the `gulpfile.js`, you'll find the function `compile()` that runs `compileJs()` for a couple of times, `compileCss()` and `thirdPartyBootstrap()`. Since what we are interested in is `v0.js`, `compileJs()` would give some hints for the generation process of `v0.js`.

```js
/**
 * Compile a javascript file
 *
 * @param {string} srcDir Path to the src directory
 * @param {string} srcFilename Name of the JS source file
 * @param {string} destDir Destination folder for output script
 * @param {?Object} options
 */
function compileJs(srcDir, srcFilename, destDir, options) {
```

The function definition and comments with it describes well how it works. The function call in `compile()` to generate `v0.js` is following:

```js
  // For compilation with babel we start with the amp-babel entry point,
  // but then rename to the amp.js which we've been using all along.
  compileJs('./src/', 'amp-babel.js', './dist', {
    toName: 'amp.js',
    minifiedName: 'v0.js',
    includePolyfills: true,
    checkTypes: opt_checkTypes,
    watch: watch,
    preventRemoveAndMakeDir: opt_preventRemoveAndMakeDir,
    minify: shouldMinify,
    // If there is a sync JS error during initial load,
    // at least try to unhide the body.
    wrapper: 'try{(function(){<%= contents %>})()}catch(e){' +
        'setTimeout(function(){' +
        'var s=document.body.style;' +
        's.opacity=1;' +
        's.visibility="visible";' +
        's.animation="none";' +
        's.WebkitAnimation="none;"},1000);throw e};'
  });
```

Though I'm not a babel expert, the function call sounds like creating `./dist/v0.js` in some condition. With that expectation, let's take a closer look in `compileJs()`.

```js
function compileJs(srcDir, srcFilename, destDir, options) {
  options = options || {};
  if (options.minify) {
    function minify() {
      console.log('Minifying ' + srcFilename);
      closureCompile(srcDir + srcFilename, destDir, options.minifiedName,
          options)
          .then(function() {
            appendToCompiledFile(srcFilename, destDir + '/' + options.minifiedName);
            fs.writeFileSync(destDir + '/version.txt', internalRuntimeVersion);
            if (options.latestName) {
              fs.copySync(
                  destDir + '/' + options.minifiedName,
                  destDir + '/' + options.latestName);
            }
          });
    }
    minify();
    return;
  }
  ...
```

## closureCompile()
Ok, great. In the internal function `minify()`, we see the line `closureCompile(srcDir + srcFilename, destDir, options.minifiedName, options)`. [^gulp1] `closureCompile()` is imported from `build-system/tasks/compile.js`.

```js
// Compiles AMP with the closure compiler. This is intended only for
// production use. During development we intent to continue using
// babel, as it has much faster incremental compilation.
exports.closureCompile = function(entryModuleFilename, outputDir,
    outputFilename, options) {
  // Rate limit closure compilation to MAX_PARALLEL_CLOSURE_INVOCATIONS
  // concurrent processes.
  return new Promise(function(resolve) {
    function start() {
      inProgress++;
      compile(entryModuleFilename, outputDir, outputFilename, options)
          .then(function() {
            inProgress--;
            next();
            resolve();
          }, function(e) {
            console./*OK*/error('Compilation error', e.message);
            process.exit(1);
          });
    }
    function next() {
      if (!queue.length) {
        return;
      }
      if (inProgress < MAX_PARALLEL_CLOSURE_INVOCATIONS) {
        queue.shift()();
      }
    }
    queue.push(start);
    next();
  });
};
```

It seems the internal function `start()` inside Promise() is doing something, because it is pushed to the array variable `queue` at the end of the Promise and called in the internal function `next()` that is called at the very last of the Promise. (`queue.shift()()` is.)

The key function `compile()` is sort of a large function. It begins with like this.

```js
function compile(entryModuleFilenames, outputDir,
    outputFilename, options) {
  return new Promise(function(resolve, reject) {
    ...
``` 

We see that this function returns `Promise`. And most of the implementation is spared for variable definitions based on arguments. So the main part of the `compile()` function is here:

```js
    var stream = gulp.src(srcs)
        .pipe(closureCompiler(compilerOptions))
        .on('error', function(err) {
          console./*OK*/error('Error compiling', entryModuleFilenames);
          console./*OK*/error(err.message);
          process.exit(1);
        });

    // If we're only doing type checking, no need to output the files.
    if (!argv.typecheck_only) {
      stream = stream
        .pipe(rename(outputFilename))
        .pipe(replace(/\$internalRuntimeVersion\$/g, internalRuntimeVersion))
        .pipe(replace(/\$internalRuntimeToken\$/g, internalRuntimeToken))
        .pipe(gulp.dest(outputDir))
        .on('end', function() {
          console./*OK*/log('Compiled', entryModuleFilename, 'to',
              outputDir + '/' + outputFilename, 'via', intermediateFilename);
          gulp.src(intermediateFilename + '.map')
              .pipe(rename(outputFilename + '.map'))
              .pipe(gulp.dest(outputDir))
              .on('end', resolve);
        });
    }

    return stream;
```

Here you see that the stream is renamed with `.pipe(rename(outputFilename))` and written into `.pipe(gulp.dest(outputDir))`, where `outputFilename` is `v0.js` and `outputDir` is `./dist` respectively.

So the summary of the process so far is:

1. `compileJs()` calls `minify()` (`options.minify` is `true` on produciton release.)
2. `minify()` calls `closureCompiler()` and then save it as `./dist/v0.js`.

Now we grasped the overview of the file generation process. But how is `v0.js` starts it process? The hint is in the compiler options for Closure Compiler. The function `closureCompiler()` is external function defined in the npm module `gulp-closure-compiler` and how the object `compilerOptions` is handled is described [here](https://github.com/steida/gulp-closure-compiler/blob/master/index.js).

```js
module.exports = function(opt, execFile_opt) {
  ...
  // Can't use sindresorhus/dargs, compiler requires own syntax.
  var flagsToArgs = function(flags) {
    var args = [];
    for (var flag in flags || {}) {
      var values = flags[flag];
      if (!Array.isArray(values)) values = [values];
      values.forEach(function(value) {
        if (flag === 'externs') {
          glob.sync(value).forEach(function(resolved){
            args.push(buildFlag(flag, resolved))
          });
        } else {
          args.push(buildFlag(flag, value));
        }
      });
    }
    return args;
  };

  var buildFlag = function(flag, value){
    return '--' + flag + (value === null ? '' : '=' + value)
  };
  ...
  function() endStream() {
    ...
    args = args.concat(flagsToArgs(opt.compilerFlags));
    ...
  }
```

So, all options in `opt.compilerFlags` are expanded in the format of `--flag1=value1 --flag2=value2 ...` and are passed to Closure Compiler. Then let's get back to our `compile.js` and see what kind of flags are passed to `closureCompiler()` in the build process of `v0.js`. 

```js
    var entryModuleFilename;
    if (entryModuleFilenames instanceof Array) {
      entryModuleFilename = entryModuleFilenames[0];
    } else {
      entryModuleFilename = entryModuleFilenames;
      entryModuleFilenames = [entryModuleFilename];
    }
    ...
    // Add needed path for extensions.
    // Instead of globbing all extensions, this will only add the actual
    // extension path for much quicker build times.
    entryModuleFilenames.forEach(function(filename) {
      if (filename.indexOf('extensions/') == -1) {
        return;
      }
      var path = filename.replace(/\/[^/]+\.js$/, '/**/*.js');
      srcs.push(path);
    });
    ...
    var compilerOptions = {
      compilerPath: 'build-system/runner/dist/runner.jar',
      ...
      compilerFlags: {
        ...
        entry_point: entryModuleFilenames,
        ...
```

Well, skipping the internals of `runner.jar` because it is not essential here [^gulp2], but the option `entry_point` is providing the entry point of `v0.js`, and the value is `entryModuleFilename`, which is in this case `./src/amp-babel.js`.

Now finally we got the point. So our AMP JS file `v0.js` is concatted and minified from lots of JavaScript files and its entry point is `./src/amp-babel.js`.

## amp-babel.js

`amp-babel.js` is tiny file that only has 2 lines of code as follows.

```js
import '../third_party/babel/custom-babel-helpers';
import './amp';
```

And here, let's go back to `./build-system/tasks/compile.js` and see the comments in `closureCompile()`.

```js
// Compiles AMP with the closure compiler. This is intended only for
// production use. During development we intent to continue using
// babel, as it has much faster incremental compilation.
exports.closureCompile = function(entryModuleFilename, outputDir,
    outputFilename, options) {
```

As you see in `compileJs()`, in production release process, AMP project does not use babel but Closure Compiler to pack all code into one release file. You can confirm this in the constant `srcs` in `compile()` function.

```js
    const srcs = [
      ...
      'extensions/amp-analytics/**/*.js',
      'src/**/*.js',
      '!third_party/babel/custom-babel-helpers.js',
      ...
    ];
    ...
    var stream = gulp.src(srcs)
        .pipe(closureCompiler(compilerOptions))
        .on('error', function(err) {
          console./*OK*/error('Error compiling', entryModuleFilenames);
          console./*OK*/error(err.message);
          process.exit(1);
        });
```

As you see, `third_party/babel/custom-babel-helpers.js` is excluded from build process. So now we know that `src/amp.js` is the actual entry point.

In [next chapter](../amp/), we dig into the file.

[^gulp1]: `appendToCompileFile()` is called only in the case of the `srcFilename` is `"amp-viz-vega.js"` so ignore it in this case. 

[^gulp2]: Added appendix for the build process of `runner.jar`. See [Appendix](../appendix_runner/) for details.