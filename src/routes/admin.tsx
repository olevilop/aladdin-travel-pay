import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, MoreHorizontal, Plus } from "lucide-react";
import * as api from "@/lib/api";
import type { Role, User } from "@/types";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-muted/30">
        <AppHeader />
        <Panel />
      </div>
    </ProtectedRoute>
  );
}

function Panel() {
  const [users, setUsers] = useState<User[] | null>(null);

  async function load() {
    setUsers(await api.listUsers());
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Админ-панель</h1>
        <NewUserDialog onCreated={load} />
      </div>

      <div className="mt-6 rounded-lg border bg-card">
        {users === null ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Имя</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Договора</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.full_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {u.role === "admin" ? "Администратор" : "Менеджер"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.is_active ? (
                      <Badge className="border-transparent bg-green-100 text-green-700">
                        Активен
                      </Badge>
                    ) : (
                      <Badge className="border-transparent bg-red-100 text-red-700">
                        Заблокирован
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.role === "admin" || u.can_access_contracts ? (
                      <Badge className="border-transparent bg-blue-100 text-blue-700">
                        Есть доступ
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(u.created_at)}
                  </TableCell>
                  <TableCell>
                    <UserRowActions user={u} onChanged={load} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </main>
  );
}

function UserRowActions({ user, onChanged }: { user: User; onChanged: () => void }) {
  const { user: me } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [resetting, setResetting] = useState(false);

  async function changeRole() {
    const next: Role = user.role === "admin" ? "manager" : "admin";
    await api.updateUserRole(user.id, next);
    toast.success(`Роль изменена: ${next === "admin" ? "Администратор" : "Менеджер"}`);
    onChanged();
  }
  async function toggleActive() {
    await api.toggleUserActive(user.id);
    toast.success(user.is_active ? "Пользователь заблокирован" : "Пользователь разблокирован");
    onChanged();
  }
  async function toggleContracts() {
    const updated = await api.toggleUserContracts(user.id);
    toast.success(
      updated.can_access_contracts
        ? "Доступ к Договорам выдан"
        : "Доступ к Договорам убран",
    );
    onChanged();
  }
  async function onDelete() {
    try {
      await api.deleteUser(user.id);
      toast.success("Пользователь удалён");
      onChanged();
    } catch (e: any) {
      toast.error(e.message || "Не удалось удалить");
    }
  }
  async function onResetPassword() {
    setResetting(true);
    try {
      await api.resetUserPassword(user.id, newPass);
      toast.success("Пароль изменён. Передайте его пользователю.");
      setResetOpen(false);
      setNewPass("");
    } catch (e: any) {
      toast.error(e.message || "Не удалось сменить пароль");
    } finally {
      setResetting(false);
    }
  }
  const isAdmin = user.role === "admin";
  const isSelf = me?.id === user.id;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={changeRole}>Сменить роль</DropdownMenuItem>
          <DropdownMenuItem onClick={toggleActive}>
            {user.is_active ? "Заблокировать" : "Разблокировать"}
          </DropdownMenuItem>
          {!isAdmin && (
            <DropdownMenuItem onClick={toggleContracts}>
              {user.can_access_contracts
                ? "Убрать доступ к Договорам"
                : "Выдать доступ к Договорам"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setResetOpen(true)}>
            Сбросить пароль
          </DropdownMenuItem>
          {!isSelf && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              Удалить пользователя
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый пароль для {user.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reset-pw">Новый пароль</Label>
            <PasswordInput
              id="reset-pw"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Минимум 8 символов, хотя бы одна буква и одна цифра. Передайте этот пароль
              пользователю — он сможет войти и сменить его в Профиле.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Отмена
            </Button>
            <Button onClick={onResetPassword} disabled={resetting}>
              {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сменить пароль
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Удалить пользователя?"
        description={`Пользователь «${user.full_name}» (${user.email}) будет удалён. Его заявки и файлы останутся. Действие необратимо.`}
        onConfirm={onDelete}
      />
    </>
  );
}

function NewUserDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("manager");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !name || !password) {
      toast.error("Заполните все поля");
      return;
    }
    setLoading(true);
    try {
      await api.createUser(email, name, role, password);
      toast.success("Сотрудник добавлен");
      setOpen(false);
      setEmail("");
      setName("");
      setPassword("");
      setRole("manager");
      onCreated();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" /> Добавить сотрудника
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый сотрудник</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ne">Email</Label>
            <Input id="ne" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nn">Имя</Label>
            <Input id="nn" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="np">Временный пароль</Label>
            <PasswordInput
              id="np"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Минимум 8 символов, хотя бы одна буква и одна цифра.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Роль</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Менеджер</SelectItem>
                <SelectItem value="admin">Администратор</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Создать
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
