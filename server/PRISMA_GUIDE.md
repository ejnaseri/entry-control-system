# ایجاد migration جدید:
npx prisma migrate dev --name add_xxx

# بررسی وضعیت migration‌ها:
npx prisma migrate status

# همگام‌سازی بدون migration (اولویت کم):
npx prisma db push
