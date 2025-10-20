// src/components/Dashboard/StatistikModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { GripVertical, PanelLeftOpen, PanelRightOpen } from "lucide-react";

const StatistikModal = ({ user, onClose }) => {
  const [stunden, setStunden] = useState({});
  const [urlaub, setUrlaub] = useState({});
  const jahr = new Date().getFullYear();
  const monate = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

  /* Daten laden */
  useEffect(() => {
    const ladeDaten = async () => {
      if (!user?.user_id) return;
      const { data: stundenData } = await supabase
        .from("DB_Stunden").select("*")
        .eq("user_id", user.user_id).eq("jahr", jahr).maybeSingle();
      const { data: urlaubData } = await supabase
        .from("DB_Urlaub").select("*")
        .eq("user_id", user.user_id).eq("jahr", jahr).maybeSingle();
      setStunden(stundenData || {});
      setUrlaub(urlaubData || {});
    };
    ladeDaten();
  }, [user, jahr]);

  /* Kennzahlen */
  const uebernahmeVorjahr = Number(stunden?.uebernahme_vorjahr) || 0;

  const summeIstJahr = useMemo(
    () => Array.from({ length: 12 }, (_, i) => Number(stunden[`m${i + 1}`]) || 0)
              .reduce((a, b) => a + b, 0),
    [stunden]
  );

  // Ist-Stunden inkl. Vorjahr
  const summeIst = summeIstJahr + uebernahmeVorjahr;

  // Rest bis Jahresende (Ziel minus Ist inkl. Vorjahr)
  const restStd = (Number(stunden.stunden_gesamt) || 0) - summeIst;

  const urlaubSumme = useMemo(
    () => Array.from({ length: 12 }, (_, i) => Number(urlaub[`m${i + 1}`]) || 0)
              .reduce((a, b) => a + b, 0),
    [urlaub]
  );
  const urlaubUebrig = (Number(urlaub.urlaub_gesamt) || 0) - urlaubSumme;

  // Chart-Daten: Ist startet bei uebernahme_vorjahr
  let kumIst = uebernahmeVorjahr;
  let kumSoll = 0;
  let kumUrlaub = 0;
  const chartData = monate.map((name, i) => {
    const ist = Number(stunden[`m${i + 1}`]) || 0;
    const soll = Number(stunden[`soll_m${i + 1}`]) || 0;
    const urlaubM = Number(urlaub[`m${i + 1}`]) || 0;
    kumIst += ist;
    kumSoll += soll;
    kumUrlaub += urlaubM;
    const ziel = ((Number(stunden.stunden_gesamt) || 0) / 12) * (i + 1);
    return { name, ist: kumIst, soll: kumSoll, ziel, urlaub: kumUrlaub };
  });

  /* Drag & Dock – wie SDAO */
  const modalRef = useRef(null);
  const [dock, setDock] = useState(null); // 'left' | 'right' | null
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!user) return;
    requestAnimationFrame(() => {
      const el = modalRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const left = Math.max((window.innerWidth - rect.width) / 2, 16);
      const top = Math.max((window.innerHeight - rect.height) / 2, 16);
      setPos({ left, top });
    });
  }, [user]);

  const startDrag = (e) => {
    if (dock) return;
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    const rect = modalRef.current.getBoundingClientRect();
    setDragging(true);
    setDragOffset({ x: cx - rect.left, y: cy - rect.top });
    e.preventDefault();
  };
  const onDrag = (e) => {
    if (!dragging || dock) return;
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    if (cx == null || cy == null) return;
    const el = modalRef.current;
    const w = el.offsetWidth, h = el.offsetHeight, m = 8;
    let left = Math.min(window.innerWidth - w - m, Math.max(m, cx - dragOffset.x));
    let top = Math.min(window.innerHeight - h - m, Math.max(m, cy - dragOffset.y));
    setPos({ left, top });
  };
  const stopDrag = () => setDragging(false);
  useEffect(() => {
    if (!dragging) return;
    const mv = (ev) => onDrag(ev);
    const up = () => stopDrag();
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', mv, { passive: false });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', mv);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', mv);
      window.removeEventListener('touchend', up);
    };
  }, [dragging, dock, dragOffset]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
      <div
        ref={modalRef}
        className={`absolute bg-white text-gray-800 dark:bg-gray-900 dark:text-white border border-gray-500 p-6 rounded-xl w-[700px] shadow-lg ${
          dragging ? 'select-none cursor-grabbing' : ''
        } ${dock ? 'h-screen rounded-none' : ''}`}
        style={
          dock === 'left'
            ? { left: 0, top: 0 }
            : dock === 'right'
            ? { right: 0, top: 0 }
            : { left: `${pos.left}px`, top: `${pos.top}px` }
        }
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onMouseDown={startDrag}
              onTouchStart={startDrag}
              title="Verschieben"
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-move"
            >
              <GripVertical className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold">
              Statistiken – {user?.vorname} {user?.nachname} · {jahr}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDock((d) => (d === 'left' ? null : 'left'))}
              title={dock === 'left' ? 'Andocken lösen' : 'Links andocken'}
              className={`p-1 rounded ${dock === 'left' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
            <button
              onClick={() => setDock((d) => (d === 'right' ? null : 'right'))}
              title={dock === 'right' ? 'Andocken lösen' : 'Rechts andocken'}
              className={`p-1 rounded ${dock === 'right' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              <PanelRightOpen className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" title="Schließen">✕</button>
          </div>
        </div>

        {/* Info-Zeilen */}
        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-xl text-sm border border-gray-300 dark:border-gray-700 mb-4">
          <div className="flex flex-wrap gap-4 mb-2 items-center">
            <span className="flex items-center gap-1">
              <span>Vorgabe Jahresstunden:</span>
              <b>{(Number(stunden.stunden_gesamt) || 0).toLocaleString("de-DE")}</b>
            </span>
            <span className="flex items-center gap-1">
              <span>Ist-Stunden (inkl. Vorjahr):</span>
              <b>{summeIst.toLocaleString("de-DE")}</b>
            </span>
            <span className="flex items-center gap-1">
              <span>Stunden zum Jahresende:</span>
              <b>
                {Number.isFinite(restStd)
                  ? restStd.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : "–"}{" "}
                h
              </b>
            </span>
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <span className="flex items-center gap-1">
              <span>Urlaub übrig:</span> <b>{urlaubUebrig}</b>
            </span>
            <span>Urlaub eingetragen: <b>{urlaubSumme}</b></span>
            <span>Urlaub gesamt: <b>{urlaub.urlaub_gesamt || 0}</b></span>
          </div>
        </div>

        {/* Chart */}
        <div className="h-72 w-full bg-gray-200 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl shadow-md p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="ist" stroke="#10B981" name="Ist-Stunden (inkl. Vorjahr)" />
              <Line yAxisId="left" type="monotone" dataKey="soll" stroke="#3B82F6" name="Stunden laut Sollplan" />
              <Line yAxisId="left" type="monotone" dataKey="ziel" stroke="#EF4444" name="Vorgabe Jahresstunden" strokeDasharray="5 5" />
              <Line yAxisId="right" type="monotone" dataKey="urlaub" stroke="#F59E0B" name="Urlaub (Tage)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default StatistikModal;
