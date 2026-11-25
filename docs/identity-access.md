# ระบบ Login และสิทธิ์ Foliar Fertilizer

ระบบนี้แบ่งหน้าที่ชัดเจนเป็นสองส่วน:

- Google Cloud Identity Platform ในโปรเจกต์ `ionflow-central-identity` เก็บบัญชี อีเมล และรหัสผ่าน
- PostgreSQL ฐาน `production` schema `foliar_fertilizer` เก็บ UID, สถานะผู้ใช้, Role และ Module

โปรเจกต์นี้ไม่มี Local Password, development bypass หรือตาราง session ของตัวเองอีกต่อไป

## ขั้นตอนติดตั้งครั้งแรก

1. เปิด Cloud SQL Proxy ที่ `127.0.0.1:5433`
2. คัดลอก `.env.example` เป็น `.env.local` และกรอกค่าที่ขาด
3. ใส่ `FACTORY_DB_OWNER_PASSWORD` ชั่วคราว แล้วรัน `npm run db:migrate:access`
4. รัน `gcloud auth application-default login` เพื่อให้ Firebase Admin SDK ใช้สิทธิ์ผู้พัฒนา
5. ตั้ง `FACTORY_BOOTSTRAP_ADMIN_EMAIL` เป็นบัญชีที่มีอยู่และยืนยันอีเมลแล้วใน Identity Platform
6. รัน `npm run auth:bootstrap-admin` หนึ่งครั้ง
7. ลบ `FACTORY_DB_OWNER_PASSWORD` ออกจาก `.env.local`
8. เปิดแอปและ Login ด้วยบัญชีดังกล่าว จากนั้นจัดการผู้ใช้และ Role ที่หน้า Settings

## ลำดับการ Login

1. Browser ส่งอีเมลและรหัสผ่านตรงไปยัง Identity Platform ผ่าน Firebase Web SDK
2. Browser ส่ง ID Token พร้อม CSRF token ไปที่ `/api/auth/login`
3. Server ตรวจ ID Token ด้วย Firebase Admin SDK และตรวจ UID ใน `foliar_fertilizer.app_users`
4. Server สร้าง Firebase Session Cookie แบบ HttpOnly
5. ทุก request ตรวจ Session Cookie แล้วอ่าน Role/Module ล่าสุดจาก PostgreSQL

## การกำหนดสิทธิ์

- `factory_admin` เป็น Role ระบบ ได้ทุก Module และแก้ mapping ไม่ได้
- `factory_user` เป็น Role ระบบ เริ่มต้นเห็นเฉพาะ Dashboard
- Role ที่สร้างเองเลือก Module ได้จากหน้า Settings
- Sidebar แสดงเฉพาะ Module ที่ผู้ใช้มีสิทธิ์
- API Admin ตรวจ `factory_admin` ฝั่ง Server เสมอ การซ่อนปุ่มหรือเมนูไม่ใช่ตัวป้องกันหลัก
- ระบบไม่อนุญาตให้ปิดหรือถอด Role จากผู้ดูแลคนสุดท้าย

## Cloud Run

กำหนด Cloud SQL connection เป็น
`ionflow-data-prod:asia-southeast3:ionflow-central-postgres` และให้ Service Account ของ Cloud Run มีสิทธิ์เชื่อม Cloud SQL และตรวจ Identity Platform จากนั้นเก็บ `FACTORY_DB_PASSWORD` ใน Secret Manager ไม่ใส่ใน image หรือ Git
