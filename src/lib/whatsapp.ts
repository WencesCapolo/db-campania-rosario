/** El enlace `wa.me` de un número argentino escrito con o sin 0, +54 o 9. */
export function enlaceDeWhatsApp(numero: string): string | null {
  const digitos = numero
    .replace(/\D/g, "")
    .replace(/^0+/, "")
    .replace(/^549?/, "");
  return digitos.length >= 8 ? `https://wa.me/549${digitos}` : null;
}

export const AYUDA_WHATSAPP =
  "Opcional. Con característica, sin el 0 ni el 15.";
