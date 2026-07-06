import { Clock, LogOut, Mail } from 'lucide-react';
import { useApp } from '../lib/context.jsx';

export default function PendienteAsignacion() {
  const { usuario, usuarioDoc, cerrarSesion } = useApp();

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="bg-white border-b border-border">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <div className="flex items-center gap-4">
            <img
              src="/paf-cap-logo.jpg"
              alt="Aprender en Familia · Fundación CAP"
              className="h-14 w-auto object-contain shrink-0"
            />
            <div>
              <h1 className="text-lg md:text-xl font-medium text-gray-dark tracking-tight leading-tight">
                Visualizador PAF 2026
              </h1>
              <p className="text-gray-ui text-sm font-light">Programa Aprender en Familia · Fundación CAP</p>
            </div>
          </div>
        </div>
        <div className="h-1" style={{ background: 'var(--color-cyan)' }}/>
      </header>

      <main className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="max-w-lg w-full">
          <div className="card text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'rgb(255,249,225)' }}>
              <Clock size={24} style={{ color: 'rgb(180,130,0)' }}/>
            </div>
            <h2 className="text-xl font-medium text-gray-dark mb-2">Tu cuenta está pendiente de asignación</h2>
            <p className="text-sm text-gray-ui font-light leading-relaxed mb-6">
              Registramos tu cuenta correctamente. Un administrador de Consultora Focus debe asignarte
              un perfil (Escuela, Jardín, Sostenedor, Consultor, etc.) para que puedas acceder a los datos
              del programa.
            </p>

            <div className="text-left border-t border-border pt-5 mb-5">
              <p className="text-xs text-gray-ui font-medium uppercase tracking-wider mb-2">Tu registro</p>
              <div className="flex items-start gap-2 mb-1">
                <Mail size={13} className="text-gray-ui mt-1 shrink-0"/>
                <span className="text-sm text-gray-dark font-medium">{usuario?.email ?? usuarioDoc?.email}</span>
              </div>
              {usuarioDoc?.nombre && (
                <p className="text-xs text-gray-ui font-light ml-5">{usuarioDoc.nombre}</p>
              )}
            </div>

            <p className="text-xs text-gray-ui font-light mb-6">
              Contactá a tu administrador con este correo para que te asigne el perfil correspondiente.
              Cuando tengas acceso, vas a poder ver los datos automáticamente al volver a ingresar.
            </p>

            <button
              onClick={cerrarSesion}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm font-medium text-gray-dark hover:bg-bg transition"
            >
              <LogOut size={14}/>
              Cerrar sesión
            </button>
          </div>
        </div>
      </main>

      <footer className="border-t border-border bg-white py-4">
        <div className="max-w-6xl mx-auto px-8 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-gray-ui font-light">Visualizador PAF · Consultora Focus · Fundación CAP</span>
          <img src="/paf-cap-logo.jpg" alt="Aprender en Familia · Fundación CAP" className="h-6 w-auto opacity-50" />
        </div>
      </footer>
    </div>
  );
}
