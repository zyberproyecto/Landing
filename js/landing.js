const API_USUARIOS_BASE = "http://localhost:8001";   // api-usuarios (Laravel)
const API_COOP_BASE     = "http://localhost:8002";   // api-cooperativa (Laravel)
const API_BACKOFFICE    = "http://localhost:8003";   // api-backoffice (Laravel)

// ====== Utilidades ======
function setMsgBelowForm(form, text) {
  let msg = form.querySelector("[data-form-msg]");
  if (!msg) {
    msg = document.createElement("p");
    msg.dataset.formMsg = "1";
    msg.style.minHeight = "1.25rem";
    msg.style.color = "#cbd5e1";
    msg.style.marginTop = "0.5rem";
    form.appendChild(msg);
  }
  msg.textContent = text || "";
}

// ====== Hook para formulario de postulación (formulario.html) ======
// HTML recibido: names/ids: CI, nombre, email, telefono, menores_cargo, intereses, mensaje
// action original: registro_cliente.php (no se toca). Solo interceptamos el submit por JS.  :contentReference[oaicite:5]{index=5}
(function hookPostulacion() {
  // Detecta si esta página tiene un form con el campo CI
  const form = document.querySelector('form[action="registro_cliente.php"], form.form-cliente');
  const ci = document.getElementById("CI");
  if (!form || !ci) return; // no estamos en formulario.html

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      ci:        (form.querySelector('[name="CI"]') || {}).value || "",
      // "Nombre Completo" lo dividimos al menos en nombre + apellido si se puede
      primer_nombre: "",
      primer_apellido: "",
      email:     (form.querySelector('[name="email"]') || {}).value || "",
      telefono:  (form.querySelector('[name="telefono"]') || {}).value || "",
      motivacion:(form.querySelector('[name="mensaje"]') || {}).value || "",
      // Campos auxiliares de tu UI:
      menores_cargo: (form.querySelector('[name="menores_cargo"]') || {}).value || "",
      intereses:     (form.querySelector('[name="intereses"]') || {}).value || ""
    };

    // Intento simple de separar nombre y apellido desde "nombre"
    const nomCompleto = (form.querySelector('[name="nombre"]') || {}).value || "";
    if (nomCompleto.trim().length) {
      const partes = nomCompleto.trim().split(/\s+/);
      payload.primer_nombre = partes[0] || "";
      payload.primer_apellido = partes.slice(1).join(" ") || "";
    }

    try {
      const res = await fetch(`${API_COOP_BASE}/api/solicitudes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ci: payload.ci,
          primer_nombre: payload.primer_nombre,
          primer_apellido: payload.primer_apellido,
          segundo_nombre: null,
          segundo_apellido: null,
          email: payload.email || null,
          telefono: payload.telefono || null,
          motivacion: `[Menores a cargo: ${payload.menores_cargo} | Interés: ${payload.intereses}] ${payload.motivacion || ""}`.trim()
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsgBelowForm(form, data.message || "No se pudo enviar la postulación.");
        return;
      }
      setMsgBelowForm(form, "¡Postulación enviada! Un administrador la revisará.");
      form.reset();
    } catch (err) {
      setMsgBelowForm(form, "Error de red al enviar.");
    }
  });
})();

// ====== Hook para login (login.html) ======
// HTML recibido: names: usuario, password; action a https://api.mi-cooperativa.uy/auth/login (no se toca).
// Enviamos además a nuestra API local Laravel para tu MVP.  :contentReference[oaicite:6]{index=6}
(function hookLogin() {
  const form = document.querySelector('form.form-cliente, main.container form');
  const userInput = document.getElementById("usuario");
  const passInput = document.getElementById("password");
  if (!form || !userInput || !passInput) return; // no estamos en login.html

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsgBelowForm(form, "Procesando...");

    const usuario = userInput.value || "";
    const password = passInput.value || "";

    try {
      const res = await fetch(`${API_USUARIOS_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Mapeo: tu campo "usuario" -> API espera "ci_usuario"
        body: JSON.stringify({ ci_usuario: usuario, password })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsgBelowForm(form, data.message || "Credenciales inválidas o usuario no aprobado.");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("rol", data.rol || "socio");

      if ((data.rol || "socio") === "admin") {
        window.location.href = "../BACKOFFICE_ADMIN/index.html";
      } else {
        window.location.href = "../FRONTEND_COOPERATIVA/index.html";
      }
    } catch (err) {
      setMsgBelowForm(form, "Error de red.");
    }
  });
})();

// ====== Botón "Salir" (si lo usas en otras páginas) ======
document.addEventListener("click", (e) => {
  if (e.target && e.target.matches('[data-logout="1"], #logout')) {
    e.preventDefault();
    localStorage.removeItem("token");
    localStorage.removeItem("rol");
    window.location.href = "../LANDING_PAGE/login.html";
  }
});