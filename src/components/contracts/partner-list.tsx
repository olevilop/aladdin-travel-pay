import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ContractDocumentRow } from "@/components/contracts/contract-document-row";
import * as api from "@/lib/api";
import type { ContractCategory, ContractPartner } from "@/types";
import { Loader2, Plus, Trash2, Users, FilePlus2 } from "lucide-react";
import { toast } from "sonner";

export function PartnerList({
  category,
  isAdmin,
}: {
  category: ContractCategory;
  isAdmin: boolean;
}) {
  const [partners, setPartners] = useState<ContractPartner[] | null>(null);

  const load = useCallback(async () => {
    try {
      setPartners(await api.listContractPartners(category.id));
    } catch (e: any) {
      toast.error(e.message || "Не удалось загрузить партнёров");
      setPartners([]);
    }
  }, [category.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (partners === null) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <NewPartnerButton categoryId={category.id} onCreated={load} />

      {partners.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium text-foreground">
            Пока нет партнёров — добавьте первого!
          </p>
        </div>
      ) : (
        partners.map((p) => (
          <PartnerCard key={p.id} partner={p} isAdmin={isAdmin} onChanged={load} />
        ))
      )}
    </div>
  );
}

function PartnerCard({
  partner,
  isAdmin,
  onChanged,
}: {
  partner: ContractPartner;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [addingDoc, setAddingDoc] = useState(false);

  async function addDocument() {
    setAddingDoc(true);
    try {
      await api.createContractDocument(partner.id);
      toast.success("Договор добавлен");
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Не удалось добавить договор");
    } finally {
      setAddingDoc(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">{partner.name}</h3>
          <span className="text-xs text-muted-foreground">
            · договоров: {partner.documents.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={addDocument} disabled={addingDoc}>
            {addingDoc ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <FilePlus2 className="mr-1 h-4 w-4" />
            )}
            Добавить договор
          </Button>
          {isAdmin && (
            <ConfirmDialog
              title="Удалить партнёра?"
              description={`Партнёр «${partner.name}» со всеми договорами и файлами будет удалён безвозвратно.`}
              onConfirm={async () => {
                await api.deleteContractPartner(partner.id);
                toast.success("Партнёр удалён");
                onChanged();
              }}
              trigger={
                <Button variant="ghost" size="icon" title="Удалить партнёра">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              }
            />
          )}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {partner.documents.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">
            Нет договоров. Нажмите «Добавить договор».
          </p>
        ) : (
          partner.documents.map((doc, i) => (
            <ContractDocumentRow
              key={doc.id}
              doc={doc}
              index={i}
              isAdmin={isAdmin}
              onChanged={onChanged}
            />
          ))
        )}
      </div>
    </div>
  );
}

function NewPartnerButton({
  categoryId,
  onCreated,
}: {
  categoryId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim()) {
      toast.error("Введите название партнёра");
      return;
    }
    setLoading(true);
    try {
      await api.createContractPartner(categoryId, name.trim());
      toast.success("Партнёр добавлен");
      setName("");
      setOpen(false);
      onCreated();
    } catch (e: any) {
      toast.error(e.message || "Не удалось добавить партнёра");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" /> Добавить партнёра
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Название партнёра"
        className="w-64"
      />
      <Button onClick={submit} disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Добавить
      </Button>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Отмена
      </Button>
    </div>
  );
}
