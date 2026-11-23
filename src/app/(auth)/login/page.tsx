import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AuthForm from "@/components/auth/AuthForm";

type LoginPageProps = { searchParams: Promise<{ verified?: string }> };

const notices: Record<string, { text: string; tone: "success" | "error" }> = {
  success: { text: "Your email is verified. You can sign in now.", tone: "success" },
  expired: { text: "That verification link has expired. Enter your details on the Create account page and we will send a new one.", tone: "error" },
  invalid: { text: "That verification link is not valid.", tone: "error" },
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if ((await auth())?.user?.id) redirect("/dashboard");
  const { verified } = await searchParams;
  const notice = verified ? notices[verified] : undefined;
  return <AuthForm mode="login" notice={notice} />;
}
