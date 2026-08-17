import { useState } from "react";
import { login } from "../lib/api";

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(password);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-forest-800">
      <form
        onSubmit={submit}
        className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold">🦌 Wildverkauf</h1>
          <p className="text-sm text-stone-500 mt-1">Bitte Passwort eingeben.</p>
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Passwort
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={submitting || password.length === 0}
          className="w-full py-2.5 rounded-md bg-forest-700 text-white font-medium hover:bg-forest-800 disabled:opacity-50"
        >
          {submitting ? "Anmelden…" : "Anmelden"}
        </button>
      </form>
    </div>
  );
}
