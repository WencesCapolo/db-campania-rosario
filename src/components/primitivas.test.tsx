import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import Boton, { BotonEnlace } from "./Boton";
import Campo from "./Campo";
import AreaDeTexto from "./AreaDeTexto";
import Eleccion from "./Eleccion";
import Buscador from "./Buscador";
import Insignia from "./Insignia";
import Mensaje from "./Mensaje";
import Tarjeta from "./Tarjeta";
import Volver from "./Volver";
import { Cargando, PanelDeError, Vacio } from "./EstadosAsincronicos";
import {
  contrasteDelTexto,
  tamanioDelObjetivo,
  violacionesDeAxe,
} from "@/test/accesibilidad";

/**
 * The primitives, measured rather than described.
 *
 * `src/app/contraste.test.ts` proves the *tokens* clear 4.5:1 against each other.
 * It cannot prove that a component uses them, and a perfect palette applied to
 * nothing passes it. This is the other half: the stylesheet is loaded, the
 * components are mounted, and every number here comes from
 * `getComputedStyle`/`getBoundingClientRect`.
 *
 * The viewport is a 390px phone, set in the config, because that is where a target
 * is cramped. At 1280px nothing ever is.
 *
 * The floors, and where each comes from:
 *
 *  - **48px targets.** SC 2.5.8 asks 24px. The project asks 48, because the users
 *    are older adults on phones and 24px is a floor drawn for a mouse. `min-h-12`
 *    is 3rem at an 18px root, which is 54px.
 *  - **4.5:1 for text.** SC 1.4.3.
 *  - **3:1 for a control's edge.** SC 1.4.11. The obvious `neutral-400` is 2.5:1
 *    and fails it, which is why `--color-borde` is darker than it looks like it
 *    should be.
 */

describe("Botón", () => {
  it("llega al piso de 48px en los tres tonos", async () => {
    const pantalla = await render(
      <>
        <Boton>Guardar</Boton>
        <Boton tono="secundario">Volver</Boton>
        <Boton tono="peligro">Dar de baja</Boton>
      </>
    );

    for (const nombre of ["Guardar", "Volver", "Dar de baja"]) {
      const boton = await pantalla.getByRole("button", { name: nombre }).element();
      expect(tamanioDelObjetivo(boton).alto).toBeGreaterThanOrEqual(48);
    }
  });

  it("tiene texto legible sobre su propio relleno", async () => {
    const pantalla = await render(
      <>
        <Boton>Guardar</Boton>
        <Boton tono="secundario">Volver</Boton>
        <Boton tono="peligro">Dar de baja</Boton>
      </>
    );

    for (const nombre of ["Guardar", "Volver", "Dar de baja"]) {
      const boton = await pantalla.getByRole("button", { name: nombre }).element();
      expect(contrasteDelTexto(boton)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("se ve como un control sin que nadie lo señale", async () => {
    const pantalla = await render(<Boton tono="secundario">Volver</Boton>);
    const boton = await pantalla.getByRole("button", { name: "Volver" }).element();

    // Story 6: a subtle hover is not an affordance. Every variant carries a
    // border, so a button looks like a button before anybody touches it — which
    // is the whole reason there is no ghost variant.
    const estilo = getComputedStyle(boton);
    expect(parseFloat(estilo.borderTopWidth)).toBeGreaterThanOrEqual(2);
  });

  it("BotonEnlace es un enlace y no un botón", async () => {
    const pantalla = await render(
      <BotonEnlace href="/peregrina">Ver Peregrinas</BotonEnlace>
    );

    // It navigates, so it must announce as a link, open in a new tab on a
    // middle-click and show its target in the status bar. Which element it is
    // follows from what it does, never from how it looks.
    const enlace = await pantalla
      .getByRole("link", { name: "Ver Peregrinas" })
      .element();
    expect(tamanioDelObjetivo(enlace).alto).toBeGreaterThanOrEqual(48);
  });

  it("deshabilitado sigue siendo legible", async () => {
    const pantalla = await render(<Boton disabled>Guardando…</Boton>);
    const boton = await pantalla
      .getByRole("button", { name: "Guardando…" })
      .element();

    // `disabled:opacity-60` is the one place the palette is undermined by design:
    // opacity multiplies against whatever is behind. 3:1 rather than 4.5, because
    // a disabled control is exempt from SC 1.4.3 — but "exempt" is not "may be
    // invisible", and every save button in the app passes through this state.
    expect(contrasteDelTexto(boton)).toBeGreaterThanOrEqual(3);
  });
});

describe("los campos", () => {
  it("atan la etiqueta, la ayuda y el error al control", async () => {
    const pantalla = await render(
      <Campo
        etiqueta="Año de consagración"
        ayuda="Cuatro cifras, por ejemplo 1998."
        error="Ese año no puede estar en el futuro."
        value=""
        onChange={() => {}}
      />
    );

    // The accessible name comes from the <label>, and both the hint and the error
    // arrive through aria-describedby. A label floating beside an input it is not
    // bound to reads as decoration, and an error in a red paragraph below is never
    // announced at all — which is the failure this component exists to prevent.
    const campo = await pantalla
      .getByRole("textbox", { name: "Año de consagración" })
      .element();

    expect(campo.getAttribute("aria-invalid")).toBe("true");

    const descrito = (campo.getAttribute("aria-describedby") ?? "").split(" ");
    const textos = descrito.map(
      (id) => document.getElementById(id)?.textContent ?? ""
    );
    expect(textos.join(" ")).toContain("Cuatro cifras");
    expect(textos.join(" ")).toContain("no puede estar en el futuro");
  });

  it("anuncia el error sin que nadie tenga que mirarlo", async () => {
    const pantalla = await render(
      <Campo etiqueta="Nombre" error="El nombre es obligatorio." value="" onChange={() => {}} />
    );

    await expect
      .element(pantalla.getByRole("alert"))
      .toHaveTextContent("El nombre es obligatorio.");
  });

  it("no dice el error sólo con el color", async () => {
    const pantalla = await render(
      <Campo etiqueta="Nombre" error="El nombre es obligatorio." value="" onChange={() => {}} />
    );

    // Roughly one man in twelve cannot separate the red from the black. The glyph
    // is aria-hidden because the sentence already carries the message — it is
    // reinforcement, not a second thing to learn.
    const alerta = await pantalla.getByRole("alert").element();
    expect(alerta.querySelector("[aria-hidden]")?.textContent).toBe("✕");
    expect(contrasteDelTexto(alerta)).toBeGreaterThanOrEqual(4.5);
  });

  it("Campo, Elección y AreaDeTexto comparten el piso de 48px", async () => {
    const pantalla = await render(
      <>
        <Campo etiqueta="Nombre" value="" onChange={() => {}} />
        <Eleccion
          etiqueta="Modalidad"
          value="JOV"
          opciones={[{ valor: "JOV", etiqueta: "Juventud" }]}
          alElegir={() => {}}
        />
        <AreaDeTexto etiqueta="Nota" value="" onChange={() => {}} />
      </>
    );

    for (const [rol, nombre] of [
      ["textbox", "Nombre"],
      ["combobox", "Modalidad"],
      ["textbox", "Nota"],
    ] as const) {
      const control = await pantalla.getByRole(rol, { name: nombre }).element();
      expect(tamanioDelObjetivo(control).alto).toBeGreaterThanOrEqual(48);
      // 3:1 — SC 1.4.11. A field whose edge cannot be seen is a field somebody
      // has to guess the position of.
      const borde = getComputedStyle(control).borderTopWidth;
      expect(parseFloat(borde)).toBeGreaterThanOrEqual(2);
    }
  });

  it("la Elección se abre, se recorre y se elige con el teclado, sin perder el foco", async () => {
    let elegido = "";
    const pantalla = await render(
      <Eleccion
        etiqueta="Modalidad"
        vacia="Todas"
        value=""
        opciones={[
          { valor: "JOV", etiqueta: "Jóvenes" },
          { valor: "FAM", etiqueta: "Familias" },
          { valor: "MAT", etiqueta: "Matrimonios" },
        ]}
        alElegir={(v) => (elegido = v)}
      />
    );
    const control = await pantalla
      .getByRole("combobox", { name: "Modalidad" })
      .element();

    // Ya no es un `<select>` (ADR 0015): lo que el navegador daba gratis tiene
    // que estar acá. El foco se queda en el botón mientras se recorre la lista;
    // la opción en la que se está la nombra `aria-activedescendant`.
    (control as HTMLElement).focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(control.getAttribute("aria-expanded")).toBe("true");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    const activa = document.getElementById(
      control.getAttribute("aria-activedescendant") ?? "",
    );
    expect(activa?.textContent).toContain("Familias");
    expect(document.activeElement).toBe(control);

    await userEvent.keyboard("{Enter}");
    expect(elegido).toBe("FAM");
    expect(control.getAttribute("aria-expanded")).toBe("false");

    // Escribir salta a la opción que empieza así, como en un `<select>`.
    await userEvent.keyboard("m");
    expect(
      document.getElementById(control.getAttribute("aria-activedescendant") ?? "")
        ?.textContent,
    ).toContain("Matrimonios");
    await userEvent.keyboard("{Escape}");
    expect(control.getAttribute("aria-expanded")).toBe("false");
  });

  it("las filas de la Elección abierta llegan a los 48px", async () => {
    const pantalla = await render(
      <Eleccion
        etiqueta="Modalidad"
        value="JOV"
        opciones={[
          { valor: "JOV", etiqueta: "Jóvenes" },
          { valor: "FAM", etiqueta: "Familias" },
        ]}
        alElegir={() => {}}
      />
    );
    await pantalla.getByRole("combobox", { name: "Modalidad" }).click();

    // Más bajas que un campo, porque una lista de 25 Diócesis tiene que entrar en
    // un teléfono. Pero no más bajas que el piso: es un dedo el que elige.
    const filas = pantalla.getByRole("option").elements();
    expect(filas).toHaveLength(2);
    for (const fila of filas) {
      expect(tamanioDelObjetivo(fila).alto).toBeGreaterThanOrEqual(48);
    }
    // La elegida no lo dice sólo con el azul: lleva ✓ y `aria-selected`.
    const elegida = await pantalla
      .getByRole("option", { name: "Jóvenes" })
      .element();
    expect(elegida.getAttribute("aria-selected")).toBe("true");
    expect(elegida.textContent).toContain("✓");
    expect(await violacionesDeAxe(pantalla.container)).toEqual([]);
  });

  it("el Buscador abierto no tiene violaciones de axe, y sus filas llegan a los 48px", async () => {
    const pantalla = await render(
      <Buscador
        etiqueta="¿Qué Peregrina?"
        value=""
        opciones={[
          { valor: "1", etiqueta: "CBA JOV 0001", detalle: "Sin entregar" },
          { valor: "2", etiqueta: "CBA JOV 0002", detalle: "La tiene Beatriz Ruiz" },
        ]}
        alElegir={() => {}}
        sinCoincidencias={(b) => `Ninguna coincide con «${b}».`}
      />
    );
    await userEvent.fill(
      pantalla.getByRole("combobox", { name: "¿Qué Peregrina?" }),
      "cba",
    );

    for (const fila of pantalla.getByRole("option").elements()) {
      expect(tamanioDelObjetivo(fila).alto).toBeGreaterThanOrEqual(48);
    }
    // El nombre de una opción lleva el detalle, separado: el lector de pantalla
    // tiene que oír quién la tiene, no «0002La tiene».
    await expect
      .element(
        pantalla.getByRole("option", { name: /^CBA JOV 0002\s*, La tiene Beatriz Ruiz$/ }),
      )
      .toBeInTheDocument();
    expect(await violacionesDeAxe(pantalla.container)).toEqual([]);
  });

  it("el contador del AreaDeTexto queda descrito, no suelto", async () => {
    const pantalla = await render(
      <AreaDeTexto
        etiqueta="Nota"
        value="Volvió con el marco flojo."
        maxLength={500}
        contador
        onChange={() => {}}
      />
    );

    const area = await pantalla.getByRole("textbox", { name: "Nota" }).element();
    const descrito = (area.getAttribute("aria-describedby") ?? "").split(" ");
    const textos = descrito.map(
      (id) => document.getElementById(id)?.textContent ?? ""
    );

    // maxLength stops accepting characters in silence, which on a phone reads as
    // the keyboard having died. The count has to be announced, not just drawn.
    expect(textos.join(" ")).toContain("26 de 500");
  });
});

describe("el estado y los mensajes", () => {
  // One at a time, and not out of tidiness: rendered together, "Activa" is a
  // substring of "Inactiva" and every text query for the first matches both. The
  // four Estados really are named that way, so the test has to cope rather than
  // rename them.
  it.each([
    ["exito", "Activa"],
    ["aviso", "En reparación"],
    ["alerta", "Extraviada"],
    ["neutro", "Inactiva"],
  ] as const)("la Insignia %s lleva palabra y glifo, no sólo color", async (
    tono,
    palabra
  ) => {
    const pantalla = await render(<Insignia tono={tono}>{palabra}</Insignia>);
    const insignia = await pantalla.getByText(palabra).element();

    expect(insignia.querySelector("[aria-hidden]")?.textContent).toBeTruthy();
    expect(contrasteDelTexto(insignia)).toBeGreaterThanOrEqual(4.5);
  });

  it("Mensaje interrumpe sólo cuando algo falló", async () => {
    const pantalla = await render(
      <>
        <Mensaje tono="exito">
          <p>Guardada. Su Código es BA JOV 001.</p>
        </Mensaje>
        <Mensaje tono="alerta">
          <p>No se puede: la imagen está en la casa de alguien.</p>
        </Mensaje>
      </>
    );

    // A confirmation announced as an alert interrupts a screen reader mid
    // sentence; a refusal announced as a status is never read out at all. The
    // role follows from the tone, so a call site cannot get it backwards.
    await expect
      .element(pantalla.getByRole("status"))
      .toHaveTextContent("BA JOV 001");
    await expect
      .element(pantalla.getByRole("alert"))
      .toHaveTextContent("está en la casa de alguien");
  });
});

describe("los tres estados de una superficie asincrónica", () => {
  it("Cargando dice que está cargando a quien no lo ve", async () => {
    const pantalla = await render(<Cargando etiqueta="Cargando territorios…" />);

    // The skeleton blocks are aria-hidden, so without this the whole state is
    // silent: a screen-reader user would hear nothing at all and reload.
    await expect
      .element(pantalla.getByText("Cargando territorios…"))
      .toBeInTheDocument();
    expect(document.querySelector("[aria-busy='true']")).not.toBeNull();
  });

  it("PanelDeError ofrece una salida y la salida se puede tocar", async () => {
    const pantalla = await render(<PanelDeError alReintentar={() => {}} />);

    const reintentar = await pantalla
      .getByRole("button", { name: "Probar de nuevo" })
      .element();
    expect(tamanioDelObjetivo(reintentar).alto).toBeGreaterThanOrEqual(48);

    // It is an alert: a dropped connection in a parish office is the common case,
    // and it has to be heard rather than found.
    await expect.element(pantalla.getByRole("alert")).toBeInTheDocument();
  });

  it("Vacío dice qué hacer, no sólo que no hay nada", async () => {
    const pantalla = await render(
      <Vacio
        titulo="Todavía no hay Misioneros cargados"
        mensaje="Cuando cargues la primera persona va a aparecer acá."
        accion={<Boton>Cargar un Misionero</Boton>}
      />
    );

    await expect
      .element(pantalla.getByRole("button", { name: "Cargar un Misionero" }))
      .toBeInTheDocument();
  });
});

describe("axe", () => {
  it("no encuentra violaciones en las primitivas juntas", async () => {
    // Together rather than one by one, because several of axe's rules are about
    // relationships — duplicate ids from two `useId` calls, headings out of
    // order, a landmark nested in another — and none of those can appear in a
    // component rendered alone.
    const pantalla = await render(
      <main>
        <h1>Peregrinas</h1>

        <Volver href="/peregrina">Volver a Peregrinas</Volver>

        <Tarjeta titulo="¿Quién la tiene ahora?" acciones={<Boton>Entregar</Boton>}>
          <p>La tiene María Pérez desde el 3 de marzo.</p>
          <Insignia tono="exito">Activa</Insignia>
        </Tarjeta>

        <Mensaje tono="aviso">
          <p>Se cierra el período de María Pérez, que la tiene ahora.</p>
        </Mensaje>

        <Campo etiqueta="Nombre" value="" onChange={() => {}} />
        <Campo etiqueta="Apellido" error="Es obligatorio." value="" onChange={() => {}} />
        <Eleccion
          etiqueta="Modalidad"
          vacia="Elegí una"
          value=""
          opciones={[{ valor: "JOV", etiqueta: "Juventud" }]}
          alElegir={() => {}}
        />
        <AreaDeTexto etiqueta="Nota" value="" maxLength={500} contador onChange={() => {}} />

        <Boton>Guardar</Boton>
        <Boton tono="secundario">Guardar y agregar otra</Boton>
        <Boton tono="peligro">Dar de baja</Boton>
      </main>
    );

    expect(await violacionesDeAxe(pantalla.container)).toEqual([]);
  });
});
