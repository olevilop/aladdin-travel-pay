import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PartnerList } from "@/components/contracts/partner-list";
import { useAuth } from "@/lib/auth";
import * as api from "@/lib/api";
import type { CompanyType, ContractCategory } from "@/types";
import { Folder, Loader2, Plus, Trash2, ChevronLeft, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/contracts")({
  component: ContractsPage,
});

function ContractsPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-muted/30">
        <AppHeader />
        <ContractsInner />
      </div>
    </ProtectedRoute>
  );
}

function ContractsInner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const canAccess = isAdmin || user?.can_access_contracts;

  const [companyType, setCompanyType] = useState<CompanyType>("ru");
  const [categories, setCategories] = useState<ContractCategory[] | null>(null);
  const [active, setActive] = useState<ContractCategory | null>(null);

  const loadCategories = useCallback(async () => {
    setCategories(null);
    try {
      const data = await api.listContractCategories(companyType);
      setCategories(data);
    } catch (e: any) {
      toast.error(e.message || "Не удалось загрузить категории");
      setCategories([]);
    }
  }, [companyType]);

  useEffect(() => {
    setActive(null);
    loadCategories();
  }, [loadCategories]);

  // Доступа нет — не пускаем (бэкенд тоже защищён).
  useEffect(() => {
    if (user && !canAccess) navigate({ to: "/applications" });
  }, [user, canAccess, navigate]);

  if (!canAccess) return null;

  // Внутри выбранной категории — список партнёров.
  if (active) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <button
          onClick={() => setActive(null)}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> К категориям
        </button>
        <h1 className="text-2xl font-semibold text-foreground">
          {active.name}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({companyType === "ru" ? "РФ компании" : "Зарубежные компании"})
          </span>
        </h1>
        <PartnerList category={active} isAdmin={!!isAdmin} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Договора</h1>
        <NewCategoryButton companyType={companyType} onCreated={loadCategories} />
      </div>

      {/* Переключатель РФ / Зарубежные */}
      <div className="mt-6 inline-flex rounded-lg border bg-card p-1">
        <button
          onClick={() => setCompanyType("ru")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            companyType === "ru" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          Договора с РФ компаниями
        </button>
        <button
          onClick={() => setCompanyType("foreign")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            companyType === "foreign"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground"
          }`}
        >
          Договора с зарубежными компаниями
        </button>
      </div>

      <div className="mt-6">
        {categories === null ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card p-12 text-center">
            <Folder className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-medium text-foreground">
              Пока нет категорий — создайте первую!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <CategoryCard
                key={c.id}
                category={c}
                isAdmin={!!isAdmin}
                onOpen={() => setActive(c)}
                onChanged={loadCategories}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function CategoryCard({
  category,
  isAdmin,
  onOpen,
  onChanged,
}: {
  category: ContractCategory;
  isAdmin: boolean;
  onOpen: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast.error("Введите название");
      return;
    }
    setSaving(true);
    try {
      await api.renameContractCategory(category.id, name.trim());
      toast.success("Название изменено");
      setEditing(false);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Не удалось переименовать");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-5">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            className="h-8"
          />
          <Button size="icon" className="h-8 w-8 shrink-0" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 shrink-0"
            onClick={() => {
              setName(category.name);
              setEditing(false);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="cursor-pointer transition-transform hover:-translate-y-0.5" onClick={onOpen}>
      <CardContent className="flex items-center justify-between p-5">
        <div className="flex min-w-0 items-center gap-3">
          <Folder className="h-5 w-5 shrink-0 text-primary" />
          <span className="truncate font-semibold text-foreground">{category.name}</span>
        </div>
        {isAdmin && (
          <div className="flex shrink-0 items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setName(category.name);
                setEditing(true);
              }}
              title="Переименовать"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <ConfirmDialog
              title="Удалить категорию?"
              description={`Категория «${category.name}» со всеми партнёрами, договорами и файлами будет удалена безвозвратно.`}
              onConfirm={async () => {
                await api.deleteContractCategory(category.id);
                toast.success("Категория удалена");
                onChanged();
              }}
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => e.stopPropagation()}
                  title="Удалить категорию"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NewCategoryButton({
  companyType,
  onCreated,
}: {
  companyType: CompanyType;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim()) {
      toast.error("Введите название категории");
      return;
    }
    setLoading(true);
    try {
      await api.createContractCategory(companyType, name.trim());
      toast.success("Категория создана");
      setName("");
      setOpen(false);
      onCreated();
    } catch (e: any) {
      toast.error(e.message || "Не удалось создать категорию");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" /> Новая категория
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
        placeholder="Название категории"
        className="w-56"
      />
      <Button onClick={submit} disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Создать
      </Button>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Отмена
      </Button>
    </div>
  );
}
