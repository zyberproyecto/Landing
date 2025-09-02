/* ========= ZYBER – Landing JS =========
   Funciones: Postulación (formulario.html) + Login (login.html)
   Endpoints:
     - api-usuarios:  http://localhost:8001/api
     - api-cooperativa: http://localhost:8002/api  (no usado aquí)
     - backoffice api: http://localhost:8003/api   (no usado aquí)
*/

const API_USUARIOS_BASE = "http://localhost:8001";   // api-usuarios (Laravel)
const API_COOP_BASE     = "http://localhost:8002";   // api-cooperativa (Laravel)
const API_BACKOFFICE    = "http://localhost:8003";   // api-backoffice (Laravel) // (no usado acá)

// ====== Utilidades ======
function setMsgBelowForm(form, text, color) {
  let msg = form.querySelector("[data-form-msg]");
  if (!msg) {
    msg = document.createElement("p");
    msg.dataset.formMsg = "1";
    msg.style.minHeight = "1.25rem";
    msg.style.marginTop = "0.5rem";
    form.appendChild(msg);
  }
  msg.style.color = color || "#cbd5e1";
  msg.textContent = text || "";
}

async function postJSON(url, body, token) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...(token ? { "Authorization": "Bearer " + token } : {})
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

// Nombre completo → primer_nombre / segundo_nombre / primer_apellido
function splitNombreCompleto(nc) {
  const partes = (nc || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { pn: "", sn: null, pa: "" };
  if (partes.length === 1) return { pn: partes[0], sn: null, pa: "" };
  const pn = partes[0];
  const pa = partes[partes.length - 1];
  const sn = partes.slice(1, -1).join(" ") || null;
  return { pn, sn, pa };
}

// ==========================================================
// Hooks: se registran cuando el DOM está listo
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {

  // ====== Hook para formulario de postulación (formulario.html) ======
  (function hookPostulacion() {
    // Detectamos por clase y dejamos fallback por action original
    const form = document.querySelector('form.form-cliente') ||
                 document.querySelector('form[action="registro_cliente.php"]');
    const ci = document.getElementById("CI");
    if (!form || !ci) return; // no estamos en formulario.html

    // Evita navegar al .php si algo falla
    form.setAttribute("action", "#");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const msgColorErr = "#b00";
      setMsgBelowForm(form, "Enviando solicitud...");

      const ciVal   = (form.querySelector('[name="CI"]') || {}).value || "";
      const nomComp = (form.querySelector('[name="nombre"]') || {}).value || "";
      const email   = (form.querySelector('[name="email"]') || {}).value || "";
      const tel     = (form.querySelector('[name="telefono"]') || {}).value || "";

      const { pn, sn, pa } = splitNombreCompleto(nomComp);

      // 1ª entrega: la landing registra en api-usuarios
      const payload = {
        ci_usuario:       ciVal.trim(),
        primer_nombre:    pn,
        segundo_nombre:   sn,
        primer_apellido:  pa,
        segundo_apellido: null,
        email:            email.trim(),
        telefono:         tel.trim() || null,
        // contraseña temporal: CI (se puede cambiar luego)
        password:         ciVal.trim() || "123456",
      };

      try {
        await postJSON(`${API_USUARIOS_BASE}/api/registro`, payload);
        setMsgBelowForm(form, "¡Postulación enviada! Tu estado es PENDIENTE hasta aprobación.", "green");
        form.reset();
      } catch (err) {
        if (err?.errors) {
          const listado = Object.entries(err.errors)
            .map(([k, v]) => `• ${k}: ${v.join(", ")}`)
            .join("\n");
          setMsgBelowForm(form, `Errores:\n${listado}`, msgColorErr);
        } else {
          setMsgBelowForm(form, err?.error || err?.message || "No se pudo enviar la postulación.", msgColorErr);
        }
      }
    });
  })();

  // ====== Hook para login (login.html) ======
  (function hookLogin() {
    const form = document.querySelector('form.form-cliente, main.container form, form[action*="login"]');
    const userInput = document.getElementById("usuario");
    const passInput = document.getElementById("password");
    if (!form || !userInput || !passInput) return; // no estamos en login.html

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msgColorErr = "#b00";
      setMsgBelowForm(form, "Procesando...");

      const usuario = (userInput.value || "").trim();  // CI o Email
      const password = passInput.value || "";

      try {
        // Nuestra API espera { login, password }
        const data = await postJSON(`${API_USUARIOS_BASE}/api/login`, { login: usuario, password });

        // Guardar token y rol (viene en data.user.rol)
        localStorage.setItem("token", data.token);
        const rol = (data.user && data.user.rol) ? data.user.rol : "socio";
        localStorage.setItem("rol", rol);

        setMsgBelowForm(form, "Login OK. Redirigiendo...", "green");

        // Redirecciones ajustadas a tu estructura
        if (rol === "admin") {
          window.location.href = "../backoffice/index.html";
        } else {
          window.location.href = "../frontend_usuarios/index.html";
        }
      } catch (err) {
        setMsgBelowForm(form, err?.error || err?.message || "Credenciales inválidas o usuario no aprobado.", msgColorErr);
      }
    });
  })();

  // ====== Botón "Salir" (si lo usas en otras páginas) ======
  document.addEventListener("click", (e) => {
    if (e.target && e.target.matches('[data-logout="1"], #logout')) {
      e.preventDefault();
      localStorage.removeItem("token");
      localStorage.removeItem("rol");
      // ajustá si tu login está en otra ruta
      window.location.href = "../landing_page/login.html";
    }
  });

});