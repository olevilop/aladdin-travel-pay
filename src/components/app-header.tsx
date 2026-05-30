import { useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { LogOut, Settings, Shield, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProfileDialog } from "@/components/profile-dialog";
import { useAuth, logoutUser } from "@/lib/auth";
import { toast } from "sonner";

export function AppHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);

  async function onLogout() {
    await logoutUser();
    toast.success("Вы вышли из системы");
    router.invalidate();
    navigate({ to: "/login" });
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link to="/applications" className="flex items-center gap-2">
          <div className="flex h-7 px-1.5 items-center justify-center rounded-md bg-primary text-primary-foreground text-[10px] font-bold">
            Alladin
          </div>
          <span className="font-semibold text-foreground">Счета на оплату</span>
        </Link>
        <div className="flex items-center gap-2">
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <UserIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">{user.full_name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-medium">{user.full_name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                  <Settings className="mr-2 h-4 w-4" /> Профиль
                </DropdownMenuItem>
                {user.role === "admin" && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>
                    <Shield className="mr-2 h-4 w-4" /> Админ-панель
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onLogout}>
                  <LogOut className="mr-2 h-4 w-4" /> Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </header>
  );
}
