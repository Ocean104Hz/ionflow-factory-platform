"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

type AccessUser = {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  active: boolean;
  roleIds: readonly string[];
};
type AccessRole = {
  id: string;
  code: string;
  name: string;
  system: boolean;
  active: boolean;
  moduleKeys: readonly string[];
};
type AccessModule = {
  key: string;
  title: string;
  group: string;
  href: string;
  sortOrder: number;
};
type AccessData = {
  users: readonly AccessUser[];
  roles: readonly AccessRole[];
  modules: readonly AccessModule[];
};

const emptyData: AccessData = { users: [], roles: [], modules: [] };
const newUser = {
  firebaseUid: "",
  email: "",
  displayName: "",
  active: true,
  roleIds: [] as string[],
};

function csrfToken(): string {
  const raw = document.cookie
    .split("; ")
    .find((part) => part.startsWith("ionflow_factory_csrf="))
    ?.slice("ionflow_factory_csrf=".length);
  return raw ? decodeURIComponent(raw) : "";
}

export function UserSettings({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [data, setData] = useState<AccessData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState(newUser);
  const [userDialog, setUserDialog] = useState<{ userId?: string } | null>(
    null,
  );
  const [userWork, setUserWork] = useState<"save" | "password" | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [passwordSent, setPasswordSent] = useState(false);
  const [sendOnCreate, setSendOnCreate] = useState(false);
  const dialogOpener = useRef<HTMLButtonElement | null>(null);
  const [role, setRole] = useState({
    id: "",
    code: "",
    name: "",
    active: true,
    moduleKeys: [] as string[],
    system: false,
  });

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    let active = true;
    fetch("/api/admin/access", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        const result = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(result?.message ?? "อ่านข้อมูลสิทธิ์ไม่สำเร็จ");
        return result as AccessData;
      })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "อ่านข้อมูลสิทธิ์ไม่สำเร็จ",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const modulesByGroup = useMemo(() => {
    const grouped = new Map<string, AccessModule[]>();
    for (const accessModule of data.modules) {
      const items = grouped.get(accessModule.group) ?? [];
      items.push(accessModule);
      grouped.set(accessModule.group, items);
    }
    return [...grouped.entries()];
  }, [data.modules]);

  function updateData(result: AccessData, success: string) {
    setData(result);
    setDirty(false);
    setError("");
    setMessage(success);
  }

  function openUserDialog(opener: HTMLButtonElement | null, item?: AccessUser) {
    dialogOpener.current = opener;
    setUser(
      item
        ? {
            firebaseUid: item.firebaseUid,
            email: item.email,
            displayName: item.displayName,
            active: item.active,
            roleIds: item.roleIds.filter((id) =>
              data.roles.some(
                (candidate) => candidate.id === id && candidate.active,
              ),
            ),
          }
        : newUser,
    );
    setDialogError("");
    setPasswordSent(false);
    setSendOnCreate(false);
    setMessage("");
    setUserDialog({ userId: item?.id });
  }

  async function requestAccess(
    payload: Record<string, unknown>,
    failure: string,
  ) {
    let token = csrfToken();
    if (!token) {
      const csrf = await fetch("/api/auth/csrf", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!csrf.ok) throw new Error(failure);
      token = (await csrf.json()).csrfToken;
    }
    const response = await fetch("/api/admin/access", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": token,
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok)
      throw new Error(
        response.status === 503 ? failure : (result?.message ?? failure),
      );
    return result;
  }

  async function submitUser() {
    setUserWork("save");
    setDialogError("");
    try {
      const result: AccessData = await requestAccess(
        { action: "saveUser", ...user },
        "บันทึกผู้ใช้ไม่สำเร็จ",
      );
      setData(result);
      if (!userDialog?.userId && sendOnCreate) {
        const linked = result.users.find(
          (item) => item.email === user.email.trim().toLowerCase(),
        );
        if (!linked)
          throw new Error("บันทึกผู้ใช้แล้ว กรุณาเปิดเมนูแก้ไขเพื่อส่งลิงก์");
        try {
          await requestPasswordLink(linked.id);
        } catch {
          openUserDialog(dialogOpener.current, linked);
          setDialogError(
            "บันทึกผู้ใช้แล้ว แต่ส่งลิงก์ไม่สำเร็จ กดส่งลิงก์เพื่อลองใหม่",
          );
          return;
        }
        setMessage("บันทึกผู้ใช้และส่งลิงก์ตั้งรหัสผ่านแล้ว");
      } else {
        setMessage("บันทึกผู้ใช้และ Role แล้ว");
      }
      setUserDialog(null);
    } catch (reason) {
      setDialogError(
        reason instanceof Error ? reason.message : "บันทึกผู้ใช้ไม่สำเร็จ",
      );
    } finally {
      setUserWork(null);
    }
  }

  function requestPasswordLink(userId: string) {
    return requestAccess(
      { action: "sendPasswordSetup", id: userId },
      "ส่งลิงก์ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองใหม่",
    );
  }

  async function sendPasswordLink(userId: string) {
    setUserWork("password");
    setDialogError("");
    try {
      await requestPasswordLink(userId);
      setPasswordSent(true);
    } catch (reason) {
      setDialogError(
        reason instanceof Error
          ? reason.message
          : "ส่งลิงก์ตั้งรหัสผ่านไม่สำเร็จ",
      );
    } finally {
      setUserWork(null);
    }
  }

  async function save(payload: Record<string, unknown>, success: string) {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const result = await requestAccess(payload, "บันทึกสิทธิ์ไม่สำเร็จ");
      updateData(result, success);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "บันทึกสิทธิ์ไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <p className="text-sm text-muted-foreground">กำลังอ่านสิทธิ์ผู้ใช้…</p>
    );

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>
          รหัสผ่านและการยืนยันตัวตนอยู่ที่ Identity Platform
          ส่วนหน้านี้เก็บเฉพาะ UID, สถานะ, Role และ Module ของ Foliar Fertilizer
        </AlertDescription>
      </Alert>
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <p role="status" className="text-sm text-success">
          {message}
        </p>
      )}

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">ผู้ใช้งาน</TabsTrigger>
          <TabsTrigger value="roles">Role และ Module</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-5">
          <div className="flex justify-end">
            <Button
              type="button"
              aria-haspopup="dialog"
              onClick={(event) => openUserDialog(event.currentTarget)}
            >
              <Plus aria-hidden="true" />
              สร้างผู้ใช้
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ผู้ใช้งาน</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium">{item.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.email}
                      </p>
                    </TableCell>
                    <TableCell>
                      {item.roleIds
                        .map(
                          (id) =>
                            data.roles.find((candidate) => candidate.id === id)
                              ?.name,
                        )
                        .filter(Boolean)
                        .join(", ") || "ยังไม่มี Role"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {item.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-haspopup="dialog"
                        aria-label={`แก้ไขผู้ใช้ ${item.displayName}`}
                        onClick={(event) =>
                          openUserDialog(event.currentTarget, item)
                        }
                      >
                        แก้ไข
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {data.users.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      ยังไม่มีผู้ใช้ใน Foliar Fertilizer
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <Dialog
            open={userDialog !== null}
            onOpenChange={(open) => {
              if (!open && !userWork) setUserDialog(null);
            }}
          >
            <DialogContent
              className="max-h-[calc(100dvh-2rem)] overflow-y-auto motion-reduce:animate-none sm:max-w-xl"
              showCloseButton={false}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                dialogOpener.current?.focus();
              }}
            >
              <DialogHeader>
                <DialogTitle>
                  {user.firebaseUid ? "แก้ไขผู้ใช้" : "สร้างผู้ใช้"}
                </DialogTitle>
                <DialogDescription>
                  กำหนดสิทธิ์โรงงานให้บัญชีที่ยืนยันอีเมลแล้วใน Identity
                  Platform
                </DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!userWork && user.roleIds.length > 0) void submitUser();
                }}
              >
                <fieldset disabled={userWork !== null} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="access-user-email">
                        อีเมล Identity Platform
                      </Label>
                      <Input
                        id="access-user-email"
                        type="email"
                        required
                        maxLength={320}
                        value={user.email}
                        onChange={(event) => {
                          setUser({ ...user, email: event.target.value });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="access-user-name">ชื่อที่แสดง</Label>
                      <Input
                        id="access-user-name"
                        required
                        maxLength={120}
                        value={user.displayName}
                        onChange={(event) => {
                          setUser({ ...user, displayName: event.target.value });
                        }}
                      />
                    </div>
                  </div>
                  <fieldset className="space-y-3">
                    <legend className="text-sm font-medium">
                      Role ของผู้ใช้
                    </legend>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {data.roles
                        .filter((item) => item.active)
                        .map((item) => (
                          <label
                            key={item.id}
                            className="flex items-center gap-2 rounded-md border p-3"
                          >
                            <Checkbox
                              checked={user.roleIds.includes(item.id)}
                              onCheckedChange={(checked) => {
                                setUser({
                                  ...user,
                                  roleIds: checked
                                    ? [...user.roleIds, item.id]
                                    : user.roleIds.filter(
                                        (id) => id !== item.id,
                                      ),
                                });
                              }}
                            />
                            <span className="text-sm">{item.name}</span>
                          </label>
                        ))}
                    </div>
                  </fieldset>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={user.active}
                      onCheckedChange={(checked) => {
                        setUser({ ...user, active: checked === true });
                      }}
                    />
                    <span className="text-sm">อนุญาตให้เข้าสู่ระบบ</span>
                  </label>
                </fieldset>
                <section
                  aria-labelledby="access-password-title"
                  className="space-y-2 border-t pt-4"
                >
                  <h3
                    id="access-password-title"
                    className="text-sm font-medium"
                  >
                    ตั้งหรือเปลี่ยนรหัสผ่าน
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    ผู้ใช้จะได้รับลิงก์ที่อีเมลของบัญชีกลางสำหรับตั้งรหัสผ่านด้วยตนเอง
                  </p>
                  {userDialog?.userId ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={userWork !== null || passwordSent}
                      onClick={() => {
                        if (userDialog.userId)
                          void sendPasswordLink(userDialog.userId);
                      }}
                    >
                      {userWork === "password"
                        ? "กำลังส่งลิงก์…"
                        : "ส่งลิงก์ตั้งรหัสผ่าน"}
                    </Button>
                  ) : (
                    <label className="flex min-h-9 items-center gap-2 text-sm">
                      <Checkbox
                        checked={sendOnCreate}
                        disabled={userWork !== null}
                        onCheckedChange={(checked) =>
                          setSendOnCreate(checked === true)
                        }
                      />
                      ส่งลิงก์ตั้งรหัสผ่านหลังบันทึก
                    </label>
                  )}
                  {passwordSent && (
                    <p role="status" className="text-sm text-success">
                      ส่งลิงก์ตั้งรหัสผ่านแล้ว
                    </p>
                  )}
                </section>
                {dialogError && (
                  <Alert variant="destructive" role="alert">
                    <AlertDescription>{dialogError}</AlertDescription>
                  </Alert>
                )}
                <DialogFooter>
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={userWork !== null}
                    >
                      ยกเลิก
                    </Button>
                  </DialogClose>
                  <Button
                    type="submit"
                    disabled={userWork !== null || user.roleIds.length === 0}
                  >
                    {userWork === "save" ? "กำลังบันทึก…" : "บันทึกผู้ใช้"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="roles" className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {data.roles.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant={role.id === item.id ? "secondary" : "outline"}
                onClick={() => {
                  setRole({
                    id: item.id,
                    code: item.code,
                    name: item.name,
                    active: item.active,
                    moduleKeys: [...item.moduleKeys],
                    system: item.system,
                  });
                  setDirty(false);
                  setMessage("");
                }}
              >
                {item.name}
                {item.system && <Badge variant="outline">ระบบ</Badge>}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRole({
                  id: "",
                  code: "",
                  name: "",
                  active: true,
                  moduleKeys: [],
                  system: false,
                });
                setDirty(false);
              }}
            >
              เพิ่ม Role
            </Button>
          </div>

          <form
            className="space-y-4 rounded-lg border bg-card p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save(
                {
                  action: "saveRole",
                  id: role.id || undefined,
                  code: role.code,
                  name: role.name,
                  active: role.active,
                  moduleKeys: role.moduleKeys,
                },
                "บันทึก Role และ Module แล้ว",
              );
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="access-role-code">รหัส Role</Label>
                <Input
                  id="access-role-code"
                  required
                  pattern="[a-z][a-z0-9_]{1,62}"
                  disabled={role.system}
                  value={role.code}
                  onChange={(event) => {
                    setRole({
                      ...role,
                      code: event.target.value.toLowerCase(),
                    });
                    setDirty(true);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="access-role-name">ชื่อ Role</Label>
                <Input
                  id="access-role-name"
                  required
                  maxLength={100}
                  disabled={role.system}
                  value={role.name}
                  onChange={(event) => {
                    setRole({ ...role, name: event.target.value });
                    setDirty(true);
                  }}
                />
              </div>
            </div>
            {modulesByGroup.map(([group, modules]) => (
              <fieldset key={group} className="space-y-2 border-t pt-4">
                <legend className="text-sm font-semibold">{group}</legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {modules.map((module) => (
                    <label
                      key={module.key}
                      className="flex items-start gap-2 rounded-md border p-3"
                    >
                      <Checkbox
                        disabled={role.system || module.key === "settings"}
                        checked={role.moduleKeys.includes(module.key)}
                        onCheckedChange={(checked) => {
                          setRole({
                            ...role,
                            moduleKeys: checked
                              ? [...role.moduleKeys, module.key]
                              : role.moduleKeys.filter(
                                  (key) => key !== module.key,
                                ),
                          });
                          setDirty(true);
                        }}
                      />
                      <span>
                        <span className="block text-sm">{module.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {module.href}
                        </span>
                        {module.key === "settings" && !role.system && (
                          <span className="block text-xs text-muted-foreground">
                            เฉพาะผู้ดูแลระบบ
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            {!role.system && (
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={role.active}
                  onCheckedChange={(checked) => {
                    setRole({ ...role, active: checked === true });
                    setDirty(true);
                  }}
                />
                <span className="text-sm">เปิดใช้งาน Role นี้</span>
              </label>
            )}
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || role.system || !dirty}>
                {role.system
                  ? "Role ระบบแก้ไขไม่ได้"
                  : saving
                    ? "กำลังบันทึก…"
                    : "บันทึก Role"}
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
