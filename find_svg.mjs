import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, sep as pathSep } from "node:path";
import { latestEcmaVersion, parse } from "espree";
import { Syntax, traverse } from "estraverse";
import { create } from "xmlbuilder2";
import { GetRecursiveFilesToParse } from "./dump_javascript_paths.mjs";

const svgOutputPath = "./svgs";
const pngOutputPath = "./pngs";

if (existsSync(svgOutputPath)) {
	rmSync(svgOutputPath, { recursive: true });
}

if (existsSync(pngOutputPath)) {
	rmSync(pngOutputPath, { recursive: true });
}

const base64PngPattern = /data:image\/png;base64,([A-Za-z0-9+\/=]+)/g;

for await (const file of GetRecursiveFilesToParse()) {
	try {
		console.log("::group::Parsing", file);

		const code = await readFile(file, "utf8");

		const file_basename = basename(file, ".js");

		if (file.endsWith(".js")) {
			console.log("Looking for svgs");

			const sourceType = file.includes("/ssr/") ? "module" : "script";

			const ast = parse(code, { ecmaVersion: latestEcmaVersion, loc: true, sourceType: sourceType });
			let last_function_seen = null;

			// output folder / resource folder / file name
			const outputFolder = `${svgOutputPath}/${file.replace(process.cwd(), "").split(pathSep)[1]}/${file_basename}`;
			if (!existsSync(outputFolder)) mkdirSync(outputFolder, { recursive: true });

			traverse(ast, {
				enter: function (node) {
					if (node.type === Syntax.FunctionDeclaration) {
						last_function_seen = node;
					}

					// TODO ssr doesn't have its svg elems under createElement
					if (node.type === Syntax.CallExpression && node.callee?.property?.name === "createElement" && node.arguments?.[0]?.value === "svg") {
						// as i understand it we don't want to go deeper if it's an svg (bc there can be svg in svg but we're only interested in the one most "outside")
						this.skip();
						const svg = createSvgBody(node).end({ prettyPrint: true });
						const hash = createHash("sha1").update(svg).digest("hex").substring(0, 16);
						console.debug(`Hash ${hash} from ${file} line ${node.loc.start.line} col ${node.loc.start.column}`);
						OutputToFile(`${outputFolder}/${last_function_seen?.id.name ?? "null"}_${hash}.svg`, `${svg}\n`);
					}
				},
			});
		}

		console.log("Looking for pngs");

		// output folder / resource folder / file name
		const outputFolder = `${pngOutputPath}/${file.replace(process.cwd(), "").split(pathSep)[1]}/${file_basename}`;
		if (!existsSync(outputFolder)) mkdirSync(outputFolder, { recursive: true });

		const result = code.matchAll(base64PngPattern);
		for (const match of result) {
			const png = Buffer.from(match[1], "base64");
			const hash = createHash("sha1").update(png).digest("hex").substring(0, 16);
			console.debug(`Hash ${hash} from ${file}`);
			OutputToFile(`${outputFolder}/${hash}.png`, png);
		}
	} catch (e) {
		console.error(`::error::Unable to parse "${file}":`, e);
	} finally {
		console.log("::endgroup::");
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
