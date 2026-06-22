import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

const TERMINOS = [
  { sigla: 'AE',   definicion: 'Agentes educativas' },
  { sigla: 'BV',   definicion: 'Biblioteca Viajera' },
  { sigla: 'CAUE', definicion: 'Consejo Asesor y Unidad Educativa' },
  { sigla: 'EFE',  definicion: 'Equipo Familia Escuela' },
  { sigla: 'IF',   definicion: 'Involucramiento Familiar' },
  { sigla: 'JI',   definicion: 'Jardín infantil' },
  { sigla: 'MFC',  definicion: 'Mi Familia Cuenta' },
  { sigla: 'MPC',  definicion: 'Madres, padres y cuidadores' },
  { sigla: 'PAF',  definicion: 'Programa Aprender en Familia' },
  { sigla: 'PEI',  definicion: 'Proyecto Educativo Institucional' },
  { sigla: 'PME',  definicion: 'Plan de Mejoramiento Educativo' },
  { sigla: 'pp',   definicion: 'Puntos porcentuales' },
];

export default function Glosario() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-8 border border-border rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-bg transition text-left"
      >
        <div className="flex items-center gap-2 text-xs font-medium text-gray-ui uppercase tracking-wider">
          <BookOpen size={14} style={{ color: 'var(--color-cyan)' }}/>
          Glosario de abreviaciones
        </div>
        {open
          ? <ChevronUp size={15} className="text-gray-ui shrink-0"/>
          : <ChevronDown size={15} className="text-gray-ui shrink-0"/>
        }
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1.5">
            {TERMINOS.map(({ sigla, definicion }) => (
              <div key={sigla} className="flex items-baseline gap-2 text-xs">
                <dt className="font-semibold text-gray-dark shrink-0 w-12">{sigla}</dt>
                <dd className="text-gray-ui">{definicion}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
