import fs from "fs";
import path from "path";
import jsdom from "jsdom";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

const outputDir = "outputs";
const imagesDir = path.join(outputDir, "images");
fs.mkdirSync(imagesDir, { recursive: true });

async function downloadImage(url, destPath) {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buffer));
    return true;
  } catch (e) {
    console.error(`Failed: ${e.message}`);
    return false;
  }
}

function imageIdFromUrl(url) {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);
    const filename = segments[segments.length - 1];
    return filename.replace(/\.[^.]+$/, "");
  } catch {
    return `img_${Date.now()}`;
  }
}

function getBestImgSrc(imgEl) {
  return (
    imgEl.getAttribute("data-src") ||
    imgEl.getAttribute("src") ||
    ""
  );
}

function resolveUrl(base, rel) {
  try {
    return new URL(rel, base).href;
  } catch {
    return rel;
  }
}

async function findArticleImage(articleUrl) {
  try {
    const res = await fetch(articleUrl, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const articleDoc = new jsdom.JSDOM(await res.text(), { url: articleUrl }).window.document;

    const selectors = [
      ".call-outs img",
      ".liner.paddingTop img",
      ".entry-content img",
      "article img",
    ];

    for (const sel of selectors) {
      const img = articleDoc.querySelector(sel);
      if (img) {
        const src = getBestImgSrc(img);

        if (src && !src.startsWith("data:") && !src.endsWith(".svg")) {
          return resolveUrl(articleUrl, src);
        }
      }
    }
  } catch (e) {
    console.error(`Could not fetch : ${e.message}`);
  }
  return null;
}



console.log("Fetching plant list...");
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

console.log(`Found ${plants.length} plants.\n`);

const plantDetails = [];

for (const plant of plants) {
  console.log(`Plant: ${plant.name}`);
  try {
    const res = await fetch(plant.url, { headers });
    const plantDoc = new jsdom.JSDOM(await res.text(), { url: plant.url }).window.document;

    const sections = [
      ...plantDoc.querySelectorAll(".liner.paddingTop.archiveList section"),
    ];

    const flowers = [];

    for (const section of sections) {
      const h3 = section.querySelector("h3");
      const linkEl = section.querySelector("a");
      const name = h3?.textContent.trim() || "";
      const articleUrl = linkEl?.href || "";

      if (!name || !articleUrl) continue;

      let imageUrl = null;
      const thumbImg = section.querySelector("img");
      if (thumbImg) {
        const src = getBestImgSrc(thumbImg);
        if (src && !src.startsWith("data:") && !src.endsWith(".svg")) {
          imageUrl = resolveUrl(plant.url, src);
        }
      }

      if (!imageUrl) {
        await sleep(800);
        imageUrl = await findArticleImage(articleUrl);
      }

      let imageId = null;
      let savedPath = null;

      if (imageUrl) {
        imageId = imageIdFromUrl(imageUrl);
        const extMatch = imageUrl.match(/\.(jpe?g|png|webp|gif)(\?|$)/i);
        const ext = extMatch ? extMatch[1].replace("jpeg", "jpg") : "jpg";
        savedPath = path.join(imagesDir, `${imageId}.${ext}`);

        if (!fs.existsSync(savedPath)) {
          await downloadImage(imageUrl, savedPath);
          await sleep(400);
        } else {
          console.log(`image already exists`);
        }
      } else {
        console.log(`no image found`);
      }

      flowers.push({
        name,
        url: articleUrl,
        imageId,
        imagePath: savedPath,
      });
    }

    if (flowers.length > 0) {
      plantDetails.push({ ...plant, flowers });
    }
  } catch (error) {
    console.error(`Error processing : ${error.message}`);
  }

  await sleep(1200);

  fs.writeFileSync(
    path.join(outputDir, "plants.json"),
    JSON.stringify(plantDetails, null, 2)
  );
}

