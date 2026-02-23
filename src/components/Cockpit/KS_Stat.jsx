// src/components/Cockpit/KS_Stat.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const deNumber = (v, digits = 0) => {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return '0';
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
};

const fmtDateTime = (ts) => {
  if (!ts) return '—';
  const d = dayjs(ts);
  if (!d.isValid()) return String(ts);
  return d.format('DD.MM.YYYY HH:mm');
};

const Modal = ({ open, title, subtitle, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-6xl rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <div className="font-semibold text-gray-900 dark:text-gray-100">{title}</div>
            {subtitle ? <div className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-white/10 text-sm"
          >
            Schließen
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

const SmallToggle = ({ value, onChange }) => (
  <div className="flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
    <button
      type="button"
      onClick={() => onChange('gauge')}
      className={`px-2 py-1 text-xs ${
        value === 'gauge' ? 'bg-gray-300/60 dark:bg-gray-700' : 'hover:bg-white/10'
      }`}
      title="Gauge"
    >
      Gauge
    </button>
    <button
      type="button"
      onClick={() => onChange('bullet')}
      className={`px-2 py-1 text-xs ${
        value === 'bullet' ? 'bg-gray-300/60 dark:bg-gray-700' : 'hover:bg-white/10'
      }`}
      title="Bullet"
    >
      Bullet
    </button>
  </div>
);

/* ---------------------- Gauge (Halbkreis) ---------------------- */
function IstSollGauge({ ist, soll, height = 220 }) {
  const safeSoll = Math.max(0, Number(soll ?? 0));
  const safeIst = Math.max(0, Number(ist ?? 0));

  const ratio = safeSoll > 0 ? safeIst / safeSoll : 0;
  const capped = Math.min(Math.max(ratio, 0), 1);

  const filledPct = Math.round(capped * 1000) / 10; // %
  const mainData = [
    { name: 'Ist', value: filledPct },
    { name: 'Rest', value: 100 - filledPct },
  ];

  // Überhang als dünner Außenring (visuell cap: +100%)
  const overPct = safeSoll > 0 ? Math.min(Math.max((ratio - 1) * 100, 0), 100) : 0;
  const overData =
    overPct > 0 ? [{ name: 'Über', value: overPct }, { name: 'Leer', value: 100 - overPct }] : null;

  const pctText = safeSoll > 0 ? `${Math.round(ratio * 100)}%` : '—';

  return (
    <div style={{ height }} className="relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={mainData}
            dataKey="value"
            startAngle={180}
            endAngle={0}
            innerRadius="70%"
            outerRadius="95%"
            paddingAngle={1}
            stroke="none"
          >
            <Cell fill="#10b981" />
            <Cell fill="#374151" />
          </Pie>

          {overData && (
            <Pie
              data={overData}
              dataKey="value"
              startAngle={180}
              endAngle={0}
              innerRadius="97%"
              outerRadius="100%"
              paddingAngle={1}
              stroke="none"
            >
              <Cell fill="#ef4444" />
              <Cell fill="transparent" />
            </Pie>
          )}
        </PieChart>
      </ResponsiveContainer>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-xs text-gray-500 dark:text-gray-300">Ist / Verfügbar</div>
        <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{pctText}</div>
        <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
          {deNumber(safeIst)}h / {deNumber(safeSoll)}h
        </div>
      </div>
    </div>
  );
}

/* ---------------------- Bullet (flach) ---------------------- */
function IstSollBulletFlat({ ist, soll, dense = false }) {
  const safeSoll = Math.max(0, Number(soll ?? 0));
  const safeIst = Math.max(0, Number(ist ?? 0));

  const ratio = safeSoll > 0 ? safeIst / safeSoll : 0;
  const pct = safeSoll > 0 ? Math.round(ratio * 100) : null;

  const fillPct = safeSoll > 0 ? Math.min(Math.max(ratio, 0), 1) * 100 : 0;
  const overPct = safeSoll > 0 ? Math.min(Math.max((ratio - 1) * 100, 0), 100) : 0;

  const h = dense ? 10 : 18;

  return (
    <div className="w-full">
      {/* Zahlenzeile (flach) */}
      <div className={`flex items-center justify-between ${dense ? 'mb-1' : 'mb-2'}`}>
        <div className={`${dense ? 'text-[11px]' : 'text-xs'} text-gray-800 dark:text-gray-100`}>
          <span className="font-semibold">{deNumber(safeIst)}</span>
          <span className="text-gray-500 dark:text-gray-300"> / </span>
          <span className="font-semibold">{deNumber(safeSoll)}</span>
          <span className="text-gray-500 dark:text-gray-300"> h</span>
        </div>
        <div className={`${dense ? 'text-[11px]' : 'text-xs'} font-semibold text-gray-900 dark:text-gray-100`}>
          {pct === null ? '—' : `${pct}%`}
        </div>
      </div>

      {/* Bar */}
      <div className="relative rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700" style={{ height: h }}>
        {/* Ist (bis 100%) */}
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ width: `${fillPct}%`, backgroundColor: '#10b981' }}
        />

        {/* Überhang als dünner roter Streifen oben */}
        {overPct > 0 && (
          <div className="absolute left-0 top-0 h-[2px]" style={{ width: `${Math.min(overPct, 100)}%`, backgroundColor: '#ef4444' }} />
        )}

        {/* Soll-Marke rechts */}
        <div className="absolute top-[-8px] right-0 flex flex-col items-end pointer-events-none">
          <div className="h-[calc(100%+16px)] w-[2px] bg-gray-900/60 dark:bg-gray-100/50" />
        </div>
      </div>
    </div>
  );
}

/* ---------------------- Tooltip / Notiz-Popover ---------------------- */
const Popover = ({ open, anchorRef, onClose, children }) => {
  const popRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      const a = anchorRef?.current;
      const p = popRef.current;
      if (!a || !p) return;
      if (a.contains(e.target) || p.contains(e.target)) return;
      onClose?.();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, anchorRef, onClose]);

  if (!open) return null;
  return (
    <div
      ref={popRef}
      className="absolute z-[9999] mt-2 w-[380px] rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-3"
      style={{ left: 0, top: '100%' }}
    >
      {children}
    </div>
  );
};

const StatLine = ({ label, value, emphasis = false }) => (
  <div className="flex items-center justify-between gap-3 py-0.5">
    <div className="text-xs text-gray-500 dark:text-gray-300">{label}</div>
    <div className={`text-xs ${emphasis ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-800 dark:text-gray-100'}`}>
      {value}
    </div>
  </div>
);

const MiniCard = ({ title, children }) => (
  <div className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
    <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">{title}</div>
    {children}
  </div>
);

export default function KS_Stat({ jahr, monat }) {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [monthRow, setMonthRow] = useState(null);
  const [ytdRow, setYtdRow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const [openModal, setOpenModal] = useState(false);
  const [monthMode, setMonthMode] = useState('bullet'); // 'bullet' | 'gauge'
  const [yearMode, setYearMode] = useState('gauge');    // 'bullet' | 'gauge'

  // Hover “Notizfeld”
  const anchorRef = useRef(null);
  const [openNote, setOpenNote] = useState(false);
  const [noteHover, setNoteHover] = useState(false);

  const monthName = useMemo(() => dayjs(new Date(jahr, monat, 1)).format('MMMM YYYY'), [jahr, monat]);

  useEffect(() => {
    if (!firma || !unit || jahr == null || monat == null) return;

    const load = async () => {
      setLoading(true);
      setErr(null);

      const m = Number(monat) + 1; // db_report_monthly: 1..12
      try {
        const [{ data: mData, error: mErr }, { data: yData, error: yErr }] = await Promise.all([
          supabase
            .from('db_report_monthly')
            .select('jahr, monat, ist_stunden_sum, soll_stunden_sum, finalized_at')
            .eq('firma_id', firma)
            .eq('unit_id', unit)
            .eq('jahr', Number(jahr))
            .eq('monat', m)
            .maybeSingle(),
          supabase
            .from('db_report_ytd')
            .select('jahr, bis_monat, ytd_soll, ytd_ist, ytd_diff, year_soll, year_ist, year_diff, year_uebernahme')
            .eq('firma_id', firma)
            .eq('unit_id', unit)
            .eq('jahr', Number(jahr))
            .maybeSingle(),
        ]);

        if (mErr) throw mErr;
        if (yErr) throw yErr;

        setMonthRow(mData ?? null);
        setYtdRow(yData ?? null);
      } catch (e) {
        setErr(e?.message ?? 'Fehler beim Laden');
        setMonthRow(null);
        setYtdRow(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [firma, unit, jahr, monat]);

  const monthIst = Number(monthRow?.ist_stunden_sum ?? 0);
  const monthSoll = Number(monthRow?.soll_stunden_sum ?? 0);
  const monthPct = monthSoll > 0 ? (monthIst / monthSoll) * 100 : null;
  const monthRest = monthSoll - monthIst;

  const yearSoll = Number(ytdRow?.year_soll ?? 0);
  const yearIst = Number(ytdRow?.year_ist ?? 0);
  const yearUe = Number(ytdRow?.year_uebernahme ?? 0);

  // ✅ Wunsch: Ist-Stunden inkl. Übernahme (Jahr)
  const yearIstIncl = yearIst + yearUe;

  // ✅ Wunsch: Differenz inkl. Übernahme (Ist+Übernahme − Soll)
  const yearDiffIncl = yearIstIncl - yearSoll;

  const ytdSoll = Number(ytdRow?.ytd_soll ?? 0);
  const ytdIst = Number(ytdRow?.ytd_ist ?? 0);
  const ytdPct = ytdSoll > 0 ? (ytdIst / ytdSoll) * 100 : null;

  const hasMonthData = !!monthRow && (monthSoll > 0 || monthIst > 0 || !!monthRow?.finalized_at);
  const canOpen = hasMonthData || !!ytdRow;

  // “Notiz” nur wenn wirklich Daten da
  const noteDisabled = !hasMonthData && !ytdRow;

  // Hover handling: bleibt offen wenn Maus im Popover ist
  const closeNoteSafe = () => {
    setTimeout(() => {
      setOpenNote((prev) => (noteHover ? prev : false));
    }, 60);
  };

  // ----------------- FLACHE KALENDER-ANSICHT -----------------
  return (
    <div className="relative w-[480px]">
      <div
        ref={anchorRef}
        className="flex items-center gap-2"
        onMouseEnter={() => {
          if (noteDisabled) return;
          setOpenNote(true);
        }}
        onMouseLeave={closeNoteSafe}
      >
        <div className="flex-1">
          {loading ? (
            <div className="text-[11px] text-gray-500 dark:text-gray-300">Lade…</div>
          ) : err ? (
            <div className="text-[11px] text-red-500">{err}</div>
          ) : !hasMonthData ? (
            <div className="text-[11px] text-gray-500 dark:text-gray-300">—</div>
          ) : (
            <IstSollBulletFlat ist={monthIst} soll={monthSoll} dense />
          )}
        </div>

        {/* Icon rechts neben Bullet */}
        <button
          type="button"
          title={canOpen ? 'Groß anzeigen' : 'Keine Daten'}
          onClick={() => canOpen && setOpenModal(true)}
          disabled={!canOpen}
          className={`px-2 py-1 rounded-lg border text-xs
            ${
              canOpen
                ? 'border-gray-300 dark:border-gray-700 hover:bg-white/10'
                : 'opacity-50 cursor-not-allowed border-gray-300 dark:border-gray-700'
            }`}
        >
          ⤢
        </button>
      </div>

      {/* Hover-Notizfeld */}
      <Popover
        open={openNote && !noteDisabled}
        anchorRef={anchorRef}
        onClose={() => setOpenNote(false)}
      >
        <div
          onMouseEnter={() => setNoteHover(true)}
          onMouseLeave={() => {
            setNoteHover(false);
            setOpenNote(false);
          }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {monthName}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-300">
              {monthRow?.finalized_at ? `final: ${fmtDateTime(monthRow.finalized_at)}` : 'nicht final'}
            </div>
          </div>

          {/* Monat Details */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-2">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Monat</div>
            <StatLine label="Ist" value={`${deNumber(monthIst)} h`} emphasis />
            <StatLine label="Verfügbar" value={`${deNumber(monthSoll)} h`} />
            <StatLine label="Quote" value={monthPct == null ? '—' : `${Math.round(monthPct)}%`} />
            <StatLine
              label={monthRest >= 0 ? 'Rest bis Soll' : 'Über Soll'}
              value={`${monthRest >= 0 ? '' : '+'}${deNumber(Math.abs(monthRest))} h`}
              emphasis={monthRest < 0}
            />
          </div>

          {/* Year/YTD Kurzinfos */}
          {ytdRow && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-2">
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                Jahr (inkl. Übernahme)
              </div>
              <StatLine label="Ist inkl. Übernahme" value={`${deNumber(yearIstIncl)} h`} emphasis />
              <StatLine label="Verfügbar (Jahr)" value={`${deNumber(yearSoll)} h`} />
              <StatLine
                label="Diff (Ist+Ü − Soll)"
                value={`${yearDiffIncl >= 0 ? '+' : ''}${deNumber(yearDiffIncl)} h`}
                emphasis={yearDiffIncl > 0}
              />
              <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-300">
                YTD bis Monat: <span className="font-semibold">{ytdRow?.bis_monat ?? '—'}</span>
                {ytdPct == null ? '' : ` · ${Math.round(ytdPct)}%`}
              </div>
            </div>
          )}

          <div className="text-[11px] text-gray-500 dark:text-gray-300">
            Tipp: Klick auf ⤢ öffnet das Modal (Bullet/Gauge + Year/YTD).
          </div>
        </div>
      </Popover>

      {/* ----------------- MODAL ----------------- */}
      <Modal
        open={openModal}
        title="Ist Stunden vs. Verfügbare Stunden"
        subtitle={`${monthName} · Jahr ${jahr}`}
        onClose={() => setOpenModal(false)}
      >
        {/* Month Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Monat
            </div>
            <SmallToggle value={monthMode} onChange={setMonthMode} />
          </div>

          <div className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            {!hasMonthData ? (
              <div className="text-sm text-gray-500 dark:text-gray-300">Keine Monatsdaten verfügbar.</div>
            ) : monthMode === 'gauge' ? (
              <IstSollGauge ist={monthIst} soll={monthSoll} height={360} />
            ) : (
              <div className="max-w-3xl mx-auto">
                {/* Bullet im Modal DARF “Rest bis Soll” zeigen */}
                <div className="space-y-3">
                  <IstSollBulletFlat ist={monthIst} soll={monthSoll} dense={false} />
                  <div className="text-sm text-gray-700 dark:text-gray-200 flex items-center justify-between">
                    <div>
                      {monthRest >= 0 ? (
                        <>Rest bis Soll: <span className="font-semibold">{deNumber(monthRest)} h</span></>
                      ) : (
                        <>Über Soll: <span className="font-semibold text-red-500">+{deNumber(Math.abs(monthRest))} h</span></>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-300">
                      {monthRow?.finalized_at ? `final: ${fmtDateTime(monthRow.finalized_at)}` : 'nicht final'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* YTD / YEAR Section */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Jahr & YTD (nur im Modal)
            </div>
            <SmallToggle value={yearMode} onChange={setYearMode} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1) YTD (Gauge/Bullet) */}
            <MiniCard title={`YTD (bis Monat ${ytdRow?.bis_monat ?? '—'})`}>
              {!ytdRow ? (
                <div className="text-sm text-gray-500 dark:text-gray-300">Keine YTD-Daten.</div>
              ) : yearMode === 'gauge' ? (
                <IstSollGauge ist={ytdIst} soll={ytdSoll} height={220} />
              ) : (
                <div className="space-y-2">
                  <IstSollBulletFlat ist={ytdIst} soll={ytdSoll} />
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    Diff: <span className="font-semibold">{deNumber(Number(ytdRow?.ytd_diff ?? (ytdIst - ytdSoll)))} h</span>
                  </div>
                </div>
              )}
            </MiniCard>

            {/* 2) Ist (Jahr) inkl. Übernahme */}
            <MiniCard title="Ist (Jahr) inkl. Übernahme">
              {!ytdRow ? (
                <div className="text-sm text-gray-500 dark:text-gray-300">Keine Jahresdaten.</div>
              ) : yearMode === 'gauge' ? (
                <IstSollGauge ist={yearIstIncl} soll={yearSoll} height={220} />
              ) : (
                <div className="space-y-2">
                  <IstSollBulletFlat ist={yearIstIncl} soll={yearSoll} />
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    Ist ohne Übernahme: <span className="font-semibold">{deNumber(yearIst)} h</span>
                    <span className="mx-2 text-gray-400">|</span>
                    Übernahme: <span className="font-semibold">{deNumber(yearUe)} h</span>
                  </div>
                </div>
              )}
            </MiniCard>

            {/* 3) Differenz inkl. Übernahme */}
            <MiniCard title="Diff (Ist + Übernahme − Verfügbar)">
              {!ytdRow ? (
                <div className="text-sm text-gray-500 dark:text-gray-300">Keine Jahresdaten.</div>
              ) : (
                <div className="space-y-3">
                  <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {yearDiffIncl >= 0 ? '+' : ''}{deNumber(yearDiffIncl)}
                    <span className="text-base font-semibold text-gray-600 dark:text-gray-300"> h</span>
                  </div>

                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-2">
                    <StatLine label="Ist inkl. Übernahme" value={`${deNumber(yearIstIncl)} h`} emphasis />
                    <StatLine label="Verfügbar (Jahr)" value={`${deNumber(yearSoll)} h`} />
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-300">
                    (Rechnung: {deNumber(yearIst)} + {deNumber(yearUe)} − {deNumber(yearSoll)})
                  </div>
                </div>
              )}
            </MiniCard>
          </div>
        </div>
      </Modal>
    </div>
  );
}