const fs = require("fs");
const path = require("path");
const root = __dirname;
let t = fs.readFileSync(path.join(root, "template.html"), "utf8");
const c = JSON.parse(fs.readFileSync(path.join(root, "content/site.json"), "utf8"));
for (const [k, v] of Object.entries(c)) t = t.split(`@@${k}@@`).join(v);
fs.writeFileSync(path.join(root, "index.html"), t);
console.log(`Built index.html with ${Object.keys(c).length} content fields.`);
