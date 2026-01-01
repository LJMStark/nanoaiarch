import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db/index.js';
import { user, account } from '../src/db/schema.js';

dotenv.config();

const ADMIN_EMAIL = process.env.ADMIN_EMAILS?.split(',')[0]?.trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_NAME = 'Admin';

async function createAdmin() {
  if (!ADMIN_EMAIL) {
    console.error('❌ 请设置 ADMIN_EMAILS 环境变量');
    process.exit(1);
  }

  console.log('🔄 正在创建/更新管理员账号...');

  const db = await getDb();
  const now = new Date();

  // 检查用户是否存在
  const existing = await db.select().from(user).where(eq(user.email, ADMIN_EMAIL)).limit(1);

  let userId: string;

  if (existing.length > 0) {
    // 用户存在，更新为已验证 + 管理员角色
    userId = existing[0].id;
    console.log('📝 用户已存在，正在更新...');

    await db.update(user)
      .set({
        emailVerified: true,
        role: 'admin',
        updatedAt: now,
      })
      .where(eq(user.id, userId));

    console.log('✅ 用户已更新为管理员');
  } else {
    // 创建新用户
    userId = crypto.randomUUID();

    await db.insert(user).values({
      id: userId,
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      emailVerified: true,
      role: 'admin',
      createdAt: now,
      updatedAt: now,
    });

    console.log('✅ 新用户已创建');
  }

  // 检查/更新密码账号
  const existingAccount = await db.select().from(account)
    .where(eq(account.userId, userId))
    .limit(1);

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  if (existingAccount.length > 0) {
    // 更新现有账号的密码
    await db.update(account)
      .set({
        password: hashedPassword,
        updatedAt: now,
      })
      .where(eq(account.userId, userId));

    console.log('✅ 密码已更新');
  } else {
    // 创建新账号
    await db.insert(account).values({
      id: crypto.randomUUID(),
      userId: userId,
      accountId: userId,
      providerId: 'credential',
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    });

    console.log('✅ 账号已创建');
  }

  console.log('');
  console.log('🎉 管理员设置完成!');
  console.log('📧 邮箱:', ADMIN_EMAIL);
  console.log('🔑 密码:', ADMIN_PASSWORD);
  console.log('');
  console.log('💡 现在可以使用以上凭据登录系统');

  process.exit(0);
}

createAdmin().catch((error) => {
  console.error('❌ 创建失败:', error);
  process.exit(1);
});
