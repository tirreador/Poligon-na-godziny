const draft = JSON.parse(document.getElementById("draft-data").textContent);
const publishedNode = document.getElementById("published-data");
const published = publishedNode ? JSON.parse(publishedNode.textContent) : null;
const panel = document.getElementById("panel");
const status = document.getElementById("status");
const viewLink = document.getElementById("view");
const publishButton = document.getElementById("publish");
const retryButton = document.getElementById("retry");

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function setPath(obj, path, value) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

function field(label, bind, value, options = {}) {
  const control = options.multiline
    ? `<textarea data-bind="${bind}" rows="${options.rows || 4}">${esc(value)}</textarea>`
    : `<input data-bind="${bind}" type="${options.type || "text"}" value="${esc(value)}">`;
  return `<label class="field"><span>${label}</span>${control}</label>`;
}

function lineEditor(offerIndex, line, lineIndex) {
  const base = `offers.${offerIndex}.lines.${lineIndex}`;
  return `<div class="news-item">
    ${field("Nazwa wariantu", `${base}.label`, line.label)}
    ${field("Opis", `${base}.detail`, line.detail, { multiline: true, rows: 3 })}
    ${field("Cena", `${base}.amount`, line.amount)}
    ${field("Jednostka", `${base}.unit`, line.unit)}
    ${field("Czas", `${base}.time`, line.time)}
    ${field("Tekst, gdy ceny nie ma", `${base}.ask`, line.ask)}
    <button type="button" class="danger" data-action="remove-line" data-offer="${offerIndex}" data-line="${lineIndex}">Usuń wariant</button>
  </div>`;
}

function offerEditor(offer, index) {
  return `<article class="offer" id="oferta-${index}">
    <h3>${esc(offer.name || "Pozycja cennika")}</h3>
    ${field("Nazwa", `offers.${index}.name`, offer.name)}
    ${field("Opis", `offers.${index}.summary`, offer.summary, { multiline: true, rows: 3 })}
    ${field("Dopisek", `offers.${index}.note`, offer.note, { multiline: true, rows: 2 })}
    ${(offer.lines || []).map((line, lineIndex) => lineEditor(index, line, lineIndex)).join("")}
    <button type="button" data-action="add-line" data-offer="${index}">Dodaj wariant</button>
  </article>`;
}

function shotEditor(item, index) {
  return `<article class="shot-edit" id="zdjecie-${index}">
    <img class="preview" src="/admin/uploads/${encodeURIComponent(item.file)}" alt="">
    ${field("Podpis", `gallery.${index}.caption`, item.caption)}
    ${field("Opis alternatywny", `gallery.${index}.alt`, item.alt, { multiline: true, rows: 2 })}
    ${field("Oznaczenie, np. Kozaki", `gallery.${index}.tag`, item.tag)}
    <div class="row">
      <label class="file-btn">Zmień zdjęcie<input type="file" accept="image/*" data-upload="replace" data-index="${index}"></label>
      <button type="button" data-action="up" data-index="${index}">Wyżej</button>
      <button type="button" data-action="down" data-index="${index}">Niżej</button>
      <button type="button" class="danger" data-action="remove-photo" data-index="${index}">Usuń</button>
    </div>
  </article>`;
}

function render() {
  panel.innerHTML = `
    <section id="sekcja-pierwszy">
      <h2>Pierwszy ekran</h2>
      ${field("Nazwa marki", "hero.brand", draft.hero.brand)}
      ${field("Nagłówek", "hero.title", draft.hero.title)}
      ${field("Opis", "hero.lead", draft.hero.lead, { multiline: true, rows: 6 })}
      ${field("Opis zdjęcia", "hero.imageAlt", draft.hero.imageAlt, { multiline: true, rows: 2 })}
      ${field("Przycisk", "hero.primaryLabel", draft.hero.primaryLabel)}
      ${field("Link", "hero.secondaryLabel", draft.hero.secondaryLabel)}
      <img class="preview" src="/admin/uploads/${encodeURIComponent(draft.hero.image)}" alt="">
      <div class="row"><label class="file-btn">Zmień zdjęcie<input type="file" accept="image/*" data-upload="hero"></label></div>
    </section>
    <section id="sekcja-cennik">
      <h2>Cennik</h2>
      <p class="hint">Cena, czas i dopisek biorą się stąd. Puste pole ceny przy przejeździe naszą terenówką zostawia informację telefoniczną. Gdy uzupełnisz cenę jednego wariantu, pojawi się przy jego wierszu.</p>
      ${field("Przycisk pod ofertą", "pricingCta", draft.pricingCta)}
      ${draft.offers.map(offerEditor).join("")}
    </section>
    <section id="sekcja-voucher">
      <h2>Voucher</h2>
      ${field("Nagłówek", "voucher.title", draft.voucher.title)}
      ${field("Treść", "voucher.body", draft.voucher.body, { multiline: true, rows: 4 })}
      ${field("Przycisk", "voucher.button", draft.voucher.button)}
    </section>
    <section id="sekcja-galeria">
      <h2>Galeria</h2>
      <p class="hint">Dodajesz i usuwasz zdjęcia tutaj. Oznaczenie „Kozaki” dopisuje się do podpisu zdjęcia z rajdu. Po zmianie wybierz „Zapisz i opublikuj”.</p>
      <label class="file-btn">Dodaj zdjęcia<input type="file" accept="image/*" data-upload="add" multiple></label>
      ${draft.gallery.length ? draft.gallery.map(shotEditor).join("") : `<p class="hint">Galeria jest pusta.</p>`}
      ${field("Etykieta nagrania", "video.label", draft.video.label)}
      ${field("Adres nagrania", "video.url", draft.video.url, { type: "url" })}
    </section>
    <section id="sekcja-dojazd">
      <h2>Dojazd</h2>
      <p class="hint">Numer i link tel: biorą się z tego jednego pola. Pojawia się przy cenniku, voucherze i dojeździe.</p>
      ${field("Numer telefonu", "contact.phone", draft.contact.phone)}
      ${field("Oznaczenie numeru", "contact.phoneNote", draft.contact.phoneNote)}
      ${field("Adres", "contact.address", draft.contact.address)}
      ${field("Zdanie dojazdowe", "contact.directions", draft.contact.directions, { multiline: true, rows: 2 })}
      ${field("Cel mapy i trasy", "contact.mapsQuery", draft.contact.mapsQuery)}
      ${field("Przycisk trasy", "contact.mapsLabel", draft.contact.mapsLabel)}
    </section>
    <section id="sekcja-aktualnosci">
      <h2>Aktualności</h2>
      <p class="hint">Sekcja pojawia się na stronie tylko wtedy, gdy jest opublikowany wpis.</p>
      ${draft.news.map((item, index) => `<article class="news-item">
        ${field("Komunikat", `news.${index}.message`, item.message, { multiline: true, rows: 3 })}
        <label class="check"><input type="checkbox" data-bind="news.${index}.published" ${item.published ? "checked" : ""}> Opublikowany</label>
        <button type="button" class="danger" data-action="remove-news" data-index="${index}">Usuń komunikat</button>
      </article>`).join("")}
      <button type="button" data-action="add-news">Dodaj komunikat</button>
    </section>`;
}

function setStatus(message, kind) {
  status.textContent = message;
  status.className = kind || "";
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function upload(input) {
  const files = Array.from(input.files || []);
  const mode = input.dataset.upload;
  const index = Number(input.dataset.index);
  input.value = "";
  if (!files.length) return;
  setStatus(files.length > 1 ? "Wgrywanie zdjęć…" : "Wgrywanie zdjęcia…", "");
  publishButton.disabled = true;
  try {
    for (const file of files) {
      const response = await fetch("/admin/api/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, dataBase64: await readFile(file) })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Nie udało się wgrać zdjęcia.");
      if (mode === "hero") {
        draft.hero.image = data.file;
        break;
      }
      if (mode === "replace") {
        draft.gallery[index].file = data.file;
        break;
      }
      draft.gallery.push({
        id: `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        file: data.file,
        alt: "",
        caption: "",
        tag: ""
      });
    }
    render();
    setStatus(mode === "add" && files.length > 1
      ? "Nowe zdjęcia są w podglądzie. Uzupełnij opisy i opublikuj, żeby trafiły na stronę."
      : "Zdjęcie jest w podglądzie. Uzupełnij opis i opublikuj, żeby trafiło na stronę.", "ok");
  } catch (error) {
    render();
    setStatus(error.message, "error");
  } finally {
    publishButton.disabled = false;
  }
}

async function publish() {
  publishButton.disabled = true;
  retryButton.hidden = true;
  viewLink.hidden = true;
  setStatus("Publikowanie…", "");
  try {
    const response = await fetch("/admin/api/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft)
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Publikacja nie powiodła się.");
    setStatus(data.message || "Opublikowano", "ok");
    viewLink.href = data.url;
    viewLink.hidden = false;
  } catch (error) {
    setStatus(error.message, "error");
    retryButton.hidden = false;
  } finally {
    publishButton.disabled = false;
  }
}

document.addEventListener("input", (event) => {
  const target = event.target;
  if (!target.dataset.bind) return;
  setPath(draft, target.dataset.bind, target.type === "checkbox" ? target.checked : target.value);
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-upload]")) upload(event.target);
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const index = Number(button.dataset.index);
  const offerIndex = Number(button.dataset.offer);
  if (button.dataset.action === "add-line") {
    draft.offers[offerIndex].lines.push({ label: "", detail: "", amount: "", unit: "", time: "", ask: "Zapytaj o cenę przejazdu" });
  } else if (button.dataset.action === "remove-line") {
    const lineIndex = Number(button.dataset.line);
    if (draft.offers[offerIndex].lines.length === 1) return;
    draft.offers[offerIndex].lines.splice(lineIndex, 1);
  } else if (button.dataset.action === "up" && index > 0) {
    const [item] = draft.gallery.splice(index, 1);
    draft.gallery.splice(index - 1, 0, item);
  } else if (button.dataset.action === "down" && index < draft.gallery.length - 1) {
    const [item] = draft.gallery.splice(index, 1);
    draft.gallery.splice(index + 1, 0, item);
  } else if (button.dataset.action === "remove-photo") {
    draft.gallery.splice(index, 1);
  } else if (button.dataset.action === "add-news") {
    draft.news.push({ id: `n${Date.now().toString(36)}`, message: "", published: true });
  } else if (button.dataset.action === "remove-news") {
    draft.news.splice(index, 1);
  } else {
    return;
  }
  render();
});

publishButton.addEventListener("click", publish);
retryButton.addEventListener("click", publish);

if (published && JSON.stringify(published) !== JSON.stringify(draft)) {
  setStatus("Są zmiany zapisane w panelu, których nie ma jeszcze na stronie.", "");
}

render();
