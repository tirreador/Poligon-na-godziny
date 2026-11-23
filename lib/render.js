function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

export function phoneTel(phone) {
  const raw = String(phone ?? "");
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  return raw.trim().startsWith("+") ? `+${digits}` : digits;
}

function safeUrl(url) {
  const value = String(url ?? "").trim();
  if (/^https:\/\/[^\s]+$/i.test(value)) return value;
  return "";
}

function srcset(list) {
  return list.map((item) => `${item.src} ${item.w}w`).join(", ");
}

function picture(image, alt, { eager = false, sizes, className = "" } = {}) {
  if (!image) return "";
  const fallback = image.webp[image.webp.length - 1];
  const loading = eager
    ? 'fetchpriority="high" decoding="async"'
    : 'loading="lazy" decoding="async"';
  return `<picture>
    <source type="image/avif" srcset="${srcset(image.avif)}" sizes="${sizes}">
    <source type="image/webp" srcset="${srcset(image.webp)}" sizes="${sizes}">
    <img class="${className}" src="${fallback.src}" alt="${esc(alt)}" width="${fallback.w}" height="${fallback.h}" ${loading}>
  </picture>`;
}

function lineMarkup(line) {
  const bits = [];
  if (line.label) bits.push(`<h4>${esc(line.label)}</h4>`);
  if (line.detail) bits.push(`<p class="detail">${esc(line.detail)}</p>`);
  const time = line.time ? `<span class="time">${esc(line.time)}</span>` : "";
  if (String(line.amount || "").trim()) {
    const unit = line.unit ? ` <small>${esc(line.unit)}</small>` : "";
    bits.push(`<p class="rate"><span class="amount">${esc(line.amount)}${unit}</span>${time}</p>`);
  } else if (line.ask || line.time) {
    bits.push(`<p class="rate ask"><span class="amount">${esc(line.ask || "Zapytaj o cenę")}</span>${time}</p>`);
  }
  return `<div class="line">${bits.join("")}</div>`;
}

function newsMarkup(news) {
  const published = (news || []).filter((item) => item.published && String(item.message || "").trim());
  if (!published.length) return "";
  return `<section id="aktualnosci" aria-labelledby="aktualnosci-tytul">
    <div class="wrap">
      <h2 id="aktualnosci-tytul">Aktualności</h2>
      <ul class="news">
        ${published.map((item) => `<li>${esc(item.message)}</li>`).join("")}
      </ul>
    </div>
  </section>`;
}

export function renderPage(draft, manifest, css) {
  const phone = draft.contact?.phone || "";
  const tel = phoneTel(phone);
  const telHref = tel ? `tel:${tel}` : "#dojazd";
  const note = draft.contact?.phoneNote || "";
  const hero = manifest[draft.hero.image];
  const maps = safeUrl(draft.contact?.mapsUrl);
  const video = safeUrl(draft.video?.url);
  const publishedNews = (draft.news || []).some((item) => item.published && String(item.message || "").trim());

  const lcp = hero && (hero.avif.find((item) => item.w >= 960) || hero.avif[hero.avif.length - 1]);
  const preload = lcp
    ? `<link rel="preload" as="image" href="${lcp.src}" imagesrcset="${srcset(hero.avif)}" imagesizes="(min-width: 900px) 58vw, 100vw" type="image/avif" fetchpriority="high">`
    : "";

  const nav = [
    ["#cennik", "Cennik"],
    ["#voucher", "Voucher"],
    ["#galeria", "Galeria"],
    ["#dojazd", "Dojazd"]
  ];
  if (publishedNews) nav.splice(1, 0, ["#aktualnosci", "Aktualności"]);

  const cards = (draft.offers || []).map((offer) => `<article class="card">
    <h3>${esc(offer.name)}</h3>
    ${offer.summary ? `<p>${esc(offer.summary)}</p>` : ""}
    <div class="lines">${(offer.lines || []).map(lineMarkup).join("")}</div>
    ${offer.note ? `<p class="note">${esc(offer.note)}</p>` : ""}
    <a class="btn" href="${telHref}">${esc(offer.ctaLabel || "Zadzwoń")}</a>
  </article>`).join("");

  const shots = (draft.gallery || []).map((item) => {
    const image = manifest[item.file];
    if (!image) return "";
    const caption = [item.tag, item.caption].filter(Boolean).join(" — ");
    return `<li>
      <button type="button" class="shot" data-gallery-item data-full="${image.full.src}" data-full-w="${image.full.w}" data-full-h="${image.full.h}" data-alt="${esc(item.alt)}" data-caption="${esc(caption)}">
        ${picture(image, item.alt, { sizes: "(min-width: 800px) 33vw, 50vw" })}
        <span class="shot-text">
          ${item.tag ? `<span class="badge">${esc(item.tag)}</span>` : ""}
          <span>${esc(item.caption)}</span>
        </span>
      </button>
    </li>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(draft.hero.brand)} — tor off-road we Wrocławiu</title>
  <meta name="description" content="${esc(draft.hero.lead)}">
  <meta name="theme-color" content="#20251F">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  ${preload}
  <style>${css}</style>
</head>
<body>
  <a class="skip" href="#tresc">Przejdź do treści</a>
  <header class="site-header">
    <a class="brand" href="#tresc">${esc(draft.hero.brand)}</a>
    <nav class="nav" aria-label="Sekcje strony">
      ${nav.map(([href, label]) => `<a href="${href}">${label}</a>`).join("")}
    </nav>
  </header>
  <main id="tresc">
    <section class="hero" aria-labelledby="hero-tytul">
      <div class="hero-photo">
        ${picture(hero, draft.hero.imageAlt, { eager: true, sizes: "(min-width: 900px) 58vw, 100vw", className: "hero-img" })}
      </div>
      <div class="hero-copy">
        <p class="eyebrow">${esc(draft.hero.eyebrow)}</p>
        <h1 id="hero-tytul">${esc(draft.hero.title)}</h1>
        <p class="lead">${esc(draft.hero.lead)}</p>
        <div class="hero-actions">
          <a class="btn" href="#cennik">${esc(draft.hero.primaryLabel)}</a>
          <a class="text-link" href="#voucher">${esc(draft.hero.secondaryLabel)}</a>
        </div>
      </div>
    </section>
    ${newsMarkup(draft.news)}
    <section id="cennik" aria-labelledby="cennik-tytul">
      <div class="wrap">
        <h2 id="cennik-tytul">Cennik</h2>
        <p class="intro">${esc(draft.pricingIntro)}</p>
        <p class="phone-line"><a href="${telHref}">${esc(phone)}</a>${note ? ` <span>${esc(note)}</span>` : ""}</p>
        <div class="cards">${cards}</div>
      </div>
    </section>
    <section id="voucher" aria-labelledby="voucher-tytul">
      <div class="wrap voucher-inner">
        <div>
          <h2 id="voucher-tytul">${esc(draft.voucher.title)}</h2>
          <p class="intro">${esc(draft.voucher.body)}</p>
        </div>
        <div class="voucher-actions">
          <a class="btn" href="${telHref}">${esc(draft.voucher.button)}</a>
          <p class="phone-line light"><a href="${telHref}">${esc(phone)}</a>${note ? ` <span>${esc(note)}</span>` : ""}</p>
        </div>
      </div>
    </section>
    <section id="galeria" aria-labelledby="galeria-tytul">
      <div class="wrap">
        <h2 id="galeria-tytul">Galeria</h2>
        <p class="intro">Tor, auta i wspólny wypad. Zdjęcia z rajdu są podpisane „Kozaki”.</p>
        <ul class="gallery">${shots}</ul>
        ${video ? `<p class="video-link"><a href="${esc(video)}">${esc(draft.video.label || "Zobacz nagranie")}</a></p>` : ""}
      </div>
    </section>
    <section id="dojazd" aria-labelledby="dojazd-tytul">
      <div class="wrap contact">
        <div>
          <h2 id="dojazd-tytul">Kontakt i dojazd</h2>
          <p class="address">${esc(draft.contact.address)}</p>
          <p class="intro">${esc(draft.contact.directions)}</p>
        </div>
        <div class="contact-actions">
          <p class="phone-line"><a href="${telHref}">${esc(phone)}</a>${note ? ` <span>${esc(note)}</span>` : ""}</p>
          ${maps ? `<a class="btn" href="${esc(maps)}">${esc(draft.contact.mapsLabel || "Prowadź do wjazdu")}</a>` : ""}
        </div>
      </div>
    </section>
  </main>
  <footer class="site-footer">
    <p class="brand">${esc(draft.hero.brand)}</p>
    <p><a href="${telHref}">${esc(phone)}</a>${note ? ` · ${esc(note)}` : ""}</p>
    <p>${esc(draft.contact.address)}</p>
  </footer>
  <dialog class="lightbox" data-lightbox aria-label="Powiększone zdjęcie">
    <figure>
      <img alt="">
      <figcaption></figcaption>
    </figure>
    <div class="lightbox-bar">
      <button type="button" data-prev>Poprzednie</button>
      <button type="button" data-next>Następne</button>
      <button type="button" data-close>Zamknij</button>
    </div>
  </dialog>
  <script src="gallery.js" defer></script>
</body>
</html>`;
}
