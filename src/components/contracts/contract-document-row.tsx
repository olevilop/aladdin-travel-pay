import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import * as api from "@/lib/api";
import type { ContractDocument, ContractField } from "@/types";
import { formatBytes } from "@/lib/format";
import {
  Loader2,
  Upload,
  Trash2,
  Plus,
  FileText,
  X,
} from "lucide-react";
import { toast } from "sonner";

// Открыть/скачать файл поля (как в счетах: PDF/картинки — просмотр, остальное — скачивание).
function mimeByName(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  return "";
}

export function ContractDocumentRow({
  doc,
  index,
  isAdmin,
  onChanged,
}: {
  doc: ContractDocument;
  index: number;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [addingField, setAddingField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");

  async function addField() {
    if (!newFieldLabel.trim()) {
      toast.error("Введите название поля");
      return;
    }
    try {
      await api.addContractField(doc.id, newFieldLabel.trim());
      toast.success("Поле добавлено");
      setNewFieldLabel("");
      setAddingField(false);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Не удалось добавить поле");
    }
  }

  return (
    <div className="rounded-md border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          Договор {index + 1}
          {doc.title ? ` — ${doc.title}` : ""}
        </span>
        {isAdmin && (
          <ConfirmDialog
            title="Удалить договор?"
            description="Этот договор со всеми его файлами будет удалён безвозвратно."
            onConfirm={async () => {
              await api.deleteContractDocument(doc.id);
              toast.success("Договор удалён");
              onChanged();
            }}
            trigger={
              <Button variant="ghost" size="icon" title="Удалить договор">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            }
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {doc.fields.map((f) => (
          <FieldCell key={f.id} field={f} isAdmin={isAdmin} onChanged={onChanged} />
        ))}
      </div>

      {/* Добавить своё поле */}
      <div className="mt-3">
        {addingField ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={newFieldLabel}
              onChange={(e) => setNewFieldLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addField()}
              placeholder="Название нового поля"
              className="h-8 w-56"
            />
            <Button size="sm" onClick={addField}>
              Добавить
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAddingField(false)}>
              Отмена
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => setAddingField(true)}
          >
            <Plus className="mr-1 h-4 w-4" /> Добавить поле
          </Button>
        )}
      </div>
    </div>
  );
}

function FieldCell({
  field,
  isAdmin,
  onChanged,
}: {
  field: ContractField;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // позволяем выбрать тот же файл снова
    if (!file) return;
    setBusy(true);
    try {
      await api.uploadContractFieldFile(field.id, file);
      toast.success(`Файл загружен в «${field.label}»`);
      onChanged();
    } catch (err: any) {
      toast.error(err.message || "Не удалось загрузить файл");
    } finally {
      setBusy(false);
    }
  }

  async function onView() {
    setBusy(true);
    try {
      const name = field.file!.name;
      const type = mimeByName(name);
      const raw = await api.downloadContractFieldFile(field.id);
      if (!type) {
        // скачать
        const url = URL.createObjectURL(raw);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const win = window.open("", "_blank");
        const blob = new Blob([raw], { type });
        const url = URL.createObjectURL(blob);
        if (win) win.location.href = url;
        else window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    } catch (err: any) {
      toast.error(err.message || "Не удалось открыть файл");
    } finally {
      setBusy(false);
    }
  }

  async function removeFile() {
    setBusy(true);
    try {
      await api.deleteContractFieldFile(field.id);
      toast.success("Файл удалён");
      onChanged();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isCustom = field.slot === null;

  return (
    <div className="flex flex-col rounded-md border bg-card p-2">
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className="truncate text-xs font-medium text-foreground" title={field.label}>
          {field.label}
        </span>
        {/* Удалить пользовательское поле целиком — только админ */}
        {isAdmin && isCustom && (
          <ConfirmDialog
            title="Удалить поле?"
            description={`Поле «${field.label}» и его файл будут удалены.`}
            onConfirm={async () => {
              await api.deleteContractField(field.id);
              toast.success("Поле удалено");
              onChanged();
            }}
            trigger={
              <button title="Удалить поле" className="text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            }
          />
        )}
      </div>

      {field.file ? (
        <div className="flex flex-col gap-1">
          <button
            onClick={onView}
            disabled={busy}
            className="flex items-start gap-1 text-left text-xs text-foreground hover:text-primary hover:underline disabled:opacity-60"
            title="Открыть"
          >
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{field.file.name}</span>
          </button>
          <span className="text-[10px] text-muted-foreground">
            {formatBytes(field.file.size)}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              title="Заменить файл"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Заменить"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px] text-destructive"
              onClick={removeFile}
              disabled={busy}
              title="Удалить файл"
            >
              Убрать
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-full text-xs"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Upload className="mr-1 h-3.5 w-3.5" /> Загрузить
            </>
          )}
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
        onChange={onPick}
      />
    </div>
  );
}
