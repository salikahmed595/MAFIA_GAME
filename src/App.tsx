import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  AudioLines,
  Check,
  ChevronRight,
  Copy,
  Eye,
  Flag,
  HelpCircle,
  Home,
  Menu,
  Moon,
  Play,
  Settings,
  Shield,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { command, identity, supabase } from "./lib/api";
import { roleInfo, validNickname, type Room } from "./lib/game";
import { newPractice, practiceStep } from "./lib/practice";
const Town = lazy(() => import("./components/Town"));
type Prefs = {
  volume: number;
  music: boolean;
  motion: boolean;
  quality: string;
};
function getPrefs(): Prefs {
  try {
    return {
      ...{
        volume: 35,
        music: false,
        motion: !matchMedia("(prefers-reduced-motion: reduce)").matches,
        quality: "high",
      },
      ...JSON.parse(localStorage.getItem("mafia-settings") || "{}"),
    };
  } catch {
    return { volume: 35, music: false, motion: true, quality: "high" };
  }
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    panel.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = panel.current?.querySelectorAll<HTMLElement>(
          "button,input,select,a[href]",
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === panel.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
function Brand() {
  return (
    <Link to="/" className="brand">
      <span className="brand-mark">M</span>
      <span>
        MAFIA<small>MIDNIGHT COUNCIL</small>
      </span>
    </Link>
  );
}
function Rules() {
  return (
    <div className="rules">
      <p>
        A social deduction game for 5–16 friends. Gather in person or use your
        own voice call. Keep your screen and role private.
      </p>
      {[
        [
          "01",
          "The town goes to sleep",
          "Mafia secretly choose a victim. The Doctor protects someone. The Detective investigates.",
        ],
        [
          "02",
          "Everyone has a story",
          "At dawn, survivors discuss the evidence. Bluff, persuade, and question your friends.",
        ],
        [
          "03",
          "Make your accusation",
          "Vote to eliminate one player. A tied vote eliminates nobody.",
        ],
        [
          "04",
          "Trust is how you win",
          "The town wins when all Mafia are out. Mafia win when they equal or outnumber everyone else.",
        ],
      ].map(([n, t, d]) => (
        <div className="rule" key={n}>
          <span>{n}</span>
          <div>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        </div>
      ))}
      <p className="muted">
        One Mafia for 5–6 players; two for 7–11; three for 12–16. Every game has
        one Doctor and one Detective. Night actions stay secret. Missing actions
        count as abstentions. Tied Mafia targets cause no kill.
      </p>
    </div>
  );
}
export default function App() {
  const [prefs, setPrefs] = useState(getPrefs);
  const [modal, setModal] = useState<"settings" | "rules" | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const [audioError, setAudioError] = useState("");
  const close = useCallback(() => setModal(null), []);
  useEffect(() => {
    localStorage.setItem("mafia-settings", JSON.stringify(prefs));
    if (audio.current) {
      audio.current.volume = prefs.volume / 100;
      if (prefs.music)
        audio.current
          .play()
          .catch(() =>
            setAudioError("Press music off, then on, to allow audio."),
          );
      else audio.current.pause();
    }
  }, [prefs]);
  return (
    <div className={prefs.motion ? "app" : "app reduce-motion"}>
      <audio ref={audio} src="/music.wav" loop preload="none" />
      <header>
        <Brand />
        <nav>
          <button onClick={() => setModal("rules")}>
            <HelpCircle size={15} /> How to play
          </button>
          <button onClick={() => setModal("settings")}>
            <Settings size={16} /> Settings
          </button>
          <span className="version">EST. AFTER DARK</span>
        </nav>
        <button
          className="mobile-menu icon-button"
          aria-label="Open menu"
          onClick={() => setModal("settings")}
        >
          <Menu />
        </button>
      </header>
      <Routes>
        <Route
          path="/"
          element={<Landing prefs={prefs} onRules={() => setModal("rules")} />}
        />
        <Route path="/room/:code" element={<GameRoom prefs={prefs} />} />
        <Route path="/practice" element={<GameRoom prefs={prefs} practice />} />
        <Route
          path="*"
          element={
            <main className="empty">
              <h1>This street leads nowhere.</h1>
              <Link className="primary" to="/">
                Return to town
              </Link>
            </main>
          }
        />
      </Routes>
      <footer>
        <span>
          BLACKTHORN COUNTY <span className="dot">·</span> EVERYONE HAS A SECRET
        </span>
        <button onClick={() => setModal("settings")}>
          <AudioLines size={14} />
          {prefs.music ? "AMBIENCE ON" : "AMBIENCE OFF"}
        </button>
        <span>PLAY TOGETHER. TRUST CAREFULLY.</span>
      </footer>
      <AnimatePresence>
        {modal && (
          <Modal
            title={
              modal === "rules"
                ? "The rules of the night"
                : "Make yourself at home"
            }
            onClose={close}
          >
            {modal === "rules" ? (
              <Rules />
            ) : (
              <div className="settings">
                <label className="setting-row">
                  <span>
                    <Volume2 size={18} /> Background music
                  </span>
                  <input
                    type="checkbox"
                    checked={prefs.music}
                    onChange={(e) => {
                      setAudioError("");
                      setPrefs({ ...prefs, music: e.target.checked });
                    }}
                  />
                </label>
                <label>
                  Music volume <strong>{prefs.volume}%</strong>
                  <input
                    aria-label="Music volume"
                    type="range"
                    min="0"
                    max="100"
                    value={prefs.volume}
                    onChange={(e) =>
                      setPrefs({ ...prefs, volume: +e.target.value })
                    }
                  />
                </label>
                {audioError && <p role="status">{audioError}</p>}
                <label className="setting-row">
                  <span>Scene animation</span>
                  <input
                    type="checkbox"
                    checked={prefs.motion}
                    onChange={(e) =>
                      setPrefs({ ...prefs, motion: e.target.checked })
                    }
                  />
                </label>
                <label className="setting-row">
                  3D quality
                  <select
                    value={prefs.quality}
                    onChange={(e) =>
                      setPrefs({ ...prefs, quality: e.target.value })
                    }
                  >
                    <option value="high">High</option>
                    <option value="low">Battery saver</option>
                  </select>
                </label>
                <button
                  className="secondary wide"
                  onClick={() => setModal("rules")}
                >
                  How to play
                </button>
                <Link className="secondary wide" to="/" onClick={close}>
                  Create or join a room
                </Link>
                <p className="muted">
                  Settings are saved on this device. Multiplayer requires an
                  internet connection.
                </p>
              </div>
            )}
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
function Landing({ prefs, onRules }: { prefs: Prefs; onRules: () => void }) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [nickname, setNickname] = useState(
    localStorage.getItem("mafia-nickname") || "",
  );
  const [code, setCode] = useState("");
  const [duration, setDuration] = useState(60);
  const [capacity, setCapacity] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  async function enter(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!validNickname(nickname)) {
      setError("Choose a nickname with 2–20 characters.");
      return;
    }
    setBusy(true);
    try {
      localStorage.setItem("mafia-nickname", nickname.trim());
      const room = await command(mode, code, {
        nickname: nickname.trim(),
        duration,
        capacity,
      });
      navigate(`/room/${room.code}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="landing">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> A SOCIAL DEDUCTION EXPERIENCE
          </div>
          <h1>
            A quiet town.
            <br />A deadly <em>secret.</em>
          </h1>
          <p className="hero-description">
            Some of you are neighbors.
            <br />
            Some of you are the reason they lock their doors.
          </p>
          <div className="hero-meta">
            <span>
              <Users size={16} /> 5–16 players
            </span>
            <span>
              <Moon size={16} /> 15–30 minutes
            </span>
            <span>
              <Shield size={16} /> Free to play
            </span>
          </div>
          <button className="text-button" onClick={onRules}>
            Learn the rules <ArrowRight size={16} />
          </button>
        </div>
        <div className="town-hero">
          <div className="moon-orb" />
          <div className="town-canvas">
            <Suspense
              fallback={
                <div className="scene-fallback">Building Blackthorn…</div>
              }
            >
              <Town motion={prefs.motion} quality={prefs.quality} />
            </Suspense>
          </div>
          <span className="scene-coordinate">35° 41′ N &nbsp; 139° 41′ E</span>
          <div className="town-label">
            <span className="live-dot" /> BLACKTHORN{" "}
            <small>Population: suspicious</small>
          </div>
          <span className="scene-caption">
            THE NIGHT IS YOUNG. YOUR ALIBI ISN’T.
          </span>
        </div>
      </section>
      <section className="play-section">
        <div className="room-card">
          <div className="tabs">
            <button
              className={mode === "create" ? "active" : ""}
              onClick={() => {
                setMode("create");
                setError("");
              }}
            >
              <Flag size={17} /> Create a room
            </button>
            <button
              className={mode === "join" ? "active" : ""}
              onClick={() => {
                setMode("join");
                setError("");
              }}
            >
              <Users size={17} /> Join a room
            </button>
          </div>
          <form onSubmit={enter}>
            <div className="form-intro">
              <h2>
                {mode === "create"
                  ? "Your table. Your suspects."
                  : "There’s a seat waiting for you."}
              </h2>
              <p>
                {mode === "create"
                  ? "Start a private game and invite your friends."
                  : "Enter the room code your host shared."}
              </p>
            </div>
            <div className="form-fields">
              <label>
                Your nickname
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={20}
                  minLength={2}
                  placeholder="What should we call you?"
                  required
                  autoComplete="nickname"
                />
              </label>
              {mode === "create" ? (
                <label>
                  Seats at the table
                  <select
                    value={capacity}
                    onChange={(e) => setCapacity(+e.target.value)}
                  >
                    {[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((n) => (
                      <option key={n} value={n}>
                        {n} players
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label>
                  Room code
                  <input
                    value={code}
                    onChange={(e) =>
                      setCode(
                        e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                      )
                    }
                    maxLength={6}
                    minLength={6}
                    placeholder="ABC123"
                    required
                    autoCapitalize="characters"
                  />
                </label>
              )}
            </div>
            {mode === "create" && (
              <label className="duration">
                Time per phase
                <select
                  value={duration}
                  onChange={(e) => setDuration(+e.target.value)}
                >
                  <option value={30}>Quick · 30 seconds</option>
                  <option value={60}>Classic · 60 seconds</option>
                  <option value={120}>Thoughtful · 120 seconds</option>
                </select>
              </label>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary wide" disabled={busy}>
              {busy
                ? "Finding your table…"
                : mode === "create"
                  ? "Create private room"
                  : "Join the council"}
              <ArrowRight size={18} />
            </button>
            <p className="privacy">
              <Shield size={12} /> No account needed. Just a good poker face.
            </p>
          </form>
        </div>
        <div className="beside-card">
          <div className="section-kicker">
            TRUST NO ONE. PLAY WITH EVERYONE.
          </div>
          <h2>
            Good friends.
            <br />
            <em>Questionable intentions.</em>
          </h2>
          <p>
            Secret identities. Late-night decisions. A vote that changes
            everything. The classic party game, brought to your screen.
          </p>
          <div className="feature-pills">
            <span>Private rooms</span>
            <span>Secret roles</span>
            <span>Live multiplayer</span>
          </div>
          <Link to="/practice" className="practice-link">
            <span className="play-icon">
              <Play size={16} />
            </span>
            <span>
              New in town?<small>Try a solo practice game with bots</small>
            </span>
            <ChevronRight size={20} />
          </Link>
        </div>
      </section>
      <section className="roles-section">
        <div className="roles-heading">
          <span className="section-kicker">FOUR ROLES. COUNTLESS ALIBIS.</span>
          <span>Your role is yours to keep.</span>
        </div>
        <div className="role-grid">
          {Object.entries(roleInfo).map(([key, role]) => (
            <article className={`role-card ${key}`} key={key}>
              <span className="role-symbol">{role.symbol}</span>
              <div>
                <h3>{role.name}</h3>
                <p>{role.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
function GameRoom({
  prefs,
  practice = false,
}: {
  prefs: Prefs;
  practice?: boolean;
}) {
  const { code: rawCode } = useParams();
  const navigate = useNavigate();
  const code = (rawCode || "").toUpperCase();
  const [room, setRoom] = useState<Room | null>(() =>
    practice ? newPractice() : null,
  );
  const [user, setUser] = useState(practice ? "0" : "");
  const [nickname, setNickname] = useState(
    localStorage.getItem("mafia-nickname") || "",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [target, setTarget] = useState("");
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  const [copied, setCopied] = useState(false);
  const [connection, setConnection] = useState("Connecting");
  const inFlight = useRef(false);
  const accept = useCallback((r: Room) => {
    setRoom(r);
    setOffset(Date.parse(r.server_now) - Date.now());
    setConnection("Connected");
  }, []);
  const refresh = useCallback(async () => {
    if (practice || inFlight.current) return;
    inFlight.current = true;
    try {
      accept(await command("state", code));
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setConnection("Reconnecting");
    } finally {
      inFlight.current = false;
    }
  }, [accept, code, practice]);
  useEffect(() => {
    if (practice) return;
    setRoom(null);
    identity()
      .then((id) => {
        setUser(id);
        void refresh();
      })
      .catch((e) => setError(e.message));
    const channel = supabase
      ?.channel(`room-${code}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `code=eq.${code}`,
        },
        () => void refresh(),
      )
      .subscribe();
    const poll = setInterval(() => void refresh(), 3000);
    return () => {
      clearInterval(poll);
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [code, practice, refresh]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setTarget("");
    setReveal(false);
  }, [room?.phase, room?.round]);
  async function act(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    try {
      if (practice) {
        if (action === "restart") {
          setRoom(newPractice());
        } else if (action === "submit") {
          setRoom((r) => ({
            ...r!,
            submitted: true,
            investigation: target
              ? `${r!.players.find((p) => p.id === target)?.nickname} is ${["1", "6"].includes(target) ? "Mafia" : "not Mafia"}.`
              : null,
          }));
        } else setRoom((r) => practiceStep(r!, target || undefined));
      } else if (action === "leave") {
        await command(action, code);
        navigate("/");
      } else accept(await command(action, code, payload));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!room)
    return (
      <main className="join-page">
        <Link to="/" className="text-button">
          <Home size={16} /> Back to town
        </Link>
        <div className="room-card">
          <h1>Join the council</h1>
          <p>
            Room <strong>{code}</strong>
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              localStorage.setItem("mafia-nickname", nickname.trim());
              void act("join", { nickname: nickname.trim() });
            }}
          >
            <label>
              Your nickname
              <input
                required
                minLength={2}
                maxLength={20}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Your nickname"
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary wide" disabled={busy}>
              Take your seat <ArrowRight size={17} />
            </button>
          </form>
        </div>
      </main>
    );
  const me = room.players.find((p) => p.id === user);
  const host = room.host_id === user;
  const seconds = room.deadline
    ? Math.max(0, Math.ceil((Date.parse(room.deadline) - now - offset) / 1000))
    : 0;
  const canAct =
    me?.alive &&
    !room.submitted &&
    (room.phase === "voting" ||
      (room.phase === "night" && room.role !== "villager"));
  const role = room.role ? roleInfo[room.role] : null;
  return (
    <main className="game-page">
      <div className="game-top">
        <Link className="text-button" to="/">
          <Home size={16} /> Town square
        </Link>
        <span className="eyebrow">
          <span />
          {practice ? "PRACTICE · BOTS" : connection.toUpperCase()}
        </span>
        <span className="room-code">
          {room.code}
          <button
            className="icon-button"
            aria-label="Copy room link"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setError("Copy the room link from your browser address bar.");
              }
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </span>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {practice && (
        <div className="practice-notice">
          Solo practice · You are the Detective. Bots act when you advance a
          phase.{" "}
          <Link to="/">
            Play with friends <ArrowRight size={14} />
          </Link>
        </div>
      )}
      <div className="game-layout">
        <section className="council">
          <div className="council-heading">
            <div className="section-kicker">
              {room.phase === "lobby"
                ? "GATHER YOUR PEOPLE"
                : `ROUND ${room.round} · BLACKTHORN`}
            </div>
            <h1>
              {
                {
                  lobby: "The table is waiting.",
                  night: "The town falls silent.",
                  discussion: "Someone knows something.",
                  voting: "Make your accusation.",
                  finished:
                    room.winner === "town"
                      ? "The town sees another dawn."
                      : "The night belongs to Mafia.",
                }[room.phase]
              }
            </h1>
            <p>
              {room.phase === "lobby"
                ? `Share your link. ${room.players.length} of ${room.capacity} seats filled.`
                : room.phase === "night"
                  ? "Keep your role secret. Make your move."
                  : room.phase === "discussion"
                    ? "Talk with your friends in person or on your voice call."
                    : room.phase === "voting"
                      ? "Choose a suspect below. Your final vote cannot be changed."
                      : "Every secret is out. Play again with the same council."}
            </p>
          </div>
          <div className="game-town">
            <Suspense fallback={null}>
              <Town motion={prefs.motion} quality={prefs.quality} />
            </Suspense>
            {room.deadline && room.phase !== "finished" && (
              <div className="timer">
                <span>
                  {String(Math.floor(seconds / 60)).padStart(2, "0")}:
                  {String(seconds % 60).padStart(2, "0")}
                </span>
                <small>{room.phase.toUpperCase()}</small>
              </div>
            )}
          </div>
          <div className="players-grid">
            {room.players.map((p, i) => (
              <button
                key={p.id}
                disabled={
                  !canAct ||
                  !p.alive ||
                  (p.id === user &&
                    (room.phase === "voting" || room.role !== "doctor")) ||
                  (room.phase === "night" &&
                    room.role === "mafia" &&
                    room.allies.includes(p.id))
                }
                onClick={() => setTarget(p.id)}
                className={`player ${!p.alive ? "eliminated" : ""} ${target === p.id ? "selected" : ""}`}
              >
                <span className={`avatar a${i % 5}`}>
                  {p.nickname.slice(0, 1).toUpperCase()}
                </span>
                <strong>
                  {p.nickname}
                  {p.id === user ? " (you)" : ""}
                </strong>
                <small>
                  {p.role
                    ? roleInfo[p.role].name
                    : !p.alive
                      ? "Eliminated"
                      : room.phase === "lobby"
                        ? p.ready
                          ? "Ready"
                          : "Getting ready"
                        : room.allies.includes(p.id)
                          ? "Your Mafia ally"
                          : "In the council"}
                </small>
                {target === p.id && <Check size={15} />}
              </button>
            ))}
          </div>
        </section>
        <aside className="game-sidebar">
          {role && (
            <section className={`secret-card ${room.role}`}>
              <div className="section-kicker">
                <Shield size={13} /> FOR YOUR EYES ONLY
              </div>
              <button
                className="reveal"
                onClick={() => setReveal(!reveal)}
                aria-label={reveal ? "Hide role" : "Reveal role"}
              >
                <span className="role-symbol">
                  {reveal ? role.symbol : "?"}
                </span>
                <h2>{reveal ? role.name : "Your secret identity"}</h2>
                <span>
                  <Eye size={14} /> {reveal ? "Tap to hide" : "Tap to reveal"}
                </span>
              </button>
              {reveal && <p>{role.description}</p>}
            </section>
          )}
          <section className="action-card">
            <h3>
              {room.phase === "lobby"
                ? "Before the first night"
                : room.phase === "finished"
                  ? "Case closed"
                  : "Your next move"}
            </h3>
            {room.phase === "lobby" ? (
              <>
                <p>
                  At least 5 players must join. Everyone needs to be ready
                  before the host can start.
                </p>
                <button
                  className="secondary wide"
                  disabled={busy}
                  onClick={() => void act("ready")}
                >
                  {me?.ready ? "Cancel ready" : "I’m ready"}
                </button>
                {host && (
                  <button
                    className="primary wide"
                    disabled={
                      busy ||
                      room.players.length < 5 ||
                      room.players.some((p) => !p.ready)
                    }
                    onClick={() => void act("start")}
                  >
                    Start the night <Moon size={16} />
                  </button>
                )}
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => void act("leave")}
                >
                  Leave this table
                </button>
              </>
            ) : room.phase === "finished" ? (
              <>
                {host && (
                  <button
                    className="primary wide"
                    disabled={busy}
                    onClick={() => void act("restart")}
                  >
                    Play again <ArrowRight size={16} />
                  </button>
                )}
                <p>
                  {host
                    ? "A fresh round. A new identity."
                    : "Waiting for the host to start a new game."}
                </p>
              </>
            ) : (
              <>
                {!me?.alive ? (
                  <p>
                    You’ve been eliminated. Watch the story unfold, and keep
                    your secrets until the end.
                  </p>
                ) : room.submitted ? (
                  <p className="success">
                    <Check size={16} /> Your choice is locked in.
                  </p>
                ) : canAct ? (
                  <>
                    <p>
                      {room.phase === "voting"
                        ? "Select a living suspect, then confirm your vote."
                        : room.role === "doctor"
                          ? "Choose someone to protect tonight."
                          : room.role === "detective"
                            ? "Choose someone to investigate."
                            : "Choose a victim. Mafia ties result in no kill."}
                    </p>
                    <button
                      className="primary wide"
                      disabled={!target || busy || (!practice && seconds === 0)}
                      onClick={() => void act("submit", { target })}
                    >
                      Confirm {room.phase === "voting" ? "vote" : "choice"}{" "}
                      <Check size={16} />
                    </button>
                  </>
                ) : (
                  <p>
                    {room.phase === "discussion"
                      ? "Share what you know. Listen for contradictions. Voting opens when the timer ends."
                      : "You have no action right now. Wait for the town to wake."}
                  </p>
                )}
                {room.investigation && (
                  <div className="investigation">
                    <Eye size={16} />
                    {room.investigation}
                  </div>
                )}
                {practice && (
                  <button
                    className="secondary wide"
                    disabled={busy}
                    onClick={() => void act("advance")}
                  >
                    Advance practice phase <ChevronRight size={16} />
                  </button>
                )}
              </>
            )}
          </section>
          <section className="event-card">
            <h3>The town chronicle</h3>
            <div className="events" aria-live="polite">
              {room.log
                .slice(-8)
                .reverse()
                .map((line, i) => (
                  <p key={`${line}-${i}`}>
                    <span />
                    {line}
                  </p>
                ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
