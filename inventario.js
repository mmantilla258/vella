// Panel privado de inventario de Vella.
import { MARGEN_OBJETIVO, POCAS_UNIDADES } from "./config.js";
import {
  MODO_DEMO, onSesion, entrar, salir, cargarProductos, cargarMovimientos,
  guardarProducto, borrarProducto, moverStock, sembrarIniciales
} from "./datos.js";

const $ = (id) => document.getElementById(id);
const estado = { usuario: null, productos: [], vista: "productos", filtro: "", abierto: null, seccion: "datos", stock: null };

/* ---------- Utilidades ---------- */
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pesos = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);
const pct = (n) => `${Math.round(n * 100)} %`;
const esAdmin = () => estado.usuario?.rol === "admin";
const costoTotal = (p) => (p.costoCompra || 0) + (p.gastos || 0);
const margen = (precio, costo) => (precio > 0 ? (precio - costo) / precio : 0);
const nombreCompleto = (p) => `${p.marca} ${p.nombre}`;
const linkSeguro = (l) => (/^https?:\/\//i.test(l || "") ? l : "");
const numero = (v) => Math.max(0, Math.round(Number(v) || 0));

function avisar(texto, mal = false) {
  const t = $("toast");
  t.textContent = texto;
  t.className = `toast ver${mal ? " mal" : ""}`;
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => t.classList.remove("ver"), 3500);
}

function mensajeError(e) {
  const c = e?.code || e?.message || "";
  if (c === "sin-stock") return "No hay suficientes unidades para esa venta.";
  if (c === "cantidad-invalida") return "Revisa la cantidad: debe ser un número entero.";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "Correo o contraseña incorrectos.";
  if (c.includes("too-many-requests")) return "Demasiados intentos. Espera unos minutos.";
  if (c.includes("permission-denied")) return "No tienes permiso para hacer esto.";
  return "No se pudo completar. Revisa tu conexión e inténtalo de nuevo.";
}

// Ejecuta una acción y, si falla, lo muestra en pantalla
async function intentar(fn) {
  try { await fn(); return true; }
  catch (e) { avisar(mensajeError(e), true); return false; }
}

async function recargar() {
  estado.productos = (await cargarProductos()).sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), "es"));
  await pintar();
  if (estado.abierto?.id) {
    estado.abierto = estado.productos.find((p) => p.id === estado.abierto.id) || null;
  }
}

/* ---------- Entrada ---------- */
function pintarLogin(mensaje = "") {
  $("pantallaLogin").hidden = false;
  $("pantallaApp").hidden = true;
  $("errorLogin").textContent = mensaje;
  $("zonaLogin").innerHTML = MODO_DEMO ? `
    <p class="suave">Modo demo: elige con qué permisos quieres probar.</p>
    <button class="btn" data-accion="demo" data-rol="admin">Entrar como administrador</button>
    <button class="btn-sec" data-accion="demo" data-rol="socio">Entrar como socio</button>` : `
    <form id="formLogin">
      <label>Correo <input id="loginCorreo" type="email" autocomplete="username" required></label>
      <label>Contraseña <input id="loginClave" type="password" autocomplete="current-password" required></label>
      <button class="btn" type="submit">Entrar</button>
    </form>`;
}

document.addEventListener("submit", async (e) => {
  if (e.target.id === "formLogin") {
    e.preventDefault();
    $("errorLogin").textContent = "";
    try { await entrar($("loginCorreo").value.trim(), $("loginClave").value); }
    catch (err) { $("errorLogin").textContent = mensajeError(err); }
  }
  if (e.target.id === "formStock") { e.preventDefault(); confirmarStock(); }
  if (e.target.id === "formDatos") { e.preventDefault(); guardarDatos(); }
  if (e.target.id === "formFila") { e.preventDefault(); agregarFila(e.target); }
});

/* ---------- Vistas ---------- */
async function pintar() {
  $("contenido").innerHTML = estado.vista === "productos" ? vistaProductos() : await vistaMovimientos();
  document.querySelectorAll("[data-vista]").forEach((b) => b.classList.toggle("activa", b.dataset.vista === estado.vista));
}

function chipStock(p) {
  const c = p.cantidad || 0;
  if (c === 0) return `<span class="chip mal">Agotado</span>`;
  if (c <= POCAS_UNIDADES) return `<span class="chip ojo">Quedan ${c}</span>`;
  return `<span class="chip ok">${c} unidades</span>`;
}

function tarjeta(p) {
  const costo = costoTotal(p);
  return `<article class="producto">
    <img src="${esc(p.foto)}" alt="" loading="lazy">
    <button class="btn-abrir" data-accion="abrir" data-id="${esc(p.id)}">
      <span class="suave">${esc(p.marca)} · ${esc(p.presentacion)}</span>
      <h3>${esc(p.nombre)}</h3>
      <span class="chips">${chipStock(p)}${p.visible ? "" : `<span class="chip">Oculto en tienda</span>`}</span>
    </button>
    <div class="cifras">
      <div><span>Costo total</span>${pesos(costo)}</div>
      <div><span>Precio venta</span>${pesos(p.precioVenta)}</div>
      <div><span>Ganancia</span>${p.precioVenta ? `${pesos(p.precioVenta - costo)} (${pct(margen(p.precioVenta, costo))})` : "—"}</div>
    </div>
    <div class="acciones">
      <button class="btn" data-accion="stock" data-tipo="venta" data-id="${esc(p.id)}" ${p.cantidad ? "" : "disabled"}>Vendí</button>
      <button class="btn-sec" data-accion="stock" data-tipo="entrada" data-id="${esc(p.id)}">Entrada</button>
      <button class="btn-sec" data-accion="stock" data-tipo="conteo" data-id="${esc(p.id)}">Conteo</button>
    </div>
  </article>`;
}

function vistaProductos() {
  const todos = estado.productos;
  if (!todos.length) {
    return `<div class="vacio"><p>Aún no hay productos en el inventario.</p>
      ${esAdmin() ? `<button class="btn" data-accion="sembrar">Cargar los 7 productos iniciales</button>` : `<p class="suave">El administrador debe cargarlos primero.</p>`}</div>`;
  }
  const f = estado.filtro.toLowerCase();
  const lista = todos.filter((p) => nombreCompleto(p).toLowerCase().includes(f));
  const unidades = todos.reduce((s, p) => s + (p.cantidad || 0), 0);
  const invertido = todos.reduce((s, p) => s + (p.cantidad || 0) * costoTotal(p), 0);
  const venta = todos.reduce((s, p) => s + (p.cantidad || 0) * (p.precioVenta || 0), 0);
  const agotados = todos.filter((p) => !p.cantidad).length;
  return `<section class="resumen" aria-label="Resumen">
      <div class="dato"><span>Unidades</span><strong>${unidades}</strong></div>
      <div class="dato"><span>Agotados</span><strong>${agotados} de ${todos.length}</strong></div>
      <div class="dato"><span>Invertido en bodega</span><strong>${pesos(invertido)}</strong></div>
      <div class="dato"><span>Si se vende todo</span><strong>${pesos(venta)}</strong></div>
    </section>
    <div class="herramientas">
      <input id="buscar" type="search" placeholder="Buscar producto" aria-label="Buscar producto" value="${esc(estado.filtro)}">
      ${esAdmin() ? `<button class="btn" data-accion="nuevo">＋ Nuevo</button>` : ""}
    </div>
    <div class="lista">${lista.map(tarjeta).join("") || `<p class="suave">Sin resultados.</p>`}</div>`;
}

const NOMBRE_TIPO = { venta: "Venta", entrada: "Entrada", conteo: "Conteo" };

async function vistaMovimientos() {
  const movs = await cargarMovimientos();
  if (!movs.length) return `<div class="vacio"><p>Todavía no hay movimientos.</p></div>`;
  const fecha = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" });
  return movs.map((m) => `<article class="mov">
      <strong>${NOMBRE_TIPO[m.tipo]}: ${esc(m.producto)}</strong>
      <div>${m.antes} → ${m.despues} unidades</div>
      <div class="suave">${esc(m.por)} · ${fecha.format(m.fecha)}${m.nota ? ` · ${esc(m.nota)}` : ""}</div>
    </article>`).join("");
}

/* ---------- Movimientos de inventario ---------- */
function abrirStock(id, tipo) {
  const p = estado.productos.find((x) => x.id === id);
  estado.stock = { p, tipo };
  const textos = {
    venta: ["Registrar venta", `Hay ${p.cantidad || 0}. ¿Cuántas se vendieron?`, 1],
    entrada: ["Registrar entrada", `Hay ${p.cantidad || 0}. ¿Cuántas llegaron?`, 1],
    conteo: ["Conteo físico", `El sistema dice ${p.cantidad || 0}. ¿Cuántas contaste?`, p.cantidad || 0]
  }[tipo];
  $("tituloStock").textContent = textos[0];
  $("ayudaStock").textContent = `${nombreCompleto(p)}. ${textos[1]}`;
  $("stockCantidad").value = textos[2];
  $("stockNota").value = "";
  $("dlgStock").showModal();
}

async function confirmarStock() {
  const { p, tipo } = estado.stock;
  const ok = await intentar(async () => {
    await moverStock(p.id, tipo, Number($("stockCantidad").value), $("stockNota").value.trim(), estado.usuario);
    await recargar();
  });
  if (ok) { $("dlgStock").close(); avisar("Inventario actualizado ✅"); }
}

/* ---------- Detalle de producto ---------- */
function abrirProducto(id) {
  estado.abierto = id ? estado.productos.find((p) => p.id === id) : { foto: "", competidores: [], proveedores: [], visible: false };
  estado.seccion = "datos";
  pintarDetalle();
  $("dlgProducto").showModal();
}

function pintarDetalle() {
  const p = estado.abierto;
  $("tituloProducto").textContent = p.id ? nombreCompleto(p) : "Nuevo producto";
  $("pestanasProducto").hidden = !p.id; // competencia y proveedores necesitan el producto ya guardado
  document.querySelectorAll("[data-seccion]").forEach((b) => b.classList.toggle("activa", b.dataset.seccion === estado.seccion));
  $("cuerpoProducto").innerHTML = { datos: seccionDatos, competencia: seccionCompetencia, proveedores: seccionProveedores }[estado.seccion](p);
  if (estado.seccion === "datos") actualizarCalculo();
}

function seccionDatos(p) {
  const bloqueo = esAdmin() ? "" : "disabled";
  const campo = (id, texto, valor, extra = "") => `<label>${texto} <input id="${id}" value="${esc(valor)}" ${bloqueo} ${extra}></label>`;
  const dinero = (id, texto, valor) => campo(id, texto, valor || 0, `type="number" min="0" step="1" inputmode="numeric"`);
  return `<form id="formDatos">
    <div class="foto-campo">
      <img id="fotoVista" src="${esc(p.foto)}" alt="">
      ${esAdmin() ? `<label>Foto <input id="fotoArchivo" type="file" accept="image/*"></label>` : ""}
    </div>
    <div class="doble">${campo("fMarca", "Marca", p.marca, "required")}${campo("fPresentacion", "Presentación", p.presentacion)}</div>
    ${campo("fNombre", "Nombre", p.nombre, "required")}
    ${campo("fCategoria", "Categoría", p.categoria)}
    <label>Descripción <textarea id="fDescripcion" rows="3" ${bloqueo}>${esc(p.descripcion)}</textarea></label>
    <div class="doble">${dinero("fCosto", "Costo de compra", p.costoCompra)}${dinero("fGastos", "Gastos (envío, aduana)", p.gastos)}</div>
    ${dinero("fPrecio", "Precio de venta", p.precioVenta)}
    <div id="calculo" class="calculo"></div>
    <label class="check"><input id="fVisible" type="checkbox" ${p.visible ? "checked" : ""} ${bloqueo}>Mostrar en la tienda</label>
    ${esAdmin() ? `<div class="fila-btn"><button class="btn" type="submit">Guardar</button>
      ${p.id ? `<button class="btn-sec btn-peligro empuja" type="button" data-accion="borrar">Borrar producto</button>` : ""}</div>` : ""}
  </form>`;
}

function actualizarCalculo() {
  const costo = numero($("fCosto").value) + numero($("fGastos").value);
  const precio = numero($("fPrecio").value);
  const objetivo = costo / (1 - MARGEN_OBJETIVO);
  $("calculo").innerHTML = `Costo total <strong>${pesos(costo)}</strong> · Ganancia <strong>${pesos(precio - costo)}</strong> (${pct(margen(precio, costo))})<br>
    <span class="suave">Para ganar ${pct(MARGEN_OBJETIVO)}, cobra al menos ${pesos(objetivo)}.</span>`;
}

// Reduce la foto en el navegador: así cabe en Firestore y la tienda carga rápido en celular
async function reducirFoto(archivo) {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(bitmap.width * escala);
  lienzo.height = Math.round(bitmap.height * escala);
  lienzo.getContext("2d").drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
  return lienzo.toDataURL("image/webp", 0.8);
}

// Guarda sin enviar cantidad ni disponible: esos solo cambian con movimientos
async function persistir(cambios) {
  const { id, cantidad, disponible, actualizado, ...resto } = estado.abierto;
  await guardarProducto(id, { ...resto, ...cambios });
}

async function guardarDatos() {
  const ok = await intentar(async () => {
    await persistir({
      marca: $("fMarca").value.trim(), nombre: $("fNombre").value.trim(), presentacion: $("fPresentacion").value.trim(),
      categoria: $("fCategoria").value.trim(), descripcion: $("fDescripcion").value.trim(), foto: $("fotoVista").getAttribute("src"),
      costoCompra: numero($("fCosto").value), gastos: numero($("fGastos").value), precioVenta: numero($("fPrecio").value),
      visible: $("fVisible").checked
    });
    await recargar();
  });
  if (ok) { $("dlgProducto").close(); avisar("Producto guardado ✅"); }
}

/* ---------- Competencia y proveedores ---------- */
const CONFIG_FILA = {
  competidores: { etiqueta: "Competidor", precio: "Su precio de venta" },
  proveedores: { etiqueta: "Proveedor", precio: "Precio puesto en Colombia" }
};

function formFila(campo) {
  if (!esAdmin()) return "";
  const c = CONFIG_FILA[campo];
  return `<form id="formFila" data-campo="${campo}">
    <h3>Agregar</h3>
    <div class="doble">
      <label>${c.etiqueta} <input name="nombre" required maxlength="60"></label>
      <label>${c.precio} <input name="precio" type="number" min="1" step="1" inputmode="numeric" required></label>
    </div>
    <label>Link (opcional) <input name="link" type="url" placeholder="https://"></label>
    <button class="btn" type="submit">Agregar</button>
  </form>`;
}

function filas(p, campo, resaltado) {
  const lista = p[campo] || [];
  if (!lista.length) return `<p class="suave">Aún no hay registros.</p>`;
  return lista.map((f, i) => {
    const link = linkSeguro(f.link);
    return `<div class="fila"><div>
        <strong>${esc(f.nombre)}</strong> · ${pesos(f.precio)}${f.precio === resaltado ? ` <span class="chip ok">Más barato</span>` : ""}
        <div class="suave">${esc(f.fecha)}${link ? ` · <a href="${esc(link)}" target="_blank" rel="noopener">Ver</a>` : ""}</div>
      </div>${esAdmin() ? `<button class="btn-texto" data-accion="quitarFila" data-campo="${campo}" data-i="${i}" aria-label="Quitar ${esc(f.nombre)}">✕</button>` : ""}</div>`;
  }).join("");
}

function botonesBusqueda(enlaces) {
  return `<div class="fila-btn">${enlaces.map(([t, u]) => `<a class="btn-sec btn-enlace" href="${esc(u)}" target="_blank" rel="noopener">${t}</a>`).join("")}</div>`;
}

function seccionCompetencia(p) {
  const q = encodeURIComponent(`${p.marca} ${p.nombre}`);
  const precios = (p.competidores || []).map((c) => c.precio);
  const costo = costoTotal(p);
  let analisis = `<p class="suave">Agrega precios de competidores para ver en qué rango puedes cobrar.</p>`;
  if (precios.length) {
    const min = Math.min(...precios), max = Math.max(...precios);
    const prom = Math.round(precios.reduce((a, b) => a + b, 0) / precios.length);
    const objetivo = Math.ceil(costo / (1 - MARGEN_OBJETIVO));
    const fila = (t, v) => `<tr><td>${t}</td><td>${pesos(v)}</td><td>${pesos(v - costo)}</td><td>${pct(margen(v, costo))}</td></tr>`;
    let rango;
    if (!costo) rango = `<span class="suave">Llena el costo en Datos para calcular tu rango.</span>`;
    else if (objetivo > max) rango = `<span class="chip mal">Con este costo no alcanzas ${pct(MARGEN_OBJETIVO)} de ganancia al precio de la competencia</span>`;
    else rango = `<strong>${pesos(Math.max(objetivo, min))} a ${pesos(max)}</strong><span class="suave">Ganas al menos ${pct(MARGEN_OBJETIVO)} sin pasar al competidor más caro.</span>`;
    analisis = `<div class="rango"><span class="suave">Rango sugerido</span>${rango}</div>
      <div class="tabla-marco"><table>
        <tr><th>Precio</th><th>Valor</th><th>Ganancia</th><th>Margen</th></tr>
        ${fila("Mínimo", min)}${fila("Promedio", prom)}${fila("Máximo", max)}${p.precioVenta ? fila("El tuyo", p.precioVenta) : ""}
      </table></div>`;
  }
  return `${analisis}
    <h3>Buscar precios</h3>
    ${botonesBusqueda([["Mercado Libre", `https://listado.mercadolibre.com.co/${q}`], ["Google Colombia", `https://www.google.com/search?gl=co&hl=es&q=${q}+precio+colombia`]])}
    <h3>Competidores</h3>${filas(p, "competidores")}${formFila("competidores")}`;
}

function seccionProveedores(p) {
  const q = encodeURIComponent(`${p.marca} ${p.nombre}`);
  const precios = (p.proveedores || []).map((c) => c.precio);
  return `<p class="suave">Anota el precio total hasta tenerlo en Colombia, en pesos, para comparar en igualdad.</p>
    <h3>Buscar proveedor</h3>
    ${botonesBusqueda([["Amazon", `https://www.amazon.com/s?k=${q}`], ["Walmart", `https://www.walmart.com/search?q=${q}`], ["Google Shopping", `https://www.google.com/search?tbm=shop&q=${q}`]])}
    <h3>Proveedores</h3>${filas(p, "proveedores", precios.length > 1 ? Math.min(...precios) : null)}${formFila("proveedores")}`;
}

async function agregarFila(form) {
  const campo = form.dataset.campo;
  const d = new FormData(form);
  const fila = { nombre: d.get("nombre").trim(), precio: numero(d.get("precio")), link: d.get("link").trim(), fecha: new Date().toLocaleDateString("es-CO") };
  const ok = await intentar(async () => {
    await persistir({ [campo]: [...(estado.abierto[campo] || []), fila] });
    await recargar();
  });
  if (ok) { pintarDetalle(); avisar("Agregado ✅"); }
}

async function quitarFila(campo, i) {
  const ok = await intentar(async () => {
    await persistir({ [campo]: estado.abierto[campo].filter((_, n) => n !== i) });
    await recargar();
  });
  if (ok) pintarDetalle();
}

/* ---------- Eventos ---------- */
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button, [data-accion]");
  if (!b) return;
  if (b.dataset.vista) { estado.vista = b.dataset.vista; await intentar(pintar); return; }
  if (b.dataset.seccion) { estado.seccion = b.dataset.seccion; pintarDetalle(); return; }
  switch (b.dataset.accion) {
    case "demo": await entrar(b.dataset.rol); break;
    case "salir": await salir(); break;
    case "cerrar": b.closest("dialog").close(); break;
    case "abrir": abrirProducto(b.dataset.id); break;
    case "nuevo": abrirProducto(null); break;
    case "stock": abrirStock(b.dataset.id, b.dataset.tipo); break;
    case "quitarFila": await quitarFila(b.dataset.campo, Number(b.dataset.i)); break;
    case "sembrar":
      if (await intentar(async () => { await sembrarIniciales(); await recargar(); })) avisar("Productos cargados ✅");
      break;
    case "borrar":
      if (confirm(`¿Borrar ${nombreCompleto(estado.abierto)}? Esto no se puede deshacer.`)) {
        const ok = await intentar(async () => {
          await borrarProducto(estado.abierto.id);
          estado.abierto = null;
          await recargar();
        });
        if (ok) { $("dlgProducto").close(); avisar("Producto borrado"); }
      }
      break;
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "buscar") {
    estado.filtro = e.target.value;
    const pos = e.target.selectionStart;
    pintar().then(() => { const c = $("buscar"); c.focus(); c.setSelectionRange(pos, pos); });
  }
  if (["fCosto", "fGastos", "fPrecio"].includes(e.target.id)) actualizarCalculo();
});

document.addEventListener("change", async (e) => {
  if (e.target.id !== "fotoArchivo" || !e.target.files[0]) return;
  try { $("fotoVista").src = await reducirFoto(e.target.files[0]); }
  catch { avisar("No se pudo leer esa imagen. Prueba con otra.", true); }
});

/* ---------- Arranque ---------- */
onSesion(async (u) => {
  estado.usuario = u?.sinPermiso ? null : u;
  if (u?.sinPermiso) {
    await salir();
    return pintarLogin("Tu usuario aún no tiene permisos. Pídele acceso al administrador.");
  }
  if (!u) return pintarLogin();
  $("pantallaLogin").hidden = true;
  $("pantallaApp").hidden = false;
  $("avisoDemo").hidden = !MODO_DEMO;
  $("quien").textContent = `${u.nombre} · ${u.rol === "admin" ? "Administrador" : "Socio"}`;
  await intentar(recargar);
});
