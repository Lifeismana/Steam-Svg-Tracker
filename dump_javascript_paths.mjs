import { join as pathJoin, resolve as pathResolve } from "path";
import { readdir as readDir } from "fs/promises";

const pathsToRecurse = [
	"./SteamTracking/Scripts/",
	"./SteamTracking/ClientExtracted/",
	"./SteamTracking/help.steampowered.com/",
	"./SteamTracking/partner.steamgames.com/",
	"./SteamTracking/steamcommunity.com/",
	"./SteamTracking/store.steampowered.com",
	"./SteamTracking/checkout.steampowered.com",
	"./SteamTracking/www.dota2.com",
	"./SteamTracking/www.underlords.com",
];

// Should this just be a recursive search for all webpack files?
const paths = [
	"./SteamTracking/Scripts/WebUI/",
	"./SteamTracking/ClientExtracted/clientui/",
	"./SteamTracking/ClientExtracted/steamui/",
	"./SteamTracking/help.steampowered.com/public/javascript/applications/help/",
	"./SteamTracking/partner.steamgames.com/public/javascript/applications/appmgmt/",
	"./SteamTracking/partner.steamgames.com/public/javascript/webui/storeadmin/",
	"./SteamTracking/steamcommunity.com/public/javascript/applications/community/",
	"./SteamTracking/steamcommunity.com/public/javascript/webui/",
	"./SteamTracking/store.steampowered.com/public/javascript/applications/interactive_recommender/",
	"./SteamTracking/store.steampowered.com/public/javascript/applications/store/",
	"./SteamTracking/store.steampowered.com/public/shared/javascript/legacy_web/",
	"./SteamTracking/www.dota2.com/public/javascript/applications/dpc/",
	"./SteamTracking/www.dota2.com/public/javascript/dota_react/",
	"./SteamTracking/www.underlords.com/public/javascript/",
];

async function GetJavascriptFiles(dirName) {
	dirName = pathResolve(dirName);

	const files = await readDir(dirName);

	return files
		.filter((fileName) => {
			if (fileName == "licenses.js") {
				return false;
			}

			return fileName.endsWith(".js");
		})
		.map((fileName) => pathJoin(dirName, fileName));
}

export async function GetFilesToParse() {
	const promises = await Promise.all(paths.map(GetJavascriptFiles));
	return [].concat(...promises).sort();
}
