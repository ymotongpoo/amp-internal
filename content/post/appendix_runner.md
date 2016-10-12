+++
date = "2016-10-12T16:02:37+09:00"
draft = false
title = "Appendix A: runner.jar"
tags = ["Closure Compiler", "Ant"]
+++

## runner.jar
In the [chapter 1](./gulp/), we saw that option `entry_point` is passed to `runner.jar` and that is defining the entry point of `v0.js`. But how can we know `runner.jar` is Closure Compiler? 

In `./runner` directory, you find `build.xml` which is Ant build file for `runner.jar`.

```xml
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<project default="jar" basedir="." name="runner">
...
  <property name="dir.buildfile" value="."/>
  <property name="src.dir" value="${basedir}/src"/>
  <property name="test.dir" value="${basedir}/test"/>
  <property name="build.dir" value="${basedir}/build"/>
  <property name="lib.dir" value="${basedir}/lib"/>
  <property name="dist.dir" value="${basedir}/dist"/>
  <property name="runner-jarfile" value="${build.dir}/${ant.project.name}.jar"/>
  <property name="compiler.dir" value="${basedir}/../../third_party/closure-compiler"/>

  <property name="classes.dir" value="${build.dir}/classes"/>
...
  <target name="jar" depends="compile">
    <jar destfile="${runner-jarfile}">
      <zipfileset src="${lib.dir}/jar-in-jar-loader.zip"/>
      <fileset dir="${classes.dir}"/>
      <fileset dir="${compiler.dir}">
        <include name="compiler.jar"/>
      </fileset>
      <manifest>
        <attribute name="Main-Class" value="org.eclipse.jdt.internal.jarinjarloader.JarRsrcLoader"/>
        <attribute name="Rsrc-Main-Class" value="org.ampproject.AmpCommandLineRunner"/>
        <attribute name="Class-Path" value="."/>
        <attribute name="Rsrc-Class-Path" value="./ compiler.jar"/>
      </manifest>
    </jar>
    <mkdir dir="${dist.dir}"/>
    <copy file="${build.dir}/runner.jar" todir="${dist.dir}"/>
  </target>
...
```

Here, you see that the executable jar file is based on `org.ampproject.AmpCommandLineRunner` that is located in `./src/org/ampproject/AmpCommandLineRunner.java`.
The [JavaDoc of it](http://static.javadoc.io/com.google.javascript/closure-compiler/v20160911/com/google/javascript/jscomp/CommandLineRunner.html) tells that the command line tool. 