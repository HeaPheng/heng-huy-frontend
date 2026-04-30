import { useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import Sell from "./pages/Sell";
import Stock from "./pages/Stock";
import Sales from "./pages/Sales";
import Dashboard from "./pages/Dashboard";
import DailySalesHistory from "./pages/DailySalesHistory";
import Statements from "./pages/Statements";
import ManualInvoice from "./pages/ManualInvoice";
import Login from "./pages/Login";
import Tasks from "./pages/Tasks";
import api from "./api";

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(
    Boolean(localStorage.getItem("pos_token"))
  );
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("theme") === "dark"
  );

  const user = getStoredUser();
  const defaultPath = user.role === "staff" ? "/sell" : "/dashboard";

  function handleLoginSuccess() {
    setIsLoggedIn(true);
  }

  function handleLogoutSuccess() {
    setIsLoggedIn(false);
    setMenuOpen(false);
  }

  function toggleTheme() {
    const next = !darkMode;
    setDarkMode(next);

    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  return (
    <div className="min-h-screen bg-[#fbfdf8] text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-50">
      {isLoggedIn && (
        <>
          <DesktopMiniSidebar
            user={user}
            darkMode={darkMode}
            toggleTheme={toggleTheme}
            setMenuOpen={setMenuOpen}
          />

          <MobileTopBar
            setMenuOpen={setMenuOpen}
            darkMode={darkMode}
            toggleTheme={toggleTheme}
          />

          <Sidebar
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            darkMode={darkMode}
            toggleTheme={toggleTheme}
            onLogoutSuccess={handleLogoutSuccess}
            user={user}
          />
        </>
      )}

      <main className={isLoggedIn ? "pt-[76px] md:pt-0 md:pl-[72px]" : ""}>
        <Routes>
          <Route
            path="/login"
            element={
              isLoggedIn ? (
                <Navigate to={defaultPath} replace />
              ) : (
                <Login onLoginSuccess={handleLoginSuccess} />
              )
            }
          />

          <Route
            path="/"
            element={
              isLoggedIn ? (
                <Navigate to={defaultPath} replace />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route path="/dashboard" element={<ProtectedRoute isLoggedIn={isLoggedIn} allowRoles={["admin"]}><Dashboard /></ProtectedRoute>} />
          <Route path="/sell" element={<ProtectedRoute isLoggedIn={isLoggedIn} allowRoles={["admin", "staff"]}><Sell /></ProtectedRoute>} />
          <Route path="/manual-invoices" element={<ProtectedRoute isLoggedIn={isLoggedIn} allowRoles={["admin", "staff"]}><ManualInvoice /></ProtectedRoute>} />
          <Route path="/stock" element={<ProtectedRoute isLoggedIn={isLoggedIn} allowRoles={["admin"]}><Stock /></ProtectedRoute>} />
          <Route path="/stock/add" element={<ProtectedRoute isLoggedIn={isLoggedIn} allowRoles={["admin"]}><Stock /></ProtectedRoute>} />
          <Route path="/sales" element={<ProtectedRoute isLoggedIn={isLoggedIn} allowRoles={["admin"]}><Sales /></ProtectedRoute>} />
          <Route path="/daily-history" element={<ProtectedRoute isLoggedIn={isLoggedIn} allowRoles={["admin"]}><DailySalesHistory /></ProtectedRoute>} />
          <Route path="/statements" element={<ProtectedRoute isLoggedIn={isLoggedIn} allowRoles={["admin"]}><Statements /></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute isLoggedIn={isLoggedIn} allowRoles={["admin"]}><Tasks /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}

function ProtectedRoute({ children, isLoggedIn, allowRoles }) {
  const user = getStoredUser();

  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (allowRoles && !allowRoles.includes(user.role)) return <Navigate to="/sell" replace />;

  return children;
}

function DesktopMiniSidebar({ user, darkMode, toggleTheme, setMenuOpen }) {
  const isAdmin = user.role === "admin";

  return (
    <aside
      onMouseEnter={() => setMenuOpen(true)}
      className="print:hidden fixed left-0 top-0 z-40 hidden h-screen w-[72px] bg-[#070b18] px-3 py-4 shadow-xl md:flex md:flex-col md:items-center"
    >
      <button
        onClick={() => setMenuOpen(true)}
        className="mb-6 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-xl font-black text-white transition hover:bg-slate-700 active:scale-95"
        aria-label="បើកម៉ឺនុយ"
      >
        ☷
      </button>

      <div className="flex flex-1 flex-col items-center gap-3">
        {isAdmin && <MiniLink to="/dashboard" icon="📊" label="ផ្ទាំងគ្រប់គ្រង" />}
        <MiniLink to="/sell" icon="🧾" label="លក់" />

        <MiniLink to="/manual-invoices" icon="🧾" label="វិក្កយបត្រធម្មតា" />
        {isAdmin && (
          <>
            <MiniLink to="/stock" icon="🥔" label="ស្តុក" />
            <MiniLink to="/sales" icon="📄" label="វិក្កយបត្រទាំងអស់" />
            <MiniLink to="/daily-history" icon="📅" label="ប្រចាំថ្ងៃ" />
            <MiniLink to="/statements" icon="📑" label="របាយការណ៍" />
            <MiniLink to="/tasks" icon="✅" label="កំណត់ចំណាំ" />
          </>
        )}
      </div>

      <button
        onClick={toggleTheme}
        className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl text-lg transition hover:bg-slate-800 active:scale-95"
        aria-label="ប្ដូរពណ៌ផ្ទៃ"
      >
        {darkMode ? "☀️" : "🌙"}
      </button>

      <img
        src="/logo.png"
        alt="Heng Huy Logo"
        className="h-11 w-11 rounded-2xl bg-white object-contain p-1 shadow-sm"
      />
    </aside>
  );
}

function MiniLink({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        [
          "group relative flex h-11 w-11 items-center justify-center rounded-2xl text-lg transition active:scale-95",
          isActive
            ? "bg-green-600 text-white shadow-lg shadow-green-950/30"
            : "text-slate-300 hover:bg-slate-800 hover:text-white",
        ].join(" ")
      }
    >
      <span>{icon}</span>
      <span className="pointer-events-none absolute left-[54px] top-1/2 z-[90] hidden -translate-y-1/2 whitespace-nowrap rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white shadow-xl group-hover:block">
        {label}
      </span>
    </NavLink>
  );
}

function Sidebar({
  menuOpen,
  setMenuOpen,
  darkMode,
  toggleTheme,
  onLogoutSuccess,
  user,
}) {
  const navigate = useNavigate();
  const isAdmin = user.role === "admin";

  async function handleLogout() {
    try {
      await api.post("/logout");
    } catch { }

    localStorage.removeItem("pos_token");
    localStorage.removeItem("pos_user");
    onLogoutSuccess();
    navigate("/login", { replace: true });
  }

  return (
    <div
      className={`print:hidden fixed inset-0 z-[80] ${menuOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
    >
      <button
        className={`absolute inset-0 bg-black/45 transition-opacity duration-300 md:bg-transparent ${menuOpen ? "opacity-100 md:opacity-0" : "opacity-0"
          }`}
        onClick={() => setMenuOpen(false)}
        aria-label="បិទម៉ឺនុយ"
      />

      <aside
        onMouseLeave={() => setMenuOpen(false)}
        className={`absolute top-0 h-full w-[84%] max-w-[300px] bg-[#111827] text-white shadow-2xl transition-transform duration-300 ease-out md:left-0 md:w-[300px] ${menuOpen
          ? "right-0 translate-x-0 md:right-auto md:translate-x-0"
          : "right-0 translate-x-full md:right-auto md:-translate-x-full"
          }`}
      >
        <div className="flex h-full flex-col px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black leading-tight text-white">ម៉ឺនុយ</h2>
              <p className="text-xs font-semibold text-slate-400">Heng Huy POS</p>
            </div>

            <button
              onClick={() => setMenuOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800 text-xl font-black text-white transition hover:bg-slate-700 active:scale-95"
              aria-label="បិទម៉ឺនុយ"
            >
              ×
            </button>
          </div>

          <div className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/70 p-3">
            <img
              src="/logo.png"
              alt="Heng Huy Logo"
              className="h-11 w-11 rounded-xl bg-white object-contain p-1 shadow-sm"
            />

            <div className="min-w-0">
              <p className="truncate text-base font-black text-white">
                {user.name || "User"}
              </p>
              <p className="text-[11px] font-black uppercase tracking-wide text-green-400">
                {user.role || "staff"}
              </p>
            </div>
          </div>

          <div className="no-scrollbar flex-1 overflow-y-auto pb-2">
            <div className="space-y-2">
              {isAdmin && (
                <DrawerLink to="/dashboard" icon="📊" close={() => setMenuOpen(false)}>
                  ផ្ទាំងគ្រប់គ្រង
                </DrawerLink>
              )}

              <DrawerLink to="/sell" icon="🧾" close={() => setMenuOpen(false)}>
                លក់
              </DrawerLink>

              <DrawerLink to="/manual-invoices" icon="🧾" close={() => setMenuOpen(false)}>
                វិក្កយបត្រធម្មតា
              </DrawerLink>

              {isAdmin && (
                <>

                  <DrawerLink to="/stock" icon="🥔" close={() => setMenuOpen(false)}>
                    ស្តុក
                  </DrawerLink>

                  <DrawerLink to="/sales" icon="📄" close={() => setMenuOpen(false)}>
                    វិក្កយបត្រទាំងអស់
                  </DrawerLink>

                  <DrawerLink to="/daily-history" icon="📅" close={() => setMenuOpen(false)}>
                    របាយការណ៏ប្រចាំថ្ងៃ
                  </DrawerLink>

                  <DrawerLink to="/statements" icon="📑" close={() => setMenuOpen(false)}>
                    បង្កើតរបាយការណ៍
                  </DrawerLink>

                  <DrawerLink to="/tasks" icon="✅" close={() => setMenuOpen(false)}>
                    កំណត់ចំណាំ
                  </DrawerLink>
                </>
              )}
            </div>
          </div>

          <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
            <button
              onClick={toggleTheme}
              className="flex w-full items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-base font-black text-slate-100 transition hover:bg-slate-800 active:scale-95"
            >
              <span className="flex items-center gap-3">
                <span>{darkMode ? "☀️" : "🌙"}</span>
                <span>ពណ៌ផ្ទៃ</span>
              </span>
              <span className="text-sm">{darkMode ? "Light" : "Dark"}</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-2xl bg-red-950/40 px-4 py-3 text-left text-base font-black text-red-300 transition hover:bg-red-950/70 active:scale-95"
            >
              <span>🚪</span>
              <span>ចាកចេញ</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function MobileTopBar({ setMenuOpen, darkMode, toggleTheme }) {
  return (
    <nav className="print:hidden fixed left-0 top-0 z-40 w-full border-b border-green-100 bg-white/95 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:hidden">
      <div className="flex items-center justify-between">
        <button
          onClick={toggleTheme}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 bg-slate-100 text-xl font-black text-slate-800 shadow-sm transition active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          aria-label="ប្ដូរពណ៌ផ្ទៃ"
        >
          {darkMode ? "☀️" : "🌙"}
        </button>

        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="Heng Huy Logo"
            className="h-11 w-11 rounded-2xl bg-white object-contain p-1 shadow-sm"
          />

          <div>
            <p className="text-base font-black leading-tight text-slate-900 dark:text-white">
              Heng Huy
            </p>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              POS System
            </p>
          </div>
        </div>

        <button
          onClick={() => setMenuOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-green-200 bg-green-600 text-2xl font-black text-white shadow-sm transition active:scale-95 dark:border-green-700"
          aria-label="បើកម៉ឺនុយ"
        >
          ☰
        </button>
      </div>
    </nav>
  );
}

function DrawerLink({ to, children, close, icon }) {
  return (
    <NavLink
      to={to}
      onClick={close}
      className={({ isActive }) =>
        [
          "group flex items-center gap-3 rounded-2xl px-4 py-3 text-base font-black transition duration-200 active:scale-95",
          isActive
            ? "bg-green-600 text-white shadow-lg shadow-green-950/30"
            : "bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white",
        ].join(" ")
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={
              isActive
                ? "flex h-9 w-9 items-center justify-center rounded-xl bg-green-500 text-lg leading-none"
                : "flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-lg leading-none"
            }
          >
            {icon}
          </span>
          <span className="truncate">{children}</span>
        </>
      )}
    </NavLink>
  );
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("pos_user") || "{}");
  } catch {
    return {};
  }
}