/* Based on https://github.com/SteamDatabase/SteamTracking/blob/master/dump_javascript_paths.mjs
Thanks xPaw! */
import { readdir as readDir } from "node:fs/promises";
import { resolve as pathResolve } from "node:path";

const pathsToRecurse = ["./SteamTracking/", "./GameTracking-SteamVR/"];

const blocklist = ["licenses.js", "steamaudio.js"];

async function* GetRecursiveJavascriptCssFiles(dir) {
	const dirents = await readDir(dir, { withFileTypes: true });
	for (const dirent of dirents) {
		const res = pathResolve(dir, dirent.name);
		if (dirent.isDirectory()) {
			yield* GetRecursiveJavascriptCssFiles(res);
		} else if (dirent.isFile() && (dirent.name.endsWith(".js") || dirent.name.endsWith(".css")) && !blocklist.some((block) => res.includes(block))) {
			yield res;
		}
	}
}

export async function* GetRecursiveFilesToParse() {
	for (const path of pathsToRecurse) {
		yield* GetRecursiveJavascriptCssFiles(path);
	}
}
