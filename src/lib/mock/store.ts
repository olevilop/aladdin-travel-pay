import type { Application, InvoiceFile, User, CompanyType, Role } from "@/types";
import { nextApplicationNumber } from "@/lib/format";

// In-memory file storage. Maps fileId -> File (with Blob).
const fileBlobStore = new Map<string, File>();

interface MockDB {
  users: User[];
  applications: Application[];
}

const nowISO = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

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
      number: "2026-0001",
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
      number: "2026-0002",
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
      number: "2026-0003",
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

export function newAppNumber() {
  return nextApplicationNumber(db.applications.map((a) => a.number));
}

export function mockCurrentUser(): User {
  return adminUser;
}

export type { CompanyType, Role };
export { uid, nowISO };
