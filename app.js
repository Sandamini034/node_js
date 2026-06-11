import fs from "fs";
import jsdom from "jsdom";

const html = await fetch(
  "https://wildfloweryard.com/a-to-z-list-plants-flowers-trees/"
);
const doc = new jsdom.JSDOM(await html.text()).window.document;
const plants = [...doc.querySelectorAll(".links li a")].map((a) => ({
  name: a.textContent.trim(),
  url: a.href,
}));

fs.writeFileSync("outputs/plants.json", JSON.stringify(plants, null, 2));
