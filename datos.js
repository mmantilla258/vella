// Capa de datos: el resto de la app no sabe si habla con Firebase o con el modo demo.
// Cada producto vive en dos documentos:
//   productos/{id} = público (lo lee la tienda)
//   privado/{id}   = costos, cantidad, competencia y proveedores (solo el equipo)
import { firebaseConfig } from "./config.js";
import { PRODUCTOS_INICIALES } from "./productos-iniciales.js";

export const MODO_DEMO = !firebaseConfig.apiKey;

// Separa un producto completo en su parte pública y su parte privada
function separar(p) {
  const { costoCompra = 0, gastos = 0, cantidad = 0, competidores = [], proveedores = [] } = p;
  const publico = {
    marca: p.marca, nombre: p.nombre, presentacion: p.presentacion, categoria: p.categoria,
    descripcion: p.descripcion, foto: p.foto, precioVenta: p.precioVenta || 0,
    visible: !!p.visible, disponible: cantidad > 0
  };
  return { publico, privado: { costoCompra, gastos, cantidad, competidores, proveedores } };
}

// Calcula la cantidad nueva según el tipo de movimiento
function calcularCantidad(tipo, antes, n) {
  if (!Number.isInteger(n) || n < 0 || (tipo !== "conteo" && n === 0)) throw new Error("cantidad-invalida");
  const despues = tipo === "venta" ? antes - n : tipo === "entrada" ? antes + n : n;
  if (despues < 0) throw new Error("sin-stock");
  return despues;
}

function crearId(p) {
  const base = `${p.marca}-${p.nombre}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base}-${Date.now().toString(36)}`;
}

/* ---------- Modo demo: todo en localStorage de este navegador ---------- */
function backendDemo() {
  const CLAVE = "vellaDemo";
  const leer = () => {
    try { return JSON.parse(localStorage.getItem(CLAVE)) || { productos: {}, movimientos: [] }; }
    catch { return { productos: {}, movimientos: [] }; }
  };
  const escribir = (d) => localStorage.setItem(CLAVE, JSON.stringify(d));
  let aviso = () => {};
  return {
    onSesion(cb) {
      aviso = cb;
      let u = null;
      try { u = JSON.parse(sessionStorage.getItem("vellaDemoUsuario")); } catch {}
      cb(u);
    },
    async entrar(rol) {
      const u = { uid: rol, nombre: rol === "admin" ? "Miguel (demo)" : "Socio (demo)", rol };
      sessionStorage.setItem("vellaDemoUsuario", JSON.stringify(u));
      aviso(u);
    },
    async salir() { sessionStorage.removeItem("vellaDemoUsuario"); aviso(null); },
    async productos() { return Object.values(leer().productos); },
    async guardar(id, p) {
      const d = leer();
      d.productos[id] = { ...d.productos[id], ...p, id };
      d.productos[id].disponible = (d.productos[id].cantidad || 0) > 0;
      escribir(d);
    },
    async borrar(id) { const d = leer(); delete d.productos[id]; escribir(d); },
    async mover(id, tipo, n, nota, u) {
      const d = leer();
      const p = d.productos[id];
      const antes = p.cantidad || 0;
      const despues = calcularCantidad(tipo, antes, n);
      p.cantidad = despues;
      p.disponible = despues > 0;
      d.movimientos.push({ productoId: id, producto: `${p.marca} ${p.nombre}`, tipo, cantidad: n, antes, despues, nota, por: u.nombre, uid: u.uid, fecha: new Date().toISOString() });
      escribir(d);
    },
    async movimientos() {
      return leer().movimientos.map((m) => ({ ...m, fecha: new Date(m.fecha) })).sort((a, b) => b.fecha - a.fecha).slice(0, 100);
    }
  };
}

/* ---------- Firebase real ---------- */
async function backendFirebase() {
  const V = "https://www.gstatic.com/firebasejs/12.19.0";
  const { initializeApp } = await import(`${V}/firebase-app.js`);
  const { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } = await import(`${V}/firebase-auth.js`);
  const fs = await import(`${V}/firebase-firestore.js`);
  const { getFirestore, doc, getDoc, getDocs, collection, query, orderBy, limit, runTransaction, writeBatch, serverTimestamp } = fs;

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  return {
    onSesion(cb) {
      onAuthStateChanged(auth, async (usuario) => {
        if (!usuario) return cb(null);
        const perfil = await getDoc(doc(db, "usuarios", usuario.uid)).catch(() => null);
        // Sin documento en usuarios/ no hay acceso: entró pero no es del equipo
        if (!perfil?.exists()) return cb({ sinPermiso: true });
        cb({ uid: usuario.uid, nombre: perfil.data().nombre || usuario.email, rol: perfil.data().rol });
      });
    },
    entrar: (correo, clave) => signInWithEmailAndPassword(auth, correo, clave),
    salir: () => signOut(auth),
    async productos() {
      const [pub, priv] = await Promise.all([getDocs(collection(db, "productos")), getDocs(collection(db, "privado"))]);
      const privados = Object.fromEntries(priv.docs.map((d) => [d.id, d.data()]));
      return pub.docs.map((d) => ({ id: d.id, ...d.data(), ...privados[d.id] }));
    },
    // Al editar no se toca la cantidad: solo cambia con movimientos, para no pisar lo que haga el socio
    async guardar(id, p, nuevo) {
      const { publico, privado } = separar(p);
      if (!nuevo) { delete publico.disponible; delete privado.cantidad; }
      const lote = writeBatch(db);
      lote.set(doc(db, "productos", id), { ...publico, actualizado: serverTimestamp() }, { merge: true });
      lote.set(doc(db, "privado", id), { ...privado, actualizado: serverTimestamp() }, { merge: true });
      await lote.commit();
    },
    async borrar(id) {
      const lote = writeBatch(db);
      lote.delete(doc(db, "productos", id));
      lote.delete(doc(db, "privado", id));
      await lote.commit();
    },
    // Transacción: si dos personas mueven el mismo producto a la vez, ninguna pisa a la otra
    async mover(id, tipo, n, nota, u) {
      const refPriv = doc(db, "privado", id);
      const refPub = doc(db, "productos", id);
      await runTransaction(db, async (tx) => {
        const [priv, pub] = [await tx.get(refPriv), await tx.get(refPub)];
        const antes = priv.data()?.cantidad || 0;
        const despues = calcularCantidad(tipo, antes, n);
        tx.update(refPriv, { cantidad: despues, actualizado: serverTimestamp() });
        tx.update(refPub, { disponible: despues > 0, actualizado: serverTimestamp() });
        tx.set(doc(collection(db, "movimientos")), {
          productoId: id, producto: `${pub.data().marca} ${pub.data().nombre}`, tipo, cantidad: n,
          antes, despues, nota, por: u.nombre, uid: u.uid, fecha: serverTimestamp()
        });
      });
    },
    async movimientos() {
      const r = await getDocs(query(collection(db, "movimientos"), orderBy("fecha", "desc"), limit(100)));
      return r.docs.map((d) => ({ ...d.data(), fecha: d.data().fecha?.toDate?.() || new Date() }));
    }
  };
}

const backend = MODO_DEMO ? backendDemo() : await backendFirebase();

export const onSesion = (cb) => backend.onSesion(cb);
export const entrar = (...a) => backend.entrar(...a);
export const salir = () => backend.salir();
export const cargarProductos = () => backend.productos();
export const cargarMovimientos = () => backend.movimientos();
export const borrarProducto = (id) => backend.borrar(id);
export const moverStock = (...a) => backend.mover(...a);
export const guardarProducto = (id, p) => backend.guardar(id || crearId(p), p, !id);
export async function sembrarIniciales() {
  for (const { id, ...p } of PRODUCTOS_INICIALES) await backend.guardar(id, { ...p, precioVenta: 0, visible: false }, true);
}
