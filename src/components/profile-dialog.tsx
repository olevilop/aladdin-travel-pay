import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as api from "@/lib/api";
import { applyUser, useAuth } from "@/lib/auth";
import { toast } from "sonner";

export function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();

  // Форма смены email (логина)
  const [newEmail, setNewEmail] = useState(user?.email ?? "");
  const [emailPassword, setEmailPassword] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  // Форма смены пароля
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  async function onChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setSavingEmail(true);
    try {
      const updated = await api.changeEmail(emailPassword, newEmail.trim());
      applyUser(updated);
      setEmailPassword("");
      toast.success("Email обновлён");
    } catch (err: any) {
      toast.error(err.message || "Не удалось изменить email");
    } finally {
      setSavingEmail(false);
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Новые пароли не совпадают");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Пароль должен быть не короче 6 символов");
      return;
    }
    setSavingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Пароль изменён");
    } catch (err: any) {
      toast.error(err.message || "Не удалось изменить пароль");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Профиль</DialogTitle>
          <DialogDescription>Email используется как логин для входа.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onChangeEmail} className="space-y-3 border-b pb-5">
          <h3 className="text-sm font-medium text-foreground">Email (логин)</h3>
          <div className="space-y-2">
            <Label htmlFor="new-email">Новый email</Label>
            <Input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-password">Текущий пароль</Label>
            <PasswordInput
              id="email-password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              required
              placeholder="Подтвердите паролем"
            />
          </div>
          <Button type="submit" size="sm" disabled={savingEmail}>
            {savingEmail ? "Сохраняем…" : "Сохранить email"}
          </Button>
        </form>

        <form onSubmit={onChangePassword} className="space-y-3 pt-1">
          <h3 className="text-sm font-medium text-foreground">Сменить пароль</h3>
          <div className="space-y-2">
            <Label htmlFor="current-password">Текущий пароль</Label>
            <PasswordInput
              id="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="np">Новый пароль</Label>
            <PasswordInput
              id="np"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Минимум 8 символов, хотя бы одна буква и одна цифра.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp">Повторите новый пароль</Label>
            <PasswordInput
              id="cp"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" size="sm" disabled={savingPassword}>
            {savingPassword ? "Сохраняем…" : "Сменить пароль"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
