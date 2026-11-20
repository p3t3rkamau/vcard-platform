import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px" }}>
      <p style={{ color: "#64748b", fontSize: 13, fontWeight: 700, letterSpacing: ".08em" }}>VCARD PLATFORM</p>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Your dashboard</h1>
      <p style={{ color: "#64748b" }}>Signed in as {session.user.email}</p>
      <p>Your account is ready. We'll build your business card workspace next.</p>
      <form action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}>
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
