// Tienda pública de Vella. Solo lee productos/{id}: nunca toca costos ni inventario.
import { firebaseConfig, WHATSAPP, REDES } from "./config.js";

const $ = (id) => document.getElementById(id);
const CLAVE_CARRITO = "vellaCarrito";
const MODO_DEMO = !firebaseConfig.apiKey;
const estado = { productos: [], categoria: "Todos", carrito: leerCarrito() };

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pesos = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);
const buscar = (id) => estado.productos.find((p) => p.id === id);
const nombre = (p) => `${p.marca} ${p.nombre}`;
const sePuedeComprar = (p) => p?.disponible && p.precioVenta > 0;

/* ---------- Carrito: solo guarda id y cantidad; el precio siempre sale del catálogo ---------- */
function leerCarrito() {
  try { return JSON.parse(localStorage.getItem(CLAVE_CARRITO)) || {}; } catch { return {}; }
}
function guardarCarrito() {
  try { localStorage.setItem(CLAVE_CARRITO, JSON.stringify(estado.carrito)); } catch {}
  pintarContador();
}
// Líneas que todavía se pueden comprar (un producto pudo agotarse desde la última visita)
const lineas = () => Object.entries(estado.carrito)
  .map(([id, cantidad]) => ({ p: buscar(id), cantidad }))
  .filter((l) => sePuedeComprar(l.p));
const totalPedido = () => lineas().reduce((s, l) => s + l.cantidad * l.p.precioVenta, 0);

function cambiarCantidad(id, delta) {
  const n = (estado.carrito[id] || 0) + delta;
  if (n > 0) estado.carrito[id] = n; else delete estado.carrito[id];
  guardarCarrito();
}

/* ---------- Catálogo ---------- */
async function cargarCatalogo() {
  if (MODO_DEMO) {
    let demo = [];
    try { demo = Object.values(JSON.parse(localStorage.getItem("vellaDemo"))?.productos || {}); } catch {}
    if (demo.length) return demo.filter((p) => p.visible);
    const { PRODUCTOS_INICIALES } = await import("./productos-iniciales.js");
    return PRODUCTOS_INICIALES.map((p) => ({ ...p, precioVenta: 0, disponible: false }));
  }
  const V = "https://www.gstatic.com/firebasejs/12.19.0";
  const { initializeApp } = await import(`${V}/firebase-app.js`);
  const { getFirestore, collection, query, where, getDocs } = await import(`${V}/firebase-firestore.js`);
  const db = getFirestore(initializeApp(firebaseConfig));
  const r = await getDocs(query(collection(db, "productos"), where("visible", "==", true)));
  return r.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function textoPrecio(p) {
  if (!p.precioVenta) return `<span class="suave">Muy pronto</span>`;
  if (!p.disponible) return `<span class="agotado">Agotado</span>`;
  return `<span class="precio">${pesos(p.precioVenta)}</span>`;
}

function pintarCatalogo() {
  const categorias = ["Todos", ...new Set(estado.productos.map((p) => p.categoria).filter(Boolean))];
  $("filtros").innerHTML = categorias.length > 2 ? categorias.map((c) =>
    `<button class="filtro${c === estado.categoria ? " activo" : ""}" data-categoria="${esc(c)}" aria-pressed="${c === estado.categoria}">${esc(c)}</button>`).join("") : "";
  const lista = estado.productos.filter((p) => estado.categoria === "Todos" || p.categoria === estado.categoria);
  $("catalogo").innerHTML = lista.map((p) => `<article class="producto">
      <button class="producto-abrir" data-accion="detalle" data-id="${esc(p.id)}">
        <img src="${esc(p.foto)}" alt="${esc(nombre(p))}" loading="lazy">
        <span class="producto-texto">
          <span class="suave">${esc(p.marca)} · ${esc(p.presentacion)}</span>
          <span class="producto-nombre">${esc(p.nombre)}</span>
          ${textoPrecio(p)}
        </span>
      </button>
      <button class="btn" data-accion="agregar" data-id="${esc(p.id)}" ${sePuedeComprar(p) ? "" : "disabled"}>Agregar</button>
    </article>`).join("") || `<p class="suave">Pronto tendremos productos aquí 🌸</p>`;
}

function abrirDetalle(id) {
  const p = buscar(id);
  $("cuerpoDetalle").innerHTML = `<div class="detalle">
      <img src="${esc(p.foto)}" alt="${esc(nombre(p))}">
      <div class="detalle-texto">
        <span class="suave">${esc(p.marca)} · ${esc(p.presentacion)}</span>
        <h2>${esc(p.nombre)}</h2>
        ${textoPrecio(p)}
        <p>${esc(p.descripcion)}</p>
        <button class="btn btn-ancho" data-accion="agregar" data-id="${esc(p.id)}" ${sePuedeComprar(p) ? "" : "disabled"}>Agregar al carrito</button>
      </div>
    </div>`;
  $("dlgDetalle").showModal();
}

/* ---------- Carrito y pedido ---------- */
function pintarContador() {
  $("contador").textContent = lineas().reduce((s, l) => s + l.cantidad, 0);
}

function pintarCarrito() {
  const ls = lineas();
  if (!ls.length) {
    $("cuerpoCarrito").innerHTML = `<p class="suave">Tu carrito está vacío.</p>`;
    return;
  }
  // Se conservan los datos escritos al cambiar cantidades
  const previo = { nombre: $("pedNombre")?.value || "", ciudad: $("pedCiudad")?.value || "" };
  $("cuerpoCarrito").innerHTML = ls.map(({ p, cantidad }) => `<div class="linea">
      <img src="${esc(p.foto)}" alt="">
      <div class="linea-nombre">${esc(nombre(p))}<br><span class="suave">${pesos(p.precioVenta)}</span></div>
      <div class="cantidad">
        <button data-accion="menos" data-id="${esc(p.id)}" aria-label="Quitar uno de ${esc(p.nombre)}">−</button>
        <span>${cantidad}</span>
        <button data-accion="mas" data-id="${esc(p.id)}" aria-label="Agregar uno de ${esc(p.nombre)}">+</button>
      </div>
    </div>`).join("") + `
    <div class="total"><span>Total productos</span><span>${pesos(totalPedido())}</span></div>
    <p class="suave">El envío se confirma por WhatsApp según tu ciudad.</p>
    <form id="formPedido">
      <label>Tu nombre <input id="pedNombre" required maxlength="60" autocomplete="name" value="${esc(previo.nombre)}"></label>
      <label>Ciudad <input id="pedCiudad" required maxlength="60" autocomplete="address-level2" value="${esc(previo.ciudad)}"></label>
      <button class="btn btn-ancho" type="submit">Enviar pedido por WhatsApp</button>
    </form>`;
}

function mensajePedido() {
  const detalle = lineas().map(({ p, cantidad }) => `• ${cantidad} x ${nombre(p)}: ${pesos(cantidad * p.precioVenta)}`).join("\n");
  return `Hola Vella 🌸 Quiero hacer este pedido:\n\n${detalle}\n\nTotal productos: ${pesos(totalPedido())}\n\nNombre: ${$("pedNombre").value.trim()}\nCiudad: ${$("pedCiudad").value.trim()}\n\n¿Me confirman el envío y los datos para pagar por Bre-B?`;
}

/* ---------- Eventos ---------- */
function avisar(texto) {
  const t = $("toast");
  t.textContent = texto;
  t.classList.add("ver");
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => t.classList.remove("ver"), 2500);
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.categoria) { estado.categoria = b.dataset.categoria; pintarCatalogo(); return; }
  const id = b.dataset.id;
  switch (b.dataset.accion) {
    case "detalle": abrirDetalle(id); break;
    case "cerrar": b.closest("dialog").close(); break;
    case "carrito": pintarCarrito(); $("dlgCarrito").showModal(); break;
    case "agregar":
      cambiarCantidad(id, 1);
      $("dlgDetalle").close();
      avisar("Agregado a tu carrito 🛍️");
      break;
    case "mas": cambiarCantidad(id, 1); pintarCarrito(); break;
    case "menos": cambiarCantidad(id, -1); pintarCarrito(); break;
  }
});

document.addEventListener("submit", (e) => {
  if (e.target.id !== "formPedido") return;
  e.preventDefault();
  window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensajePedido())}`, "_blank", "noopener");
});

/* ---------- Arranque ---------- */
const ETIQUETAS = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook" };
$("redes").innerHTML = Object.entries(REDES).filter(([, u]) => /^https:\/\//.test(u))
  .map(([k, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${ETIQUETAS[k]}</a>`).join("");

try {
  estado.productos = (await cargarCatalogo()).sort((a, b) => nombre(a).localeCompare(nombre(b), "es"));
  pintarCatalogo();
  pintarContador();
} catch {
  $("catalogo").innerHTML = `<p class="suave">No pudimos cargar los productos. Revisa tu conexión y recarga la página.</p>`;
}
