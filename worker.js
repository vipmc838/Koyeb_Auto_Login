// ==================== 配置区 ====================
const CONFIG = {
  REQUEST_TIMEOUT: 30000,      // 请求超时（毫秒）
  ACCOUNT_DELAY: 5000,         // 账户间隔（毫秒）
  TIMEZONE: 'Asia/Shanghai',   // 时区
};

// ==================== Telegram 消息发送 ====================
async function sendTGMessage(message, env) {
  const botToken = env.TG_BOT_TOKEN;
  const chatId = env.TG_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn("⚠️ TG_BOT_TOKEN 或 TG_CHAT_ID 未设置，跳过 Telegram 消息发送");
    return null;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const data = {
    chat_id: chatId,
    text: message,
    parse_mode: 'Markdown',
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    console.info("✅ Telegram 消息发送成功");
    return await response.json();
  } catch (e) {
    console.error(`❌ 发送 Telegram 消息失败: ${e.message}`);
    return null;
  }
}

// ==================== Koyeb 登录 ====================
async function loginKoyeb(email, password) {
  if (!email || !password) {
    return [false, "邮箱或密码为空"];
  }

  const loginUrl = 'https://app.koyeb.com/v1/account/login';
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };
  const data = { email: email.trim(), password };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const errorData = await response.json();
          errorMsg += ` - ${errorData.message || JSON.stringify(errorData)}`;
        } else {
          const text = await response.text();
          errorMsg += ` - ${text.substring(0, 100)}`;
        }
      } catch {
        // 忽略解析错误
      }
      return [false, errorMsg];
    }

    return [true, "登录成功"];
  } catch (e) {
    if (e.name === 'AbortError') {
      return [false, "请求超时"];
    }
    return [false, e.message];
  }
}

// ==================== 环境变量验证 ====================
async function validateEnvVariables(env) {
  const koyebAccountsEnv = env.KOYEB_ACCOUNTS;
  if (!koyebAccountsEnv) {
    throw new Error("❌ KOYEB_ACCOUNTS 环境变量未设置");
  }
  
  try {
    const accounts = JSON.parse(koyebAccountsEnv);
    if (!Array.isArray(accounts) || accounts.length === 0) {
      throw new Error("❌ KOYEB_ACCOUNTS 必须是非空数组");
    }
    return accounts;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error("❌ KOYEB_ACCOUNTS JSON 格式无效");
    }
    throw e;
  }
}

// ==================== 主处理逻辑 ====================
async function scheduledEventHandler(env, ctx) {
  try {
    const KOYEB_ACCOUNTS = await validateEnvVariables(env);
    const results = [];
    const currentTime = new Date().toLocaleString('zh-CN', { 
      timeZone: CONFIG.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const totalAccounts = KOYEB_ACCOUNTS.length;
    let successCount = 0;

    console.info(`🚀 开始处理 ${totalAccounts} 个账户...`);

    for (let index = 0; index < totalAccounts; index++) {
      const account = KOYEB_ACCOUNTS[index];
      const email = account.email?.trim();
      const password = account.password;

      if (!email || !password) {
        console.warn(`⚠️ 账户 ${index + 1} 信息不完整，跳过`);
        results.push(`⚠️ 账户 ${index + 1}: 配置不完整\n`);
        continue;
      }

      try {
        console.info(`🔄 [${index + 1}/${totalAccounts}] 处理账户: ${email}`);
        
        // 添加延迟（除了第一个账户）
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, CONFIG.ACCOUNT_DELAY));
        }

        const [success, message] = await loginKoyeb(email, password);
        
        if (success) {
          successCount++;
          console.info(`✅ [${index + 1}/${totalAccounts}] ${email} 登录成功`);
          results.push(`✅ ${email}\n   └─ 登录成功\n`);
        } else {
          console.error(`❌ [${index + 1}/${totalAccounts}] ${email} 登录失败: ${message}`);
          results.push(`❌ ${email}\n   └─ ${message}\n`);
        }
      } catch (e) {
        console.error(`❌ [${index + 1}/${totalAccounts}] ${email} 异常: ${e.message}`);
        results.push(`❌ ${email}\n   └─ 异常: ${e.message}\n`);
      }
    }

    // 生成报告
    const failCount = totalAccounts - successCount;
    const summary = `📊 *执行摘要*\n` +
                   `   • 总计: ${totalAccounts} 个账户\n` +
                   `   • 成功: ${successCount} 个\n` +
                   `   • 失败: ${failCount} 个\n` +
                   `   • 成功率: ${((successCount / totalAccounts) * 100).toFixed(1)}%\n\n`;

    const tgMessage = `🤖 *Koyeb 账户保活报告*\n\n` +
                     `⏰ *检查时间*\n   ${currentTime}\n\n` +
                     summary +
                     `📋 *详细结果*\n${results.join('\n')}` +
                     `\n━━━━━━━━━━━━━━━\n✨ 任务执行完成`;

    console.log("\n" + tgMessage.replace(/\*/g, ''));
    await sendTGMessage(tgMessage, env);

    return {
      success: true,
      total: totalAccounts,
      successCount,
      failCount,
    };

  } catch (e) {
    const errorMessage = `❌ *程序执行出错*\n\n错误信息: ${e.message}\n\n堆栈: \`${e.stack?.substring(0, 200)}\``;
    console.error(errorMessage);
    await sendTGMessage(errorMessage, env);
    throw e;
  }
}

// ==================== Cloudflare Workers 入口 ====================
export default {
  // 定时触发器
  async scheduled(event, env, ctx) {
    ctx.waitUntil(scheduledEventHandler(env, ctx));
  },

  // HTTP 请求处理（可选，用于手动触发）
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 手动触发路径
    if (url.pathname === '/trigger') {
      try {
        const result = await scheduledEventHandler(env, ctx);
        return new Response(JSON.stringify(result, null, 2), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Koyeb Auto Login Worker\n\nEndpoints:\n  /trigger - 手动触发登录任务', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
};
