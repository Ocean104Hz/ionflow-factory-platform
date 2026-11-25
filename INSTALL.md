# ติดตั้งแพ็กเกจ Ionflow Factory Platform

คู่มือนี้ใช้กับ Windows ผ่าน PowerShell เตรียม Node.js 24 พร้อม npm และเปิด PowerShell ที่โฟลเดอร์ `ionflow-factory-platform` ซึ่งมีไฟล์ `package.json` และ `package-lock.json` จาก Git commit เดียวกัน

## ติดตั้งครั้งแรกหรือหลังอัปเดตแพ็กเกจ

ถ้าเปิด dev server อยู่ ให้หยุดด้วย `Ctrl+C` แล้วรันคำสั่งทีละบรรทัด

```powershell
node --version
npm.cmd --version
npm.cmd ci --include=dev
npm.cmd ls firebase-admin --depth=0
```

`npm ci` ติดตั้งแพ็กเกจทั้งหมดตามเวอร์ชันใน `package-lock.json` รวมถึง Next.js, React, Firebase, PostgreSQL client และเครื่องมือพัฒนา จาก lockfile ปัจจุบัน คำสั่งสุดท้ายควรแสดง `firebase-admin@13.10.0`

## เปิดโปรเจกต์

```powershell
npm.cmd run dev
```

เปิด URL ที่ Next.js แสดงใน PowerShell หากต้องใช้ระบบล็อกอินจริง ให้คัดลอก `.env.example` เป็น `.env.local` หากยังไม่มี แล้วใช้ค่าของสภาพแวดล้อมพัฒนาตาม [คู่มือตั้งค่า Firebase และสิทธิ์](docs/identity-access.md#ขั้นตอนติดตั้งครั้งแรก)

## แก้ปัญหา `Cannot find module 'firebase-admin/app'`

- `firebase-admin/app` และ `firebase-admin/auth` มาจากแพ็กเกจ `firebase-admin` ตัวเดียว ให้รัน `npm.cmd ci --include=dev` ที่โฟลเดอร์โปรเจกต์ แล้วเปิด dev server ใหม่
- ถ้า `npm ci` แจ้งว่าไฟล์แพ็กเกจไม่ตรงกัน ให้ตรวจว่า `package.json` และ `package-lock.json` มาจาก Git commit เดียวกัน แล้วรันอีกครั้ง
- ถ้าเว็บเปิดได้แล้วแต่ VS Code ยังขีดแดง ให้เปิด Command Palette แล้วเลือก `TypeScript: Restart TS Server`
