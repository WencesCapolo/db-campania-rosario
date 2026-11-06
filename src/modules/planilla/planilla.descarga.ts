/**
 * Una planilla como respuesta HTTP: el tipo de un `.xlsx` y un nombre de archivo
 * con la fecha, para que dos descargas de días distintos no se pisen en la
 * carpeta de Descargas de nadie.
 *
 * Aparte del router porque un archivo `"use server"` sólo exporta acciones, y
 * esto no es una.
 */
export function respuestaDePlanilla(contenido: Buffer, nombre: string): Response {
  const dia = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());

  return new Response(new Uint8Array(contenido), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}-${dia}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
