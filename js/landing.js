/* ========================================================================
   Landing – lógica de Login + Registro
   Requisitos:
   - API Usuarios     => http://127.0.0.1:8001  (POST /api/login, GET /api/perfil)
   - API Cooperativa  => http://127.0.0.1:8002  (POST /api/solicitudes)
   - Backoffice       => http://127.0.0.1:8003  (/sso?token=...)
   - Front Socios     => página estática o app separada
   ======================================================================== */

/* ========= Endpoints ========= */
const API_USUARIOS_BASE   = "http://127.0.0.1:8001";
const API_COOP_BASE       = "http://127.0.0.1:8002";
const BACKOFFICE_URL      = "http://127.0.0.1:8003";
const FRONT_SOCIOS_URL    = "http://127.0.0.1:5500/frontend_usuarios/index.html";

/* ========= Helpers ========= */
function $(sel, root) { return (root || document).querySelector(sel); }

function setMsgBelowForm(form, text, color) {
  let msg = form.querySelector("[data-form-msg]");
  if (!msg) {
    msg = document.createElement("p");
    msg.dataset.formMsg = "1";
    msg.style.minHeight = "1.25rem";
    msg.style.marginTop = "0.5rem";
    form.appendChild(msg);
  }
  msg.style.whiteSpace = "pre-wrap";
  msg.style.color = color || "#334155";
  msg.textContent = text || "";
}

async function postJSON(url, body, extraHeaders) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(extraHeaders || {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

async function getJSON(url, token) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

function extractToken(possible) {
  return (
    possible?.token ||
    possible?.access_token ||
    possible?.data?.token ||
    possible?.data?.access_token ||
    null
  );
}

/* ========= App ========= */
document.addEventListener("DOMContentLoaded", () => {

  /* ================== LOGIN (landing/login.html) ================== */
  const loginForm = $("#login-form") || (function searchLoginFallback(){
    const f = document.querySelector("form");
    if (!f) return null;
    const u = $("#usuario", f), p = $("#password", f);
    return (u && p) ? f : null;
  })();

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const usuario = ($("#usuario", loginForm)?.value || "").trim();
      const password = ($("#password", loginForm)?.value || "");

      if (!usuario || !password) {
        setMsgBelowForm(loginForm, "Completá usuario y contraseña.", "#b00");
        return;
      }

      try {
        setMsgBelowForm(loginForm, "Procesando login...");

        // 1) Login en API Usuarios
        const loginResp = await postJSON(`${API_USUARIOS_BASE}/api/login`, {
          login: usuario,
          password
        });
        const token = extractToken(loginResp);
        if (!token) throw new Error("No llegó token desde API Usuarios.");

        localStorage.setItem("token", token);

        // 2) Perfil del usuario
        const perfilResp = await getJSON(`${API_USUARIOS_BASE}/api/perfil`, token);
        const perfil  = perfilResp?.data || perfilResp || {};
        const rol     = perfil?.rol ?? loginResp?.user?.rol ?? "socio";
        const estado  = perfil?.estado_registro ?? perfil?.estado ?? "Pendiente";

        if (rol === "admin" && estado === "Aprobado") {
          setMsgBelowForm(loginForm, "Login OK (admin). Redirigiendo al Backoffice...", "green");
          window.location.assign(`${BACKOFFICE_URL}/sso?token=${encodeURIComponent(token)}`);
        } else if (rol === "socio" && estado === "Aprobado") {
          setMsgBelowForm(loginForm, "Login OK (socio). Redirigiendo al portal...", "green");
          window.location.assign(FRONT_SOCIOS_URL);
        } else {
          setMsgBelowForm(loginForm, "Usuario no aprobado o sin permisos para ingresar.", "#b00");
        }
      } catch (err) {
        console.error("Login error:", err);
        const msg =
          err?.errors?.login?.[0] ||
          err?.message ||
          err?.error ||
          "Credenciales inválidas o usuario no aprobado.";
        setMsgBelowForm(loginForm, msg, "#b00");
      }
    });
  }

  /* ================== REGISTRO (landing/formulario.html) ================== */
  const regForm = $("#registro-form");
  if (regForm) {
    regForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const CI        = $("#CI")?.value.trim() || "";
      const nombre    = $("#nombre")?.value.trim() || "";
      const email     = $("#email")?.value.trim() || "";
      const telefono  = $("#telefono")?.value.trim() || "";
      const menores   = $("#menores_cargo")?.value || "no";   // "si" | "no"
      const interes   = $("#intereses")?.value || "1";        // "1" | "2" | "3"
      const mensaje   = $("#mensaje")?.value.trim() || "";

      if (!CI || !nombre || !email || !telefono) {
        setMsgBelowForm(regForm, "Completá todos los campos obligatorios.", "#b00");
        return;
      }

      setMsgBelowForm(regForm, "Enviando solicitud...");

      // Contrato limpio para la API: boolean + entero
      const payload = {
        ci_usuario: CI,
        nombre_completo: nombre,
        email,
        telefono,
        menores_a_cargo: (menores === "si"),     // boolean
        dormitorios: parseInt(interes, 10),      // entero 1..3
        comentarios: mensaje || null,
      };

      try {
        await postJSON(`${API_COOP_BASE}/api/solicitudes`, payload);
        setMsgBelowForm(regForm, "¡Solicitud enviada! Te contactaremos cuando sea aprobada.", "green");
        regForm.reset();
      } catch (err) {
        console.error("Registro error:", err);
        const firstError =
          (err?.errors && typeof err.errors === "object" && Object.values(err.errors)[0]?.[0]) ||
          err?.message ||
          err?.error ||
          "No se pudo enviar la solicitud.";
        setMsgBelowForm(regForm, firstError, "#b00");
      }
    });
  }

  /* ================== Logout opcional (si lo usás) ================== */
  document.addEventListener("click", (e) => {
    if (e.target && (e.target.matches('[data-logout="1"]') || e.target.id === "logout")) {
      e.preventDefault();
      localStorage.removeItem("token");
      window.location.reload();
    }
  });
});