import * as esbuild from "esbuild";
import path from "node:path";
import { platform } from "node:process";

const entry = "./src/index.ts";

let jsEntry = path.resolve(
  "dist/node",
  path.basename(entry).replace(".ts", ".js")
);
let outfile = jsEntry.replace(".js", ".cjs");

await esbuild.build({
  entryPoints: ["./dist/node/index.js"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "es2021",
  resolveExtensions: [".node.js", ".ts", ".js"],
  allowOverwrite: true,
  plugins: [makeNodeModulesExternal(), makeJsooExternal()],
  allowOverwrite: true,
  outfile,
  dropLabels: ["ESM"],
  minify: false,
});

function makeNodeModulesExternal() {
  let isNodeModule = /^[^./\\]|^\.[^./\\]|^\.\.[^/\\]/;
  return {
    name: "plugin-external",
    setup(build) {
      build.onResolve({ filter: isNodeModule }, ({ path }) => ({
        path,
        external: !(platform === "win32" && path.endsWith("index.js")),
      }));
    },
  };
}

function makeJsooExternal() {
  let isJsoo = /(bc.cjs|plonk_wasm.cjs)$/;
  return {
    name: "plugin-external",
    setup(build) {
      build.onResolve({ filter: isJsoo }, ({ path: filePath, resolveDir }) => ({
        path:
          "./" +
          path.relative(
            path.resolve(".", "dist/node"),
            path.resolve(resolveDir, filePath)
          ),
        external: true,
      }));
    },
  };
}
