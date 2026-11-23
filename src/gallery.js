(function () {
  var dialog = document.querySelector("[data-lightbox]");
  if (!dialog || typeof dialog.showModal !== "function") return;

  var items = Array.prototype.slice.call(document.querySelectorAll("[data-gallery-item]"));
  if (!items.length) return;

  var img = dialog.querySelector("img");
  var caption = dialog.querySelector("figcaption");
  var index = 0;
  var trigger = null;

  function show(next) {
    index = (next + items.length) % items.length;
    var item = items[index];
    img.src = item.getAttribute("data-full");
    img.width = Number(item.getAttribute("data-full-w")) || 1600;
    img.height = Number(item.getAttribute("data-full-h")) || 1066;
    img.alt = item.getAttribute("data-alt") || "";
    caption.textContent = item.getAttribute("data-caption") || "";
  }

  items.forEach(function (item, itemIndex) {
    item.addEventListener("click", function () {
      trigger = item;
      show(itemIndex);
      dialog.showModal();
    });
  });

  dialog.querySelector("[data-prev]").addEventListener("click", function () {
    show(index - 1);
  });
  dialog.querySelector("[data-next]").addEventListener("click", function () {
    show(index + 1);
  });
  dialog.querySelector("[data-close]").addEventListener("click", function () {
    dialog.close();
  });

  dialog.addEventListener("close", function () {
    img.removeAttribute("src");
    if (trigger) trigger.focus();
  });

  document.addEventListener("keydown", function (event) {
    if (!dialog.open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      dialog.close();
    }
  });

  dialog.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      event.preventDefault();
      dialog.close();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      show(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      show(index - 1);
    }
  });
})();
