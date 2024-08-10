import { join as pathJoin } from "path";
import { readFile, writeFile } from "fs/promises";
import { createWriteStream, existsSync, mkdirSync, rmSync, readdirSync } from "fs";
import { createHash } from "node:crypto";
import { parse, latestEcmaVersion } from "espree";
import { traverse, Syntax } from "estraverse";
import { GetFilesToParse } from "./dump_javascript_paths.mjs";
import { create } from "xmlbuilder2";

const outputPath = "./svgs";
const files = await GetFilesToParse();


const allEnums = [];


if (!existsSync(outputPath))
	mkdirSync(outputPath);
readdirSync(outputPath).forEach(f => rmSync(`${outputPath}/${f}`));


const globalModuleExportedMessages = new Map();

console.log("Found", files.length, "files to parse");

for (const file of files) {
	if (!file.includes("library.js")) {
		continue;
	}
	try {
		const code = await readFile(file);
		const ast = parse(code, { ecmaVersion: latestEcmaVersion, loc: true });

		console.log("Parsing", file);

        traverse(ast, {
            enter: function (node) {
				if (node.type === Syntax.CallExpression && node.callee?.property?.name === 'createElement' && node.arguments?.[0].value === 'svg') {
					// as i understand it we don't want to go deeper if it's an svg (bc there can be svg in svg but we're only interested in the one most "outside")
					this.skip();
					const svg = (createSvgBody(node)).end({ prettyPrint: true });
					const hash = createHash('sha1').update(svg).digest('hex').substring(0,16);
					console.log("Debug hash", hash);
					console.log("Debug svg", svg);
					OutputToFile(`./svgs/${hash}.svg`, svg);
            }}

		});

		// allEnums.push(...enums);
	} catch (e) {
		console.error(`Unable to parse "${file}":`, e);
		continue;
	}
}


function createSvgBody(node, xml = undefined) {
	if (!xml) {
		xml = create();
	}
	if (!node) {
		return xml;
	}
	const elem = xml.ele(node.arguments[0].value);
	node.arguments[1].properties?.forEach((prop) => {
		if (prop.type === 'SpreadElement' || prop.key.name === 'className') return;
		elem.att(fixSVGKeyName(prop.key) , prop.value.value);
	})
	node.arguments.slice(2)?.forEach((prop) => {
		if (prop.type === 'CallExpression') {
			createSvgBody(prop, elem);
		}
	});

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

function OutputToFile(fileName, svg) {
	return new Promise((resolve) => {
		const stream = createWriteStream(fileName, {
			flags: "w",
			encoding: "utf8",
		});
		stream.once("close", resolve);

		stream.write(`${svg}\n`);
		stream.end();
	});
}




