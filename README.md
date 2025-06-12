# Koyeb Auto Login

## 项目简介

Koyeb Auto Login 是一个自动化脚本，旨在定期登录 Koyeb 账户，以保持账户的活跃状态。该项目部署方式：青龙面板。

## 部署方式

### 青龙面板

1. **在青龙环境变量添加变量**
   | Secret 名称        | 说明                      | 是否必须 |
   | ---------------- | ----------------------- |
   | `KOYEB_ACCOUNTS` | 存储 Koyeb 账户信息，格式为 JSON。✅必须 |
   | `TG_BOT_TOKEN`   | 你的 Telegram Bot Token。 ❌ 可选 |
   | `TG_CHAT_ID`     | 你的 Telegram 账号 ID。    ❌ 可选 |
   | `PUSHPLUS_TOKEN`   | 你的 PUSHPLUS Token。 ❌ 可选 |

✅ 只设置 KOYEB_ACCOUNTS 也能运行，但建议至少设置 PUSHPLUS_TOKEN 或 TG_BOT_TOKEN + TG_CHAT_ID 之一，否则没有通知功能。
   
   **`KOYEB_ACCOUNTS` 格式如下：**
   
   ```json
   [
     {
       "email": "your-email@example.com",
       "password": "your-password"
     },
     {
       "email": "another-email@example.com",
       "password": "another-password"
     }
   ]
   ```

2. **在青龙脚本管理**

   - 创建koyeb.py文件然后复制本项目koyeb.py文件内容保存即可。

3. **在青龙定时任务**

   - 青龙面板添加定时任务 时，填写方式应如下：

   - 项目	填写内容示例
   - 名称	Koyeb定期登录（可以是中文）
   - 命令	task koyeb.py（假设你脚本叫这个）
   - 定时规则	18 12 1,15 * *（每月的第 1 天和第 15 天的中午 12:18 执行）

## 免责声明

本项目仅用于个人学习和研究，使用者需自行承担使用风险。

