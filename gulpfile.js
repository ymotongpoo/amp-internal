//    Copyright 2016 Yoshi Yamaguchi
// 
//    Licensed under the Apache License, Version 2.0 (the "License");
//    you may not use this file except in compliance with the License.
//    You may obtain a copy of the License at
// 
//        http://www.apache.org/licenses/LICENSE-2.0
// 
//    Unless required by applicable law or agreed to in writing, software
//    distributed under the License is distributed on an "AS IS" BASIS,
//    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//    See the License for the specific language governing permissions and
//    limitations under the License.
"use strict";

const gulp = require('gulp');
const del = require('del');
const run = require('gulp-run');

const paths = {
  'src': {
    'files': 'public/**/*'
  },
  'dist': {
    'dir': 'docs'
  } 
}

gulp.task('test:amp', function() {
  return run('hugo server --theme=simpleblog --buildDrafts').exec();
});

gulp.task('build:amp', function() {
  return run('hugo --theme=simpleblog').exec();
});

gulp.task('clean:amp', function() {
  return del(paths.dist.dir);
});

gulp.task('move:amp', ['build:amp', 'clean:amp'], function() {
  return gulp.src(paths.src.files)
    .pipe(gulp.dest(paths.dist.dir));
});

gulp.task('build', [
  'clean:amp',
  'build:amp',
  'move:amp'
]);

var clean = function() {
  return del(paths.goblog.public.dir);
};

gulp.task('clean', function() {
  return clean();
});

gulp.task('deploy', ['build'], function() {
  return run('firebase deploy --only=hosting').exec();
});
