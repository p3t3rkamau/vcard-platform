import AuthForm from "@/components/auth/AuthForm";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;
  return <AuthForm mode="reset" token={token} />;
}
