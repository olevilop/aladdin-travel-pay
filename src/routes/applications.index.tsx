import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { ProtectedRoute } from "@/components/protected-route";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { NewApplicationDialog } from "@/components/new-application-dialog";
import * as api from "@/lib/api";
import type { Application } from "@/types";

import { FileText, Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/applications/")({
  component: ApplicationsPage,
});

function ApplicationsPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-muted/30">
        <AppHeader />
        <List />
      </div>
    </ProtectedRoute>
  );
}

function List() {
  const [query, setQuery] = useState("");
  const [apps, setApps] = useState<Application[] | null>(null);

  async function load(q = "") {
    setApps(null);
    const data = await api.listApplications(q);
    setApps(data);
  }

  useEffect(() => {
    const t = setTimeout(() => load(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Счета на оплату</h1>
        <NewApplicationDialog />
      </div>

      <div className="mt-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Поиск по номеру или названию"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mt-6">
        {apps === null ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : apps.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-medium text-foreground">
              {query ? "Ничего не найдено" : "Пока нет заявок — создайте первую!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => (
              <Link
                key={app.id}
                to="/applications/$id"
                params={{ id: app.id }}
                className="block transition-transform hover:-translate-y-0.5"
              >
                <Card className="h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        N {app.number}
                      </span>
                      <StatusBadge app={app} />
                    </div>
                    <h3 className="mt-2 line-clamp-2 font-semibold text-foreground">
                      {app.title}
                    </h3>
                    <div className="mt-4 text-xs text-muted-foreground">
                      {app.files.length} файлов
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
