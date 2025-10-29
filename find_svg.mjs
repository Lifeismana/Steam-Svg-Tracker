import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { parse as pathParse, sep as pathSep } from "node:path";
import { latestEcmaVersion, parse } from "espree";
import { Syntax, traverse } from "estraverse";
import { create } from "xmlbuilder2";
import { GetRecursiveFilesToParse } from "./dump_javascript_paths.mjs";

const svgOutputPath = "./svgs";
const pngOutputPath = "./pngs";
const gifOutputPath = "./gifs";

if (existsSync(svgOutputPath)) {
	rmSync(svgOutputPath, { recursive: true });
}

if (existsSync(pngOutputPath)) {
	rmSync(pngOutputPath, { recursive: true });
}

if (existsSync(gifOutputPath)) {
	rmSync(gifOutputPath, { recursive: true });
}

const base64PngPattern = /data:image\/png;base64,([A-Za-z0-9+\/=]+)/g;
const base64GifPattern = /data:image\/gif;base64,([A-Za-z0-9+\/=]+)/g;
const base64SvgPattern = /data:image\/svg\+xml;base64,([A-Za-z0-9+\/=]+)/g;

for await (const file of GetRecursiveFilesToParse()) {
	try {
		console.log("::group::Parsing", file);

		const code = await readFile(file, "utf8");

		const file_basename = pathParse(file).name;

		if (file.endsWith(".js")) {
			console.log("Looking for svgs");

			const sourceType = file.includes("/ssr/") ? "module" : "script";

			const ast = parse(code, { ecmaVersion: latestEcmaVersion, loc: true, sourceType: sourceType });

			traverse(ast, {
				enter: function (node) {

					// TODO ssr doesn't have its svg elems under createElement
					if (node.type === Syntax.CallExpression && node.callee?.property?.name === "createElement" && node.arguments?.[0]?.value === "svg") {
						// as i understand it we don't want to go deeper if it's an svg (bc there can be svg in svg but we're only interested in the one most "outside")
						this.skip();
						const svg = createSvgBody(node).end({ prettyPrint: true });
						const hash = createHash("sha3-384").update(svg).digest("hex").substring(0, 20);
						console.debug(`Hash ${hash} from ${file} line ${node.loc.start.line} col ${node.loc.start.column}`);
						OutputToFile(`${svgOutputPath}/${hash}.svg`, `${svg}\n`);
					}
				},
			});
		}

		console.log("Looking for pngs");

		regexSearchAndOutput(code, base64PngPattern, pngOutputPath, file, file_basename, "png");

		console.log("Looking for gifs");
		regexSearchAndOutput(code, base64GifPattern, gifOutputPath, file, file_basename, "gif");

		console.log("Looking for svgs in base64");
		regexSearchAndOutput(code, base64SvgPattern, svgOutputPath, file, file_basename, "svg");
	} catch (e) {
		console.error(`::error::Unable to parse "${file}":`, e);
	} finally {
		console.log("::endgroup::");
	}
}

function regexSearchAndOutput(fileContent, pattern, baseOutputFolder, file, file_basename, extension) {
	const outputFolder = `${baseOutputFolder}/${file.replace(process.cwd(), "").split(pathSep)[1]}/${file_basename}`;
	if (!existsSync(outputFolder)) mkdirSync(outputFolder, { recursive: true });

	const result = fileContent.matchAll(pattern);
	for (const match of result) {
		const data = Buffer.from(match[1], "base64");
		const hash = createHash("sha3-384").update(data).digest("hex").substring(0, 20);
		console.debug(`Hash ${hash} from ${file}`);
		OutputToFile(`${outputFolder}/${hash}.${extension}`, data);
	}
}

// TODO handle ssr svg format
function createSvgBody(node, xml = create()) {
	if (!node) {
		return xml;
	}
	try {
		const elem = xml.ele(node.arguments[0].value);
		node.arguments[1].properties?.forEach((prop) => {
			if (prop.type === "SpreadElement" || prop.key.name === "className") return;
			elem.att(fixSVGKeyName(prop.key), prop.value.value);
		});
		node.arguments.slice(2)?.forEach((prop) => {
			if (prop.type === "CallExpression") {
				createSvgBody(prop, elem);
			}
		});
	} catch (e) {
		console.warn("::warning::probably some vars that i can do nothing about", e);
	}
	return xml;
}

// fix svg key names that aren't the same in html vs xml
function fixSVGKeyName(key) {
	// if a key has a dash in it, it's under value not name
	const keyName = key.name || key.value;
	switch (keyName) {
		case "clipRule":
			return "clip-rule";
		case "clipPath":
			return "clip-path";
		case "fillRule":
			return "fill-rule";
		case "fillOpacity":
			return "fill-opacity";
		case "strokeLinecap":
			return "stroke-linecap";
		case "strokeWidth":
			return "stroke-width";
		case "strokeLinejoin":
			return "stroke-linejoin";
		case "strokeMiterlimit":
			return "stroke-miterlimit";
		case "strokeDasharray":
			return "stroke-dasharray";
		case "strokeDashoffset":
			return "stroke-dashoffset";
		default:
			return keyName;
	}
}

function OutputToFile(fileName, content) {
	return new Promise((resolve) => {
		const stream = createWriteStream(fileName, {
			flags: "w",
			encoding: "utf8",
		});
		stream.once("close", resolve);

		stream.write(content);
		stream.end();
	});
}
