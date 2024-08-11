import { resolve as pathResolve } from "path";
import { readdir as readDir } from "fs/promises";

const pathsToRecurse = [
	"./SteamTracking/",
	"./GameTracking-SteamVR/",
];

const blocklist = [
	"licenses.js",
];

async function* GetRecursiveJavascriptFiles(dir) {
	const dirents = await readDir(dir, { withFileTypes: true });
	for (const dirent of dirents) {
		const res = pathResolve(dir, dirent.name);
		if (dirent.isDirectory()) {
			yield* GetRecursiveJavascriptFiles(res);
		} else if (dirent.isFile() && dirent.name.endsWith(".js") && !blocklist.some((block) => res.includes(block))) {
			yield res;
		}
	}
}

export async function* GetRecursiveFilesToParse() {
	for (const path of pathsToRecurse) {
		yield* GetRecursiveJavascriptFiles(path);
	}
}