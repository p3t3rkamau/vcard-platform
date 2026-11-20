"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import styles from "./AuthForm.module.scss";

type AuthMode = "login" | "register" | "forgot" | "reset";

type Props = {
  mode: AuthMode;
  token?: string;
};

const copy: Record<AuthMode, { title: string; description: string; button: string }> = {
  login: {
    title: "Welcome back",
    description: "Sign in to manage your digital business cards.",
    button: "Sign in",
  },
  register: {
    title: "Create your account",
    description: "Start creating and sharing digital business cards for free.",
    button: "Create account",
  },
  forgot: {
    title: "Reset your password",
    description: "Enter your account email and we'll send a reset link if it exists.",
    button: "Send reset link",
  },
  reset: {
    title: "Choose a new password",
    description: "Use at least 12 characters. Your reset link is valid for 30 minutes.",
    button: "Update password",
  },
};

export default function AuthForm({ mode, token }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
          redirectTo: "/dashboard",
        });

        if (result?.error) {
          setError("Invalid email or password, or your email has not been verified.");
        } else {
          router.push(result?.url || "/dashboard");
          router.refresh();
        }
        return;
      }

      const endpoint = {
        register: "/api/auth/register",
        forgot: "/api/auth/forgot-password",
        reset: "/api/auth/reset-password",
      } as const;

      const payload =
        mode === "register"
          ? { name, email, password }
          : mode === "forgot"
            ? { email }
            : { token, password };

      const response = await fetch(endpoint[mode], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setMessage(data.message || "Request completed.");
      if (mode === "reset") {
        window.setTimeout(() => router.push("/login"), 1200);
      }
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const details = copy[mode];

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.brand}>vCard Platform</p>
        <h1 className={styles.title}>{details.title}</h1>
        <p className={styles.description}>{details.description}</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          {mode === "register" && (
            <label className={styles.field}>
              Full name
              <input className={styles.input} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={80} required />
            </label>
          )}

          {(mode === "login" || mode === "register" || mode === "forgot") && (
            <label className={styles.field}>
              Email address
              <input className={styles.input} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} required />
            </label>
          )}

          {(mode === "login" || mode === "register" || mode === "reset") && (
            <label className={styles.field}>
              {mode === "login" ? "Password" : "Password (at least 12 characters)"}
              <input className={styles.input} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? 1 : 12} maxLength={72} required />
            </label>
          )}

          {message && <p className={styles.message} role="status">{message}</p>}
          {error && <p className={styles.error} role="alert">{error}</p>}

          <button className={styles.button} type="submit" disabled={loading || (mode === "reset" && !token)}>
            {loading ? "Please wait..." : details.button}
          </button>
        </form>

        <nav className={styles.links}>
          {mode !== "login" && <Link href="/login">Sign in</Link>}
          {mode !== "register" && <Link href="/register">Create account</Link>}
          {mode !== "forgot" && mode !== "reset" && <Link href="/forgot-password">Forgot password?</Link>}
        </nav>
      </section>
    </main>
  );
}
