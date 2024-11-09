import {basename, sep as pathSep } from "path";
import { readFile } from "fs/promises";
import { createWriteStream, existsSync, mkdirSync, rmSync } from "fs";
import { createHash } from "node:crypto";
import { parse, latestEcmaVersion } from "espree";
import { traverse, Syntax } from "estraverse";
import { GetRecursiveFilesToParse } from "./dump_javascript_paths.mjs";
import { create } from "xmlbuilder2";

const outputPath = "./svgs";

if (existsSync(outputPath)) {
	rmSync(outputPath, { recursive: true });
}

for await (const file of GetRecursiveFilesToParse()) {
	try {
		console.log("::group::Parsing", file);

		const code = await readFile(file);
		const ast = parse(code, { ecmaVersion: latestEcmaVersion, loc: true });
		let last_function_seen = null;
		const file_basename = basename(file, '.js');

		// output folder / resource folder / file name
		const outputFolder = `${outputPath}/${file.replace(process.cwd(), '').split(pathSep)[1]}/${file_basename}`;
		if (!existsSync(outputFolder))
			mkdirSync(outputFolder, { recursive: true });

        traverse(ast, {
            enter: function (node) {
				if(node.type === Syntax.FunctionDeclaration) {
					last_function_seen = node;
				}
				
				if (node.type === Syntax.CallExpression && node.callee?.property?.name === 'createElement' && node.arguments?.[0]?.value === 'svg') {
					// as i understand it we don't want to go deeper if it's an svg (bc there can be svg in svg but we're only interested in the one most "outside")
					this.skip();
					const svg = (createSvgBody(node)).end({ prettyPrint: true });
					const hash = createHash('sha1').update(svg).digest('hex').substring(0,16);
					console.debug(`Hash ${hash} from ${file} line ${node.loc.start.line} col ${node.loc.start.column}`);
					OutputToFile(`${outputFolder}/${last_function_seen?.id.name ?? "null"}_${hash}.svg`, svg);
            }}
		});
	} catch (e) {
		console.error(`::error::Unable to parse "${file}":`, e);
		continue;
	} finally {
		console.log("::endgroup::");
	}
}

function createSvgBody(node, xml = undefined) {
	if (!xml) {
		xml = create();
	}
	if (!node) {
		return xml;
	}
	try {
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
	} catch (e) {
		console.warn("::warning::probably some vars that i can do nothing about",e);
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
