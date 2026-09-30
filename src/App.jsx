import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  Hammer, Check, Plus, Lock, Trophy, Download, X, BarChart3, Users, User, Crown, Star, Target,
  Layers, Sun, Shield, Award, Clock, Droplet, BookOpen, Footprints, Flower2, Coffee, Moon,
  PenLine, Music, Dumbbell, Brain, Leaf, Heart, LogOut, AlertCircle,
} from "lucide-react";
import { api, setToken, ApiError } from "./api.js";

/* ==========================================================================
   Small pure helpers duplicated from the backend so the UI can render XP/
   level/rank without an extra round trip. The backend is the source of
   truth for every number that matters (XP, streaks); this is display only.
   ========================================================================== */
const XP_UNIT = 40;
const levelFromXp = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / XP_UNIT)) + 1;
const xpForLevel = (lvl) => XP_UNIT * (lvl - 1) * (lvl - 1);
const rankTitle = (lvl) => (lvl < 5 ? "Apprentice" : lvl < 10 ? "Journeyman" : lvl < 15 ? "Smith" : lvl < 20 ? "Master smith" : "Forgemaster");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d) => addDays(d, -((d.getDay() + 6) % 7));
const fmtTime = (hm) => { const [h, m] = hm.split(":").map(Number); return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "pm" : "am"}`; };

const FREE_LIMIT = 3;
const ICON_MAP = { droplet: Droplet, book: BookOpen, run: Footprints, flower: Flower2, coffee: Coffee, moon: Moon, pen: PenLine, music: Music, dumbbell: Dumbbell, brain: Brain, leaf: Leaf, heart: Heart };
const ICON_KEYS = Object.keys(ICON_MAP);
const COLORS = ["#C4623A", "#D9A441", "#8FA383", "#6E9C94", "#D98E8E", "#8A5A6B", "#A99BC0", "#B08968"];
const MINUTES = [5, 10, 15, 20, 30, 45, 60];
const HEAT = ["#EADFD2", "#F2CDB8", "#E39A78", "#C4623A", "#7E3A22"];
const TOKEN_KEY = "habitforge_token";

/* ==========================================================================
   Small components (mostly unchanged from the design artifact; data now
   comes from props instead of local state)
   ========================================================================== */
function HabitIcon({ name, color, size = 22 }) {
  const Ic = ICON_MAP[name] || Leaf;
  return <Ic size={size} color={color} strokeWidth={1.9} />;
}

function Arches({ width = 120 }) {
  return (
    <svg width={width} height={width * 0.54} viewBox="0 0 120 64" aria-hidden="true">
      <path d="M5 62a55 55 0 0 1 110 0" fill="none" stroke="#C4623A" strokeWidth="10" />
      <path d="M19 62a41 41 0 0 1 82 0" fill="none" stroke="#D9A441" strokeWidth="10" />
      <path d="M33 62a27 27 0 0 1 54 0" fill="none" stroke="#8FA383" strokeWidth="10" />
      <path d="M47 62a13 13 0 0 1 26 0" fill="none" stroke="#F2CDB8" strokeWidth="10" />
    </svg>
  );
}

function Bell() {
  return (
    <svg width="104" height="104" viewBox="0 0 96 96" aria-hidden="true">
      <path d="M14 36c-4 6-4 14 0 20M7 28c-7 10-7 26 0 36" fill="none" stroke="#8FA383" strokeWidth="4" strokeLinecap="round" />
      <path d="M82 36c4 6 4 14 0 20M89 28c7 10 7 26 0 36" fill="none" stroke="#8FA383" strokeWidth="4" strokeLinecap="round" />
      <circle cx="48" cy="12" r="5" fill="#D9A441" />
      <path d="M48 16c-13 0-22 9-22 22v13c0 7-4 11-9 15h62c-5-4-9-8-9-15V38c0-13-9-22-22-22z" fill="#C4623A" />
      <path d="M36 24c-6 4-8 9-8 16" fill="none" stroke="#E39A78" strokeWidth="4" strokeLinecap="round" />
      <circle cx="48" cy="80" r="7" fill="#D9A441" />
    </svg>
  );
}

function Avatar({ level, progress, size = 48 }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const gid = `ring-${size}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Level ${level}, ${Math.round(progress * 100)} percent to next level`}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#C4623A" /><stop offset="100%" stopColor="#D9A441" /></linearGradient></defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="#F2CDB8" stroke="#E6D9CB" strokeWidth="3.5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${gid})`} strokeWidth="3.5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - progress)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dy=".35em" textAnchor="middle" fill="#4A2F24" style={{ fontFamily: "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif", fontWeight: 700, fontSize: size * 0.36 }}>{level}</text>
    </svg>
  );
}

function RoutineItem({ h, burst, busy, onToggle, onEdit }) {
  const unit = h.frequency === "weekly" ? "week" : "day";
  let sub;
  if (h.streak > 0) sub = `Streak ${h.streak} ${unit}${h.streak === 1 ? "" : "s"}`;
  else sub = h.best > 0 ? `Streak lost, best ${h.best}` : "No streak yet";
  return (
    <div className={"item" + (h.done ? " isdone" : "")}>
      <span className="ckw">
        <button className={"ck" + (h.done ? " done" : "")} disabled={busy} aria-pressed={h.done}
          aria-label={h.done ? `Undo check-in for ${h.name}` : `Check in ${h.name}`} onClick={onToggle}>
          {h.done && <Check size={15} color="#FFF8EE" strokeWidth={3.2} />}
        </button>
        {burst && burst.id === h.id && (
          <span className="burst" key={burst.k} aria-hidden="true">
            {[...Array(8)].map((_, i) => <i key={i} style={{ "--a": `${i * 45}deg`, background: i % 2 ? h.color : "#D9A441" }} />)}
            <em>+{burst.xp} XP</em>
          </span>
        )}
      </span>
      <div className="card">
        <span className="tile" style={{ background: h.color + "33" }}><HabitIcon name={h.icon} color={h.color} /></span>
        <button className="ctext" onClick={onEdit} aria-label={`Edit ${h.name}`}>
          <b>{h.name}</b><small>{sub}</small>
        </button>
        <span className="dur"><Clock size={17} fill="#4A2F24" color="#FFFCF7" /><span>{h.minutes || 10} min</span></span>
      </div>
    </div>
  );
}

function HabitModal({ habit, onSave, onDelete, onClose, saving }) {
  const [name, setName] = useState(habit ? habit.name : "");
  const [icon, setIcon] = useState(habit ? habit.icon : ICON_KEYS[0]);
  const [color, setColor] = useState(habit ? habit.color : COLORS[0]);
  const [minutes, setMinutes] = useState(habit ? habit.minutes || 10 : 10);
  const [freq, setFreq] = useState(habit ? habit.frequency : "daily");
  const [confirmDel, setConfirmDel] = useState(false);
  const valid = name.trim().length > 0;
  const save = () => valid && !saving && onSave({ id: habit ? habit.id : null, name: name.trim(), icon, color, minutes, frequency: freq });
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={habit ? "Edit habit" : "New habit"} onClick={(e) => e.stopPropagation()}>
        <div className="sheethead"><h2 className="disp">{habit ? "Edit habit" : "New habit"}</h2><button className="iconbtn" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <label className="lbl" htmlFor="hname">Name</label>
        <input id="hname" className="inp" value={name} maxLength={40} autoFocus placeholder="Read for 30 minutes"
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
        <div className="lbl">Icon</div>
        <div className="picker">{ICON_KEYS.map((k) => (
          <button key={k} className={"pick" + (icon === k ? " sel" : "")} onClick={() => setIcon(k)} aria-label={`Icon ${k}`} aria-pressed={icon === k}>
            <HabitIcon name={k} color={icon === k ? color : "#77635A"} size={21} />
          </button>))}</div>
        <div className="lbl">Color</div>
        <div className="picker">{COLORS.map((c) => (
          <button key={c} className={"sw" + (color === c ? " sel" : "")} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Color ${c}`} aria-pressed={color === c} />))}</div>
        <div className="lbl">Time it takes</div>
        <div className="picker">{MINUTES.map((m) => (
          <button key={m} className={"mchip" + (minutes === m ? " sel" : "")} onClick={() => setMinutes(m)} aria-pressed={minutes === m}>{m} min</button>))}</div>
        <div className="lbl">Repeats</div>
        <div className="seg">{["daily", "weekly"].map((f) => (
          <button key={f} className={freq === f ? "on" : ""} disabled={!!habit} onClick={() => setFreq(f)}>{f === "daily" ? "Every day" : "Once a week"}</button>))}</div>
        {habit && <p className="hint">Repeat schedule can't change after creation, so your streak stays accurate.</p>}
        <div className="actions">
          <button className="btn primary" disabled={!valid || saving} onClick={save}>{saving ? "Saving…" : "Save habit"}</button>
          {habit && (confirmDel
            ? <button className="btn danger" disabled={saving} onClick={() => onDelete(habit.id)}>Delete habit and its history</button>
            : <button className="btn ghost" onClick={() => setConfirmDel(true)}>Delete habit</button>)}
        </div>
      </div>
    </div>
  );
}

function ReminderModal({ reminder, onSave, onClose, saving }) {
  const [time, setTime] = useState(reminder.time);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Daily reminder" onClick={(e) => e.stopPropagation()}>
        <div className="sheethead"><h2 className="disp">Daily reminder</h2><button className="iconbtn" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <label className="lbl" htmlFor="rtime">Remind me at</label>
        <input id="rtime" type="time" className="inp" value={time} onChange={(e) => setTime(e.target.value)} />
        <p className="hint">You'll get a nudge at this time while HabitForge is open, if habits are still waiting.</p>
        <div className="actions">
          <button className="btn primary" disabled={!time || saving} onClick={() => onSave({ on: true, time })}>Save reminder</button>
          {reminder.on && <button className="btn ghost" disabled={saving} onClick={() => onSave({ on: false, time: reminder.time })}>Turn off</button>}
        </div>
      </div>
    </div>
  );
}

function Heatmap({ counts, dailyCount, now, blurred }) {
  const CELL = 12, STEP = 15, LEFT = 28, TOP = 20;
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth; }, []);
  const start = addDays(startOfWeek(now), -52 * 7);
  const cells = []; const months = []; let lastLabel = -10;
  for (let c = 0; c < 53; c++) {
    const colStart = addDays(start, c * 7);
    if (c > 0 && colStart.getMonth() !== addDays(start, (c - 1) * 7).getMonth() && c - lastLabel >= 3) { months.push({ c, label: MONTHS[colStart.getMonth()] }); lastLabel = c; }
    for (let r = 0; r < 7; r++) {
      const d = addDays(colStart, r);
      if (d > now) continue;
      const k = dayKey(d);
      const n = counts[k] || 0;
      const lvl = n === 0 ? 0 : Math.min(4, Math.ceil(Math.min(1, n / Math.max(1, dailyCount)) * 4));
      cells.push(<rect key={k} x={LEFT + c * STEP} y={TOP + r * STEP} width={CELL} height={CELL} rx="3" fill={HEAT[lvl]}>{!blurred && <title>{`${MONTHS[d.getMonth()]} ${d.getDate()}: ${n} check-in${n === 1 ? "" : "s"}`}</title>}</rect>);
    }
  }
  const W = LEFT + 53 * STEP, H = TOP + 7 * STEP;
  return (
    <div>
      <div className="hm" ref={ref}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Check-in heatmap for the last year">
          {months.map((m) => <text key={m.c} x={LEFT + m.c * STEP} y="11" fill="#77635A" fontSize="10">{m.label}</text>)}
          {["Mon", "Wed", "Fri"].map((t, i) => <text key={t} x="0" y={TOP + i * 2 * STEP + 10} fill="#77635A" fontSize="10">{t}</text>)}
          {cells}
        </svg>
      </div>
      <div className="legend"><span>Less</span>{HEAT.map((c) => <i key={c} style={{ background: c }} />)}<span>More</span></div>
    </div>
  );
}

function ConsistencyChart({ data }) {
  return (
    <div style={{ width: "100%", height: 210 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs><linearGradient id="fillBoho" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C4623A" stopOpacity="0.4" /><stop offset="100%" stopColor="#C4623A" stopOpacity="0" /></linearGradient></defs>
          <CartesianGrid stroke="#E6D9CB" strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#77635A", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#E6D9CB" }} interval={6} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: "#77635A", fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
          <Tooltip contentStyle={{ background: "#FFFCF7", border: "1px solid #E6D9CB", borderRadius: 10, color: "#3B2A22" }} formatter={(v) => [`${v}%`, "Completed"]} labelStyle={{ color: "#77635A" }} />
          <Area type="monotone" dataKey="rate" stroke="#C4623A" strokeWidth={2.5} fill="url(#fillBoho)" dot={false} activeDot={{ r: 5, fill: "#D9A441", stroke: "#FFFCF7" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ==========================================================================
   Auth screen
   ========================================================================== */
function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);

  async function submit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const data = mode === "login"
        ? await api.login({ email, password })
        : await api.register({ name, email, password, timezone });
      onAuthed(data.token, data.user);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Couldn't reach the server. Is the backend running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hf">
      <style>{CSS}</style>
      <div className="authwrap">
        <div className="authcard">
          <div className="brand center"><Hammer size={22} color="#C4623A" /> HabitForge</div>
          <div className="seg" style={{ margin: "18px 0" }}>
            <button className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>Log in</button>
            <button className={mode === "register" ? "on" : ""} onClick={() => setMode("register")}>Sign up</button>
          </div>
          <form onSubmit={submit}>
            {mode === "register" && (
              <>
                <label className="lbl" htmlFor="nm">Name</label>
                <input id="nm" className="inp" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
              </>
            )}
            <label className="lbl" htmlFor="em">Email</label>
            <input id="em" type="email" className="inp" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label className="lbl" htmlFor="pw">Password</label>
            <input id="pw" type="password" className="inp" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            {mode === "register" && <p className="hint">At least 8 characters. Your timezone ({timezone}) is saved automatically, so streaks reset at your own midnight.</p>}
            {err && <p className="err"><AlertCircle size={15} /> {err}</p>}
            <button className="btn dark" type="submit" disabled={busy} style={{ width: "100%", marginTop: 16 }}>
              {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>
          <p className="hint" style={{ textAlign: "center", marginTop: 16 }}>
            Demo login: demo@habitforge.app / ForgeDemo123<br />(run <code>npm run seed</code> in the backend first)
          </p>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   Main dashboard
   ========================================================================== */
function Dashboard({ token, initialUser, onLogout }) {
  const [user, setUser] = useState(initialUser);
  const [habits, setHabits] = useState([]);
  const [today, setToday] = useState(dayKey(new Date()));
  const [summary, setSummary] = useState(null);
  const [dailyRate, setDailyRate] = useState([]);
  const [heatCounts, setHeatCounts] = useState(null);
  const [badges, setBadges] = useState([]);
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");

  const [tab, setTab] = useState("today");
  const [modal, setModal] = useState(null);
  const [remModal, setRemModal] = useState(false);
  const [savingHabit, setSavingHabit] = useState(false);
  const [busyHabitId, setBusyHabitId] = useState(null);
  const [burst, setBurst] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [levelUp, setLevelUp] = useState(null);

  const pushToast = (text) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((a) => [...a, { id, text }]);
    setTimeout(() => setToasts((a) => a.filter((x) => x.id !== id)), 3200);
  };
  const reportError = (e) => pushToast(e instanceof ApiError ? e.message : "Network error. Check the backend is running.");

  const loadAll = useCallback(async (silently) => {
    if (!silently) setLoading(true);
    setLoadErr("");
    try {
      const [meRes, habitsRes, summaryRes, rateRes, badgesRes, boardRes] = await Promise.all([
        api.me(), api.listHabits(), api.summary(), api.dailyRate(30), api.badges(), api.leaderboard(),
      ]);
      setUser(meRes.user);
      setHabits(habitsRes.habits);
      setToday(habitsRes.today);
      setSummary(summaryRes);
      setDailyRate(rateRes.series);
      setBadges(badgesRes.badges);
      setBoard(boardRes.board);
      if (meRes.user.isPremium) {
        try { setHeatCounts((await api.heatmap()).counts); } catch { setHeatCounts(null); }
      } else setHeatCounts(null);
    } catch (e) {
      setLoadErr(e instanceof ApiError ? e.message : "Couldn't reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(false); }, [loadAll]);
  // Re-check "today" every 30s so streaks/week-strip roll over at local midnight without a manual refresh.
  useEffect(() => {
    const t = setInterval(() => loadAll(true), 30000);
    return () => clearInterval(t);
  }, [loadAll]);

  const level = levelFromXp(user.xp);
  const into = user.xp - xpForLevel(level);
  const span = xpForLevel(level + 1) - xpForLevel(level);
  const pct = Math.min(1, into / span);
  const isPro = user.isPremium;
  const canAdd = isPro || habits.length < FREE_LIMIT;
  const reminder = user.reminder || { on: false, time: "08:00" };

  async function toggle(h) {
    setBusyHabitId(h.id);
    try {
      if (h.done) {
        const r = await api.undoCheckIn(h.id);
        setUser((u) => ({ ...u, xp: r.userXp }));
        setHabits((list) => list.map((x) => (x.id === h.id ? { ...x, done: false, streak: r.streak, best: r.best } : x)));
      } else {
        const r = await api.checkIn(h.id);
        setUser((u) => ({ ...u, xp: r.userXp }));
        setHabits((list) => list.map((x) => (x.id === h.id ? { ...x, done: true, streak: r.streak, best: r.best } : x)));
        const k = Date.now();
        setBurst({ id: h.id, xp: r.xpAwarded, k });
        setTimeout(() => setBurst((b) => (b && b.k === k ? null : b)), 1000);
        if (r.levelUp) { setLevelUp({ level: r.levelUp.to, title: rankTitle(r.levelUp.to), newRank: rankTitle(r.levelUp.to) !== rankTitle(r.levelUp.from), k }); setTimeout(() => setLevelUp((l) => (l && l.k === k ? null : l)), 3400); }
        r.newBadges.forEach((b) => pushToast(`Badge unlocked: ${b.name}`));
        if (r.newBadges.length || r.levelUp) loadAll(true); // refresh badge list / summary quietly
        else { const s = await api.summary(); setSummary(s); }
      }
    } catch (e) { reportError(e); }
    finally { setBusyHabitId(null); }
  }

  async function saveHabit(d) {
    setSavingHabit(true);
    try {
      if (d.id) {
        const r = await api.updateHabit(d.id, { name: d.name, icon: d.icon, color: d.color, minutes: d.minutes });
        setHabits((list) => list.map((x) => (x.id === d.id ? { ...x, ...r.habit } : x)));
      } else {
        await api.createHabit(d);
        await loadAll(true);
        pushToast(`"${d.name}" added`);
      }
      setModal(null);
    } catch (e) { reportError(e); } finally { setSavingHabit(false); }
  }
  async function deleteHabit(id) {
    setSavingHabit(true);
    try { await api.deleteHabit(id); setHabits((list) => list.filter((x) => x.id !== id)); setModal(null); }
    catch (e) { reportError(e); } finally { setSavingHabit(false); }
  }
  function openNew() {
    if (!canAdd) { pushToast(`The Free plan holds ${FREE_LIMIT} habits. Pro removes the limit.`); setTab("pro"); return; }
    setModal({ habit: null });
  }
  async function saveReminder(r) {
    try { const res = await api.setReminder(r); setUser(res.user); pushToast(r.on ? `Reminder set for ${fmtTime(r.time)}` : "Reminder turned off"); setRemModal(false); }
    catch (e) { reportError(e); }
  }
  async function goPremium(on) {
    try { const res = on ? await api.upgrade() : await api.downgrade(); setUser(res.user); pushToast(on ? "Pro is on. Heatmap and export are unlocked." : "Switched to the Free plan"); loadAll(true); }
    catch (e) { reportError(e); }
  }
  async function exportCsv() {
    if (!isPro) { setTab("pro"); return; }
    try {
      const blob = await api.exportCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "habitforge-history.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { reportError(e); }
  }

  const now = parseKey(today);
  const greeting = (() => { const hr = now.getHours ? new Date().getHours() : 8; return hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening"; })();
  const firstName = user.name.split(" ")[0];
  const dateLine = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const dailyHabits = habits.filter((h) => h.frequency === "daily");
  const weeklyHabits = habits.filter((h) => h.frequency === "weekly");
  const weekDays = WEEKDAYS.map((label, i) => {
    const d = addDays(startOfWeek(now), i);
    const k = dayKey(d);
    const active = dailyHabits.filter((h) => h.createdAtKey <= k);
    const done = k > today ? 0 : active.filter((h) => h.dates.includes(k)).length;
    return { k, label, n: d.getDate(), total: active.length, done, future: k > today, isToday: k === today };
  });
  const fakeCounts = useMemo(() => { const m = {}; for (let i = 0; i < 371; i++) m[dayKey(addDays(now, -i))] = Math.floor(Math.abs(Math.sin(i * 7.13 + 1)) * 5); return m; }, [today]); // eslint-disable-line

  const NAV = [
    { id: "today", label: "Today", icon: Sun }, { id: "stats", label: "Stats", icon: BarChart3 },
    { id: "friends", label: "Friends", icon: Users }, { id: "profile", label: "Profile", icon: User }, { id: "pro", label: "Pro", icon: Crown },
  ];

  if (loading) return <div className="hf"><style>{CSS}</style><div className="loadingpage">Warming up the forge…</div></div>;
  if (loadErr) return (
    <div className="hf"><style>{CSS}</style>
      <div className="loadingpage">
        <AlertCircle size={22} color="#B4432F" />
        <p style={{ margin: "10px 0 16px" }}>{loadErr}</p>
        <button className="btn dark" onClick={() => loadAll(false)}>Try again</button>
        <button className="btn ghost" style={{ marginTop: 10 }} onClick={onLogout}>Log out</button>
      </div>
    </div>
  );

  return (
    <div className="hf">
      <style>{CSS}</style>
      <div className="app">
        <main className="main">
          <div className="topbar">
            <div className="brand"><Hammer size={17} color="#C4623A" /> HabitForge</div>
            <span style={{ display: "flex", gap: 8 }}>
              <button className={"chip" + (isPro ? " pro" : "")} onClick={() => setTab("pro")}>{isPro ? <><Crown size={13} /> Pro</> : "Free plan"}</button>
              <button className="chip" onClick={onLogout} aria-label="Log out"><LogOut size={13} /></button>
            </span>
          </div>

          {tab === "today" && (
            <>
              <header className="greet">
                <div>
                  <h1 className="disp">{greeting}, {firstName}</h1>
                  <p className="date">{dateLine}</p>
                  <p className="lvltxt">Level {level} {rankTitle(level).toLowerCase()}, {(span - into).toLocaleString()} XP to level {level + 1}</p>
                </div>
                <button className="avbtn" onClick={() => setTab("profile")} aria-label="Open profile"><Avatar level={level} progress={pct} size={54} /></button>
              </header>

              <div className="week" role="group" aria-label="This week">
                {weekDays.map((w) => (
                  <div key={w.k} className={"wd" + (w.isToday ? " today" : "") + (w.future ? " future" : "") + (w.total > 0 && w.done === w.total ? " full" : "")}>
                    <small>{w.label}</small>
                    <span className="dn">{w.n}{w.done > 0 && <i className="pip" style={{ opacity: w.done === w.total ? 1 : 0.45 }} />}</span>
                  </div>
                ))}
              </div>

              <section className="remind">
                <div className="remtxt">
                  <h2 className="disp">{reminder.on ? "Reminder is on" : "Set the reminder"}</h2>
                  <p>{reminder.on ? `We'll nudge you at ${fmtTime(reminder.time)} while HabitForge is open.` : "Never miss your morning routine! Set a reminder to stay on track."}</p>
                  <button className="btn dark" onClick={() => setRemModal(true)}>{reminder.on ? "Change time" : "Set now"}</button>
                </div>
                <Bell />
              </section>

              <div className="listhead"><h2 className="disp">Daily routine</h2><span className="mute">{dailyHabits.filter((h) => h.done).length} of {dailyHabits.length} done</span></div>
              {dailyHabits.length === 0 && <p className="empty">No daily habits yet. Add one to start a streak.</p>}
              <div className="items">{dailyHabits.map((h) => (
                <RoutineItem key={h.id} h={h} burst={burst} busy={busyHabitId === h.id} onToggle={() => toggle(h)} onEdit={() => setModal({ habit: h })} />
              ))}</div>

              {weeklyHabits.length > 0 && (
                <>
                  <div className="listhead"><h2 className="disp">This week</h2><span className="mute">Once a week</span></div>
                  <div className="items">{weeklyHabits.map((h) => (
                    <RoutineItem key={h.id} h={h} burst={burst} busy={busyHabitId === h.id} onToggle={() => toggle(h)} onEdit={() => setModal({ habit: h })} />
                  ))}</div>
                </>
              )}
              <button className="addrow" onClick={openNew}>{canAdd ? <Plus size={18} /> : <Lock size={16} />} {canAdd ? "Add a habit" : "Add a habit with Pro"}</button>
              {!isPro && <p className="hint">{habits.length} of {FREE_LIMIT} habits used on the Free plan.</p>}
            </>
          )}

          {tab === "stats" && summary && (
            <>
              <h1 className="disp pgt">Stats</h1>
              <section className="sum">
                <div><b>{summary.totalCheckIns}</b><span>Check-ins</span></div>
                <div><b>{summary.liveStreak}</b><span>Live streak</span></div>
                <div><b>{summary.bestStreak}</b><span>Best streak</span></div>
                <div><b>{Math.round(dailyRate.reduce((s, x) => s + x.rate, 0) / Math.max(1, dailyRate.length))}%</b><span>30-day rate</span></div>
              </section>
              <section className="panel"><h2 className="disp">Last 30 days</h2><p className="mute">Share of your daily habits completed each day.</p>
                <ConsistencyChart data={dailyRate.map((d) => ({ label: `${MONTHS[parseKey(d.date).getMonth()]} ${parseKey(d.date).getDate()}`, rate: d.rate }))} />
              </section>
              <section className="panel"><h2 className="disp">This year</h2><p className="mute">Darker squares mean more habits done.</p>
                {isPro && heatCounts ? <Heatmap counts={heatCounts} dailyCount={Math.max(1, dailyHabits.length)} now={now} /> : (
                  <div className="locked">
                    <div className="blurme"><Heatmap counts={fakeCounts} dailyCount={4} now={now} blurred /></div>
                    <div className="lockcta"><Lock size={22} color="#A94E2B" /><p>The year heatmap is part of Pro.</p><button className="btn dark" onClick={() => setTab("pro")}>See Pro</button></div>
                  </div>
                )}
              </section>
              <section className="panel"><h2 className="disp">Your data</h2><p className="mute">Download every check-in as a CSV file.</p>
                <button className="btn ghost" onClick={exportCsv}>{isPro ? <Download size={16} /> : <Lock size={15} />} {isPro ? "Export CSV" : "Export CSV with Pro"}</button>
              </section>
            </>
          )}

          {tab === "friends" && (
            <>
              <h1 className="disp pgt">Friends</h1>
              <p className="mute">Weekly XP since Monday. The board resets every week.</p>
              <ol className="board">{board.map((p, i) => {
                const topXp = Math.max(1, board[0].xp);
                const hue = p.me ? "#C4623A" : ["#D98E8E", "#6E9C94", "#8FA383", "#D9A441"][i % 4];
                return (
                  <li key={p.name + i} className={p.me ? "me" : ""}>
                    <span className="rk disp">{i + 1}</span>
                    <span className="dot" style={{ background: hue }}>{p.name[0]}</span>
                    <span className="who"><span className="pn">{p.me ? `${p.name} (you)` : p.name}</span><span className="pbar"><i style={{ width: `${(p.xp / topXp) * 100}%`, background: hue }} /></span></span>
                    <span className="pxp">{p.xp.toLocaleString()} XP</span>
                  </li>
                );
              })}</ol>
              <p className="hint">Friends shown here are sample data. Inviting real friends needs a social graph on the server.</p>
            </>
          )}

          {tab === "profile" && (
            <>
              <h1 className="disp pgt">Profile</h1>
              <section className="panel prof">
                <Avatar level={level} progress={pct} size={92} />
                <div className="profin">
                  <h2 className="disp">{user.name}</h2>
                  <p className="rank2">{rankTitle(level)}, level {level}</p>
                  <div className="ingot"><i style={{ width: `${Math.max(3, pct * 100)}%` }} /></div>
                  <p className="mute">{into.toLocaleString()} of {span.toLocaleString()} XP to level {level + 1}</p>
                </div>
              </section>
              <p className="mute" style={{ marginTop: 10 }}>{user.xp.toLocaleString()} XP total. {user.email} · {user.timezone}</p>
              <section className="blk">
                <h2 className="disp">Badges</h2>
                <p className="mute">{badges.filter((b) => b.earned).length} of {badges.length} unlocked</p>
                <div className="badges">{badges.map((b) => (
                  <div key={b.id} className={"badge" + (b.earned ? " got" : "")}>
                    <span className="bico">{b.earned ? <Award size={20} color="#C4623A" /> : <Lock size={17} />}</span>
                    <span className="bt"><b>{b.name}</b><span>{b.description}</span>{b.earnedAt && <em>Earned {b.earnedAt}</em>}</span>
                  </div>
                ))}</div>
              </section>
            </>
          )}

          {tab === "pro" && (
            <>
              <h1 className="disp pgt">HabitForge Pro</h1>
              <p className="lead">The Free plan covers the daily loop. Pro adds the long view.</p>
              <div className="plans">
                <div className={"plan" + (!isPro ? " cur" : "")}>
                  <h2 className="disp">Free</h2><p className="price">$0</p>
                  <ul><li><Check size={16} /> Up to {FREE_LIMIT} habits</li><li><Check size={16} /> Streaks, XP, levels and badges</li><li><Check size={16} /> 30-day consistency chart</li><li><Check size={16} /> Weekly friends board</li></ul>
                  {!isPro && <span className="curtag">Your plan</span>}
                </div>
                <div className={"plan pro" + (isPro ? " cur" : "")}>
                  <div className="archwrap"><Arches width={84} /></div>
                  <h2 className="disp">Pro</h2><p className="price">$4.99 a month</p>
                  <ul><li><Check size={16} /> Everything in Free</li><li><Check size={16} /> Unlimited habits</li><li><Check size={16} /> Year heatmap</li><li><Check size={16} /> CSV export</li></ul>
                  {isPro && <span className="curtag">Your plan</span>}
                </div>
              </div>
              {isPro ? <button className="btn ghost" onClick={() => goPremium(false)}>Switch to Free (demo)</button>
                : <button className="btn dark" onClick={() => goPremium(true)}>Start Pro (demo)</button>}
              <p className="hint">This demo billing takes no payment (the backend's <code>ALLOW_DEMO_BILLING</code> flag). Swap in Stripe Checkout for production; see the backend README.</p>
            </>
          )}
        </main>

        {tab === "today" && <div className="fabwrap"><button className="fab" onClick={openNew} aria-label="Add a habit">{canAdd ? <Plus size={26} /> : <Lock size={22} />}</button></div>}
        <nav className="tabbar" aria-label="Main">{NAV.map((n) => { const Ic = n.icon; return (
          <button key={n.id} className={"tab" + (tab === n.id ? " on" : "")} onClick={() => setTab(n.id)} aria-current={tab === n.id ? "page" : undefined}><Ic size={21} /><span>{n.label}</span></button>
        ); })}</nav>
      </div>

      <div className="toasts" role="status" aria-live="polite">{toasts.map((t) => <div key={t.id} className="toast"><Award size={16} color="#D9A441" /> {t.text}</div>)}</div>

      {levelUp && (
        <div className="lvl" onClick={() => setLevelUp(null)} role="dialog" aria-label="Level up">
          <div className="lvlbox">
            <span className="sp" aria-hidden="true">{[...Array(16)].map((_, i) => <i key={i} style={{ "--a": `${i * 22.5}deg`, "--d": `${110 + (i % 3) * 22}px`, background: ["#C4623A", "#D9A441", "#8FA383", "#F2CDB8"][i % 4] }} />)}</span>
            <Arches width={150} /><div className="lvlnum disp">{levelUp.level}</div><h2 className="disp">You reached level {levelUp.level}</h2>
            {levelUp.newRank && <p className="rank3">New rank: {levelUp.title}</p>}<p className="lvlsub">Tap to keep going</p>
          </div>
        </div>
      )}
      {modal && <HabitModal habit={modal.habit} onSave={saveHabit} onDelete={deleteHabit} onClose={() => setModal(null)} saving={savingHabit} />}
      {remModal && <ReminderModal reminder={reminder} onSave={saveReminder} onClose={() => setRemModal(false)} />}
    </div>
  );
}

/* ==========================================================================
   Root: decides between the auth screen and the dashboard
   ========================================================================== */
export default function App() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = logged out, {token,user} = logged in

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) { setSession(null); return; }
    setToken(saved);
    api.me().then((r) => setSession({ token: saved, user: r.user })).catch(() => { localStorage.removeItem(TOKEN_KEY); setToken(null); setSession(null); });
  }, []);

  const handleAuthed = (token, user) => { localStorage.setItem(TOKEN_KEY, token); setToken(token); setSession({ token, user }); };
  const handleLogout = () => { localStorage.removeItem(TOKEN_KEY); setToken(null); setSession(null); };

  if (session === undefined) return <div className="hf"><style>{CSS}</style><div className="loadingpage">Warming up the forge…</div></div>;
  if (session === null) return <AuthScreen onAuthed={handleAuthed} />;
  return <Dashboard key={session.user.id} token={session.token} initialUser={session.user} onLogout={handleLogout} />;
}

/* ==========================================================================
   Styles — same boho palette as the design artifact, plus auth screen styles
   ========================================================================== */
const CSS = `
.hf{--page1:#EBDDD1;--page2:#F2D8C8;--surface:#F7F1E9;--card:#FFFCF7;--line:#E6D9CB;--text:#3B2A22;--mute:#77635A;--terra:#C4623A;--terra-d:#A94E2B;--brown:#4A2F24;--mustard:#D9A441;--sage:#8FA383;--rose:#D98E8E;--blush:#F2CDB8;--danger:#B4432F;
  min-height:100vh;background:linear-gradient(165deg,var(--page1),var(--page2) 62%,#EBD9BC);color:var(--text);font-family:"Avenir Next","Nunito","Segoe UI",system-ui,-apple-system,sans-serif;line-height:1.45;-webkit-font-smoothing:antialiased}
.hf *{box-sizing:border-box}
.hf button{font:inherit;color:inherit;cursor:pointer}
.hf .disp{font-family:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;font-weight:700}
.hf h1,.hf h2,.hf p,.hf ul,.hf ol{margin:0}
.hf button:focus-visible,.hf input:focus-visible,.hf summary:focus-visible,.hf a:focus-visible{outline:2px solid var(--terra);outline-offset:2px}
.mute{color:var(--mute);font-size:14px}
.hint{color:var(--mute);font-size:13px;margin-top:12px;max-width:60ch}
.lead{font-size:16px;margin-bottom:18px;max-width:56ch}
.err{display:flex;align-items:center;gap:6px;color:var(--danger);font-size:13.5px;margin-top:12px}
.loadingpage{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--mute);text-align:center;padding:20px}

.authwrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.authcard{width:100%;max-width:380px;background:var(--card);border-radius:26px;padding:26px 24px;box-shadow:0 24px 50px -20px rgba(74,47,36,.35)}
.brand.center{justify-content:center;font-size:18px}

.app{position:relative;max-width:460px;margin:0 auto;min-height:100vh;background:var(--surface);display:flex;flex-direction:column}
@media (min-width:600px){.hf{padding:24px 0}.app{min-height:calc(100vh - 48px);border-radius:38px;box-shadow:0 34px 70px -24px rgba(74,47,36,.4);overflow:clip}}
.main{flex:1;padding:16px 20px 28px;min-width:0}
.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.brand{display:flex;align-items:center;gap:7px;font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;font-weight:700;font-size:15px;color:var(--mute)}
.chip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);background:var(--card);border-radius:999px;padding:4px 12px;font-size:12.5px;color:var(--mute)}
.chip.pro{color:var(--terra-d);border-color:var(--blush);background:#FBEBDF}
.pgt{font-size:30px;margin-bottom:6px}

.greet{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.greet h1{font-size:29px;line-height:1.15}
.date{font-size:13.5px;color:var(--mute);margin-top:4px}
.lvltxt{font-size:12.5px;color:var(--terra-d);margin-top:3px;font-weight:600}
.avbtn{background:none;border:0;padding:0;border-radius:50%;flex:none}

.week{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin:20px 0 20px}
.wd{display:flex;flex-direction:column;align-items:center;gap:8px}
.wd small{font-size:12.5px;color:var(--mute)}
.wd .dn{position:relative;width:100%;max-width:42px;aspect-ratio:1;border-radius:50%;background:var(--card);display:grid;place-items:center;font-weight:600;font-size:15px;margin:0 auto}
.wd.full .dn{background:var(--blush)}
.wd.today .dn{box-shadow:inset 0 0 0 1.5px var(--terra)}
.wd.future .dn{color:#B3A296}
.pip{position:absolute;bottom:5px;left:50%;margin-left:-2px;width:4px;height:4px;border-radius:50%;background:var(--terra)}

.remind{display:flex;align-items:center;justify-content:space-between;gap:8px;background:linear-gradient(135deg,#F5D2BD,#EFC0A5);border-radius:24px;padding:18px 14px 18px 20px}
.remtxt{min-width:0}
.remtxt h2{font-size:19px;margin-bottom:6px}
.remtxt p{font-size:13px;color:#6B4A3C;max-width:24ch;margin-bottom:14px}

.listhead{display:flex;justify-content:space-between;align-items:baseline;margin:24px 0 10px}
.listhead h2{font-size:21px}
.items{display:flex;flex-direction:column}
.item{position:relative;display:grid;grid-template-columns:30px 1fr;gap:10px;align-items:center;padding:6px 0}
.item::before{content:"";position:absolute;left:14px;top:0;bottom:0;border-left:2px dotted #D3C2B1}
.item:first-child::before{top:50%}
.item:last-child::before{bottom:50%}
.item:only-child::before{display:none}
.ckw{position:relative;display:grid;place-items:center;z-index:1}
.ck{position:relative;width:26px;height:26px;border-radius:50%;background:var(--surface);border:2px solid #B7A798;display:grid;place-items:center;padding:0}
.ck::after{content:"";position:absolute;inset:-9px}
.ck.done{background:var(--terra);border-color:var(--terra);animation:strike .4s ease-out}
.ck:disabled{opacity:.6;cursor:default}
@keyframes strike{0%{transform:scale(.8)}55%{transform:scale(1.22)}100%{transform:scale(1)}}
.card{display:flex;align-items:center;gap:12px;background:var(--card);border-radius:20px;padding:11px 14px 11px 11px;box-shadow:0 8px 18px -12px rgba(74,47,36,.35)}
.tile{width:46px;height:46px;flex:none;border-radius:14px;display:grid;place-items:center}
.ctext{flex:1;min-width:0;background:none;border:0;padding:0;text-align:left;display:flex;flex-direction:column;gap:1px}
.ctext b{font-size:15.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ctext small{font-size:12.5px;color:var(--mute)}
.isdone .ctext b{color:var(--mute);text-decoration:line-through;text-decoration-color:#C9B8A8}
.dur{display:flex;flex-direction:column;align-items:center;gap:2px;padding-left:14px;border-left:1px solid var(--line);min-width:62px;font-size:12px;color:var(--mute)}
.burst{position:absolute;inset:0;pointer-events:none}
.burst i,.sp i{position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px;border-radius:50%;animation:fly .7s ease-out forwards}
.burst em{position:absolute;left:100%;margin-left:8px;top:-2px;font-style:normal;font-weight:700;font-size:14px;color:var(--terra-d);white-space:nowrap;animation:floatxp .95s ease-out forwards}
@keyframes fly{from{transform:rotate(var(--a)) translateX(0) scale(1);opacity:1}to{transform:rotate(var(--a)) translateX(var(--d,30px)) scale(.2);opacity:0}}
@keyframes floatxp{from{transform:translateY(0);opacity:1}to{transform:translateY(-28px);opacity:0}}
.empty{padding:20px 0;color:var(--mute)}
.addrow{width:100%;margin-top:16px;display:flex;justify-content:center;align-items:center;gap:8px;padding:13px;border:1.5px dashed #C9B8A8;border-radius:14px;background:none;color:var(--mute);font-size:15px}

.fabwrap{position:sticky;bottom:84px;height:0;z-index:15;pointer-events:none}
.fab{pointer-events:auto;position:absolute;right:20px;bottom:0;width:58px;height:58px;border-radius:50%;background:var(--brown);color:#FFF8EE;border:0;display:grid;place-items:center;box-shadow:0 14px 26px -8px rgba(74,47,36,.6)}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:999px;padding:11px 20px;font-size:14.5px;font-weight:600;border:1.5px solid transparent;text-decoration:none}
.btn.dark,.btn.primary{background:var(--brown);color:#FFF8EE}
.btn.dark{padding:9px 20px;font-size:14px}
.btn.primary:disabled,.btn.dark:disabled{opacity:.5;cursor:not-allowed}
.btn.ghost{background:transparent;border-color:#C9B8A8;color:var(--text)}
.btn.danger{background:transparent;border-color:var(--danger);color:var(--danger)}
.iconbtn{background:none;border:0;padding:6px;border-radius:8px;color:var(--mute)}
.inp{width:100%;background:var(--card);border:1.5px solid var(--line);border-radius:14px;padding:12px 14px;color:var(--text);font-size:16px;font-family:inherit;margin-bottom:4px}
.lbl{margin:14px 0 8px;font-size:13px;color:var(--mute);display:block}
.picker{display:flex;flex-wrap:wrap;gap:8px}
.pick{width:44px;height:44px;border-radius:13px;background:var(--card);border:1.5px solid var(--line);display:grid;place-items:center}
.pick.sel{border-color:var(--terra);background:#FBEBDF}
.sw{width:34px;height:34px;border-radius:50%;border:3px solid var(--surface);box-shadow:0 0 0 1.5px var(--line)}
.sw.sel{box-shadow:0 0 0 2.5px var(--brown)}
.mchip{border:1.5px solid var(--line);background:var(--card);border-radius:999px;padding:7px 14px;font-size:13.5px}
.mchip.sel{border-color:var(--terra);background:#FBEBDF;color:var(--terra-d);font-weight:600}
.seg{display:grid;grid-template-columns:1fr 1fr;border:1.5px solid var(--line);border-radius:999px;overflow:hidden;background:var(--card)}
.seg button{background:transparent;border:0;padding:11px;font-size:14.5px;color:var(--mute)}
.seg button.on{background:var(--brown);color:#FFF8EE}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}

.scrim{position:fixed;inset:0;background:rgba(59,42,34,.55);z-index:40;display:flex;align-items:flex-end;justify-content:center}
.sheet{width:100%;max-width:460px;max-height:92vh;overflow:auto;background:var(--surface);border-radius:28px 28px 0 0;padding:20px 22px 28px}
.sheethead{display:flex;justify-content:space-between;align-items:center}
.sheethead h2{font-size:23px}
@media (min-width:600px){.scrim{align-items:center}.sheet{border-radius:28px}}

.sum{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border-radius:20px;margin:14px 0 4px;padding:6px 0}
.sum>div{padding:12px 4px;text-align:center;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:2px}
.sum>div:last-child{border-right:0}
.sum b{font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;font-size:23px;color:var(--terra-d)}
.sum span{font-size:12px;color:var(--mute)}
.panel{background:var(--card);border-radius:22px;padding:18px 16px;margin-top:14px}
.panel>h2{font-size:20px;margin-bottom:2px}
.panel>.mute{margin-bottom:12px}
.blk{margin-top:28px}
.blk>h2{font-size:21px;margin-bottom:2px}
.blk>.mute{margin-bottom:12px}
.hm{overflow-x:auto;padding-bottom:6px}
.legend{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--mute);margin-top:8px}
.legend i{width:12px;height:12px;border-radius:3px;display:inline-block}
.locked{position:relative;border-radius:14px;overflow:hidden}
.blurme{filter:blur(5px);opacity:.6;pointer-events:none}
.lockcta{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(255,252,247,.55);text-align:center;padding:12px}

.board{list-style:none;padding:0;margin-top:14px;display:flex;flex-direction:column;gap:10px}
.board li{display:grid;grid-template-columns:26px 40px 1fr auto;gap:12px;align-items:center;padding:12px 14px;background:var(--card);border-radius:18px}
.board li.me{box-shadow:inset 0 0 0 2px var(--terra)}
.rk{font-size:20px;color:var(--mute);text-align:center}
.dot{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;color:#FFF8EE;font-weight:700}
.who{display:flex;flex-direction:column;gap:6px;min-width:0}
.pn{font-weight:600}
.pbar{height:6px;border-radius:3px;background:var(--line);display:block;overflow:hidden}
.pbar i{display:block;height:100%;border-radius:3px}
.pxp{font-variant-numeric:tabular-nums;font-weight:600;font-size:14px}

.prof{display:flex;gap:18px;align-items:center}
.profin{flex:1;min-width:0}
.prof h2{font-size:23px}
.rank2{color:var(--terra-d);font-weight:600;margin:2px 0 8px}
.ingot{height:10px;border-radius:999px;background:var(--line);overflow:hidden;margin-bottom:6px}
.ingot>i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--terra),var(--mustard))}
.badges{display:grid;grid-template-columns:1fr;gap:10px}
.badge{display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:18px;background:rgba(255,252,247,.55);opacity:.7}
.badge.got{opacity:1;background:var(--card)}
.bico{width:46px;height:46px;flex:none;border-radius:14px;background:var(--line);display:grid;place-items:center;color:#A6957F}
.bt{display:flex;flex-direction:column;font-size:13px;color:var(--mute)}
.bt b{font-size:15px;color:var(--text)}
.bt em{font-style:normal;color:var(--terra-d);font-size:12px;margin-top:2px}

.plans{display:grid;grid-template-columns:1fr;gap:14px;margin-bottom:20px}
.plan{position:relative;background:var(--card);border-radius:22px;padding:20px 18px}
.plan.pro{background:linear-gradient(160deg,#FBE6D8,#FFFCF7 65%)}
.plan.cur{box-shadow:inset 0 0 0 2px var(--terra)}
.plan h2{font-size:23px}
.archwrap{position:absolute;right:16px;top:18px;opacity:.95}
.price{color:var(--terra-d);font-weight:700;font-size:16px;margin:2px 0 12px}
.plan ul{list-style:none;padding:0;display:flex;flex-direction:column;gap:9px;font-size:14.5px}
.plan li{display:flex;gap:8px;align-items:center}
.plan li svg{color:var(--terra);flex:none}
.curtag{display:inline-block;margin-top:14px;font-size:12px;color:var(--terra-d);font-weight:700}

.tabbar{position:sticky;bottom:0;z-index:20;display:grid;grid-template-columns:repeat(5,1fr);background:var(--surface);border-top:1px solid var(--line);padding:6px 6px calc(6px + env(safe-area-inset-bottom))}
.tab{background:none;border:0;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 0;border-radius:14px;color:var(--mute);font-size:11.5px}
.tab.on{color:var(--terra-d);background:#FBEBDF;font-weight:600}

.toasts{position:fixed;top:12px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:8px;z-index:60;pointer-events:none;padding:0 12px}
.toast{display:flex;align-items:center;gap:8px;background:var(--brown);color:#FFF8EE;padding:10px 16px;border-radius:999px;font-size:14px;box-shadow:0 10px 24px -10px rgba(59,42,34,.6)}
.lvl{position:fixed;inset:0;z-index:70;background:rgba(59,42,34,.9);display:grid;place-items:center}
.lvlbox{position:relative;text-align:center;padding:24px;color:#FFF8EE;display:flex;flex-direction:column;align-items:center}
.lvlnum{font-size:96px;line-height:1;color:var(--mustard);margin-top:6px}
.lvlbox h2{font-size:24px;margin-top:8px}
.rank3{margin-top:6px;color:var(--blush);font-weight:600}
.lvlsub{margin-top:8px;font-size:13px;color:#CDB9AA}
.sp{position:absolute;left:50%;top:70px}
.sp i{width:8px;height:8px;margin:-4px;animation-duration:.95s}

@media (prefers-reduced-motion:reduce){.hf *,.hf *::before,.hf *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
`;
