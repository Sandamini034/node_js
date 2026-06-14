import fs from "fs";
import jsdom from "jsdom";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

const html = await fetch(
  "https://wildfloweryard.com/a-to-z-list-plants-flowers-trees/",
  { headers }
);
const doc = new jsdom.JSDOM(await html.text()).window.document;
const plants = [...doc.querySelectorAll(".links li a")].map((a) => ({
  name: a.textContent.trim(),
  url: a.href,
  flowers: [],
}));

const plantDetails = [];

for (const plant of plants) {
  try {
    const res = await fetch(plant.url, { headers });
    const plantDoc = new jsdom.JSDOM(await res.text()).window.document;

    const flowers = [
      ...plantDoc.querySelectorAll(".liner.paddingTop.archiveList section"),
    ]
      .map((section) => {
        const a = section.querySelector("h3");
        const url = section.querySelector("a");
        return {
          name: a?.textContent.trim() || "",
          url: url?.href || "",
        };
      })
      .filter((flower) => flower.name);

    if (flowers.length > 0) {
      plantDetails.push({ ...plant, flowers });
    }
  } catch (error) {
    console.error(error.message);
  }

  await sleep(1500);
  fs.writeFileSync(
    "outputs/plants.json",
    JSON.stringify(plantDetails, null, 2)
  );
}
