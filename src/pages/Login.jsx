import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function Login({ onLoginSuccess }) {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await api.post("/login", {
                email,
                password,
            });

            localStorage.setItem("pos_token", res.data.token);
            localStorage.setItem("pos_user", JSON.stringify(res.data.user));

            onLoginSuccess?.();

            navigate("/dashboard", { replace: true });
        } catch (err) {
            setError(err.response?.data?.message || "ចូលមិនបានទេ");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#f7faf5] px-4 py-10 text-slate-950 transition-colors dark:bg-slate-950 dark:text-white">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-md rounded-[28px] border border-green-100 bg-white p-7 shadow-2xl shadow-slate-200/70 transition-colors dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/40 sm:p-8"
            >
                <div className="mb-7 text-center">
                    <img
                        src="/logo.png"
                        alt="Heng Huy Logo"
                        className="mx-auto mb-4 h-20 w-20 rounded-3xl bg-white object-contain p-2 shadow-md"
                    />

                    <h1 className="text-3xl font-black text-slate-900 dark:text-white">
                        Heng Huy
                    </h1>

                    <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-400">
                        ចូលប្រើប្រព័ន្ធ POS
                    </p>
                </div>

                {error && (
                    <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-black text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                        {error}
                    </div>
                )}

                <label className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                    អ៊ីមែល
                </label>
                <input
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mb-5 h-13 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-900 outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-green-500 dark:focus:ring-green-950"
                    required
                />

                <label className="mb-2 block text-sm font-black text-slate-700 dark:text-slate-200">
                    ពាក្យសម្ងាត់
                </label>
                <input
                    type="password"
                    placeholder="បញ្ចូលពាក្យសម្ងាត់"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mb-6 h-13 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-bold text-slate-900 outline-none transition focus:border-green-500 focus:ring-4 focus:ring-green-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-green-500 dark:focus:ring-green-950"
                    required
                />

                <button
                    type="submit"
                    disabled={loading}
                    className="h-13 w-full rounded-2xl bg-green-600 text-lg font-black text-white shadow-lg shadow-green-600/20 transition hover:bg-green-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loading ? "កំពុងចូល..." : "ចូល"}
                </button>
            </form>
        </main>
    );
}