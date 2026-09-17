import { Brand } from "@/components/shared/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Brand />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_40px_-24px_rgba(0,0,0,0.15)] sm:p-9">
          {children}
        </div>
      </main>
    </div>
  );
}
