// Configuración de Vella.
// Mientras firebaseConfig esté vacío, el inventario funciona en MODO DEMO:
// los datos quedan solo en este navegador y sirven únicamente para probar.
// El objeto firebaseConfig es público por diseño: lo que protege los datos son las reglas de Firestore.
export const firebaseConfig = {
  // Pega aquí lo que te da la consola de Firebase (ver CONFIGURAR-FIREBASE.md)
};

// Número de WhatsApp Business: indicativo y número, sin + ni espacios. Ejemplo: "573001234567"
export const WHATSAPP = "";

// Enlaces completos a las redes. Las que queden vacías no se muestran.
export const REDES = { instagram: "", tiktok: "", facebook: "" };

export const MARGEN_OBJETIVO = 0.30; // 30 % de ganancia sobre el precio de venta
export const POCAS_UNIDADES = 3;     // desde aquí se avisa "quedan pocas"
