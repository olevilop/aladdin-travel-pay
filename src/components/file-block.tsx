import { useState } from "react";
import type { InvoiceFile, CompanyType } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Trash2,
  CheckCircle2,
  Circle,
  FileText,
  FileSpreadsheet,
  FileImage,
  File as FileIcon,
  Loader2,
} from "lucide-react";
import { Dropzone, validateFile } from "@/components/dropzone";
import { formatBytes, formatDate } from "@/lib/format";
import * as api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";

function fileIcon(name: string) {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return <FileText className="h-5 w-5 text-red-600" />;
  if (n.endsWith(".doc") || n.endsWith(".docx"))
    return <FileText className="h-5 w-5 text-blue-600" />;
  if (n.endsWith(".xls") || n.endsWith(".xlsx") || n.endsWith(".csv"))
    return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
  if (n.endsWith(".png") || n.endsWith(".jpg") || n.endsWith(".jpeg"))
    return <FileImage className="h-5 w-5 text-purple-600" />;
  return <FileIcon className="h-5 w-5 text-muted-foreground" />;
}

// MIME-тип по расширению имени файла. Нужен потому, что файлы, загруженные через
// Telegram-бота, часто приходят как application/octet-stream — с таким типом
// браузер не показывает файл, а скачивает. Поэтому тип определяем сами.
function mimeByName(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".svg")) return "image/svg+xml";
  if (n.endsWith(".txt")) return "text/plain";
  return ""; // формат, который браузер показать не умеет (docx/xlsx и т.п.)
}

async function downloadAndSave(fileId: string, name: string) {
  const blob = await api.downloadFile(fileId);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Открыть файл для просмотра в новой вкладке (без сохранения в «Загрузки»).
// PDF, изображения и текст откроются прямо в браузере; форматы, которые браузер
// показать не умеет (docx/xlsx), автоматически скачиваются.
// Вкладку открываем СРАЗУ при клике (иначе блокировщик всплывающих окон её
// отменит — после await это уже вне «жеста пользователя»), а содержимое
// подставляем после загрузки.
async function openForView(fileId: string, name: string) {
  const type = mimeByName(name);
  if (!type) {
    await downloadAndSave(fileId, name);
    return;
  }
  const win = window.open("", "_blank");
  const raw = await api.downloadFile(fileId);
  // Пересобираем Blob с правильным типом — иначе браузер не покажет содержимое.
  const blob = new Blob([raw], { type });
  const url = URL.createObjectURL(blob);
  if (win) {
    win.location.href = url;
  } else {
    window.open(url, "_blank");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function FileBlock({
  title,
  companyType,
  applicationId,
  files,
  accentColor,
  onChanged,
}: {
  title: string;
  companyType: CompanyType;
  applicationId: string;
  files: InvoiceFile[];
  accentColor: string;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const role = user?.role;
  // Кто что может (фронт прячет кнопки; настоящая защита — на сервере):
  // оплачено — админ/бухгалтер; загрузка/удаление файла — админ/менеджер.
  const canTogglePaid = role === "admin" || role === "accountant";
  const canUpload = role === "admin" || role === "manager";
  const canDeleteFile = role === "admin" || role === "manager";

  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleFiles(list: File[]) {
    const valid: File[] = [];
    for (const f of list) {
      const err = validateFile(f);
      if (err) toast.error(err);
      else valid.push(f);
    }
    if (!valid.length) return;
    setUploading(true);
    try {
      for (const f of valid) {
        await api.uploadFile(applicationId, companyType, f);
      }
      toast.success(`Загружено файлов: ${valid.length}`);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }

  async function onToggle(f: InvoiceFile) {
    setBusyId(f.id);
    try {
      await api.toggleFilePaid(f.id);
      onChanged();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(f: InvoiceFile) {
    setBusyId(f.id);
    try {
      await api.deleteFile(f.id);
      toast.success("Файл удалён");
      onChanged();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function onView(f: InvoiceFile) {
    setBusyId(f.id);
    try {
      await openForView(f.id, f.name);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function onDownload(f: InvoiceFile) {
    setBusyId(f.id);
    try {
      await downloadAndSave(f.id, f.name);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className="rounded-lg border bg-card"
      style={{ borderTop: `4px solid ${accentColor}` }}
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-semibold" style={{ color: accentColor }}>
          {title}
        </h3>
        <span className="text-xs text-muted-foreground">
          {files.length} {files.length === 1 ? "файл" : "файлов"}
        </span>
      </div>
      <div className="space-y-2 p-4">
        {files.length === 0 && (
          <p className="py-2 text-center text-sm text-muted-foreground">
            Файлы ещё не загружены
          </p>
        )}
        {files.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between gap-3 rounded-md border p-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              {fileIcon(f.name)}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onView(f)}
                    disabled={busyId === f.id}
                    title="Открыть для просмотра"
                    className="truncate text-left text-sm font-medium text-foreground hover:text-primary hover:underline cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {f.name}
                  </button>
                  {f.is_paid && (
                    <Badge className="border-transparent bg-green-100 text-green-700">
                      Оплачено
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(f.size)} · {formatDate(f.uploaded_at)} ·{" "}
                  {f.uploaded_by_name}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                title="Скачать"
                onClick={() => onDownload(f)}
                disabled={busyId === f.id}
              >
                {busyId === f.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
              {canTogglePaid ? (
                <Button
                  variant="ghost"
                  size="icon"
                  title={f.is_paid ? "Снять отметку" : "Отметить оплаченным"}
                  onClick={() => onToggle(f)}
                  disabled={busyId === f.id}
                >
                  {f.is_paid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              ) : (
                // Менеджер видит статус, но не может его менять.
                f.is_paid && <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              {canDeleteFile && (
                <ConfirmDialog
                  title="Удалить файл?"
                  description={`Файл "${f.name}" будет удалён без возможности восстановления.`}
                  onConfirm={() => onDelete(f)}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Удалить"
                      disabled={busyId === f.id}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  }
                />
              )}
            </div>
          </div>
        ))}
        {canUpload && (
          <Dropzone
            onFiles={handleFiles}
            uploading={uploading}
            accentColor={accentColor}
          />
        )}
      </div>
    </div>
  );
}
