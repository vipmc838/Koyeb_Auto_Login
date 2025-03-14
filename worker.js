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
      headers: {
        'Content-Type': 'application/json',
      },
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

async function loginKoyeb(email, password) {
  if (!email || !password) {
    return [false, "邮箱或密码为空"];
  }

  const loginUrl = 'https://app.koyeb.com/v1/account/login';
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  };
  const data = { email: email.trim(), password };

  try {
    const controller = new AbortController();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => {
        controller.abort();
        reject(new Error("请求超时"));
      }, 30000)
    );

    const fetchPromise = fetch(loginUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (!response.ok) {
      let errorMsg = `HTTP状态码 ${response.status}`;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        errorMsg += ` - ${errorData.message || JSON.stringify(errorData)}`;
      }
      return [false, errorMsg];
    }

    return [true, "登录成功"];
  } catch (e) {
    return [false, e.message];
  }
}

async function validateEnvVariables(env) {
  const koyebAccountsEnv = env.KOYEB_ACCOUNTS;
  if (!koyebAccountsEnv) {
    throw new Error("❌ KOYEB_ACCOUNTS 环境变量未设置或格式错误");
  }
  try {
    return JSON.parse(koyebAccountsEnv);
  } catch {
    throw new Error("❌ KOYEB_ACCOUNTS JSON 格式无效");
  }
}

async function scheduledEventHandler(event, env) {
  try {
    const KOYEB_ACCOUNTS = await validateEnvVariables(env);

    if (!KOYEB_ACCOUNTS || KOYEB_ACCOUNTS.length === 0) {
      throw new Error("❌ 没有找到有效的 Koyeb 账户信息");
    }

    const results = [];
    const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const totalAccounts = KOYEB_ACCOUNTS.length;
    let successCount = 0;

    for (let index = 0; index < totalAccounts; index++) {
      const account = KOYEB_ACCOUNTS[index];
      const email = account.email?.trim();
      const password = account.password;

      if (!email || !password) {
        console.warn(`⚠️ 账户信息不完整，跳过: ${email}`);
        continue;
      }

      try {
        console.info(`🔄 处理账户 ${index + 1}/${totalAccounts}: ${email}`);
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // 5秒间隔
        }

        const [success, message] = await loginKoyeb(email, password);
        if (success) {
          successCount++;
          results.push(`✅ 账户: ${email} 登录成功\n`);
        } else {
          results.push(`❌ 账户: ${email} 登录失败 - ${message}\n`);
        }
      } catch (e) {
        results.push(`❌ 账户: ${email} 登录失败 - 执行异常: ${e.message}\n`);
      }
    }

    if (results.length === 0) {
      throw new Error("❌ 没有任何账户处理结果");
    }

    const summary = `📊 总计: ${totalAccounts} 个账户\n✅ 成功: ${successCount} | ❌ 失败: ${totalAccounts - successCount}\n\n`;
    const tgMessage = `🤖 *Koyeb 登录状态报告*\n⏰ *检查时间:* ${currentTime}\n\n${summary}${results.join('')}`;

    console.log(tgMessage);
    await sendTGMessage(tgMessage, env);

  } catch (e) {
    const errorMessage = `❌ 程序执行出错: ${e.message}`;
    console.error(errorMessage);
    await sendTGMessage(errorMessage, env);
  }
}

addEventListener('scheduled', event => {
  event.waitUntil(scheduledEventHandler(event, event.environment));
});
