import type { Application, InvoiceFile, User, CompanyType, Role } from "@/types";

// In-memory file storage. Maps fileId -> File (with Blob).
const fileBlobStore = new Map<string, File>();

interface MockDB {
  users: User[];
  applications: Application[];
}

const nowISO = () => new Date().toISOString();

// Безопасный генератор id: crypto.randomUUID() доступен только в "secure context"
// (HTTPS или localhost). На обычном http:// в браузере его нет, поэтому делаем
// устойчивый фолбэк, чтобы модуль не падал при загрузке.
const uid = (): string => {
  const c: Crypto | undefined =
    typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  if (c && typeof c.getRandomValues === "function") {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
    return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
  }
  return `id-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
};

const adminUser: User = {
  id: "u-admin",
  email: "admin@alladin.club",
  full_name: "Администратор",
  role: "admin",
  is_active: true,
  created_at: "2026-01-10T09:00:00.000Z",
};

const managerUser: User = {
  id: "u-manager-1",
  email: "ivanova@alladin.club",
  full_name: "Ольга Иванова",
  role: "manager",
  is_active: true,
  created_at: "2026-02-14T12:30:00.000Z",
};

const managerUser2: User = {
  id: "u-manager-2",
  email: "petrov@alladin.club",
  full_name: "Сергей Петров",
  role: "manager",
  is_active: false,
  created_at: "2026-03-02T10:00:00.000Z",
};

function seed(): MockDB {
  const apps: Application[] = [
    {
      id: uid(),
      number: "01.05.2026",
      title: "Тур в Турцию, семья Соколовых",
      description: "Anex Tour, вылет 12.06.2026, 4 ночи",
      created_at: "2026-05-01T10:00:00.000Z",
      created_by: adminUser.id,
      files: [
        {
          id: uid(),
          application_id: "",
          company_type: "ru",
          name: "Счёт-РФ-001.pdf",
          size: 245678,
          mime: "application/pdf",
          uploaded_by: adminUser.id,
          uploaded_by_name: adminUser.full_name,
          uploaded_at: "2026-05-01T10:10:00.000Z",
          is_paid: true,
        },
        {
          id: uid(),
          application_id: "",
          company_type: "foreign",
          name: "Invoice-Anex.pdf",
          size: 312000,
          mime: "application/pdf",
          uploaded_by: managerUser.id,
          uploaded_by_name: managerUser.full_name,
          uploaded_at: "2026-05-01T11:00:00.000Z",
          is_paid: false,
        },
      ],
    },
    {
      id: uid(),
      number: "10.05.2026",
      title: "Корпоративная поездка в Дубай",
      description: "Группа 8 человек, отель Atlantis",
      created_at: "2026-05-10T14:00:00.000Z",
      created_by: managerUser.id,
      files: [
        {
          id: uid(),
          application_id: "",
          company_type: "ru",
          name: "Договор-РФ.docx",
          size: 56000,
          mime: "application/msword",
          uploaded_by: managerUser.id,
          uploaded_by_name: managerUser.full_name,
          uploaded_at: "2026-05-10T14:20:00.000Z",
          is_paid: true,
        },
        {
          id: uid(),
          application_id: "",
          company_type: "foreign",
          name: "Atlantis-Invoice.pdf",
          size: 410000,
          mime: "application/pdf",
          uploaded_by: managerUser.id,
          uploaded_by_name: managerUser.full_name,
          uploaded_at: "2026-05-10T14:25:00.000Z",
          is_paid: true,
        },
        {
          id: uid(),
          application_id: "",
          company_type: "foreign",
          name: "Transfer.xlsx",
          size: 22000,
          mime: "application/vnd.ms-excel",
          uploaded_by: managerUser.id,
          uploaded_by_name: managerUser.full_name,
          uploaded_at: "2026-05-10T14:28:00.000Z",
          is_paid: true,
        },
      ],
    },
    {
      id: uid(),
      number: "18.05.2026",
      title: "Индивидуальный тур, Мальдивы",
      description: "",
      created_at: "2026-05-18T09:30:00.000Z",
      created_by: adminUser.id,
      files: [],
    },
  ];
  for (const a of apps) for (const f of a.files) f.application_id = a.id;
  return {
    users: [adminUser, managerUser, managerUser2],
    applications: apps,
  };
}

export const db: MockDB = seed();

export const mockFiles = {
  put(id: string, file: File) {
    fileBlobStore.set(id, file);
  },
  get(id: string): File | undefined {
    return fileBlobStore.get(id);
  },
  delete(id: string) {
    fileBlobStore.delete(id);
  },
};

export function findApplication(id: string): Application | undefined {
  return db.applications.find((a) => a.id === id);
}

export function findFile(id: string): { app: Application; file: InvoiceFile } | undefined {
  for (const app of db.applications) {
    const file = app.files.find((f) => f.id === id);
    if (file) return { app, file };
  }
  return undefined;
}


export function mockCurrentUser(): User {
  return adminUser;
}

export type { CompanyType, Role };
export { uid, nowISO };
