async function check() {
  const res = await fetch("http://localhost:3000/");
  const html = await res.text();
  const match = html.match(/href="(\/_next\/static\/css\/[^"]+)"/);
  if (match) {
    const cssUrl = "http://localhost:3000" + match[1];
    const cssRes = await fetch(cssUrl);
    const cssText = await cssRes.text();
    console.log("CSS URL:", cssUrl);
    console.log("CSS HTTP Status:", cssRes.status);
    console.log("CSS File Size:", cssText.length, "bytes");
  } else {
    console.log("No CSS stylesheet link found in HTML!");
  }
}

check().catch(console.error);
