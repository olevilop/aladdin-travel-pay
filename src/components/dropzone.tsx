import { useCallback, useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ALLOWED = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".png", ".jpg", ".jpeg"];
const MAX_SIZE = 25 * 1024 * 1024;

export function validateFile(file: File): string | null {
  const lower = file.name.toLowerCase();
  if (!ALLOWED.some((ext) => lower.endsWith(ext))) {
    return `Недопустимый формат: ${file.name}`;
  }
  if (file.size > MAX_SIZE) {
    return `Файл больше 25 МБ: ${file.name}`;
  }
  return null;
}

export function Dropzone({
  onFiles,
  uploading,
  accentColor,
}: {
  onFiles: (files: File[]) => void;
  uploading: boolean;
  accentColor: string;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      onFiles(Array.from(files));
    },
    [onFiles],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handle(e.dataTransfer.files);
      }}
      className={cn(
        "rounded-lg border-2 border-dashed p-6 text-center transition-colors",
        dragOver ? "bg-accent" : "bg-background",
      )}
      style={{ borderColor: dragOver ? accentColor : undefined }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ALLOWED.join(",")}
        className="hidden"
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = "";
        }}
      />
      <UploadCloud className="mx-auto h-8 w-8" style={{ color: accentColor }} />
      <p className="mt-2 text-sm text-foreground">
        Перетащите файлы сюда или
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Выбрать файлы
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">
        PDF, Word, Excel, CSV, PNG, JPG · до 25 МБ
      </p>
    </div>
  );
}
