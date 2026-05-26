import { useAuth } from "../lib/auth";

export function Profile() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Profile</h1>
      <div className="card p-5 space-y-3">
        <Field label="Name" value={user.name} />
        <Field label="Email" value={user.email} />
        <Field label="Role" value={user.role} />
        <Field label="Plan" value={user.subscriptionTier} />
        <Field label="Credits balance" value={String(user.creditsBalance)} />
      </div>
      <p className="text-sm text-slate-500">Profile editing and password change — coming soon.</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
