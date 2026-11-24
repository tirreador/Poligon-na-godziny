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

function hasAmount(line) {
  return String(line?.amount || "").trim().length > 0;
}

function placeOf(contact) {
  return String(contact?.mapsQuery || contact?.address || "").trim();
}

function mapsFor(contact) {
  const place = placeOf(contact);
  if (!place) return { embed: "", directions: "", place: "" };
  const query = encodeURIComponent(place);
  return {
    place,
    embed: `https://www.google.com/maps?q=${query}&z=16&output=embed`,
    directions: `https://www.google.com/maps/dir/?api=1&destination=${query}`
  };
}

function phoneMarkup(phone, telHref, note, light) {
  return `<p class="phone-line${light ? " light" : ""}"><a href="${telHref}">${esc(phone)}</a>${note ? ` <span>${esc(note)}</span>` : ""}</p>`;
}

function ownBlock(offer) {
  const rows = (offer.lines || []).map((line) => `<div class="price-row">
      <span>${esc(line.time || line.label)}</span>
      <strong>${esc(line.amount)}</strong>
    </div>`).join("");
  return `<article class="offer-block">
    <h3>${esc(offer.name)}</h3>
    ${offer.summary ? `<p class="detail">${esc(offer.summary)}</p>` : ""}
    <div class="price-rows">${rows}</div>
    ${offer.note ? `<p class="note">${esc(offer.note)}</p>` : ""}
  </article>`;
}

function rideBlock(offer) {
  const lines = offer.lines || [];
  const anyPrice = lines.some(hasAmount);
  const rows = lines.map((line) => {
    const side = hasAmount(line)
      ? `<strong>${esc(line.amount)}</strong>`
      : (anyPrice ? `<span class="row-ask">${esc(line.ask || "Zadzwoń po cenę")}</span>` : "");
    const text = [line.label, line.time].filter(Boolean).join(" — ");
    return `<div class="price-row">
      <span>${esc(text)}${line.detail ? `<small class="detail">${esc(line.detail)}</small>` : ""}</span>
      ${side}
    </div>`;
  }).join("");
  const foot = !anyPrice && String(offer.note || "").trim() ? `<p class="note">${esc(offer.note)}</p>` : "";
  return `<article class="offer-block">
    <h3>${esc(offer.name)}</h3>
    <div class="price-rows">${rows}</div>
    ${foot}
  </article>`;
}

function groupBlock(offer) {
  const line = (offer.lines || [])[0] || {};
  const quote = hasAmount(line) ? line.amount : (line.ask || "Wycena indywidualna");
  return `<article class="group-row">
    <div>
      <h3>${esc(offer.name)}</h3>
      ${String(offer.summary || "").split("\n").map((part) => part.trim()).filter(Boolean).map((part) => `<p>${esc(part)}</p>`).join("")}
    </div>
    <p class="quote">${esc(quote)}</p>
  </article>`;
}

function offerMarkup(offer) {
  if (offer.id === "impreza") return groupBlock(offer);
  if (offer.id === "nasze") return rideBlock(offer);
  return ownBlock(offer);
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
  const maps = mapsFor(draft.contact);
  const video = safeUrl(draft.video?.url);
  const intro = String(draft.pricingIntro || "").trim();
  const publishedNews = (draft.news || []).some((item) => item.published && String(item.message || "").trim());

  const lcp = hero && (hero.avif.find((item) => item.w >= 960) || hero.avif[hero.avif.length - 1]);
  const preload = lcp
    ? `<link rel="preload" as="image" href="${lcp.src}" imagesrcset="${srcset(hero.avif)}" imagesizes="(min-width: 960px) 58vw, 100vw" type="image/avif" fetchpriority="high">`
    : "";

  const nav = [
    ["#cennik", "Cennik"],
    ["#voucher", "Voucher"],
    ["#galeria", "Galeria"],
    ["#dojazd", "Dojazd"]
  ];
  if (publishedNews) nav.splice(1, 0, ["#aktualnosci", "Aktualności"]);

  const offers = draft.offers || [];
  const driveOffers = offers.filter((offer) => offer.id !== "impreza");
  const groupOffers = offers.filter((offer) => offer.id === "impreza");
  const pricingCta = draft.pricingCta || "Zadzwoń o cenę lub termin";

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
    <div class="header-inner">
      <a class="brand" href="#tresc">${esc(draft.hero.brand)}</a>
      <nav class="nav" aria-label="Sekcje strony">
        ${nav.map(([href, label]) => `<a href="${href}">${label}</a>`).join("")}
      </nav>
    </div>
  </header>
  <main id="tresc">
    <section class="hero" aria-labelledby="hero-tytul">
      <div class="hero-frame">
        <div class="hero-copy">
          <h1 id="hero-tytul">${esc(draft.hero.title)}</h1>
          <p class="lead">${esc(draft.hero.lead)}</p>
          <div class="hero-actions">
            <a class="btn" href="#cennik">${esc(draft.hero.primaryLabel)}</a>
            <a class="text-link" href="#voucher">${esc(draft.hero.secondaryLabel)}</a>
          </div>
        </div>
        <div class="hero-photo">
          ${picture(hero, draft.hero.imageAlt, { eager: true, sizes: "(min-width: 960px) 58vw, 100vw", className: "hero-img" })}
        </div>
      </div>
    </section>
    ${newsMarkup(draft.news)}
    <section id="cennik" aria-labelledby="cennik-tytul">
      <div class="wrap">
        <h2 id="cennik-tytul">Cennik</h2>
        ${intro ? `<p class="intro">${esc(intro)}</p>` : ""}
        <div class="price-grid">${driveOffers.map(offerMarkup).join("")}</div>
        ${groupOffers.map(offerMarkup).join("")}
        <div class="offer-contact">
          <a class="btn" href="${telHref}">${esc(pricingCta)}</a>
          ${phoneMarkup(phone, telHref, note)}
        </div>
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
          ${phoneMarkup(phone, telHref, note, true)}
        </div>
      </div>
    </section>
    <section id="galeria" aria-labelledby="galeria-tytul">
      <div class="wrap">
        <h2 id="galeria-tytul">Zobacz tor i terenówki</h2>
        <ul class="gallery">${shots}</ul>
        ${video ? `<p class="video-link"><a href="${esc(video)}">${esc(draft.video.label || "Zobacz nagranie")}</a></p>` : ""}
      </div>
    </section>
    <section id="dojazd" aria-labelledby="dojazd-tytul">
      <div class="wrap contact">
        <div class="contact-copy">
          <h2 id="dojazd-tytul">Kontakt i dojazd</h2>
          <p class="address">${esc(draft.contact.address)}</p>
          ${draft.contact.directions ? `<p class="intro">${esc(draft.contact.directions)}</p>` : ""}
          ${phoneMarkup(phone, telHref, note)}
          ${maps.directions ? `<a class="btn" href="${esc(maps.directions)}">${esc(draft.contact.mapsLabel || "Wyznacz trasę")}</a>` : ""}
        </div>
        ${maps.embed ? `<div class="map-frame"><iframe title="Mapa: ${esc(maps.place)}" src="${esc(maps.embed)}" width="600" height="360" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>` : ""}
      </div>
    </section>
  </main>
  <footer class="site-footer">
    <div class="footer-inner">
      <p class="brand">${esc(draft.hero.brand)}</p>
      <p><a href="${telHref}">${esc(phone)}</a>${note ? ` · ${esc(note)}` : ""}</p>
      <p>${esc(draft.contact.address)}</p>
    </div>
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
