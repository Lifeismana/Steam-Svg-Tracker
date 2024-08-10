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
					const svg = createSvg(node);
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

// return svg as string from the node given assumed as a valid svg
function createSvg(node) {
	console.log("Debug ", node.type, Object.keys(node), node.expression, node.arguments, Object.keys(node.callee), node.callee);
	const svg = create().ele('svg');

	node.arguments[1].properties.forEach((prop) => {
		if (prop.type === 'SpreadElement' || prop.key.name === 'className') return;
		// console.log("Debug prop", prop.type, prop.key.name, prop.value.value);
		svg.att(fixSVGKeyName(prop.key), prop.value.value);
	})

	node.arguments.slice(2).forEach((prop) => {
		if (prop.type === 'CallExpression') {
			//console.log("Debug prop", prop, prop.property);
			if (prop.callee.property.name === 'createElement') {
				if (prop.arguments[0].value === 'path') {
					//console.debug("Debug path", prop.arguments[1]);
					const path = svg.ele('path');
					prop.arguments[1].properties.forEach((prop) => {
						console.debug("Debug prop", prop, prop.key.name || prop.key.value , prop.value.value);
						path.att(fixSVGKeyName(prop.key) , prop.value.value);
					})
				} else if (prop.arguments[0].value === 'g') {
					const g = svg.ele('g');
					prop.arguments[1]?.properties?.forEach((prop) => {
						console.debug("Debug prop", prop, prop.key.name || prop.key.value , prop.value.value);
						g.att(fixSVGKeyName(prop.key) , prop.value.value);
					})
					// TODO: refactor this to have a recursive function and not have dupe code
					prop.arguments.slice(2).forEach((prop) => {
						if (prop.type === 'CallExpression') {
							if (prop.callee.property.name === 'createElement') {
								if (prop.arguments[0].value === 'path') {
									const path = g.ele('path');
									prop.arguments[1].properties.forEach((prop) => {
										console.debug("Debug prop", prop, prop.key.name || prop.key.value , prop.value.value);
										path.att(fixSVGKeyName(prop.key) , prop.value.value);
									})
								}
							}
						}
					});
				}
				else if (prop.arguments[0].value === 'rect') {
					const rect = svg.ele('rect');
					prop.arguments[1].properties.forEach((prop) => {
						console.debug("Debug prop", prop, prop.key.name || prop.key.value , prop.value.value);
						rect.att(fixSVGKeyName(prop.key) , prop.value.value);
					})

				} else {
					console.log("Unknown element", prop.arguments[0].value);
				}
				// TODO: we are not handling defs elements

			} else {
				console.warn("unexpected element", prop.type);
			}
		}});

	return svg.end({ prettyPrint: true });

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




