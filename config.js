// Configuración de Vella.
// Si firebaseConfig queda vacío, el inventario vuelve al MODO DEMO (datos solo en este navegador).
// El objeto firebaseConfig es público por diseño: lo que protege los datos son las reglas de Firestore.
export const firebaseConfig = {
  apiKey: "AIzaSyDNWYaahLpZ70xyFbyT4WT1-Ag42gRux-Q",
  authDomain: "vella-1f2dd.firebaseapp.com",
  projectId: "vella-1f2dd",
  storageBucket: "vella-1f2dd.firebasestorage.app",
  messagingSenderId: "490332272581",
  appId: "1:490332272581:web:87b7a232fa25f2f1803dac"
};

// Número de WhatsApp Business: indicativo y número, sin + ni espacios. Ejemplo: "573001234567"
export const WHATSAPP = "";

// Enlaces completos a las redes. Las que queden vacías no se muestran.
export const REDES = { instagram: "", tiktok: "", facebook: "" };

export const MARGEN_OBJETIVO = 0.30; // 30 % de ganancia sobre el precio de venta
export const POCAS_UNIDADES = 3;     // desde aquí se avisa "quedan pocas"
