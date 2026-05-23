import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import JSZip from "jszip";
import { AppHeader } from "@/components/app-header";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FileBlock } from "@/components/file-block";
import * as api from "@/lib/api";
import type { Application } from "@/types";
import { ArrowLeft, Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/applications/$id")({
  component: DetailPage,
});

const COLOR_RU = "#d62828";
const COLOR_FOREIGN = "#003566";

function DetailPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-muted/30">
        <AppHeader />
        <Detail />
      </div>
    </ProtectedRoute>
  );
}

function Detail() {
  const { id } = useParams({ from: "/applications/$id" });
  const navigate = useNavigate();
  const [app, setApp] = useState<Application | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getApplication(id);
      setApp({ ...data });
    } catch (e: any) {
      setError(e.message || "Заявка не найдена");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function onDeleteApp() {
    await api.deleteApplication(id);
    toast.success("Заявка удалена");
    navigate({ to: "/applications" });
  }

  async function onDownloadZip() {
    if (!app || app.files.length === 0) {
      toast.error("В заявке нет файлов");
      return;
    }
    setZipping(true);
    try {
      const zip = new JSZip();
      const ruDir = zip.folder("Компания РФ");
      const fDir = zip.folder("Зарубежная компания");
      for (const f of app.files) {
        const blob = await api.downloadFile(f.id);
        (f.company_type === "ru" ? ruDir : fDir)?.file(f.name, blob);
      }
      const out = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${app.number}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      toast.error(e.message || "Не удалось собрать ZIP");
    } finally {
      setZipping(false);
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-muted-foreground">{error}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/applications">← К списку заявок</Link>
        </Button>
      </main>
    );
  }

  if (!app) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const ruFiles = app.files.filter((f) => f.company_type === "ru");
  const foreignFiles = app.files.filter((f) => f.company_type === "foreign");

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/applications" className="hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Заявки
        </Link>
        <span>→</span>
        <span className="text-foreground">{app.number}</span>
      </nav>

      <div className="mt-4 flex flex-col gap-4 rounded-lg border bg-card p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">№ {app.number}</div>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{app.title}</h1>
          {app.description && (
            <p className="mt-2 text-sm text-muted-foreground">{app.description}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" onClick={onDownloadZip} disabled={zipping}>
            {zipping ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Скачать всё ZIP
          </Button>
          <ConfirmDialog
            title="Удалить заявку?"
            description={`Заявка № ${app.number} и все её файлы будут удалены безвозвратно.`}
            onConfirm={onDeleteApp}
            trigger={
              <Button variant="outline" className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Удалить заявку
              </Button>
            }
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <FileBlock
          title="Компания РФ"
          companyType="ru"
          applicationId={app.id}
          files={ruFiles}
          accentColor={COLOR_RU}
          onChanged={load}
        />
        <FileBlock
          title="Зарубежная компания"
          companyType="foreign"
          applicationId={app.id}
          files={foreignFiles}
          accentColor={COLOR_FOREIGN}
          onChanged={load}
        />
      </div>
    </main>
  );
}
